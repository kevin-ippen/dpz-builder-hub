"""Barebones feeds crawler — crawl / ingest / bronze.

Replicates the ingest layer of the feeds-intelligence pipeline.
No LLM processing. Just RSS parsing, page fetching, and bronze table writes.

Feed sources:
  - Databricks Blog (sitemap XML → article URLs)
  - Azure Databricks Release Notes (Atom feed)
  - Databricks YouTube (Atom feed)

Bronze table: {catalog}.{schema}.content_raw
  Mirrors the feeds_bronze.content_raw schema from the main pipeline.

Usage:
  As a Databricks notebook (scheduled via Lakeflow Jobs):
    %pip install feedparser trafilatura
    from pipeline.feeds_crawler import run_crawl
    run_crawl(spark)  # uses defaults

  Or with overrides:
    run_crawl(spark, catalog="my_cat", schema="my_schema", max_items=50)
"""

import hashlib
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger("feeds_crawler")

# ─── Feed registry ────────────────────────────────────────────────────

FEED_SOURCES = [
    {
        "name": "Databricks Blog",
        "url": "https://www.databricks.com/en-blog-assets/sitemap/sitemap-0.xml",
        "source_type": "blog",
        "parser": "sitemap",  # XML sitemap, not RSS
    },
    {
        "name": "Azure DB Release Notes",
        "url": "https://learn.microsoft.com/en-us/azure/databricks/feed.xml",
        "source_type": "release_notes",
        "parser": "atom",
    },
    {
        "name": "Databricks YouTube",
        "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC3q8O3Bh2Le8Rj1-Q-_UUbA",
        "source_type": "video",
        "parser": "atom",
    },
]

# ─── Defaults ─────────────────────────────────────────────────────────

DEFAULT_CATALOG = "serverless_stable_h7wanf_catalog"
DEFAULT_SCHEMA = "dpz_feeds_bronze"
DEFAULT_TABLE = "content_raw"
DEFAULT_MAX_ITEMS = 200  # per source, per run
FETCH_TIMEOUT = 15


# ─── Helpers ──────────────────────────────────────────────────────────

def _item_id(source_name: str, guid: str) -> str:
    """Deterministic SHA-256 from source + guid."""
    return hashlib.sha256(f"{source_name}:{guid}".encode()).hexdigest()


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_html(text: Optional[str]) -> str:
    """Strip HTML tags for a rough plain-text fallback."""
    if not text:
        return ""
    return re.sub(r"<[^>]+>", " ", text).strip()[:2000]


# ─── Parsers ──────────────────────────────────────────────────────────

def _parse_sitemap(xml_text: str, source: dict, max_items: int) -> list[dict]:
    """Parse a Databricks blog sitemap XML into raw items."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        logger.warning(f"Sitemap parse error for {source['name']}: {e}")
        return []

    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    for url_elem in root.findall(".//s:url", ns)[:max_items]:
        loc = url_elem.findtext("s:loc", "", ns).strip()
        lastmod = url_elem.findtext("s:lastmod", "", ns).strip()
        if not loc or "/blog/" not in loc:
            continue
        # Derive title from URL slug
        slug = loc.rstrip("/").split("/")[-1]
        title = slug.replace("-", " ").title()
        items.append({
            "item_id": _item_id(source["name"], loc),
            "source_name": source["name"],
            "source_type": source["source_type"],
            "feed_url": source["url"],
            "rss_title": title,
            "rss_description": None,
            "rss_link": loc,
            "rss_pub_date": lastmod or None,
            "rss_guid": loc,
            "rss_categories": None,
            "rss_author": None,
            "raw_html": None,
            "raw_text": None,
            "fetch_status": "pending",
            "ingested_at": _now_utc(),
            "fetched_at": None,
            "canonical_title": None,
            "canonical_url": loc,
            "image_url": None,
            "image_alt": None,
            "site_name": "Databricks Blog",
        })
    return items


def _parse_atom(xml_text: str, source: dict, max_items: int) -> list[dict]:
    """Parse an Atom/RSS feed into raw items."""
    try:
        import feedparser
    except ImportError:
        logger.error("feedparser not installed — pip install feedparser")
        return []

    feed = feedparser.parse(xml_text)
    items = []
    for entry in feed.entries[:max_items]:
        link = entry.get("link", "")
        guid = entry.get("id") or link
        title = entry.get("title", "")
        pub = entry.get("published") or entry.get("updated", "")
        summary = entry.get("summary", "")
        author = entry.get("author", "")
        categories = [t.get("term", "") for t in entry.get("tags", []) if t.get("term")]

        items.append({
            "item_id": _item_id(source["name"], guid),
            "source_name": source["name"],
            "source_type": source["source_type"],
            "feed_url": source["url"],
            "rss_title": title[:500] if title else None,
            "rss_description": _clean_html(summary)[:2000] if summary else None,
            "rss_link": link,
            "rss_pub_date": pub or None,
            "rss_guid": guid,
            "rss_categories": categories or None,
            "rss_author": author or None,
            "raw_html": None,
            "raw_text": None,
            "fetch_status": "pending",
            "ingested_at": _now_utc(),
            "fetched_at": None,
            "canonical_title": title[:500] if title else None,
            "canonical_url": link,
            "image_url": None,
            "image_alt": None,
            "site_name": source["name"],
        })
    return items


# ─── Page fetcher ─────────────────────────────────────────────────────

def _fetch_page(url: str) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Fetch a page and extract text + metadata.
    Returns (raw_text, canonical_title, image_url, image_alt, site_name).
    """
    import requests
    try:
        import trafilatura
    except ImportError:
        logger.warning("trafilatura not installed — skipping page fetch")
        return None, None, None, None, None

    try:
        resp = requests.get(url, timeout=FETCH_TIMEOUT, headers={
            "User-Agent": "DPZ-Builder-Hub-Crawler/1.0"
        })
        if resp.status_code != 200:
            return None, None, None, None, None
        html = resp.text
    except Exception:
        return None, None, None, None, None

    # Extract main text
    raw_text = trafilatura.extract(html, include_comments=False, include_tables=False) or ""

    # Extract metadata from HTML
    title = None
    image_url = None
    image_alt = None
    site_name = None

    # og:title
    m = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\'>]+)', html)
    if m:
        title = m.group(1).strip()[:500]
    # og:image
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\'>]+)', html)
    if m:
        image_url = m.group(1).strip()
    # og:site_name
    m = re.search(r'<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\'>]+)', html)
    if m:
        site_name = m.group(1).strip()

    return raw_text[:10000], title, image_url, image_alt, site_name


# ─── Main crawl ───────────────────────────────────────────────────────

def run_crawl(
    spark,
    catalog: str = DEFAULT_CATALOG,
    schema: str = DEFAULT_SCHEMA,
    table: str = DEFAULT_TABLE,
    max_items: int = DEFAULT_MAX_ITEMS,
    fetch_pages: bool = True,
    fetch_limit: int = 50,
    sources: Optional[list[dict]] = None,
):
    """Run the full crawl/ingest/bronze pipeline.

    1. Fetch RSS/sitemap XML for each source
    2. Parse into raw items
    3. Optionally fetch linked pages (trafilatura)
    4. Deduplicate against existing bronze table
    5. Append new items to Delta bronze table

    Args:
        spark: SparkSession
        catalog: UC catalog name
        schema: UC schema name
        table: Bronze table name
        max_items: Max items per feed source
        fetch_pages: Whether to fetch linked page content
        fetch_limit: Max pages to fetch per run (rate limiting)
        sources: Override feed sources list (default: FEED_SOURCES)
    """
    import requests
    from pyspark.sql import Row
    from pyspark.sql.types import (
        StructType, StructField, StringType, TimestampType, ArrayType,
    )

    feed_sources = sources or FEED_SOURCES
    fqn = f"{catalog}.{schema}.{table}"

    logger.info(f"Starting crawl → {fqn} ({len(feed_sources)} sources, max {max_items}/source)")

    # ── Ensure schema + table exist ──
    spark.sql(f"CREATE SCHEMA IF NOT EXISTS {catalog}.{schema}")
    spark.sql(f"""
        CREATE TABLE IF NOT EXISTS {fqn} (
            item_id STRING NOT NULL COMMENT 'SHA-256 of source_name + guid/link',
            source_name STRING,
            source_type STRING COMMENT 'blog | release_notes | video',
            feed_url STRING,
            rss_title STRING,
            rss_description STRING,
            rss_link STRING,
            rss_pub_date TIMESTAMP,
            rss_guid STRING,
            rss_categories ARRAY<STRING>,
            rss_author STRING,
            raw_html STRING COMMENT 'Full HTML of linked page',
            raw_text STRING COMMENT 'Extracted main text content',
            fetch_status STRING COMMENT 'pending | fetched | failed',
            ingested_at TIMESTAMP,
            fetched_at TIMESTAMP,
            canonical_title STRING COMMENT 'Display-ready title from og:title or feed',
            canonical_url STRING COMMENT 'Normalized source URL',
            image_url STRING COMMENT 'Best OG/Twitter image discovered at crawl time',
            image_alt STRING,
            site_name STRING COMMENT 'Publisher label from OG metadata'
        )
        USING DELTA
        COMMENT 'Bronze: raw RSS/sitemap items + fetched page content'
    """)

    # ── Get existing item_ids for dedup ──
    existing_ids = set()
    try:
        rows = spark.sql(f"SELECT item_id FROM {fqn}").collect()
        existing_ids = {r["item_id"] for r in rows}
        logger.info(f"Existing bronze items: {len(existing_ids)}")
    except Exception:
        pass

    # ── Fetch + parse each feed ──
    all_items: list[dict] = []
    for source in feed_sources:
        logger.info(f"Fetching {source['name']}: {source['url']}")
        try:
            resp = requests.get(source["url"], timeout=30, headers={
                "User-Agent": "DPZ-Builder-Hub-Crawler/1.0"
            })
            if resp.status_code != 200:
                logger.warning(f"  HTTP {resp.status_code} for {source['name']}")
                continue
            xml_text = resp.text
        except Exception as e:
            logger.warning(f"  Fetch failed for {source['name']}: {e}")
            continue

        parser = source.get("parser", "atom")
        if parser == "sitemap":
            items = _parse_sitemap(xml_text, source, max_items)
        else:
            items = _parse_atom(xml_text, source, max_items)

        # Dedup
        new_items = [i for i in items if i["item_id"] not in existing_ids]
        logger.info(f"  {source['name']}: {len(items)} parsed, {len(new_items)} new")
        all_items.extend(new_items)

    if not all_items:
        logger.info("No new items to ingest.")
        return {"ingested": 0, "fetched": 0, "sources": len(feed_sources)}

    # ── Optional: fetch page content ──
    fetched_count = 0
    if fetch_pages:
        for item in all_items[:fetch_limit]:
            url = item.get("rss_link") or item.get("canonical_url")
            if not url:
                continue
            raw_text, title, img_url, img_alt, site = _fetch_page(url)
            if raw_text:
                item["raw_text"] = raw_text[:10000]
                item["fetch_status"] = "fetched:trafilatura"
                item["fetched_at"] = _now_utc()
                if title:
                    item["canonical_title"] = title
                if img_url:
                    item["image_url"] = img_url
                if img_alt:
                    item["image_alt"] = img_alt
                if site:
                    item["site_name"] = site
                fetched_count += 1
            else:
                item["fetch_status"] = "failed"
                item["fetched_at"] = _now_utc()

    # ── Write to Delta ──
    # Convert to temp view + INSERT INTO (serverless-safe)
    bronze_schema = StructType([
        StructField("item_id", StringType()),
        StructField("source_name", StringType()),
        StructField("source_type", StringType()),
        StructField("feed_url", StringType()),
        StructField("rss_title", StringType()),
        StructField("rss_description", StringType()),
        StructField("rss_link", StringType()),
        StructField("rss_pub_date", StringType()),  # cast below
        StructField("rss_guid", StringType()),
        StructField("rss_categories", ArrayType(StringType())),
        StructField("rss_author", StringType()),
        StructField("raw_html", StringType()),
        StructField("raw_text", StringType()),
        StructField("fetch_status", StringType()),
        StructField("ingested_at", StringType()),  # cast below
        StructField("fetched_at", StringType()),  # cast below
        StructField("canonical_title", StringType()),
        StructField("canonical_url", StringType()),
        StructField("image_url", StringType()),
        StructField("image_alt", StringType()),
        StructField("site_name", StringType()),
    ])

    rows = [Row(**item) for item in all_items]
    df = spark.createDataFrame(rows, schema=bronze_schema)
    df.createOrReplaceTempView("_feeds_bronze_staging")

    spark.sql(f"""
        INSERT INTO {fqn}
        SELECT
            item_id, source_name, source_type, feed_url,
            rss_title, rss_description, rss_link,
            CAST(rss_pub_date AS TIMESTAMP) AS rss_pub_date,
            rss_guid, rss_categories, rss_author,
            raw_html, raw_text, fetch_status,
            CAST(ingested_at AS TIMESTAMP) AS ingested_at,
            CAST(fetched_at AS TIMESTAMP) AS fetched_at,
            canonical_title, canonical_url, image_url, image_alt, site_name
        FROM _feeds_bronze_staging
    """)

    result = {
        "ingested": len(all_items),
        "fetched": fetched_count,
        "sources": len(feed_sources),
        "table": fqn,
    }
    logger.info(f"Crawl complete: {result}")
    return result

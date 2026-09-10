"""Feeds pipeline configuration.

Centralized table references and feed sources. Point these at your existing
infra or spin up fresh tables for a new instance.

Override via environment variables or edit defaults below.
"""

import os

# ── UC catalog ────────────────────────────────────────────────────────
CATALOG = os.getenv("DPZ_FEEDS_CATALOG", "")

# ── Bronze layer (crawler output) ────────────────────────────────────
# Set BRONZE_TABLE to point at an existing bronze table, or leave default
# to create a fresh one on first crawl run.
BRONZE_SCHEMA = os.getenv("DPZ_FEEDS_BRONZE_SCHEMA", "feeds_bronze")
BRONZE_TABLE  = os.getenv("DPZ_FEEDS_BRONZE_TABLE",  "content_raw")
BRONZE_FQN    = f"{CATALOG}.{BRONZE_SCHEMA}.{BRONZE_TABLE}"

# ── Gold layer (enriched, used by sync-feeds endpoint) ───────────────
GOLD_SCHEMA = os.getenv("DPZ_FEEDS_GOLD_SCHEMA", "feeds_gold")
GOLD_TABLE  = os.getenv("DPZ_FEEDS_GOLD_TABLE",  "content_search_source")
GOLD_FQN    = f"{CATALOG}.{GOLD_SCHEMA}.{GOLD_TABLE}"

# ── SQL warehouse (for sync-feeds endpoint) ──────────────────────────
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "")

# ── RSS/sitemap feed sources (used by crawler) ───────────────────────
FEED_SOURCES = [
    {
        "name": "Databricks Blog",
        "url": "https://www.databricks.com/en-blog-assets/sitemap/sitemap-0.xml",
        "source_type": "blog",
        "parser": "sitemap",
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

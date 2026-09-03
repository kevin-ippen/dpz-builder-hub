# Databricks notebook source
# COMMAND ----------
# MAGIC %md
# MAGIC # DPZ Feeds Crawler — Bronze Ingest
# MAGIC
# MAGIC Barebones RSS/sitemap crawler for Platform Pulse.
# MAGIC Runs on serverless. No LLM processing.
# MAGIC
# MAGIC **Sources**: Databricks Blog, Azure Release Notes, Databricks YouTube
# MAGIC
# MAGIC **Target**: `serverless_stable_h7wanf_catalog.dpz_feeds_bronze.content_raw`

# COMMAND ----------
# MAGIC %pip install feedparser trafilatura -q
# MAGIC dbutils.library.restartPython()

# COMMAND ----------
import logging
import sys

# Add pipeline directory to path
sys.path.insert(0, "/Workspace/Users/kevin.ippen@databricks.com/dpz-builder-hub/src/pipeline")

from feeds_crawler import run_crawl
from config import BRONZE_FQN

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

# COMMAND ----------
# Uses defaults from pipeline/config.py — override via env vars:
#   DPZ_FEEDS_CATALOG, DPZ_FEEDS_BRONZE_SCHEMA, DPZ_FEEDS_BRONZE_TABLE
result = run_crawl(
    spark,
    max_items=200,
    fetch_pages=True,
    fetch_limit=50,
)

print(f"Done: {result}")

# COMMAND ----------
# Quick stats
df = spark.sql(f"""
    SELECT source_name, source_type,
           COUNT(*) as total,
           SUM(CASE WHEN fetch_status LIKE 'fetched%' THEN 1 ELSE 0 END) as fetched,
           MAX(CAST(ingested_at AS DATE)) as last_ingested
    FROM {BRONZE_FQN}
    GROUP BY source_name, source_type
    ORDER BY total DESC
""")
df.show(truncate=False)

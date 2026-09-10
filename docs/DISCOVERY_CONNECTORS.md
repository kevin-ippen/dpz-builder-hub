# Discovery Connectors — Design Document

> Status: **Planning** | Priority: Phase 1 = UC Scanner

## Overview

Discovery connectors automatically populate the Builder Hub asset catalog from external sources. Each connector is:

- **Settings-toggled**: enable/disable from the Settings page
- **Background-synced**: runs on a schedule or on-demand trigger
- **Idempotent**: re-running a sync updates existing records, doesn't duplicate
- **Source-tagged**: every imported asset carries its connector origin for provenance

---

## Connector Registry

### Phase 1: Unity Catalog Scanner

**Purpose**: Discover tables, views, functions, models, and volumes in the customer's UC catalogs. Auto-register them as assets with metadata (schema, owner, tags, description).

**How it works**:
1. User configures which catalogs/schemas to scan in Settings
2. Scanner queries `information_schema.tables`, `information_schema.columns`, etc.
3. Results are matched against existing assets (by FQN) — new ones created, existing ones updated
4. Column-level metadata, tags, and ownership pulled from UC system tables

**API**:
- `POST /api/connectors/uc-scanner/sync` — trigger a scan
- `GET /api/connectors/uc-scanner/status` — last sync time, counts
- `PUT /api/connectors/uc-scanner/config` — set catalogs, schemas, filters

**Env vars**:
- `CONNECTOR_UC_SCANNER=true|false`
- `CONNECTOR_UC_SCANNER_CATALOGS=catalog1,catalog2` (comma-separated)
- `CONNECTOR_UC_SCANNER_EXCLUDE_SCHEMAS=information_schema,__databricks_internal`

---

### Phase 2: Confluence Connector

**Purpose**: Import Confluence pages as Learn content or asset documentation. Teams document data products in Confluence — this bridges that knowledge into the hub.

**How it works**:
1. User provides Confluence base URL + API token in Settings
2. Connector queries Confluence REST API for spaces/pages matching configured labels
3. Pages become Learn items (channel=team) or are linked to existing assets by title match

**API**:
- `POST /api/connectors/confluence/sync`
- `PUT /api/connectors/confluence/config` — base URL, spaces, labels, API token

**Env vars**:
- `CONNECTOR_CONFLUENCE=true|false`
- `CONNECTOR_CONFLUENCE_BASE_URL`
- `CONNECTOR_CONFLUENCE_SPACES=DATA,ANALYTICS` (comma-separated space keys)

---

### Phase 3: Git Repository Scanner

**Purpose**: Scan Git repositories for README files, dbt models, SQL files, and project metadata. Auto-enrich assets with documentation from source repos.

**How it works**:
1. User configures repo URLs (GitHub/GitLab) + access tokens
2. Scanner clones/pulls repos, parses README.md, dbt `schema.yml`, SQL files
3. Matched to assets by naming convention or explicit `builder-hub.yaml` manifest in repo root

**Env vars**:
- `CONNECTOR_GIT=true|false`
- `CONNECTOR_GIT_REPOS=https://github.com/org/repo1,https://github.com/org/repo2`

---

### Phase 4: JIRA Importer

**Purpose**: Import JIRA issues tagged with specific labels as Wishlist demands. Teams already track data requests in JIRA — this surfaces them in the hub's demand board.

**How it works**:
1. User configures JIRA base URL, project key, JQL filter
2. Importer queries JIRA REST API for matching issues
3. Issues become Wishlist demands with status mapping (Open→open, In Progress→claimed, Done→shipped)

**Env vars**:
- `CONNECTOR_JIRA=true|false`
- `CONNECTOR_JIRA_BASE_URL`
- `CONNECTOR_JIRA_PROJECT=DATA`
- `CONNECTOR_JIRA_JQL=label = builder-hub`

---

## Shared Architecture

```
backend/src/connectors/
├── __init__.py          # Connector registry
├── base.py              # BaseConnector ABC (sync, status, config)
├── uc_scanner.py        # Phase 1
├── confluence.py         # Phase 2
├── git_scanner.py        # Phase 3
└── jira_importer.py      # Phase 4

backend/src/routes/
└── connector_routes.py   # /api/connectors/{name}/{action}
```

**BaseConnector** interface:
```python
class BaseConnector(ABC):
    name: str
    enabled: bool  # from env var
    
    @abstractmethod
    async def sync(self, config: dict) -> SyncResult: ...
    
    @abstractmethod
    async def get_status(self) -> ConnectorStatus: ...
```

**SyncResult** contains: `created`, `updated`, `skipped`, `errors`, `duration_seconds`.

All connectors store their last sync state in a `connector_sync_log` table (connector_name, started_at, finished_at, result_json).

---

## Settings UI

The Settings page gets a **Connectors** tab:

- Card per connector showing enabled/disabled toggle, last sync time, sync counts
- "Sync Now" button for on-demand trigger
- Configuration form (catalogs, URLs, tokens) per connector
- Sync history log with expandable error details

---

## Implementation Priority

1. **UC Scanner** — highest value, no external dependencies, uses existing SQL warehouse
2. **Confluence** — common enterprise pattern, moderate effort
3. **Git Scanner** — valuable for engineering teams, needs token management
4. **JIRA** — nice-to-have, bridges existing workflows

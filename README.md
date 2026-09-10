# Builder Hub

A modular data product management platform for Databricks. Organize, govern, and deliver data assets with built-in maturity tracking, compliance automation, and team collaboration.

Runs as a **Databricks App** backed by **Lakebase** (managed PostgreSQL).

## Deploy in 15 Minutes

### 1. Create the App

```bash
databricks apps create builder-hub
```

### 2. Provision Resources

The app needs four resources. Provision them in the Databricks UI or via CLI:

| Resource | Type | Purpose |
|----------|------|--------|
| **Lakebase** | PostgreSQL (Autoscale) | App metadata store |
| **SQL Warehouse** | Serverless | Unity Catalog queries |
| **Serving Endpoint** | Foundation Model | AI-assisted reviews (optional) |
| **UC Volume** | WRITE_VOLUME | File storage |

See `src/manifest.yaml` for the full resource spec.

### 3. Configure `app.yaml`

Edit `src/app.yaml`:

```yaml
env:
  # REQUIRED: Set your Lakebase endpoint
  - name: "ENDPOINT_NAME"
    value: "projects/YOUR_PROJECT/branches/production/endpoints/primary"
  - name: "LAKEBASE_INSTANCE_NAME"
    value: "projects/YOUR_PROJECT/branches/production/endpoints/primary"

  # Schema name (will be auto-created on first boot)
  - name: "PGSCHEMA"
    value: "app_data"
  - name: "PGOPTIONS"
    value: "-c search_path=app_data,public"
```

### 4. Deploy

```bash
databricks apps deploy builder-hub \
  --source-code-path /Workspace/Users/<you>/builder-hub/src
```

### 5. Load Demo Data

Open the app, go to **Settings**, and click **Load Demo Data** with the `retail` preset. This populates assets, wishlist items, capabilities, and learn content.

---

## Module System

Every feature area is controlled by an environment variable. Set any to `false` in `app.yaml` to disable:

| Module | Env Var | Default | What It Controls |
|--------|---------|---------|------------------|
| Explore | `MODULE_EXPLORE` | on | Browse assets by type, maturity, domain |
| Lab | `MODULE_LAB` | on | Pre-production experimental builds |
| Learn | `MODULE_LEARN` | on | Blogs, release notes, skill tracks |
| Portfolio | `MODULE_PORTFOLIO` | on | User's personal asset portfolio |
| Wishlist | `MODULE_WISHLIST` | on | Demand board — upvote, claim, ship |
| Dashboard | `MODULE_DASHBOARD` | on | Portfolio health and adoption signals |
| MCP | `MODULE_MCP` | on | Model Context Protocol server |
| Compliance | `MODULE_COMPLIANCE` | on | Policy DSL engine and automated checks |
| Contracts | `MODULE_CONTRACTS` | on | ODCS data contracts |
| Semantic | `MODULE_SEMANTIC` | on | Ontology and semantic models |
| Pipeline | `MODULE_PIPELINE` | **off** | Blog/release-note feed scraper (opt-in) |

Disabled modules hide from the nav, home page, and quick actions. The backend skips their startup tasks.

---

## Architecture

```
src/
├── app.yaml              # Databricks App config (env vars, command)
├── manifest.yaml         # Resource requirements (Lakebase, warehouse, endpoint, volume)
├── backend/              # Python — FastAPI + SQLAlchemy + Alembic
│   ├── src/
│   │   ├── app.py        # Entrypoint, startup lifecycle, seed logic
│   │   ├── common/       # Config, DB engine, auth, middleware
│   │   ├── controller/   # Business logic managers
│   │   ├── db_models/    # SQLAlchemy ORM models
│   │   ├── models/       # Pydantic API schemas
│   │   ├── repositories/ # DB access layer
│   │   ├── routes/       # API endpoints
│   │   └── data/         # Demo SQL, seed JSON, YAML configs
│   └── alembic/          # Database migrations
├── frontend/             # React + TypeScript + Vite
│   └── src/
│       ├── views/        # Page components
│       ├── components/   # UI library (Shadcn + custom)
│       ├── hooks/        # useApi, useModules, useTeams, ...
│       ├── config/       # features.ts (module registry)
│       └── stores/       # Zustand state
└── pipeline/             # Optional feeds crawler (MODULE_PIPELINE)
```

**Auth**: Databricks Apps OAuth. Service principal auto-provisioned.
**Database**: Lakebase (PostgreSQL). Schema created on first boot via Alembic migrations.
**Frontend build**: Vite builds to `static/`, served by FastAPI.

---

## Local Development

### Prerequisites

- Python 3.10–3.12, Node.js 18+, Hatch, PostgreSQL

### Setup

```bash
git clone <repo-url> && cd builder-hub

# Frontend
cd src/frontend && npm install

# Backend
cd ../backend && cp .env.example .env
# Edit .env: set POSTGRES_HOST, DATABRICKS_HOST, etc.
```

### Run

```bash
# Terminal 1: Frontend (port 3000)
cd src/frontend && npm run dev:frontend

# Terminal 2: Backend (port 8000)
cd src && hatch -e dev run dev-backend
```

---

## Customization

### Branding

Set env vars in `app.yaml` or `.env`:

| Variable | Purpose |
|----------|--------|
| `UI_APP_DISPLAY_NAME` | App name in header/title |
| `UI_APP_SHORT_NAME` | Abbreviated name for compact UI |
| `UI_CUSTOM_LOGO_URL` | Logo image URL |
| `UI_FAVICON_URL` | Favicon URL |
| `UI_CUSTOM_CSS` | Injected CSS for theme overrides |

### Demo Data

Presets in `backend/src/data/`:

| Preset | File | Description |
|--------|------|------------|
| `retail` | `demo_data_retail.sql` | Retail vertical (default) |
| `hls` | `demo_data_hls.sql` | Healthcare & Life Sciences |
| `fsi` | `demo_data_fsi.sql` | Financial Services |
| `mfg` | `demo_data_mfg.sql` | Manufacturing |
| `auto` | `demo_data_auto.sql` | Automotive |

### Feeds Pipeline (opt-in)

Set `MODULE_PIPELINE=true` and configure:

```yaml
- name: "DPZ_FEEDS_CATALOG"
  value: "your_catalog"
- name: "MODULE_PIPELINE"
  value: "true"
```

The pipeline scrapes Databricks blog, Azure release notes, and YouTube into the Learn hub.

---

## Standards

- [ODCS](https://github.com/bitol-io/open-data-contract-standard) — Open Data Contract Standard (v3.1.0)
- [ODPS](https://github.com/bitol-io/open-data-product-standard) — Open Data Product Specification
- [MCP](https://modelcontextprotocol.io/) — Model Context Protocol for AI integration

## Documentation

| Document | Description |
|----------|------------|
| [Configuring](CONFIGURING.md) | All env vars, DB setup, deployment |
| [User Guide](src/docs/USER-GUIDE.md) | End-user guide |
| [Compliance DSL](src/docs/compliance-dsl-guide.md) | Writing governance rules |
| [Contributing](CONTRIBUTING.md) | Dev setup, commits, releases |

## License

See [LICENSE.txt](LICENSE.txt) for details.

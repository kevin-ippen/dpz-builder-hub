# Builder Hub

<img width="1672" height="941" alt="builder_hub" src="https://github.com/user-attachments/assets/28582860-60ec-49b6-8cfd-d33236f68b72" />

You have hundreds of tables, models, dashboards, and pipelines in Unity Catalog. What you don't have is a way to answer the questions that actually matter:

- *"What production-ready assets do we have for demand forecasting?"*
- *"Three teams are building customer segmentation — did anyone check if one already exists?"*
- *"Leadership wants real-time inventory visibility. Who's working on it? Is it close?"*
- *"Jordan built something great last quarter. How do we make sure people know about it?"*

Builder Hub doesn't replace Unity Catalog. It sits on top of it and adds the **human layer**: who owns what, how mature is it, what does the business actually need next, and who deserves credit for shipping it.

---


## The Core Idea

Unity Catalog manages **technical objects** — tables, views, functions, models. Builder Hub manages the **organizational context** around those objects: ownership, maturity, demand signals, capability mapping, and the lifecycle from rough idea to trusted production asset.

Nothing moves. Nothing migrates. Your tables stay in UC. Your dashboards stay in your workspace. Builder Hub is a lightweight coordination layer that makes the invisible work visible.

---

## Why This Matters

### The problem with organic growth

Every data team hits the same scaling wall. In the early days, everyone knows what exists because the team is small. But as you grow:

- **Duplicate work multiplies quietly.** Two analysts build nearly identical churn models in different catalogs. Neither knows the other exists. Both get halfway to production before someone notices.

- **Good work disappears.** Someone builds an excellent feature store for demand forecasting. They present it once in a team meeting. Six months later, a new hire builds it again from scratch because there's no way to discover it.

- **Leadership can't prioritize.** Stakeholders submit requests through Slack, email, JIRA, and hallway conversations. There's no single view of "what does the business need most?" so the loudest voice wins.

- **Hero culture takes root.** The developer who builds the most things gets the most visibility — regardless of whether those things solve real business problems, duplicate existing work, or meet any quality standard. Speed is rewarded over sustainability.

- **Solution architects fly blind.** When a new initiative kicks off, the SA has no way to inventory existing capabilities. Every engagement starts from zero: "What do we have? What do we need? What's the gap?" — answered through tribal knowledge and stale spreadsheets.

Builder Hub is designed to fix all of these problems without adding bureaucracy.

---

## How It Works

<img width="1938" height="1189" alt="Screenshot 2026-09-11 at 3 15 22 PM" src="https://github.com/user-attachments/assets/06d83a3e-69b0-4892-acba-f3082edac3a0" />

### 1. Register what exists (Explore)

Assets in Builder Hub are **pointers to things that already exist** in your Databricks workspace — UC tables, ML models, dashboards, notebooks, pipelines. Registration is lightweight: you're adding context (owner, description, capabilities, domain) to something that already has a technical home.

This means adoption is incremental. You don't need to register everything on day one. Start with the 20 assets your team uses most. The catalog grows organically as people contribute.

<img width="736" height="1104" alt="Screenshot 2026-09-11 at 3 16 16 PM" src="https://github.com/user-attachments/assets/2e2038f5-b2b9-4a95-93cd-adbd62f9bc14" />


### 2. Track maturity (5-Level Model)

Every asset progresses through a maturity ladder with **automated, policy-driven gates**:

| Level | Name | What It Means | Gate Examples |
|-------|------|---------------|---------------|
| 1 | **Accessible** | It can be found and someone owns it | Owner assigned, name defined |
| 2 | **Described** | Purpose and usage are documented | Description present, tags assigned |
| 3 | **Defined** | Business meaning is established | Business terms linked, lineage defined |
| 4 | **Monitored** | Quality is actively tracked | Quality checks active |
| 5 | **Trusted** | Certified, governed, production-ready | Certification earned, contracts in place |

Gates are evaluated automatically via a compliance DSL. An asset at Level 3 means it's described, owned, and connected to business terminology — not because someone checked a box, but because the system verified it.

This replaces the common anti-pattern where "production" means "someone deployed it on a Friday and it hasn't broken yet." In Builder Hub, production means something earned and verifiable.
![Uploading Screenshot 2026-09-11 at 3.16.16 PM.png…]()

### 3. Surface demand (Wishlist)

<img width="1201" height="963" alt="Screenshot 2026-09-11 at 3 16 30 PM" src="https://github.com/user-attachments/assets/43582e9a-4517-402b-95ba-ed02b6e1cf5e" />

The Wishlist is a **demand board** where anyone in the organization can submit what they need built. It's not a suggestion box — it's a prioritization engine.

**How it works:**
- Anyone posts a demand: *"We need store-level demand forecasts at daily granularity"*
- The demand is tagged with **capabilities** it would deliver (e.g., `demand-forecasting`, `store-operations`)
- Others upvote to signal they need the same thing
- When total votes cross a threshold, it surfaces to solution architects and team leads
- A builder **claims** the demand, making their intent visible before they write a line of code
- When they ship it, the demand moves to **shipped** — with a direct link to the asset that fulfilled it

**Why this changes behavior:**

- **Before building, you check the board.** Is someone already working on this? Has it already been shipped? This simple friction point prevents the most expensive kind of waste: duplicate projects that run for weeks before discovery.

- **Credit flows to demand fulfillment.** The dashboard shows who shipped solutions to real business needs — not who built the most things. This rewards impact over output.

- **Leadership sees the backlog in capability terms.** Not "we have 47 open JIRA tickets" but "we have 12 unfulfilled demands in real-time analytics and 2 in compliance reporting." That's a conversation executives can act on.

- **Solution architects get a feed.** Instead of interviewing 15 people to understand capability gaps, they look at the demand board filtered by capability. The gaps reveal themselves.

### 4. Experiment safely (Lab)

The Lab is where pre-production work lives. It's visible to the organization (preventing duplicates) but clearly marked as experimental (preventing premature trust).

When someone starts working on a demand from the Wishlist, their work appears in the Lab. Colleagues can see it, offer feedback, even contribute — but nobody mistakes it for a production asset.

The Lab-to-Explore promotion is a deliberate act, not an accident. An asset leaves the Lab when its builder decides it's ready for broader use and it meets the minimum maturity gates.

### 5. Certify and govern (Compliance)

Reaching **Trusted** (Level 5) requires passing all maturity gates and earning certification. Certification can be:

- **Bronze**: Meets baseline standards (owner, docs, basic quality)
- **Silver**: Full governance (contracts, lineage, monitoring)
- **Gold**: Enterprise-grade (SLOs, formal review, audit trail)

The compliance engine evaluates assets against policies written in a declarative DSL. Policies can enforce anything from "every Gold asset must have an ODCS data contract" to "tables in the PII domain must have column-level masking."

This is where Builder Hub connects back to Unity Catalog's governance primitives — tags, grants, row filters, column masks — and adds the organizational workflow layer that makes them actionable.

<img width="1685" height="984" alt="Screenshot 2026-09-11 at 3 15 40 PM" src="https://github.com/user-attachments/assets/8a0fff22-ecee-4c06-abb0-6e2f4b91b83e" />

### 6. Align with strategy (Capabilities)

<img width="1205" height="1046" alt="Screenshot 2026-09-11 at 3 16 41 PM" src="https://github.com/user-attachments/assets/738ee0c1-3789-49fb-8852-5177baf20a27" />

Capabilities are the bridge between business priorities and technical assets. They represent *what the organization can do* rather than *what the organization has built*.

Examples: `demand-forecasting`, `customer-360`, `real-time-inventory`, `fraud-detection`.

Every asset is tagged with the capabilities it delivers. Every Wishlist demand is tagged with the capabilities it needs. The Dashboard shows capability coverage:

- **Strong**: 5+ Trusted assets deliver this capability
- **Emerging**: Assets exist but haven't reached Trusted
- **Gap**: Demands exist but no assets address them

This gives leadership a strategic view: *"We're strong in demand forecasting but have a critical gap in real-time inventory visibility, and there are 8 unfulfilled demands for it."* That's a portfolio investment decision, not a backlog grooming session.

### 7. Keep learning (Learn)

The Learn hub aggregates three channels of knowledge:

- **From Your Team**: Blogs, repos, and guides your colleagues have published
- **Platform Pulse**: Databricks release notes, feature announcements, and blog posts (auto-scraped, opt-in)
- **Skill Tracks**: Curated learning paths by domain

This keeps the team current without requiring everyone to monitor 15 RSS feeds. It also gives builders a place to share their work beyond the asset itself — a blog post explaining *why* they built something, not just *that* they built it.

---

## What Changes in Practice

**For builders**: Before you start coding, you check the Wishlist for open demands and Explore for existing assets. You claim a demand before building, so others can see your intent. When you ship, you get visible credit tied to a real business need.

**For solution architects**: You open the Wishlist filtered by capability. The gaps between what exists and what's needed are immediately visible. You scope engagements against reality, not tribal knowledge.

**For team leads**: The Dashboard shows your portfolio's health — how many assets are Trusted vs. stuck at Accessible, which capabilities have coverage gaps, which demands have been open the longest. You make prioritization decisions with data.

**For executives**: You see capability coverage across the organization. You know where you're strong, where you're investing, and where you have critical gaps. Funding decisions are informed by actual demand signals, not pitch decks.

---

## Deploy in 15 Minutes

Builder Hub runs as a Databricks App backed by Lakebase (managed PostgreSQL).

### 1. Create the App

```bash
databricks apps create builder-hub
```

### 2. Provision Resources

| Resource | Type | Purpose |
|----------|------|--------|
| **Lakebase** | PostgreSQL (Autoscale) | App metadata |
| **SQL Warehouse** | Serverless | Unity Catalog queries |
| **Serving Endpoint** | Foundation Model | AI-assisted reviews (optional) |
| **UC Volume** | WRITE_VOLUME | File storage |

See `src/manifest.yaml` for the full resource spec.

### 3. Configure `app.yaml`

```yaml
env:
  # REQUIRED: Your Lakebase endpoint (from provisioning step)
  - name: "ENDPOINT_NAME"
    value: "projects/YOUR_PROJECT/branches/production/endpoints/primary"
  - name: "LAKEBASE_INSTANCE_NAME"
    value: "projects/YOUR_PROJECT/branches/production/endpoints/primary"

  # Schema name (auto-created on first boot)
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

Open the app → **Settings** → **Load Demo Data** → select a vertical preset.

---

## Module System

Every feature is independently toggleable. Set any to `false` in `app.yaml` to hide it from the UI entirely:

| Module | Env Var | Default | Purpose |
|--------|---------|---------|--------|
| Explore | `MODULE_EXPLORE` | on | Browse and discover registered assets |
| Lab | `MODULE_LAB` | on | Pre-production experiments |
| Learn | `MODULE_LEARN` | on | Team knowledge, platform updates, skill tracks |
| Portfolio | `MODULE_PORTFOLIO` | on | Personal asset dashboard |
| Wishlist | `MODULE_WISHLIST` | on | Demand intake and prioritization |
| Dashboard | `MODULE_DASHBOARD` | on | Portfolio health and capability coverage |
| Compliance | `MODULE_COMPLIANCE` | on | Policy engine and automated gates |
| Contracts | `MODULE_CONTRACTS` | on | ODCS data contracts |
| Semantic | `MODULE_SEMANTIC` | on | Ontology and business terminology |
| MCP | `MODULE_MCP` | on | AI assistant integration (Model Context Protocol) |
| Pipeline | `MODULE_PIPELINE` | **off** | Blog/release-note feed scraper |

Start with everything on and a demo preset loaded. Turn off what you don't need as you learn what fits your team.

---

## Architecture

```
src/
├── app.yaml              # Databricks App config
├── manifest.yaml         # Resource requirements
├── backend/              # Python — FastAPI + SQLAlchemy + Alembic
│   ├── src/
│   │   ├── app.py        # Entrypoint and lifecycle
│   │   ├── common/       # Config, auth, DB, middleware
│   │   ├── controller/   # Business logic
│   │   ├── db_models/    # SQLAlchemy ORM
│   │   ├── models/       # Pydantic schemas
│   │   ├── repositories/ # Data access
│   │   ├── routes/       # API endpoints
│   │   └── data/         # Demo data, seeds, configs
│   └── alembic/          # Database migrations
├── frontend/             # React + TypeScript + Vite + Shadcn
└── pipeline/             # Optional feeds crawler
```

**Key design decisions:**

- **UC-native**: Assets are references to existing UC objects, not copies. The source of truth stays in Unity Catalog.
- **Lakebase-backed**: All app state lives in managed PostgreSQL (Lakebase). No Delta tables to maintain, no warehouse compute for app operations.
- **OAuth-first**: Databricks Apps handle auth. Every user action runs with their identity, respecting existing UC permissions.
- **Migration-managed**: Schema evolution via Alembic. First boot creates everything automatically.

---

## Customization

### Branding

| Variable | Purpose |
|----------|--------|
| `UI_APP_DISPLAY_NAME` | App name in header and title |
| `UI_APP_SHORT_NAME` | Compact name for narrow layouts |
| `UI_CUSTOM_LOGO_URL` | Logo image URL |
| `UI_FAVICON_URL` | Browser tab icon |
| `UI_CUSTOM_CSS` | Injected CSS for theme overrides |

### Demo Data Presets

| Preset | Description |
|--------|------------|
| `retail` | Retail (default) — demand forecasting, customer 360, store ops |
| `hls` | Healthcare & Life Sciences |
| `fsi` | Financial Services |
| `mfg` | Manufacturing |
| `auto` | Automotive |

Each preset populates assets, capabilities, wishlist demands, and relationships that tell a coherent story for the vertical.

### Discovery Connectors (Roadmap)

Planned integrations to auto-populate assets from external sources:

1. **UC Scanner** — discover tables/views/models from your Unity Catalog
2. **Confluence** — import documentation as Learn content
3. **Git Repos** — enrich assets from README files and dbt manifests
4. **JIRA** — import issues as Wishlist demands

See [docs/DISCOVERY_CONNECTORS.md](docs/DISCOVERY_CONNECTORS.md) for the full design.

---

## Local Development

Prerequisites: Python 3.10–3.12, Node.js 18+, Hatch, PostgreSQL.

```bash
git clone <repo-url> && cd builder-hub

# Frontend
cd src/frontend && npm install

# Backend
cd src/backend && cp .env.example .env  # then edit

# Run (two terminals)
cd src/frontend && npm run dev:frontend   # port 3000
cd src && hatch -e dev run dev-backend     # port 8000
```

---

## Standards

- [ODCS v3.1.0](https://github.com/bitol-io/open-data-contract-standard) — Data contracts
- [ODPS](https://github.com/bitol-io/open-data-product-standard) — Data product specifications
- [MCP](https://modelcontextprotocol.io/) — AI assistant integration

## Further Reading

| Document | Description |
|----------|------------|
| [Configuring](CONFIGURING.md) | All env vars, database setup, deployment options |
| [User Guide](src/docs/USER-GUIDE.md) | End-user walkthrough |
| [Compliance DSL](src/docs/compliance-dsl-guide.md) | Writing governance policies |
| [Discovery Connectors](docs/DISCOVERY_CONNECTORS.md) | Connector architecture and roadmap |
| [Contributing](CONTRIBUTING.md) | Development setup, commit conventions, release process |

## License

See [LICENSE.txt](LICENSE.txt).

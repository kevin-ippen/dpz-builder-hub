# [FEATURE]: Persona-based UI redesign

**Labels:** `feature`, `needs-triage`

---

## Is there an existing issue for this?

- [ ] I have searched the existing issues

---

## Problem statement

The current UI presents all features in a single sidebar and a single home that toggles between "Marketplace" and "Management" based on permissions. This overwhelms users who come from a traditional, data-product-centric world. We need to separate **app roles** (authorization) from **persona-oriented views** (UI): roles define permissions and which personas a user can access; personas define which home page and menu the user sees. Each persona should have a dedicated Home screen (summary tiles, tables, or dedicated views like the Marketplace for consumers), and the user should be able to select which persona they are in (from the set their role(s) allow).

---

## Proposed Solution

### 1. Roles grant access to personas; personas are not roles

- **App roles** (Admin, Data Consumer, Data Producer, etc.) remain the authorization layer: feature permissions, approval privileges, home sections, deployment policy, access control.
- **Personas** are a UI/view layer: which home page, which menu items, which focused experience. Users select a **persona** in the UI (e.g. dropdown or switcher); the list of personas they can choose from is determined by **which personas their app role(s) are allowed to access**.
- **Role configuration**: In the role edit UI (e.g. "Edit Role: Admin"), add a **"Personas this role can access"** section—similar to Home Sections and Approval Privileges—where admins select which personas this role can use. Save as `allowed_personas` on the role.

### 2. Persona definitions and dedicated Home for every persona

| Persona | Home (dedicated screen) | Menu items |
|--------|-------------------------|------------|
| **Data Consumer** | Marketplace (browse/subscribe) or What's New + tiles | Home, Marketplace, My Products, Business Lineage, Requests |
| **Data Producer** | Summary tiles + tables (owned, accessible, shared, health) | Home, Data Products, Datasets, Contracts, Requests |
| **Data Product Owner** | Summary tiles/tables (my products, health, usage) | Home, My Products, Contracts, Consumers (usage), Product Health |
| **Data Steward** | Review board, summary tiles (what needs to be done) | Home, Catalog Commander, Compliance Checks |
| **Data Governance Officer** | Main KPIs, summary tiles/tables | Home, Domains, Teams, Projects, Policies, Tags, Workflows |
| **Ontology Engineer** | Summary tiles (domains, collections, glossaries stats) | Home, Domains, Collections, Glossaries, Concepts, Properties, Ontologies, Knowledge Graph |
| **Business Term Owner** | Summary tiles/tables (terms, requests) | Home, Terms, Requests |
| **Administrator** | Summary tiles (jobs, audit, connectors status, etc.) | Home, Git, Jobs, App Roles, Search Settings, MCP Settings, UI Customization, Audit, Connectors |

Every persona has a dedicated Home at `/` with summary tiles, tables, or a dedicated view (e.g. Marketplace for Data Consumer)—no redirect-only homes.

### 3. Backend

- **New field on App Role**: `allowed_personas: List[str]` (persona IDs: `data_consumer`, `data_producer`, `data_product_owner`, `data_steward`, `data_governance_officer`, `ontology_engineer`, `business_term_owner`, `administrator`).
- Add persona ID enum/constants; add `allowed_personas` to Pydantic role model, DB (`AppRoleDb`), repository, and SettingsManager; migration and default backfill per role.
- **API**: Expose `allowed_personas` in role CRUD. Add **GET /api/user/allowed-personas** returning `{ "personas": ["data_consumer", ...] }` (union across user's roles) so the frontend can show the persona switcher and restrict selection.

### 4. Frontend

- **Persona store**: `allowedPersonas` (from API), `currentPersona` (user selection, e.g. persisted in localStorage). Fetch allowed personas on load; if `currentPersona` not in `allowedPersonas`, reset.
- **Role edit UI**: Add "Personas this role can access" (tab or section under Privileges) with multi-select of all personas; save as `allowed_personas`.
- **Layout and nav**: Single Layout; sidebar/nav content from **persona nav config** for `currentPersona`. Refactor Navigation to use persona → list of nav items (path, label); permission checks still apply. **Persona switcher** in header/sidebar (dropdown or tabs) to set `currentPersona`.
- **Home (/)** [home.tsx]: Branch on `currentPersona`; render the appropriate home per persona (Marketplace/What's New for Consumer; summary tiles + tables for Producer, Owner, Steward, DGO, Ontology Engineer, Business Term Owner; summary tiles for Administrator). Same route `/`; content is persona-driven.
- **Entity routes** unchanged: `/data-products`, `/data-contracts`, `/datasets`, etc.; menu items point to these; feature permissions still govern create/edit/delete.

### 5. Implementation order (suggested)

1. Backend: persona IDs, `allowed_personas` on role (model, DB, repo, SettingsManager), migration + backfill, `GET /api/user/allowed-personas`.
2. Frontend config: persona IDs and persona → nav items map (persona nav config).
3. Role edit UI: "Personas this role can access" and wire to role create/update.
4. Frontend store: persona store (allowed + current, persisted); fetch allowed personas on load.
5. Layout and nav: refactor Layout/Navigation for `currentPersona` and persona nav config; add persona switcher.
6. Home: implement dedicated Home screen for every persona (summary tiles, tables, or dedicated views like Marketplace).
7. Cleanup: remove or repurpose old "Home Sections" / Marketplace–Management toggle if fully replaced; document persona vs role.

---

## Additional Context

- **Key principle:** Do not conflate app roles with persona-oriented views. Similar to how we set privileges for other UI controls, we allow admins to set **which personas an app role can access**. The UI has a selectable persona option; the menu and home reflect the current persona.
- **Key files:**  
  - Backend: `src/backend/src/models/settings.py`, `src/backend/src/db_models/settings.py`, `src/backend/src/repositories/settings_repository.py`, `src/backend/src/controller/settings_manager.py`, `src/backend/src/routes/user_routes.py`; Alembic migration.  
  - Frontend: `src/frontend/src/stores/` (persona store), `src/frontend/src/components/layout/layout.tsx`, `src/frontend/src/components/layout/navigation.tsx`, `src/frontend/src/views/home.tsx`, `src/frontend/src/config/` (persona nav config), Settings/Role edit UI (personas section).
- **Data models and entity routes:** Unchanged; ODCS/ODPS interoperability retained. Feature permissions (from roles) continue to govern access; persona only governs which menu and home content are shown.

A detailed implementation plan exists in the repo: `.cursor/plans/persona-based_ui_redesign.plan.md`.

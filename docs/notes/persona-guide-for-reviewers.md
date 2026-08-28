# Ontos UI Personas & Navigation Guide

> **Audience:** Data Governance reviewers migrating from or evaluating against Informatica (CDG/EDC/Axon).
> **Date:** February 2026

---

## Overview

Ontos uses a **persona-based UI** where each user sees a tailored navigation sidebar based on their role. This replaces the monolithic "all features in one menu" approach. Users can switch between personas they have access to via a persona switcher in the header.

The concept is similar to Informatica's role-based views (e.g., Business Glossary vs. Catalog vs. Data Quality), but Ontos ties personas directly to RBAC roles mapped to Databricks directory groups, so access is inherited from your identity provider.

---

## Persona Summary

| Persona | Informatica Equivalent | Purpose |
|---|---|---|
| **Data Consumer** | Catalog Consumer / Marketplace user | Browse & subscribe to data products |
| **Data Producer** | Data Engineering / ETL Developer | Build & publish data products on Databricks |
| **Data Product Owner** | Business Data Owner | Manage product lifecycle, contracts, consumers |
| **Data Steward** | Data Steward (CDG/Axon) | Curate assets, ensure quality, run compliance |
| **Data Governance Officer** | Chief Data Officer / Governance Admin (Axon) | Policies, domains, teams, workflows |
| **Security Officer** | Data Privacy / Security Admin | Access control, entitlements, security features |
| **Ontology Engineer** | Metadata Manager / Axon Glossary Admin | Ontologies, knowledge graphs, semantic models |
| **Business Term Owner** | Glossary Author (Axon) | Maintain business glossary terms |
| **Administrator** | Platform Admin | System configuration, connectors, RBAC |

---

## Detailed Persona Breakdown

### 1. Data Consumer

**Informatica parallel:** This is closest to a user browsing the Informatica Enterprise Data Catalog (EDC) or the Informatica Marketplace to discover and request access to datasets.

| Menu Item | Description |
|---|---|
| **Marketplace** | Central discovery hub for published data products. Think of it as the Informatica Marketplace or EDC search — users browse, filter, and subscribe to products they need. |
| **My Products** | Lists data products the consumer has subscribed to. Equivalent to "My Assets" or "Favorites" in EDC — a personalized view of products they depend on, with status and update notifications. |
| **Business Lineage** | Visual, business-level lineage showing how data products relate to each other. Similar to Informatica's lineage viewer in EDC, but oriented around logical data products rather than physical ETL jobs. |
| **Requests** | View and track access requests the consumer has submitted. Maps to the access request workflow in Informatica CDG/Axon where users request access to governed datasets. |

---

### 2. Data Producer

**Informatica parallel:** The ETL developer or data engineer who builds pipelines and publishes datasets — similar to someone working in PowerCenter/IDMC mappings who also registers outputs in the catalog.

| Menu Item | Description |
|---|---|
| **Home** | Dashboard showing in-progress data products, recent activity, and quick actions. |
| **Data Products** | Create, edit, and manage data products. A data product bundles Databricks assets (tables, views, models, jobs, notebooks) with metadata and contracts. This is where the "build" happens — there's no direct Informatica equivalent since Informatica separates ETL (PowerCenter) from cataloging (EDC). Ontos unifies them. |
| **Requests** | Incoming review requests and approval workflows for assets the producer owns. Similar to Informatica's workflow tasks in CDG where stewards review proposed changes. |

---

### 3. Data Product Owner

**Informatica parallel:** The business data owner in Axon who is accountable for a data domain's assets, quality, and consumer satisfaction.

| Menu Item | Description |
|---|---|
| **Home** | Owner-centric dashboard: product health summary, pending actions, consumer activity. |
| **My Products** | All data products the owner is responsible for. Full lifecycle management (draft → published → deprecated → retired). |
| **Contracts** | Data contracts (based on BITOL ODCS) tied to the owner's products. A data contract defines schema, quality rules, SLAs, and access expectations. This is similar to Informatica's data quality rules + business glossary term associations, but formalized into a single versioned contract artifact. |
| **Consumers** | View who has subscribed to the owner's products and manage those relationships. No direct Informatica equivalent — Informatica tracks "data access" but not product subscriptions. |
| **Product Health** | Compliance scorecards and health checks for owned products. Maps to Informatica's Data Quality dashboards + CDG scorecards, but scoped to the product abstraction. |

---

### 4. Data Steward

**Informatica parallel:** This is the most direct mapping — the Data Steward role in Informatica CDG/Axon who curates metadata, resolves data quality issues, and manages catalog assets.

| Menu Item | Description |
|---|---|
| **Home** | Steward-centric dashboard with pending tasks, quality alerts, and review queues. |
| **Catalog Commander** | Dual-pane (Norton Commander-style) explorer for Unity Catalog assets. Allows copy/move of tables and schemas across catalogs. No Informatica equivalent — this is a Databricks-specific power tool for catalog reorganization. |
| **Assets** | Browse and manage governed assets (tables, views, functions, models). Similar to the asset view in Informatica EDC where stewards enrich metadata, assign classifications, and link to glossary terms. |
| **Compliance Checks** | Run and review compliance rules against assets. Calculates an overall compliance score. Maps directly to Informatica's Data Quality scorecard feature in CDG — rules are defined, executed, and results are tracked over time. |
| **Asset Reviews** | Workflow for reviewing and approving asset changes. Similar to CDG's task-based workflow where stewards review proposed metadata changes or new asset registrations before they go live. |
| **Master Data Management** | MDM capabilities powered by Zingg.ai (entity resolution, deduplication). Informatica MDM (formerly Siperian) is the direct competitor here — Ontos integrates Zingg as an open-source alternative for match/merge operations. |

---

### 5. Data Governance Officer

**Informatica parallel:** The CDO or Governance Council role in Informatica Axon — defines data domains, policies, organizational structure, and governance processes.

| Menu Item | Description |
|---|---|
| **Home** | Governance dashboard: domain coverage, policy compliance, team activity. |
| **Domains** | Define and manage data domains (e.g., "Customer", "Finance", "Product"). Equivalent to Informatica Axon's "Data Domains" or CDG's domain classification system. Used to organize products, contracts, and assets by business area. |
| **Teams** | Manage organizational units (LOB, department, team, project). Defines the hierarchy used for glossary scoping and ownership. Similar to Axon's organizational structure configuration. |
| **Projects** | Governance projects grouping related initiatives. Maps to Axon's project management features for governance programs. |
| **Policies** | Define governance policies (retention, privacy, quality standards). Direct equivalent to Informatica Axon's policy management where governance officers define rules that stewards enforce. |
| **Asset Types** | Configure what types of assets are governed and how. Similar to custom asset type definitions in EDC. |
| **Assets** | Cross-domain asset view for governance oversight. |
| **Tags** | Manage the taxonomy of tags used to classify and organize assets. Similar to Informatica's custom attribute/tag system in EDC, but unified across all asset types. |
| **Workflows** | Define governance workflows (approval chains, review processes). Maps to Informatica CDG's workflow engine where governance officers design multi-step approval processes. |
| **Master Data Management** | MDM oversight and configuration from a governance perspective. |
| **Estate Manager** | Manage multi-workspace Databricks estates. No direct Informatica equivalent — this is for organizations running multiple Databricks workspaces that need unified governance. |

---

### 6. Security Officer

**Informatica parallel:** The security/privacy administrator who manages access policies — overlaps with Informatica's Data Privacy Management and CDG's access policy features.

| Menu Item | Description |
|---|---|
| **Home** | Security dashboard: entitlement coverage, recent access changes, security alerts. |
| **Security Features** | Enable advanced security capabilities on assets (e.g., differential privacy, column masking, row-level security). Goes beyond Informatica's built-in security — Ontos leverages Databricks Unity Catalog's native security features and adds governance orchestration on top. |
| **Entitlements** | Define persona-based entitlement bundles (groups of privileges assigned to roles). Similar to Informatica's permission management in CDG, but uses Databricks directory groups as the identity backbone. |
| **Entitlements Sync** | Synchronize entitlement definitions with the Databricks workspace. This is the "deploy" step — no Informatica equivalent since Informatica manages its own internal permissions. In Ontos, entitlements are designed in the app and pushed to Databricks Unity Catalog grants. |

---

### 7. Ontology Engineer

**Informatica parallel:** This persona has no direct Informatica equivalent. The closest is a metadata architect managing the Business Glossary structure in Axon, but Ontos goes significantly further with formal ontology support (OWL/SKOS/SHACL).

| Menu Item | Description |
|---|---|
| **Home** | Ontology workspace dashboard: recent edits, model statistics. |
| **Domains** | Semantic domains (broader than data domains — these define the conceptual scope of ontologies). |
| **Collections** | Group related semantic artifacts (concepts, glossaries, properties) into named collections for versioning and export. |
| **Glossaries** | Hierarchical business glossaries with organizational scoping (company → LOB → department → team → project). Terms merge bottom-up, allowing local overrides. More powerful than Informatica Axon's flat glossary — supports inheritance and conflict resolution. |
| **Concepts** | Formal concept definitions within ontologies. These are the "classes" in an OWL ontology — e.g., "Customer", "Transaction", "Account". Informatica Axon has "Glossary Terms" but not formal ontological concepts with inheritance and constraints. |
| **Properties** | Define properties (attributes and relationships) on concepts. E.g., "Customer.hasEmail", "Transaction.amount". Equivalent to Axon term attributes, but with formal semantics (domain, range, cardinality). |
| **Ontologies** | Manage complete ontology models (OWL/SKOS). Import, export, version, and validate ontologies. No Informatica equivalent — Informatica does not natively support formal ontologies. |
| **Knowledge Graph** | Visual exploration and query interface for the knowledge graph built from ontologies and asset metadata. No Informatica equivalent — this is unique to Ontos. |
| **Semantic Models** | Configuration settings for the semantic modeling engine (namespace prefixes, reasoner settings, import sources). |

---

### 8. Business Term Owner

**Informatica parallel:** A Glossary Author or Term Steward in Informatica Axon who is responsible for maintaining specific business terms.

| Menu Item | Description |
|---|---|
| **Home** | Dashboard showing owned terms, pending reviews, recent changes. |
| **Terms** | Browse, create, and edit business glossary terms. Each term has tags, markdown descriptions, lifecycle status, and linked assets. Directly equivalent to the Glossary Term editing experience in Informatica Axon, with the addition of organizational scoping. |
| **Requests** | Review and respond to term change requests, approval workflows. Maps to Axon's glossary approval workflow. |

---

### 9. Administrator

**Informatica parallel:** The platform administrator in Informatica (Administrator Console / IDMC Org Admin) who manages system configuration, connections, and user roles.

| Menu Item | Description |
|---|---|
| **Home** | System health dashboard. |
| **General** | Core application settings (Unity Catalog location, AI/LLM configuration, audit log path). |
| **Git** | Configure Git repository for YAML-based configuration storage and version control. No Informatica equivalent — Informatica uses its own metadata repository. |
| **Delivery Modes** | Configure how data products are deployed (SDLC environments: dev, staging, prod). |
| **Jobs** | Manage Databricks background jobs/workflows for heavy operations (sync, validation, compliance checks). Similar to Informatica's job scheduling but delegated to Databricks Workflows. |
| **App Roles** | RBAC configuration: define roles, assign directory groups, set feature permissions, configure persona access. Equivalent to Informatica's role management in CDG + Admin Console. |
| **Tags** | System-wide tag taxonomy management. |
| **Business Roles** | Define business roles separate from app roles (e.g., "Data Domain Lead", "Quality Analyst"). |
| **Business Owners** | Register business owners and map them to assets and domains. |
| **Search Settings** | Configure the search index (which asset types are indexed, ranking weights). Similar to EDC's search configuration. |
| **MCP Settings** | Manage API tokens for AI assistant integrations via the Model Context Protocol. Enables AI tools (e.g., Claude, Copilot) to interact with Ontos programmatically. No Informatica equivalent. |
| **UI Customization** | Branding (custom logo, CSS overrides), internationalization settings, custom About page. |
| **Connectors** | Configure external system connections. |
| **Audit** | Audit log viewer for tracking all system changes. Equivalent to Informatica's audit trail in CDG. |
| **About** | Application version, links, license information. |

---

## Key Differences from Informatica

| Aspect | Informatica (CDG/EDC/Axon) | Ontos |
|---|---|---|
| **Architecture** | Standalone platform with proprietary metadata store | Databricks-native app using Unity Catalog as the data plane |
| **Data Products** | Not a first-class concept; approximated via catalog + glossary + DQ rules | Core abstraction: products bundle assets, contracts, and governance |
| **Data Contracts** | No equivalent; closest is DQ rules + glossary term associations | Formal versioned contracts (BITOL ODCS standard) with schema, SLAs, quality rules |
| **Ontologies** | Basic glossary only | Full OWL/SKOS/SHACL ontology support with knowledge graph |
| **MDM** | Informatica MDM (Siperian) — separate product | Integrated Zingg.ai-based MDM |
| **Deployment** | Proprietary agents and repositories | Databricks Workflows + Unity Catalog grants |
| **Identity** | Informatica internal user management or LDAP/SSO | Databricks directory groups (from SCIM/Entra ID/Okta) |
| **AI Integration** | CLAIRE AI (limited to DQ suggestions) | MCP-based integration with any LLM (Claude, GPT, etc.) |
| **Persona-based UI** | Role-based views but not persona-centric | Full persona switcher with tailored navigation per role |
| **Pricing** | Per-user licensing, separate SKUs per product | Open-source (ASF 2.0), runs on existing Databricks compute |

---

## How Personas Map to a Typical Governance Org

```
CDO / Head of Governance  ──→  Data Governance Officer
  ├── Domain Leads         ──→  Data Product Owner
  ├── Data Stewards        ──→  Data Steward
  ├── Glossary Curators    ──→  Business Term Owner / Ontology Engineer
  ├── Security & Privacy   ──→  Security Officer
  ├── Platform Team        ──→  Administrator
  ├── Data Engineers        ──→  Data Producer
  └── Business Analysts    ──→  Data Consumer
```

A single user can hold multiple personas and switch between them as needed. Persona access is controlled through RBAC role assignments.

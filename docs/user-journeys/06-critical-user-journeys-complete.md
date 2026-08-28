# Ontos Critical User Journeys (CUJs)

This document defines the complete set of Critical User Journeys for Ontos, ordered by priority. Each CUJ is composable — cross-cutting journeys reference first-order CUJs by ID. The plan is to create short walkthrough videos for each, building a library of educational material.

See also:
- [01. Data Product Team Workflows](01-critical-user-journeys.md) — team composition, workflow sequences, sequence diagrams
- [02. Lifecycle States](02-lifecycle-states.md) — state machines for contracts and products
- [03. Implementation Roadmap](03-implementation-roadmap.md) — phased feature delivery
- [04. Persona Responsibilities](04-persona-responsibilities.md) — RACI matrices, decision authority
- [05. Gap Analysis](05-gap-analysis.md) — current state vs. requirements

---

## CUJ Groups

| Group | CUJs | Theme |
| :--- | :--- | :--- |
| **#0.x — Setup** | CUJ-0.0 through CUJ-0.3 | Platform configuration prerequisites |
| **#1.x — Ontology & Knowledge** | CUJ-1 through CUJ-3 | Semantic foundation |
| **#4.x — Business Glossary** | CUJ-4 | Business vocabulary |
| **#5.x — Ask Ontos** | CUJ-5 | Natural language querying |
| **#6.x — Knowledge Graph** | CUJ-6, CUJ-7 | Graph construction & visualization |
| **#8.x — Data Products** | CUJ-8, CUJ-9, CUJ-11 | Product lifecycle & enrichment |
| **#10.x — Marketplace** | CUJ-10, CUJ-12, CUJ-13 | Discovery & consumption |
| **#14.x — Operations** | CUJ-14 | Troubleshooting & administration |
| **#15.x — Cross-Cutting** | CUJ-15, CUJ-16 | Composite end-to-end journeys |

---

## Group #0.x — Setup

These journeys establish the organizational structure that scopes all downstream work. They must be completed before any content creation journeys.

### CUJ-0.0 — Create a Data Domain

**Priority:** Prerequisite — required before creating products, contracts, or glossaries
**Persona:** Admin / Data Governance Lead
**Goal:** Establish a data domain that groups related data products, contracts, and teams under a business area (e.g., Finance, Marketing, Supply Chain).

**Why This Matters:** Domains are the top-level organizational unit in Ontos. Every data product, contract, and glossary collection is scoped to a domain. Without domains, content cannot be properly categorized or governed.

**Prerequisites:**
- PREQ-1: User must have Admin role or write permissions to the "Settings — Domains" feature

**Steps:**
1. Navigate to **Settings** via the user menu (top-right avatar → Settings)
2. Select **Data Domains** from the settings sidebar (`/settings/data-domains`)
3. Click **"Create Domain"** to open the domain creation dialog
4. Provide domain metadata:
   - **Name** — a clear business area name (e.g., "Customer Analytics")
   - **Description** — purpose and scope of the domain
   - **Owner** — the Domain Owner responsible for this area
   - **Tags** — optional classification tags
5. Save the domain
6. Optionally assign the domain to existing teams or projects

**Ontos Implementation:**
- Backend: `DataDomainManager` (`controller/data_domains_manager.py`) — CRUD operations via `/api/data-domains`
- Frontend: `data-domains.tsx` (list view) and domain detail page under Settings
- Domains appear as filter options across products, contracts, and collections

**Success Criteria:** A named domain exists in Ontos, selectable as a scope for all downstream content creation.

---

### CUJ-0.1 — Create a Team

**Priority:** Prerequisite — required for collaborative workflows
**Persona:** Admin / Data Product Owner
**Goal:** Define a team of users who collaborate on data products and contracts within a domain.

**Why This Matters:** Teams scope visibility and ownership. A data product's team determines who can edit it during DRAFT/DEVELOPMENT states. See [04. Persona Responsibilities](04-persona-responsibilities.md) for team composition guidance (minimal: 2–3, elaborate: 5–8 people).

**Prerequisites:**
- PREQ-1: User must have Admin role or write permissions to the "Settings — Teams" feature
- PREQ-2: At least one Data Domain must exist (CUJ-0.0)

**Steps:**
1. Navigate to **Settings → Teams** (`/settings/teams`)
2. Click **"Create Team"** to open the team creation dialog
3. Provide team metadata:
   - **Name** — e.g., "Customer Churn Analytics Team"
   - **Domain** — the parent data domain this team operates in
   - **Description** — team purpose and scope
4. Add members by searching the Databricks workspace directory
5. Assign roles to each member (Product Owner, Data Engineer, Analyst, etc.)
6. Save the team

**Ontos Implementation:**
- Backend: `TeamsManager` (`controller/teams_manager.py`) — team + membership routes via `/api/teams`
- Frontend: `teams.tsx` under Settings; members managed via the team detail view
- Teams are linked to Data Products and Data Contracts as ownership scope

**Success Criteria:** A team exists with assigned members and roles, linked to a domain, ready to own data products and contracts.

---

### CUJ-0.2 — Create a Project

**Priority:** Prerequisite — optional organizational unit below Team
**Persona:** Data Product Owner / Admin
**Goal:** Create a project to group related work items (data products, contracts) within a team's scope.

**Why This Matters:** Projects provide an additional scoping level. A team may run multiple projects — e.g., "Customer Churn v2" and "Revenue Forecasting" — each with its own set of products and contracts.

**Prerequisites:**
- PREQ-1: User must have write permissions to the "Settings — Projects" feature
- PREQ-2: A team must exist (CUJ-0.1)

**Steps:**
1. Navigate to **Settings → Projects** (`/settings/projects`)
2. Click **"Create Project"** to open the project creation dialog
3. Provide project metadata:
   - **Name** — e.g., "Customer Churn Prediction v2"
   - **Team** — the owning team
   - **Domain** — inherited from team or overridden
   - **Description** — scope and goals
4. Save the project
5. When creating contracts or products, select this project as the scope

**Ontos Implementation:**
- Backend: `ProjectsManager` (`controller/projects_manager.py`) — `/api/projects` with domain linkage
- Frontend: `projects.tsx` under Settings; project context stored in `project-store` (Zustand)
- Products and contracts can be filtered by project across the UI

**Success Criteria:** A project exists, scoped to a team and domain, usable as a filter/context for downstream content.

---

### CUJ-0.3 — Configure Workflows

**Priority:** Prerequisite for elaborate teams — optional for minimal teams
**Persona:** Admin / Data Governance Lead
**Goal:** Configure approval workflows, delivery methods, business roles, and reference data that govern how data products move through lifecycle states.

**Why This Matters:** The elaborate workflow (see [01. Critical User Journeys — Elaborate Workflow](01-critical-user-journeys.md#elaborate-workflow-contracts-first-with-approval-gates)) requires formal approval gates. These must be configured before teams can submit products for certification.

**Prerequisites:**
- PREQ-1: User must have Admin role

**Steps:**
1. Navigate to **Settings** and configure each area:
   - **Roles** (`/settings/roles`) — define or customize roles (Admin, Data Steward, Data Producer, Data Consumer) and their feature-level permissions
   - **Workflows** (`/settings/workflows`) — configure approval sequences for contract review and product certification
   - **Delivery Methods** (`/settings/delivery-methods`) — define how data is delivered (Table Access, Serving Endpoint, File Export, Streaming)
   - **Business Roles** (`/settings/business-roles`) — define organizational roles used in contracts (Data Owner, Technical Owner, etc.)
   - **Asset Types** (`/settings/asset-types`) — review ontology-driven asset types synced from `ontos-ontology.ttl`
   - **Tags** (`/settings/tags`) — configure tag taxonomies for classification
2. For each configuration area, review defaults and customize as needed
3. Save all changes

**Ontos Implementation:**
- Backend: `SettingsManager` (`controller/settings_manager.py`) — `/api/settings` (roles, git, delivery methods, connectors, etc.)
- Frontend: `settings-layout.tsx` — nested routes under `/settings/*`
- Workflow configuration feeds into lifecycle state transitions (see [02. Lifecycle States](02-lifecycle-states.md))

**Success Criteria:** Workflows, roles, and reference data are configured. Teams can use the defined approval gates and delivery methods.

---

## Group #1.x — Ontology & Knowledge (Highest Priority)

These journeys establish the semantic foundation that everything else builds on.

### CUJ-1 — Build an Ontology from Scratch (Manual)

**Priority:** Highest — foundational capability, required for all downstream journeys
**Persona:** Knowledge Engineer / Data Architect
**Goal:** Manually define an ontology using industry standards (OWL, TTL, RDF) and load it into Ontos for use across the platform.

**Why This Matters:** Customers are often highly skilled knowledge engineers looking for proper knowledge system support. Terms like RDF, OWL, SHACL are common in their vocabulary. Schema inference alone doesn't produce a finished ontology — manual authoring is the foundational step that everything else builds on.

**Prerequisites:**
- PREQ-1: User must have write permissions to the "Semantic Models" feature
- PREQ-2: The ontology must be in a supported format (OWL, Turtle/TTL, RDF/XML, or N-Triples)

**Steps:**
1. **Design the ontology externally** using standard tools (Protégé, TopBraid, or a text editor) in OWL/TTL/SHACL format
2. **Define the semantic model**: concepts (classes), attributes (data properties), relationships (object properties), and constraints (SHACL shapes)
3. **Navigate to Settings → Semantic Models** (`/settings/semantic-models`) in Ontos
4. **Upload the ontology file** via the "Upload" action — Ontos accepts `.ttl`, `.owl`, `.rdf`, `.nt` files
5. **Enable the model** — toggle it on so it becomes part of the conjunctive knowledge graph
6. **Refresh the graph** — trigger a graph rebuild (`POST /api/semantic-models/refresh-graph`) to integrate the new model
7. **Validate the ontology** — use the SPARQL query interface (`/concepts/search`, KG Search tab) to verify concepts, relationships, and constraints loaded correctly
8. **Map ontology concepts to UC assets** — navigate to the Asset Explorer or individual Data Products/Contracts and use semantic linking to connect ontology concepts to catalog objects (catalogs, schemas, tables, columns)
9. **Review the visual graph** — explore the loaded ontology in the Knowledge Graph visualization (`/concepts/home` → Graph tab) using Cytoscape
10. **Activate for downstream use** — once validated, the ontology is automatically available to:
    - Ask Ontos (CUJ-5) for semantic reasoning
    - MCP Server (CUJ-3) for agent grounding
    - Business Glossary (CUJ-4) as a concept source

**Ontos Implementation:**
- Backend: `SemanticModelsManager` (`controller/semantic_models_manager.py`) — loads/merges RDF, maintains the conjunctive knowledge graph, exposes concepts/properties via `/api/semantic-models/*`
- Backend: `OntologySchemaManager` (`controller/ontology_schema_manager.py`) — reads `ontos-ontology.ttl` for entity type definitions, field schemas, and asset type sync
- Frontend: `settings-semantic-models.tsx` (upload/manage), `knowledge-graph.tsx` (Cytoscape visualization), `ontology-search.tsx` (SPARQL/concept search)
- Data: `src/backend/src/data/taxonomies/` — ships with `ontos-ontology.ttl`, `odcs-ontology.ttl`, `databricks_ontology.ttl`

**Success Criteria:** A formal ontology is loaded, validated, and active in Ontos, queryable via SPARQL, visible in the graph, and ready to provide semantic grounding for agents and data consumers.

---

### CUJ-2 — Infer an Ontology from Schema

**Priority:** Highest — top customer ask, accelerates time to value
**Persona:** Data Engineer / Data Architect
**Goal:** Use Ontos to automatically infer ontological concepts and relationships from existing database schemas and metadata in Unity Catalog.

**Why This Matters:** Customers always ask to automate ontology creation as much as possible. The initial hypothesis for many engagements is that Ontos can reverse-engineer existing data to create knowledge graphs and ontologies — a tough problem, but high-value when it works. Inference provides a starting point that requires human curation, not a finished ontology.

**Prerequisites:**
- PREQ-1: User must have write permissions to the "Semantic Models" feature
- PREQ-2: Unity Catalog must be configured and accessible from the Ontos deployment
- PREQ-3: Source tables should have metadata (column comments, tags, descriptions) for best inference quality

**Steps:**
1. **Navigate to the Ontology Generator** (`/concepts/generator`)
2. **Select a UC catalog/schema** as the inference source — browse the catalog tree to pick specific tables or entire schemas
3. **Configure inference parameters**:
   - Depth of analysis (table-level vs. column-level)
   - Relationship types to detect (foreign keys, naming patterns, semantic similarity)
   - Confidence thresholds for auto-acceptance
   - LLM model to use for semantic analysis (configured under Settings)
4. **Run the ontology inference process** — the `OntologyGeneratorManager` uses LLM-assisted generation to produce OWL/Turtle from the source metadata
5. **Review the inferred concepts, relationships, and attributes** — results appear in the generator UI with confidence scores
6. **Accept, reject, or modify individual inferences** — curate the output:
   - Accept high-confidence inferences directly
   - Modify medium-confidence items (rename concepts, adjust relationships)
   - Reject low-confidence or incorrect inferences
7. **Save the finalized ontology** — persist as a semantic model in Ontos
8. **Iterate** — refine the source schema metadata (add column comments, tags) and re-run inference to improve quality
9. **Optionally import industry ontologies** — supplement the inferred model with pre-built industry packs (`/api/industry-ontologies`)

**Ontos Implementation:**
- Backend: `OntologyGeneratorManager` (`controller/ontology_generator_manager.py`) — LLM-assisted OWL/Turtle generation from UC metadata
- Backend: `IndustryOntologyManager` (`controller/industry_ontology_manager.py`) — industry vertical library, import, cache
- Frontend: `ontology-generator.tsx` — the generator UI
- Frontend: Infer-from-catalog also available at the contract level: `infer-from-catalog-dialog.tsx`

**Success Criteria:** Ontos generates a usable ontology from existing data assets with minimal manual intervention, accelerating time to value. The inferred model is loaded and queryable.

**Important Note:** Set expectations that inference provides a starting point requiring human curation, not a finished ontology. Quality depends heavily on the richness of source metadata.

---

### CUJ-3 — Ground Agents with Ontology via MCP Server

**Priority:** Highest — key value proposition for agentic AI
**Persona:** AI Engineer / Solutions Architect
**Goal:** Provide AI agents with semantic context from Ontos through the MCP server, so agents can reason over business concepts rather than raw tables.

**Why This Matters:** Ontos becomes an accelerator for enabling agents to become more grounded by providing them — through the MCP server — with the ontology and other semantic context. This is the bridge from ontology-as-documentation to ontology-as-operational-capability. Customers envision Enterprise Orchestration Agents that operate across multiple domains with built-in discoverability and semantic grounding.

**Prerequisites:**
- PREQ-1: An ontology and/or business glossary must be active in Ontos (CUJ-1 or CUJ-2, and/or CUJ-4)
- PREQ-2: User must have Admin role to configure MCP tokens

**Steps:**
1. **Ensure semantic content is active** — verify that at least one ontology model is enabled and the knowledge graph is populated (`/concepts/home` → check graph has nodes)
2. **Navigate to Settings → MCP** (`/settings/mcp`)
3. **Create an MCP API token** — click "Create Token", provide a name (e.g., "Agent-Production"), and copy the generated `X-API-Key` value
4. **Note the MCP endpoint URL** — the endpoint is `https://<ontos-host>/api/mcp` (JSON-RPC 2.0 protocol, with SSE option for streaming)
5. **Connect an agent to the MCP server**:
   - For **Databricks Agents**: configure the MCP server URL and API key in the agent's tool configuration
   - For **custom agents** (LangChain, CrewAI, etc.): use the MCP client SDK with the Ontos endpoint
   - For **external agents**: any MCP-compatible client can connect using the endpoint + API key
6. **Test agent access** — verify the agent can call Ontos tools:
   - `search` — global search across products, contracts, glossary
   - `get_data_products` / `get_data_contracts` — retrieve product/contract metadata
   - `sparql_query` — run SPARQL queries against the knowledge graph
   - `get_semantic_links` — retrieve semantic relationships
   - `get_hierarchy` — browse the ontology hierarchy
   - `get_neighbors` — explore graph neighborhood of a concept
7. **Validate grounding improvement** — compare agent responses with and without Ontos context. The agent should:
   - Use business terminology correctly (from glossary)
   - Understand relationships between concepts (from ontology)
   - Reference governed data products (from catalog)
8. **Deploy the agent** with Ontos MCP integration in production

**Ontos Implementation:**
- Backend: `mcp_routes.py` — JSON-RPC 2.0 endpoint at `/api/mcp`, uses `create_default_registry()` from `src/backend/src/tools/registry.py`
- Backend: `MCPTokensManager` + `mcp_tokens_routes.py` — token management at `/api/mcp-tokens`
- Frontend: `settings-mcp.tsx` + `mcp-tokens-settings.tsx` — token creation UI with endpoint documentation
- The MCP registry exposes the same tool set used by Ask Ontos internally: products, contracts, glossary, SPARQL, semantic links, hierarchy, search, UC analytics, domains/teams/projects/tags

**Success Criteria:** Agents leverage ontological context automatically, reducing hallucination and improving accuracy without manual context engineering per agent. The MCP server is accessible, authenticated, and serving semantic context to at least one connected agent.

---

## Group #4.x — Business Glossary

### CUJ-4 — Create a Business Glossary

**Priority:** High — what most customers actually need today
**Persona:** Data Steward / Business Analyst / Domain Expert
**Goal:** Establish a centralized, governed vocabulary of business terms and definitions that provides semantic context across the organization.

**Why This Matters:** Across hundreds of customers, the most common request is for extra context layered on top of catalog objects that goes beyond tags and domains. Organizations need a way to centralize and govern the definitions of business concepts, even if those concepts manifest in many data assets.

**Prerequisites:**
- PREQ-1: User must have write permissions to the "Semantic Models" feature
- PREQ-2: At least one Data Domain should exist (CUJ-0.0) for organizational scoping

**Steps:**
1. **Navigate to the Concepts Browser** (`/concepts/browser`)
2. **Create a new glossary collection** — click "Create Collection" and set `collection_type: glossary`
   - **Name** — e.g., "Finance Business Glossary"
   - **Domain** — the business domain this glossary covers
   - **Description** — scope and usage guidelines
   - **Owner** — the Data Steward or Domain Expert responsible
3. **Add business terms (concepts)** to the collection:
   - Click "Add Concept" within the collection
   - For each term, provide:
     - **Label** — the canonical business term (e.g., "Annual Recurring Revenue")
     - **Definition** — clear, unambiguous description
     - **Synonyms/Aliases** — alternative names (e.g., "ARR")
     - **Relationships** — links to other terms (broader/narrower, related)
     - **Domain tags** — business area classification
4. **Import existing terms** (optional) — use the **Import Concepts Dialog** to bulk-load terms from CSV, JSON, or another glossary format
5. **Categorize terms by business domain** — assign domain tags to each term (Finance, HR, Sales, Legal, etc.)
6. **Link terms to UC objects** — navigate to individual tables/columns in the Asset Explorer or Data Product detail pages and assign glossary terms via the Semantic Links panel
7. **Set term ownership and lifecycle** — each concept supports lifecycle actions:
   - **Publish** — make the term visible organization-wide
   - **Certify** — mark as the authoritative definition
   - **Deprecate** — flag superseded terms
8. **Publish the glossary** — publish the collection so it becomes available for organization-wide use, including by Ask Ontos and the MCP server

**Ontos Implementation:**
- Backend: `SemanticModelsManager` — glossary behavior via knowledge collections (`urn:glossary:` contexts) + concepts under `/api/knowledge/*` (collections, concepts, import/export, lifecycle)
- Backend: `SemanticLinksManager` — connects glossary terms to contracts/products/assets via `/api/semantic-links/*`
- Frontend: `business-terms.tsx` (concept browser with `ConceptsTab`, `GlossaryFilterPanel`), `collections.tsx` (collection management)
- Frontend: `CollectionEditorDialog`, `ConceptEditorDialog`, `ImportConceptsDialog` — editing and import UIs

**Success Criteria:** A searchable, governed glossary of business terms exists, linked to actual data assets, providing shared understanding across domains. Terms are available in Ask Ontos and via the MCP server.

---

## Group #5.x — Ask Ontos

### CUJ-5 — Ask Ontos (Natural Language Querying)

**Priority:** High — core differentiator, primary demo vehicle
**Persona:** Business User / Data Analyst
**Goal:** Query the ontology and its associated data using natural language to answer business questions.

**Why This Matters:** This is the "wow" moment in demos and the primary way non-technical users interact with Ontos. This is where the ontology investment pays off in user-facing value — users get answers grounded in governed semantic context without needing to know schemas or SQL.

**Prerequisites:**
- PREQ-1: LLM must be configured in Settings (model endpoint, API key)
- PREQ-2: At least some content must exist — ontology, glossary, products, or contracts
- PREQ-3: User must accept the LLM consent dialog on first use

**Steps:**
1. **Navigate to Search** (`/search`) — the default tab is **Ask Ontos** (`/search/llm`)
2. **Accept the consent dialog** if this is the first use (LLM data processing disclosure)
3. **Type a natural language question**, e.g.:
   - "What data products relate to customer churn?"
   - "Show me the relationship between revenue and regional sales data"
   - "Which business terms are linked to the orders table?"
   - "What contracts define SLAs for the marketing domain?"
4. **Ontos interprets the question** using:
   - The active ontology (concepts, relationships, properties)
   - Business glossary terms and definitions
   - Data product and contract metadata
   - Semantic links between all of the above
   - Tool calling to query structured data (SPARQL, search API, product/contract APIs)
5. **Review results** — responses include:
   - Direct answers with context and references
   - Relevant data products, contracts, and concepts
   - Semantic relationships and lineage
   - Debug/tool-call panel (expandable) showing which tools were invoked
6. **Drill into results** — click on referenced products, contracts, or concepts to navigate to their detail pages
7. **Refine the query** — Ask Ontos supports multi-turn conversations within a session; follow up to narrow or expand the scope
8. **Manage sessions** — previous sessions are saved and retrievable; start a new session or continue an existing one

**Ontos Implementation:**
- Backend: `LLMSearchManager` (`controller/llm_search_manager.py`) — manages LLM interactions, tool calling, session state
- Backend: `llm_search_routes.py` — `/api/llm-search` (status, chat, sessions CRUD)
- Frontend: `search.tsx` — tabs for LLM search and index search
- Frontend: `llm-search.tsx` — full chat UI with markdown rendering, tool/debug affordances, consent dialog
- Uses the same tool registry as the MCP server (`src/backend/src/tools/registry.py`)

**Success Criteria:** User gets a meaningful, contextual answer grounded in the ontology without needing to know the underlying schema or SQL. Responses reference governed objects (products, contracts, terms) with navigable links.

---

## Group #6.x — Knowledge Graph

### CUJ-6 — Build a Knowledge Graph from Data

**Priority:** High — differentiator, bridges ontology to Genie and agents
**Persona:** Data Scientist / Knowledge Engineer
**Goal:** Create a knowledge graph (triplet structure) from organizational data using Ontos tools, and optionally integrate it with Genie for enhanced question answering.

**Why This Matters:** The no-code Knowledge Graph builder with AgentBricks integration recommends triplets based on an organization's data (Genie) and context (Knowledge Assistant). Giving Genie a triplets table adds deterministic search and relationship-based reasoning. This is the link between Ontos and the broader Databricks AI platform.

**Prerequisites:**
- PREQ-1: User must have write permissions to the "Semantic Models" feature
- PREQ-2: Source data must be accessible in Unity Catalog
- PREQ-3: For LLM-assisted generation, an LLM endpoint must be configured in Settings

**Steps:**
1. **Choose the graph construction approach**:
   - **Option A — Import from ontology file**: Upload a pre-built TTL/OWL file (see CUJ-1) containing entity-relationship definitions
   - **Option B — Infer from UC schema**: Use the Ontology Generator (see CUJ-2) to propose concepts and relationships from table/column metadata
   - **Option C — Manual authoring**: Create collections and concepts manually in the Concepts Browser (`/concepts/browser`)
   - **Option D — Industry pack**: Import a pre-built industry ontology (`/api/industry-ontologies`)
2. **Select source data** — UC tables, existing ontologies, or document collections
3. **Use LLM-assisted triplet generation** (`/concepts/generator`):
   - The `OntologyGeneratorManager` analyzes source metadata and proposes entity-relationship triplets
   - Each triplet follows the (Subject, Predicate, Object) pattern — e.g., (Customer, hasOrder, Order)
4. **Review and curate recommended triplets**:
   - Accept well-formed, high-confidence triplets
   - Reject incorrect or low-value suggestions
   - Modify labels, relationships, or cardinality
5. **Visualize the resulting graph** — navigate to `/concepts/home` → Graph tab to see nodes and edges rendered in Cytoscape
6. **Save the graph** — persist as a semantic model (RDF/TTL) managed by Ontos
7. **Optionally export as a Delta triplet table** — export the graph data to a UC Delta table for use by Genie Spaces or other consumers
8. **Optionally connect to a Genie Space** — configure a Genie Space with the triplet table for graph-enhanced natural language Q&A (see Data Product detail → Genie integration)

**Ontos Implementation:**
- Backend: `SemanticModelsManager` — graph management (upload, refresh, SPARQL query, neighbors, statistics)
- Backend: `OntologyGeneratorManager` — LLM-assisted OWL/Turtle generation
- Backend: `IndustryOntologyManager` — pre-built industry models
- Backend: Knowledge collections + concepts CRUD under `/api/knowledge/*`
- Frontend: `ontology-generator.tsx` (LLM generation), `knowledge-graph.tsx` (Cytoscape visualization), `business-terms.tsx` (manual authoring)

**Success Criteria:** A knowledge graph exists in Ontos, queryable via SPARQL, visualizable in the graph UI, and optionally exported as a governed Delta table for use by agents and Genie.

---

### CUJ-7 — Visualize and Explore the Ontology Graph

**Priority:** High — essential for demos and user understanding
**Persona:** Data Architect / Business Analyst / Domain Expert
**Goal:** Interactively explore the ontology as a visual graph to understand relationships, coverage, and gaps.

**Why This Matters:** Visualization makes the ontology tangible and comprehensible to non-technical stakeholders. Customers want to be able to edit and explore the graph, seeing data relationships — not just node-to-node subclass connections, but rich semantic relationships.

**Prerequisites:**
- PREQ-1: At least one semantic model must be loaded and enabled
- PREQ-2: The knowledge graph must be refreshed after the latest model changes

**Steps:**
1. **Navigate to the Knowledge Graph view** (`/concepts/home`)
2. **Select the Graph tab** to open the Cytoscape-based interactive visualization
3. **Choose scope** — filter the graph by:
   - Specific ontology model or collection
   - Domain or concept type
   - Depth from a selected root node
4. **Explore the graph interactively**:
   - **Zoom** — scroll to zoom in/out
   - **Pan** — drag the canvas to reposition
   - **Click nodes** — view concept details (label, description, type, properties, linked assets)
   - **Click edges** — view relationship details (predicate, domain, range)
5. **Filter by relationship type** — show/hide specific edge types (subClassOf, hasProperty, relatedTo, etc.)
6. **Navigate neighborhoods** — from a selected node, explore its neighbors via the graph API (`/api/semantic-models/neighbors`)
7. **Identify gaps** — look for:
   - Concepts with no data mapping (orphan ontology nodes)
   - Clusters with sparse relationships
   - Missing domains or business areas
8. **Use SPARQL for deeper exploration** — switch to the KG Search tab (`/concepts/search`) for structured queries:
   - Path queries: "Find all paths between Concept A and Concept B"
   - Pattern matching: "Find all concepts with property X"
   - Statistics: concept counts, relationship type distribution
9. **Export or share** — take screenshots, export query results, or share direct links to specific graph views

**Ontos Implementation:**
- Frontend: `knowledge-graph.tsx` — Cytoscape-based interactive graph visualization
- Frontend: `ontology-home.tsx` — graph page with tabs (Graph, Stats)
- Frontend: `kg-search.tsx` — SPARQL/path/prefix query interface
- Backend: `/api/semantic-models/neighbors`, `/api/semantic-models/query` (SPARQL), `/api/semantic-models/statistics`

**Success Criteria:** User gains an intuitive understanding of the ontological structure and its relationship to actual data assets. Non-technical stakeholders can explore the graph without writing queries.

---

## Group #8.x — Data Products

### CUJ-8 — Create a Data Product

**Priority:** Medium — core data governance workflow
**Persona:** Data Engineer / Data Product Owner
**Goal:** Define a new data product within Ontos that packages one or more Unity Catalog assets into a governed, discoverable unit with defined output ports (Deliverables) and input ports (Consumables).

**Why This Matters:** Data Products are the primary unit of value exchange in a data mesh. Creating one formalizes ownership, quality expectations, and access semantics. See [01. Critical User Journeys](01-critical-user-journeys.md) for the Contracts First vs. Products First workflow decision.

**Prerequisites:**
- PREQ-1: User must have Data Producer role or write permissions to the "Data Products" feature
- PREQ-2: A domain, team, and optionally a project should exist (CUJ-0.x)
- PREQ-3 (Contracts First): An APPROVED data contract should exist if following the Contracts First workflow

**Steps:**
1. **Navigate to Data Products** (`/data-products`)
2. **Click "Create"** to open the creation dialog — provide minimal metadata:
   - **Name** — descriptive product name (e.g., "Customer Churn Analytics")
   - **Domain** — the business domain
   - **Owner** — the Data Product Owner
   - **Description** — business purpose and value proposition
3. **The product is created in DEVELOPMENT status** — you land on the detail page (`/data-products/:id`)
4. **Compose the product** using Draft-state editing on the detail page:
   - **Add Deliverables** (Output Ports):
     - Name each deliverable (e.g., "Daily Churn Rate", "ML Predictions")
     - Set a **Delivery Method** for each (Table Access, Serving Endpoint, File Export, Streaming)
     - **Link UC assets** to each deliverable: tables, views, datasets, ML models, API endpoints
     - Each deliverable's assets inherit access semantics from its delivery method
   - **Add Consumables** (Input Ports):
     - Declare upstream data dependencies that feed into the product's pipelines
   - **Optionally link Data Contracts** to individual deliverables (or do this later — contracts are not required during composition)
5. **Enrich the product**:
   - **Team** — add team members and assign roles
   - **Documentation** — add usage guidelines, getting started guide, known limitations
   - **Quality** — define quality expectations, SLA commitments
   - **Semantic links** — assign business glossary terms to the product and its deliverables
   - **Tags** — classify with organizational tags
   - **Custom properties** — add domain-specific metadata
   - **Costs** — document cost implications
6. **Review readiness** — check the readiness checklist on the detail page
7. **Save and validate** — the product definition is persisted

**Next Steps:** Proceed through the lifecycle:
- Deploy to Sandbox → Submit for Certification → Steward Certifies → Deploy to Production → Publish (see [02. Lifecycle States](02-lifecycle-states.md))

**Ontos Implementation:**
- Backend: `DataProductsManager` (`controller/data_products_manager.py`) — full lifecycle, ODPS support, versioning, subscriptions
- Backend: `data_product_routes.py` — extensive API surface (CRUD, lifecycle, ODPS export, deliverables, subscriptions, versioning, clone, compare, etc.)
- Frontend: `data-products.tsx` (list view with table + graph modes, create/upload dialogs)
- Frontend: `data-product-details.tsx` — rich detail page with ODPS sections, ports, team, semantic linking, metadata, comments, ratings, quality, lineage, readiness checklist

**Success Criteria:** A fully defined data product exists in DEVELOPMENT status with at least one deliverable, clear ownership, and documentation. The product is ready to progress through the lifecycle.

---

### CUJ-9 — Assign Semantic Terms to Ontos Objects

**Priority:** Medium — key enrichment step connecting glossary to data
**Persona:** Data Steward / Data Engineer
**Goal:** Enrich data assets with semantic meaning by linking business glossary terms to UC objects managed in Ontos.

**Why This Matters:** Semantic links are what make the ontology actionable. Without them, the glossary is a standalone document. With them, Ask Ontos can answer "What does this column mean?", agents can understand business context, and data products gain discoverability through business terminology.

**Prerequisites:**
- PREQ-1: A business glossary with terms must exist (CUJ-4)
- PREQ-2: Target objects (products, contracts, assets) must exist in Ontos

**Steps:**
1. **Navigate to the target object** — this can be:
   - A **Data Product** detail page → Semantic Links panel
   - A **Data Contract** detail page → Schema tab → individual columns
   - An **Asset** in the Asset Explorer → detail page
   - A **Collection/Concept** in the Concepts Browser
2. **Open the Semantic Links panel** (or "Business Terms" section)
3. **Search or browse the business glossary** for relevant terms:
   - Type-ahead search across all published glossary terms
   - Browse by domain or collection
   - View term definitions before linking
4. **Assign one or more terms** to the object — select the matching concepts
5. **For schema-level linking** (on Data Contracts): link terms at the individual property/column level for fine-grained semantic annotation
6. **Optionally add context notes** explaining why this term applies (e.g., "This column represents ARR as defined by Finance, calculated on a trailing 12-month basis")
7. **Save the assignment** — the semantic link is persisted and immediately available to:
   - Ask Ontos for semantic reasoning
   - MCP Server for agent grounding
   - Search for improved discovery

**Ontos Implementation:**
- Backend: `SemanticLinksManager` — `/api/semantic-links/*` (create, list, delete links between any Ontos entity and concept IRIs)
- Frontend: Semantic linking panels appear on Data Product, Data Contract, and Asset detail pages
- Links are three-tier: Product/Contract level → Schema level → Property/Column level

**Success Criteria:** UC objects are enriched with semantic metadata. Ask Ontos and agents can resolve business terms to actual data assets. Discovery quality improves for semantically-annotated objects.

---

### CUJ-11 — Add Metadata to Ontos Objects

**Priority:** Medium — enrichment capability
**Persona:** Data Engineer / Data Steward
**Goal:** Enrich objects in Ontos with additional metadata beyond what Unity Catalog provides natively — quality expectations, refresh frequency, sensitivity classification, business owner, and custom properties.

**Prerequisites:**
- PREQ-1: User must have write permissions to the relevant feature
- PREQ-2: Target objects must exist in Ontos

**Steps:**
1. **Select an Ontos object** — Data Product, Data Contract, Asset, or Concept
2. **Navigate to the detail page** and locate the relevant panel:
   - **Custom Properties** — add arbitrary key-value metadata
   - **Quality** — define data quality expectations, SLA metrics, freshness requirements
   - **Costs** — document cost implications (compute, storage, licensing)
   - **Tags** — apply classification tags from the configured taxonomy
   - **Comments** — add notes, discussions, and context for other users
   - **Ratings** — rate the object for quality/usefulness (consumer perspective)
3. **Edit the metadata** using inline editing or dialog forms on the detail page
4. **Link to external documentation** — add URLs to wikis, runbooks, or external systems
5. **Save the enriched metadata**

**Ontos Implementation:**
- Frontend: Polymorphic detail pages render different panel sets depending on entity type (see `.cursor/rules/10-entity-panel-matrix.mdc`)
- Panels include: Metadata, Custom Properties, Tags, Comments, Ratings, Costs, Quality, Lineage, Impact Analysis, Ownership
- Backend: Each entity type's routes support custom properties, tags, comments, ratings, etc.

**Success Criteria:** Objects carry rich, contextual metadata that goes beyond native UC tags and domains, enabling better governance, discovery, and agent grounding.

---

## Group #10.x — Marketplace & Consumption

### CUJ-10 — Find a Data Product in the Marketplace

**Priority:** Medium — consumer-side of the data product workflow
**Persona:** Data Analyst / Data Scientist / Business User
**Goal:** Discover and evaluate data products relevant to a business need.

**Prerequisites:**
- PREQ-1: User must have at least Data Consumer role
- PREQ-2: Published (ACTIVE) data products must exist

**Steps:**
1. **Navigate to the Marketplace** (`/marketplace`) or use the **Discovery Section** on the Home page
2. **Search by keyword, domain, or semantic term**:
   - Free-text search: "customer churn", "revenue by region"
   - Domain filter: select a specific business domain
   - Status filter: ACTIVE, CERTIFIED
   - Tag filters: browse by classification tags
3. **Browse results** with metadata preview:
   - Product name, description, and owner
   - Domain and tags
   - Quality/certification status
   - Delivery methods available
4. **Drill into a data product** to review:
   - Full ODPS documentation and getting started guide
   - Schema definitions across deliverables
   - Quality metrics and SLA commitments
   - Sample data (if available)
   - Consumer ratings and comments
   - Lineage and upstream dependencies (Consumables)
   - Semantic terms linked to the product
5. **View related data products** — explore products in the same domain or linked by semantic relationships
6. **Evaluate fit for purpose** — review the contract terms, quality expectations, and delivery methods to determine if the product meets your needs

**Ontos Implementation:**
- Backend: `GET /api/data-products/published` and `GET /api/data-products/my-subscriptions`
- Frontend: `marketplace-view.tsx` (dedicated marketplace at `/marketplace`), `discovery-section.tsx` (home page widget)
- Frontend: `data-catalog.tsx` (catalog browse, separate from marketplace)
- Search: `SearchManager` indexes data products, contracts, glossary terms for cross-feature search

**Success Criteria:** User finds a relevant data product and understands its content, quality, delivery methods, and how to access it.

---

### CUJ-12 — Publish a Data Product to the Marketplace

**Priority:** Medium — distribution mechanism for data products
**Persona:** Data Product Owner
**Goal:** Make a certified data product available for discovery and consumption via the Ontos marketplace.

**Prerequisites:**
- PREQ-1: Data Product must be in CERTIFIED status (see [02. Lifecycle States](02-lifecycle-states.md))
- PREQ-2: User must be the Product Owner or have appropriate permissions

**Steps:**
1. **Open the data product detail page** (`/data-products/:id`)
2. **Review completeness** against the readiness checklist:
   - Documentation complete (description, getting started, usage examples)
   - At least one deliverable with linked assets
   - Quality rules defined and passing
   - Delivery methods set for each deliverable
   - Access policies configured
   - Data contracts linked (recommended but optional)
   - Team and support contacts defined
3. **Verify certification** — ensure the product has been certified by a Data Steward (status: CERTIFIED)
4. **Deploy to production** — the Lead Engineer deploys the certified version (status transitions from CERTIFIED)
5. **Click "Publish"** — transitions the product to ACTIVE status
6. **Configure visibility**:
   - Organization-wide (default for ACTIVE products)
   - Domain-scoped (visible only within specific domains)
7. **Set licensing/contract terms** if applicable — link data contracts that define terms of use
8. **Confirm publication** — the product appears in the marketplace, searchable and browsable by all authorized consumers

**Ontos Implementation:**
- Backend: `data_product_routes.py` — lifecycle endpoints (sandbox, certify, approve, publish, deprecate)
- Backend: Published products served via `GET /api/data-products/published`
- Frontend: Lifecycle action buttons on `data-product-details.tsx` (context-dependent based on current status)
- Visibility rules follow [02. Lifecycle States — Privacy & Visibility Rules](02-lifecycle-states.md#3-privacy--visibility-rules)

**Success Criteria:** The data product appears in the marketplace, searchable and browsable by authorized consumers. The product's metadata, documentation, and access information are publicly visible within the organization.

---

### CUJ-13 — Subscribe to / Sign a Contract for a Data Product

**Priority:** Medium-Low — governance formality, important for regulated industries
**Persona:** Data Consumer / Team Lead
**Goal:** Request and formalize access to a data product with agreed-upon terms.

**Prerequisites:**
- PREQ-1: User must have Data Consumer role
- PREQ-2: A published (ACTIVE) data product must exist

**Steps:**
1. **Find the data product** via the Marketplace (CUJ-10) or direct link
2. **Review the data product's terms**:
   - Linked data contracts (schema, quality commitments, SLAs)
   - Delivery methods available per deliverable
   - Data handling requirements and sensitivity classification
   - Usage limitations or restrictions
3. **Click "Subscribe"** on the product detail page
4. **Specify subscription details**:
   - Intended use case (analytics, ML model, operational system)
   - Consuming team/system
   - Requested deliverables (which output ports to access)
5. **Submit the subscription request** — this is recorded in the database as a consumer→product relationship
6. **Data Product Owner reviews** (if approval workflow is configured):
   - Reviews the consumer's use case
   - Approves or negotiates terms
   - May request additional information
7. **Subscription is confirmed** — the consumer:
   - Appears in the product's subscriber list (visible to the Product Owner)
   - Receives notifications about product updates, deprecations, and breaking changes
   - Can provide ratings and feedback on the product
8. **Access is provisioned** — depending on delivery method:
   - Table Access: UC grants are configured
   - Serving Endpoint: API credentials are provided
   - File Export: export schedule is established

**Ontos Implementation:**
- Backend: `data_product_routes.py` — subscription endpoints (subscribe, unsubscribe, `GET /data-products/my-subscriptions`)
- Backend: Subscriptions feed into consumer impact analysis and compliance checks
- Frontend: Subscribe button on `data-product-details.tsx`, "My Subscriptions" view at `my-products.tsx`

**Success Criteria:** A formal, auditable record exists between producer and consumer. The consumer is tracked for impact analysis, receives update notifications, and can access the data through the specified delivery method.

---

## Group #14.x — Operations

### CUJ-14 — Troubleshoot Ontos Deployment and Permissions

**Priority:** Medium-Low — operational necessity
**Persona:** Platform Administrator / Solutions Architect
**Goal:** Diagnose and resolve issues with Ontos deployment, including permissions, ontology inference failures, Ask Ontos connectivity, and MCP server issues.

**Why This Matters:** Real-world deployments surface issues like ontology inference failures due to UC permissions, Ask Ontos not recognizing contracts or glossary terms, and MCP connectivity problems. Documented troubleshooting patterns reduce friction in customer deployments.

**Steps:**
1. **Access Ontos application logs**:
   - Backend logs: `/tmp/backend.log` (FastAPI/Uvicorn)
   - Frontend logs: `/tmp/frontend.log` (Vite dev server)
   - In production: Databricks App logs via workspace monitoring
2. **Identify the error category**:
   - **Permissions issues**: UC permissions for the user/service principal
   - **Ontology inference failures**: insufficient source metadata
   - **Ask Ontos issues**: LLM configuration, ontology/glossary not indexed
   - **MCP connectivity**: endpoint URL, token validity, network access
   - **Data access errors**: catalog/schema grants, workspace connectivity
3. **For permissions issues**:
   - Verify UC permissions via Databricks workspace: `GRANT USE CATALOG`, `GRANT SELECT`
   - Check service principal permissions if running as a Databricks App
   - Review RBAC configuration in Settings → Roles
   - Check feature permissions in `features.ts` / `features.py`
4. **For ontology inference failures**:
   - Validate source tables have sufficient metadata (column comments, tags, descriptions)
   - Check the LLM endpoint is configured and responsive in Settings
   - Review error logs for timeout or rate-limit issues
5. **For Ask Ontos issues**:
   - Confirm the LLM is configured (`/api/llm-search/status`)
   - Verify ontology models are enabled and the graph is refreshed
   - Check that glossary terms are published (not in DRAFT status)
   - Test with a simple query first to isolate the issue
6. **For MCP server issues**:
   - Verify the endpoint URL (`/api/mcp`) is accessible from the agent's network
   - Check API token validity and permissions
   - Test with a simple JSON-RPC call (e.g., `tools/list`)
7. **Apply fixes and re-test** — restart is typically not needed (auto-reload in dev mode)
8. **Document the resolution** for future reference

**Ontos Implementation:**
- Backend: Structured logging via `common/logging.py`, middleware error handling via `common/middleware.py`
- Backend: Settings diagnostics via `/api/settings` endpoints
- Backend: Health checks via `/api/llm-search/status`, `/api/settings/connectivity-status`
- Frontend: Error boundaries via `route-error-boundary.tsx`

**Success Criteria:** The issue is resolved and documented. The user/customer can proceed with their Ontos workflow.

---

## Group #15.x — Cross-Cutting Journeys (Composite)

These journeys span multiple CUJs and demonstrate the full Ontos value chain.

### CUJ-15 — End-to-End Ontology-Powered Data Discovery

**Persona:** Business User in a large enterprise
**Goal:** Starting from a business question, use Ontos to find, understand, and access the right data across domains.

**Composed of:**

| Step | CUJ | Action |
| :--- | :--- | :--- |
| 1 | **CUJ-5** (Ask Ontos) | Start with a natural language question: "What data do we have about customer retention?" |
| 2 | **CUJ-10** (Find a Data Product) | Browse marketplace results returned by Ask Ontos; filter by domain and certification status |
| 3 | **CUJ-9** (Review Semantic Terms) | Understand the business meaning of discovered products by reviewing their semantic links and glossary terms |
| 4 | **CUJ-13** (Subscribe to a Data Product) | Request access to the most relevant product; agree to the contract terms |
| 5 | — | Consume the data product in downstream analytics, dashboards, or agent workflows |

**Success Criteria:** A non-technical user goes from a business question to accessing governed, quality-assured data in under 15 minutes, guided by semantic context at every step.

---

### CUJ-16 — Ontology-First Agent Development

**Persona:** AI/ML Engineer building agentic workflows
**Goal:** Build an agent that leverages ontological context for accurate, grounded reasoning.

**Composed of:**

| Step | CUJ | Action |
| :--- | :--- | :--- |
| 1 | **CUJ-1** or **CUJ-2** | Build or infer the ontology — establish the semantic foundation from scratch or from existing UC schemas |
| 2 | **CUJ-4** | Create a Business Glossary — define key business terms that the agent should understand |
| 3 | **CUJ-6** | Build a Knowledge Graph — create the relationship structure connecting concepts to data assets |
| 4 | **CUJ-3** | Ground the agent via MCP — connect the agent to Ontos for real-time semantic context |
| 5 | — | Test and iterate on agent accuracy using ontology refinement — add missing concepts, fix relationships, improve definitions |

**Success Criteria:** An agent exists that leverages Ontos ontological context via MCP, producing more accurate and grounded responses than an agent without semantic context. The agent can answer domain-specific questions using business terminology and reference governed data products.

---

### CUJ-17 — Full Data Product Lifecycle (Contracts First)

**Persona:** Data Product Team (minimal or elaborate)
**Goal:** Take a data product from inception to active consumption following the Contracts First approach.

**Composed of:**

| Step | CUJ | Action | Timeline (Minimal) |
| :--- | :--- | :--- | :--- |
| 1 | **CUJ-0.x** | Set up domain, team, and project | Day 0 |
| 2 | **CUJ-4** | Create or extend the business glossary with relevant terms | Day 0 |
| 3 | — | **Draft Data Contract**: create contract in ODCS format, define schema, quality rules, SLAs | Day 1 |
| 4 | **CUJ-8** | **Create Data Product**: define deliverables, link assets, set delivery methods | Day 1–5 |
| 5 | **CUJ-9** | **Assign semantic terms** to the product and contract | Day 5 |
| 6 | **CUJ-11** | **Enrich metadata**: add quality expectations, costs, documentation | Day 5–6 |
| 7 | — | **Steward Review**: submit for review, steward approves contract and certifies product | Day 7–9 |
| 8 | **CUJ-12** | **Publish**: deploy to production, publish to marketplace | Day 10 |
| 9 | **CUJ-10** | **Consumers discover** the product in the marketplace | Day 10+ |
| 10 | **CUJ-13** | **Consumers subscribe** and begin using the product | Day 10+ |

See [01. Critical User Journeys](01-critical-user-journeys.md) for detailed workflow sequences and sequence diagrams for both minimal and elaborate teams.

**Success Criteria:** A data product moves from inception to active consumption with full governance — contract-backed, steward-certified, semantically enriched, and discoverable in the marketplace.

---

## Implementation Status

| CUJ | Title | Status | Notes |
| :--- | :--- | :--- | :--- |
| CUJ-0.0 | Create a Data Domain | **Implemented** | Full CRUD via `/api/data-domains`, Settings UI |
| CUJ-0.1 | Create a Team | **Implemented** | Team + membership management via `/api/teams` |
| CUJ-0.2 | Create a Project | **Implemented** | Project CRUD via `/api/projects` with domain linkage |
| CUJ-0.3 | Configure Workflows | **Partially Implemented** | Roles, delivery methods, tags exist; formal workflow engine is Phase 2 |
| CUJ-1 | Build Ontology (Manual) | **Implemented** | Upload TTL/OWL, enable, refresh graph, visualize, SPARQL query |
| CUJ-2 | Infer Ontology from Schema | **Implemented** | LLM-assisted generator + industry ontology packs |
| CUJ-3 | Ground Agents via MCP | **Implemented** | MCP server at `/api/mcp`, token management, full tool registry |
| CUJ-4 | Create Business Glossary | **Implemented** | Collections + concepts + import + lifecycle + semantic links |
| CUJ-5 | Ask Ontos (NLQ) | **Implemented** | LLM chat with tool calling, session management, consent flow |
| CUJ-6 | Build Knowledge Graph | **Implemented** | Multiple construction paths (upload, generate, author, industry import) |
| CUJ-7 | Visualize Ontology Graph | **Implemented** | Cytoscape visualization, SPARQL search, graph exploration |
| CUJ-8 | Create a Data Product | **Implemented** | Full ODPS lifecycle, deliverables/consumables, versioning, subscriptions |
| CUJ-9 | Assign Semantic Terms | **Implemented** | Three-tier semantic links (product → schema → property) |
| CUJ-10 | Find in Marketplace | **Implemented** | Marketplace view, discovery section, published products API |
| CUJ-11 | Add Metadata | **Implemented** | Polymorphic detail pages with custom properties, tags, comments, ratings |
| CUJ-12 | Publish Data Product | **Implemented** | Lifecycle transitions (certify → deploy → publish), readiness checklist |
| CUJ-13 | Subscribe to Data Product | **Implemented** | Subscribe/unsubscribe, my-subscriptions view, owner notifications |
| CUJ-14 | Troubleshoot Deployment | **Partial** | Logging, health checks exist; formal troubleshooting guide needed |
| CUJ-15 | E2E Data Discovery | **Implemented** | Composite of existing features |
| CUJ-16 | Ontology-First Agent Dev | **Implemented** | Composite of existing features |
| CUJ-17 | Full Product Lifecycle | **Implemented** | Composite — requires all Phase 1 features from [03. Roadmap](03-implementation-roadmap.md) |

---

## Video Library Plan

Each CUJ should have a short (3–7 minute) walkthrough video. Suggested recording order follows priority:

| Priority | CUJs to Record | Theme |
| :--- | :--- | :--- |
| **Week 1** | CUJ-1, CUJ-2, CUJ-7 | Ontology foundations (build, infer, visualize) |
| **Week 2** | CUJ-4, CUJ-9 | Business glossary and semantic enrichment |
| **Week 3** | CUJ-5, CUJ-3 | Ask Ontos and MCP agent grounding |
| **Week 4** | CUJ-8, CUJ-12, CUJ-10, CUJ-13 | Data product lifecycle end-to-end |
| **Week 5** | CUJ-0.x, CUJ-14 | Setup and troubleshooting |
| **Week 6** | CUJ-15, CUJ-16, CUJ-17 | Cross-cutting composite walkthroughs |

---

## Appendix: CUJ-to-Feature Mapping

| CUJ | Backend Manager(s) | Backend Route(s) | Frontend View(s) | Feature ID |
| :--- | :--- | :--- | :--- | :--- |
| CUJ-0.0 | `DataDomainManager` | `/api/data-domains` | `data-domains.tsx` | `settings` |
| CUJ-0.1 | `TeamsManager` | `/api/teams` | `teams.tsx` | `settings` |
| CUJ-0.2 | `ProjectsManager` | `/api/projects` | `projects.tsx` | `settings` |
| CUJ-0.3 | `SettingsManager` | `/api/settings` | `settings-layout.tsx` | `settings` |
| CUJ-1 | `SemanticModelsManager`, `OntologySchemaManager` | `/api/semantic-models`, `/api/ontology` | `settings-semantic-models.tsx` | `semantic-models` |
| CUJ-2 | `OntologyGeneratorManager`, `IndustryOntologyManager` | `/api/ontology`, `/api/industry-ontologies` | `ontology-generator.tsx` | `semantic-models` |
| CUJ-3 | `MCPTokensManager` | `/api/mcp`, `/api/mcp-tokens` | `settings-mcp.tsx` | `settings` |
| CUJ-4 | `SemanticModelsManager` | `/api/knowledge` | `business-terms.tsx`, `collections.tsx` | `semantic-models` |
| CUJ-5 | `LLMSearchManager` | `/api/llm-search` | `search.tsx`, `llm-search.tsx` | `search` |
| CUJ-6 | `SemanticModelsManager`, `OntologyGeneratorManager` | `/api/semantic-models`, `/api/knowledge` | `ontology-generator.tsx`, `knowledge-graph.tsx` | `semantic-models` |
| CUJ-7 | `SemanticModelsManager` | `/api/semantic-models` | `ontology-home.tsx`, `knowledge-graph.tsx`, `kg-search.tsx` | `semantic-models` |
| CUJ-8 | `DataProductsManager` | `/api/data-products` | `data-products.tsx`, `data-product-details.tsx` | `data-products` |
| CUJ-9 | `SemanticLinksManager` | `/api/semantic-links` | Detail pages (products, contracts, assets) | `semantic-models` |
| CUJ-10 | `DataProductsManager` | `/api/data-products/published` | `marketplace-view.tsx` | `data-products` |
| CUJ-11 | Various entity managers | Various entity routes | Polymorphic detail pages | Per-entity |
| CUJ-12 | `DataProductsManager` | `/api/data-products` | `data-product-details.tsx` | `data-products` |
| CUJ-13 | `DataProductsManager` | `/api/data-products` | `data-product-details.tsx`, `my-products.tsx` | `data-products` |
| CUJ-14 | Various | Various health/status endpoints | Settings, logs | `settings` |
| CUJ-15 | Composite | Composite | Composite | Multiple |
| CUJ-16 | Composite | Composite | Composite | Multiple |
| CUJ-17 | Composite | Composite | Composite | Multiple |

---

*This document synthesizes the CUJ framework from the Ontos CUJs planning document with the existing user journey documentation and actual implementation state of the Ontos platform. It should be updated as features are added or workflows change.*

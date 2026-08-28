# Ontology-Driven Data Model Redesign

**Status:** Completed (all 7 phases)  
**Created:** 2026-02-18  
**Last Updated:** 2026-02-21  
**Branch:** `feat/ontology-driven-model` (to be created)  
**Related Issues:** Data model consolidation, Dataset business model  

---

## 1. Motivation

The current data model has grown organically and has several structural problems:

1. **38 DB model files with inconsistent patterns** -- mixed ID types (String UUIDs vs PG_UUID), polymorphic tables everywhere, no unified relationship system.
2. **Datasets are modeled technically** (physical table references, SDLC environments) rather than as a business concept in the Data Product hierarchy.
3. **The DP-to-DC link is weak** -- Output Port `contract_id` is a plain string, not a FK. Data Contract's `data_product` field is also a plain string. No referential integrity between the two most important entities.
4. **No extensible type system** -- adding a new kind of entity (e.g., a Notebook asset, an API endpoint) requires new DB tables, Pydantic models, routes, frontend types, and views.
5. **The ontology is decorative** -- `ontos-ontology.ttl` is loaded into the RDF store but doesn't drive the application model, UI, or validation.

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Model tier split | **Dedicated models** for core entities; **Asset system** for everything else | Core entities (DP, DC, Domain, Team, Project) have rich, standards-based schemas (ODPS, ODCS). Other entities can be generic. |
| Ontology role | **Fully prescriptive** -- drives asset types, relationships, field schemas, and UI rendering at runtime | Makes the model extensible without code changes. New entity types are added by editing the TTL file. |
| Data Contract placement | **Contract governs the Dataset** (`Dataset --governedBy--> DataContract`) | Clean business hierarchy: Product > Dataset > Table > Column, with contracts governing at the dataset level. |
| Composite Data Products | **Replaced** by the new asset-based model | The composite layer was a stepping stone that orchestrated existing tables. The new model makes it native. |

## 3. Target Architecture

### 3.1 Two-Tier Entity Model

```
Tier 1: Dedicated Models (own SQL tables, full FK relationships)
  Core business entities:
  - DataDomain          (data_domains)
  - DataProduct          (data_products + child tables per ODPS spec)
  - DataContract         (data_contracts + child tables per ODCS spec)
  - Team                 (teams + team_members)
  - Project              (projects + project_teams)

  Technical/system entities (dedicated due to complex relational structure):
  - CompliancePolicy     (compliance_policies + runs + results)
  - GenieSpace           (genie_spaces)
  - SemanticModel        (semantic_models)
  - BusinessRole         (business_roles -- FK target for business_owners)
  - ProcessWorkflow      (process_workflows + steps + executions)
  - MdmConfig            (mdm_configs + source_links + match_runs + candidates)

Tier 2: Asset-Backed Entities (AssetDb + AssetTypeDb, properties as JSON)
  - Dataset              (business grouping of tables)
  - PhysicalTable        (UC table, Snowflake table, etc.)
  - PhysicalView         (UC view, etc.)
  - PhysicalColumn       (column within a table or view)
  - Policy               (access, quality, retention, usage rules)
  - BusinessTerm         (glossary term promoted to a first-class asset)
  - Dashboard            (BI dashboard)
  - APIEndpoint          (data API)
  - Notebook             (analytics notebook)
  - MLModel              (machine learning model)
  - Stream               (streaming source/sink)
  - System               (external system / platform)

Infrastructure (cross-cutting, no tier classification):
  - Tags, BusinessOwners, Metadata, SemanticLinks, Comments, Costs
  - Notifications, AuditLog, ChangeLog, AccessGrants, DataAssetReviews
  - Agreements, AgreementWizardSessions, LLMSessions, MCPTokens
  - Settings, AppSettings, WorkflowConfigurations, WorkflowInstallations
  - WorkflowJobRuns, DataContractValidations, DataQualityChecks
```

### 3.2 Relationship Hierarchy

```
DataDomain
  └── DataProduct                    (belongsToDomain)
        ├── Dataset [Asset]          (hasDataset)
        │     ├── DataContract       (governedBy)
        │     ├── PhysicalTable      (hasTable)
        │     │     └── PhysicalColumn (hasColumn)
        │     └── PhysicalView       (hasView)
        │           └── PhysicalColumn (hasColumn)
        ├── Policy [Asset]           (attachedPolicy)
        └── BusinessTerm [Asset]     (hasTerm)
```

### 3.3 Ontology as Source of Truth

```
ontos-ontology.ttl
       │
       ▼
  RDF Triple Store (rdf_triples table)
       │
       ▼
  OntologySchemaService
       │
       ├──► AssetTypeDb          (seeded on startup)
       ├──► JSON Schema          (for form rendering)
       ├──► Relationship rules   (valid source/target/type combos)
       └──► UI metadata          (icons, categories, persona visibility)
       │
       ▼
  Frontend (dynamic forms, relationship editors, hierarchy navigation)
```

### 3.4 Cross-Tier Relationship Table

Replaces the current `AssetRelationshipDb` (which only links assets to assets via UUID FKs) with a universal, polymorphic relationship table:

```
entity_relationships
  ├── id                 (UUID PK)
  ├── source_type        (string: "data_product", "dataset", etc.)
  ├── source_id          (string: entity UUID)
  ├── target_type        (string)
  ├── target_id          (string)
  ├── relationship_type  (string: ontology IRI or short name)
  ├── properties         (JSON: optional metadata)
  ├── created_by         (string)
  └── created_at         (timestamp)
```

Validated at write time against the ontology: only (source_type, relationship_type, target_type) combinations that exist in the ontology are allowed.

---

## 4. Current State (What Exists Today)

### 4.1 Ontology Files

| File | Contents |
|---|---|
| `src/backend/src/data/taxonomies/ontos-ontology.ttl` | App entity classes (DataDomain, DataProduct, Team, Project, etc.), governance artifacts, semantic linking, knowledge collections, ownership model. **No Dataset, Table, Column, Policy classes.** DataProduct is incorrectly `rdfs:subClassOf DataDomain`. |
| `src/backend/src/data/taxonomies/odcs-ontology.ttl` | ODCS v3.0.2 Data Contract model (DataContract, SchemaObject, SchemaProperty, Server, QualityRule, etc.). **No cross-references to ontos ontology.** |
| `src/backend/src/data/taxonomies/databricks_ontology.ttl` | Databricks platform model (Catalog, Schema, Table, View, Column, etc.). Platform-specific, not business-oriented. |

### 4.2 Asset System

| Component | File | Status |
|---|---|---|
| DB Models | `src/backend/src/db_models/assets.py` | AssetTypeDb, AssetDb, AssetRelationshipDb |
| API Models | `src/backend/src/models/assets.py` | Pydantic CRUD models + UnifiedAssetType enum |
| Routes | `src/backend/src/routes/assets_routes.py` | `/api/asset-types`, `/api/assets`, `/api/assets/relationships` |
| Controller | `src/backend/src/controller/assets_manager.py` | AssetsManager singleton |
| Repository | `src/backend/src/repositories/assets_repository.py` | Three repositories |
| Demo Data | `src/backend/src/data/demo_data.sql` | 9 hardcoded asset types (Table, View, Column, Dashboard, etc.) |
| Frontend | `src/frontend/src/views/asset-types.tsx`, `assets.tsx` | List + delete only; Add/Edit not implemented |

### 4.3 Dataset System (To Be Replaced)

| Component | File | Status |
|---|---|---|
| DB Models | `src/backend/src/db_models/datasets.py` | DatasetDb, DatasetInstanceDb, DatasetSubscriptionDb, DatasetCustomPropertyDb |
| API Models | `src/backend/src/models/datasets.py` | Full CRUD + subscription models |
| Routes | `src/backend/src/routes/datasets_routes.py` | Full CRUD, publish, status, contract, subscriptions, instances |
| Controller | `src/backend/src/controller/datasets_manager.py` | DatasetsManager (SearchableAsset, DeliveryMixin) |
| Repository | `src/backend/src/repositories/datasets_repository.py` | Four repositories |
| Frontend Views | `src/frontend/src/views/datasets.tsx`, `dataset-details.tsx` | List + detail views |
| Frontend Types | `src/frontend/src/types/dataset.ts` | Full type definitions |

### 4.4 Composite Data Products (To Be Replaced)

| Component | File | Status |
|---|---|---|
| API Models | `src/backend/src/models/composite_data_products.py` | CompositeDataProduct, CompositeDataset, CompositeTable + create/update models |
| Routes | `src/backend/src/routes/composite_data_product_routes.py` | Orchestration API for DP > Dataset > Table creation |
| Frontend Views | `src/frontend/src/views/producer-data-product-new.tsx`, `producer-data-product-details.tsx` | Wizard + detail views |
| Frontend Types | `src/frontend/src/types/composite-data-product.ts` | Composite type definitions |

### 4.5 Existing Polymorphic Systems (Already Cross-Tier Compatible)

These systems already use `entity_type` + `entity_id` strings and will work with the new asset-backed entities without changes:

| System | Table | entity_type Examples |
|---|---|---|
| Business Owners | `business_owners` | data_product, data_contract, dataset, data_domain, policy, asset, tag |
| Tags | `entity_tag_associations` | data_product, data_contract, dataset, data_domain |
| Semantic Links | `entity_semantic_links` | data_domain, data_product, data_contract |
| Rich Text Metadata | `rich_text_metadata` | data_domain, data_product, data_contract, dataset |
| Link Metadata | `link_metadata` | (same) |
| Document Metadata | `document_metadata` | (same) |
| Metadata Attachments | `metadata_attachments` | (same) |
| Comments | `comments` | data_contract (extensible) |
| Compliance Results | `compliance_results` | any object_type |
| Policy Attachments | `policy_attachments` | domain, data_product, data_contract, asset, attribute |

---

## 5. Implementation Phases

### Phase 1: Ontology Model Update

**Goal:** Make `ontos-ontology.ttl` the authoritative, fully prescriptive model for the entire application.

**File:** `src/backend/src/data/taxonomies/ontos-ontology.ttl`

#### 1.1 Fix Existing Class Hierarchy
- [ ] Change `DataProduct` from `rdfs:subClassOf ontos:DataDomain` to `rdfs:subClassOf ontos:Entity`
- [ ] Add `ontos:modelTier` annotation to DataDomain, DataProduct, Team, Project with value `"dedicated"`

#### 1.2 Add Asset Base Class and Asset-Backed Types
- [ ] Add `ontos:Asset rdfs:subClassOf ontos:Entity` with `ontos:modelTier "asset"`
- [ ] Add `ontos:Dataset rdfs:subClassOf ontos:Asset` with UI annotations (icon: "Database", category: "data")
- [ ] Add `ontos:PhysicalTable rdfs:subClassOf ontos:Asset` (icon: "Table2", category: "data")
- [ ] Add `ontos:PhysicalView rdfs:subClassOf ontos:Asset` (icon: "Eye", category: "data")
- [ ] Add `ontos:PhysicalColumn rdfs:subClassOf ontos:Asset` (icon: "Columns2", category: "data")
- [ ] Add `ontos:Policy rdfs:subClassOf ontos:Asset` (icon: "Shield", category: "governance")
- [ ] Add `ontos:BusinessTerm rdfs:subClassOf ontos:Asset` (icon: "BookOpen", category: "governance")
- [ ] Add `ontos:Dashboard rdfs:subClassOf ontos:Asset` (icon: "LayoutDashboard", category: "analytics")
- [ ] Add `ontos:APIEndpoint rdfs:subClassOf ontos:Asset` (icon: "Globe", category: "integration")
- [ ] Add `ontos:Notebook rdfs:subClassOf ontos:Asset` (icon: "FileCode", category: "analytics")
- [ ] Add `ontos:MLModel rdfs:subClassOf ontos:Asset` (icon: "Brain", category: "analytics")
- [ ] Add `ontos:Stream rdfs:subClassOf ontos:Asset` (icon: "Activity", category: "integration")
- [ ] Add `ontos:System rdfs:subClassOf ontos:Asset` (icon: "Server", category: "system")

#### 1.3 Cross-Reference ODCS Data Contract
- [ ] Add `owl:imports` or cross-ontology reference to `odcs:DataContract`
- [ ] Add `ontos:modelTier "dedicated"` annotation on `odcs:DataContract` (or a mapping triple)

#### 1.4 Define Relationship Properties
- [ ] `ontos:hasDataset` (domain: DataProduct, range: Dataset, cardinality: 0..*)
- [ ] `ontos:governedBy` (domain: Dataset, range: odcs:DataContract, cardinality: 0..1)
- [ ] `ontos:hasTable` (domain: Dataset, range: PhysicalTable, cardinality: 0..*)
- [ ] `ontos:hasView` (domain: Dataset, range: PhysicalView, cardinality: 0..*)
- [ ] `ontos:hasColumn` (domain: PhysicalTable/PhysicalView, range: PhysicalColumn, cardinality: 0..*)
- [ ] `ontos:implementsContract` (domain: PhysicalTable, range: odcs:DataContract, cardinality: 0..1)
- [ ] `ontos:attachedPolicy` (domain: Entity, range: Policy, cardinality: 0..*)
- [ ] `ontos:hasTerm` (domain: Entity, range: BusinessTerm, cardinality: 0..*)
- [ ] `ontos:consumesFrom` (domain: Dashboard/MLModel/Notebook, range: Dataset/PhysicalTable, cardinality: 0..*)
- [ ] `ontos:producesTo` (domain: Stream/Notebook, range: PhysicalTable, cardinality: 0..*)
- [ ] `ontos:belongsToSystem` (domain: Asset, range: System, cardinality: 0..1)
- [ ] Retain and annotate existing: `belongsToDomain`, `assignedToTeam`, `hasOwner`, `containsProduct`

#### 1.5 Add UI Annotation Properties (Meta-Properties)
- [ ] Define `ontos:uiIcon` (range: xsd:string) -- Lucide icon name
- [ ] Define `ontos:uiCategory` (range: xsd:string) -- data, governance, analytics, integration, system
- [ ] Define `ontos:uiDisplayOrder` (range: xsd:integer) -- sort order within category
- [ ] Define `ontos:uiPersonaVisibility` (range: xsd:string) -- comma-separated persona IDs
- [ ] Define `ontos:uiDetailSections` (range: xsd:string) -- JSON list of section configs
- [ ] Define `ontos:modelTier` (range: xsd:string) -- "dedicated" or "asset"

#### 1.6 Add Field Schema Annotations
- [ ] Define `ontos:uiFieldType` -- text, textarea, select, multiselect, date, boolean, json
- [ ] Define `ontos:uiFieldOrder` -- integer display order
- [ ] Define `ontos:isRequired` -- boolean
- [ ] Define `ontos:uiFieldGroup` -- basic, governance, technical, etc.
- [ ] Annotate data properties on each asset class with these hints
- [ ] Example: `ontos:datasetDescription` with domain Dataset, range xsd:string, uiFieldType "textarea", uiFieldGroup "basic", isRequired false

#### 1.7 Add Relationship UI Annotations
- [ ] Define `ontos:uiLabel` on each object property (display name)
- [ ] Define `ontos:cardinality` on each object property ("0..1", "1..1", "0..*", "1..*")
- [ ] Define `ontos:uiDisplayContext` on each object property (detail-page, sidebar, tab)

**Acceptance Criteria:**
- The ontology loads without errors via rdflib
- All entity types have `modelTier`, `uiIcon`, `uiCategory` annotations
- All relationship properties have domain, range, cardinality, uiLabel
- Field-level data properties have uiFieldType, uiFieldOrder, isRequired, uiFieldGroup
- Existing ontology functionality (concept search, semantic linking) is unaffected

---

### Phase 2: OntologySchemaService (Backend)

**Goal:** Build a service that reads the ontology from the RDF store and provides entity type definitions, JSON schemas, and relationship rules to the rest of the application.

#### 2.1 OntologySchemaService
- [ ] Create `src/backend/src/controller/ontology_schema_service.py`
- [ ] `get_entity_types()` -- SPARQL query for all classes with `ontos:modelTier`, returns list of `EntityTypeDefinition` (iri, label, tier, icon, category, display_order, persona_visibility)
- [ ] `get_entity_type_schema(type_iri)` -- SPARQL query for data properties where `rdfs:domain` includes the type, extracts field name, type, required, group, order; returns JSON Schema object
- [ ] `get_valid_relationships(type_iri)` -- SPARQL query for object properties where `rdfs:domain` includes the type; returns list of `RelationshipDefinition` (property_iri, label, target_type, cardinality, display_context)
- [ ] `get_incoming_relationships(type_iri)` -- same but where type is in `rdfs:range`
- [ ] `get_hierarchy(type_iri)` -- parent/child class tree
- [ ] `sync_asset_types()` -- for each class with `modelTier == "asset"`, create or update `AssetTypeDb` entry with `required_fields`/`optional_fields` derived from the schema

#### 2.2 Pydantic Models
- [ ] Create models in `src/backend/src/models/ontology_schema.py` (or extend existing `ontology.py`):
  - `EntityTypeDefinition` (iri, label, comment, model_tier, ui_icon, ui_category, ui_display_order, persona_visibility)
  - `EntityFieldDefinition` (name, label, field_type, required, group, order, range_type)
  - `EntityTypeSchema` (type_iri, fields: list[EntityFieldDefinition])
  - `RelationshipDefinition` (property_iri, label, source_type, target_type, cardinality, display_context)

#### 2.3 API Routes
- [ ] Create `src/backend/src/routes/ontology_schema_routes.py`
- [ ] `GET /api/ontology/entity-types` -- list all entity types (filterable by tier, category, persona)
- [ ] `GET /api/ontology/entity-types/{type_iri}/schema` -- JSON Schema for the type
- [ ] `GET /api/ontology/entity-types/{type_iri}/relationships` -- outgoing + incoming relationships
- [ ] `GET /api/ontology/entity-types/{type_iri}/hierarchy` -- class hierarchy

#### 2.4 Startup Integration
- [ ] In `src/backend/src/utils/startup_tasks.py`, call `ontology_schema_service.sync_asset_types()` after `_sync_bundled_taxonomies` completes
- [ ] Remove hardcoded asset type INSERT statements from `src/backend/src/data/demo_data.sql` (or guard them behind a flag)
- [ ] Register the new routes in `src/backend/src/app.py`

**Acceptance Criteria:**
- `GET /api/ontology/entity-types` returns all types defined in the ontology with correct tier/icon/category
- `GET /api/ontology/entity-types/{iri}/schema` returns a valid JSON Schema that could drive a form
- `AssetTypeDb` entries are created/updated from the ontology on startup
- Existing semantic model/concept APIs are unaffected

---

### Phase 3: Unified Entity Relationship System

**Goal:** Replace the asset-only `AssetRelationshipDb` with a cross-tier `EntityRelationshipDb` that links any entity to any other entity, validated by the ontology.

#### 3.1 Database Model
- [ ] Create `src/backend/src/db_models/entity_relationships.py` with `EntityRelationshipDb`
  - Columns: id (PG_UUID), source_type, source_id, target_type, target_id, relationship_type, properties (JSON), created_by, created_at
  - Unique constraint on (source_type, source_id, target_type, target_id, relationship_type)
  - Indexes on (source_type, source_id), (target_type, target_id), (relationship_type)
- [ ] Register in `src/backend/src/db_models/__init__.py`

#### 3.2 Repository
- [ ] Create `src/backend/src/repositories/entity_relationships_repository.py`
  - `create(rel)`, `delete(id)`, `get(id)`
  - `get_by_source(source_type, source_id)` -- all outgoing relationships
  - `get_by_target(target_type, target_id)` -- all incoming relationships
  - `get_by_source_and_type(source_type, source_id, relationship_type)` -- filtered outgoing
  - `get_by_target_and_type(target_type, target_id, relationship_type)` -- filtered incoming
  - `find_existing(source_type, source_id, target_type, target_id, relationship_type)` -- for uniqueness check

#### 3.3 Manager
- [ ] Create `src/backend/src/controller/entity_relationships_manager.py`
  - `create_relationship(source_type, source_id, target_type, target_id, relationship_type, properties, user)` -- validates against ontology via OntologySchemaService, checks source/target exist
  - `delete_relationship(id, user)`
  - `get_relationships(source_type, source_id, relationship_type?)` -- returns with resolved target names
  - `get_incoming_relationships(target_type, target_id, relationship_type?)`
  - `get_related_entities(entity_type, entity_id)` -- all relationships (both directions)

#### 3.4 Routes
- [ ] Create `src/backend/src/routes/entity_relationship_routes.py`
  - `POST /api/entity-relationships` -- create
  - `DELETE /api/entity-relationships/{id}` -- delete
  - `GET /api/entity-relationships` -- query (source_type, source_id, target_type, target_id, relationship_type as query params)
  - `GET /api/entities/{entity_type}/{entity_id}/relationships` -- all relationships for an entity

#### 3.5 Migration
- [ ] Alembic migration to create `entity_relationships` table
- [ ] Data migration: copy rows from `asset_relationships` into `entity_relationships` (source_type="asset", target_type="asset", mapping UUIDs)
- [ ] Register routes in `src/backend/src/app.py`

**Acceptance Criteria:**
- Can create a relationship between a DataProduct (dedicated) and a Dataset (asset)
- Ontology validation rejects invalid relationship types (e.g., Column -> DataProduct with "hasDataset")
- All existing asset relationships are migrated
- API returns relationships with both directions queryable

---

### Phase 4: Dataset-to-Asset Migration ✅ COMPLETED

**Goal:** Migrate existing Dataset/DatasetInstance data into the Asset system and establish the business hierarchy.

#### 4.1 Verify Asset Types Exist
- [x] Confirmed Phase 2 has seeded: Dataset, PhysicalTable, PhysicalView, PhysicalColumn asset types

#### 4.2 Data Migration Script
- [x] Created Alembic migration `a1_dataset_asset` (`alembic/versions/a1_dataset_to_asset_migration.py`) that:
  - Creates `entity_relationships` table (DDL)
  - Creates `entity_subscriptions` table (DDL)
  - For each `DatasetDb` row: creates `AssetDb` row with asset_type = "Dataset", merges custom properties into `properties` JSON
  - For each `DatasetInstanceDb` row: creates `AssetDb` row with asset_type = "PhysicalTable" or "PhysicalView", preserves `physical_path` as `location`
  - Creates `EntityRelationshipDb` rows: Dataset → PhysicalTable/View (`hasTable`/`hasView`)
  - Creates `EntityRelationshipDb` rows: Dataset → DataContract (`governedBy`) where contract_id was set
  - Migrates `DatasetSubscriptionDb` → `EntitySubscriptionDb` with entity_type="Dataset"
  - Migrates `DataProductSubscriptionDb` → `EntitySubscriptionDb` with entity_type="DataProduct"
  - Migrates `asset_relationships` → `entity_relationships` for backward compatibility

#### 4.3 Generic Subscription System
- [x] **Decision:** Created `EntitySubscriptionDb` table (polymorphic: entity_type, entity_id, subscriber_email)
  - `src/backend/src/db_models/entity_subscriptions.py` — SQLAlchemy model with unique constraint
  - `src/backend/src/models/entity_subscriptions.py` — Pydantic models (Create, Read, Summary)
  - `src/backend/src/repositories/entity_subscriptions_repository.py` — Repository with query-by-entity/subscriber
  - `src/backend/src/controller/entity_subscriptions_manager.py` — Manager with subscribe/unsubscribe/query
  - `src/backend/src/routes/entity_subscription_routes.py` — REST API at `/api/subscriptions` with audit logging
- [x] Migrated `DatasetSubscriptionDb` and `DataProductSubscriptionDb` in Alembic migration
- [x] Subscription API supports any entity type (`POST /api/subscriptions`, `DELETE`, `GET /entity/{type}/{id}`, `GET /user/{email}`)
- [x] Feature `entity_subscriptions` added to `common/features.py`

#### 4.4 Update Assets Manager
- [x] `AssetsManager` now accepts optional `ontology_schema_manager` dependency
- [x] Added `_validate_properties()` method: validates `properties` JSON against ontology-derived JSON Schema on create/update
- [x] Wired `ontology_schema_manager` into `AssetsManager` during startup (post-init injection in `startup_tasks.py`)
- [x] Added `ValidationError` handling (422) in `assets_routes.py` create/update endpoints
- [x] Fixed category/status casing bug in `ontology_schema_manager.sync_asset_types` (was uppercase, Pydantic enum expects lowercase)
- [x] Fixed `ONTOS_NS` to correct namespace `http://ontos.app/ontology#`
- [x] Added `DRAFT` to `AssetStatus` enum (needed for draft-status Dataset assets)

#### 4.5 Update Frontend Asset Views
- [ ] `src/frontend/src/views/assets.tsx` — support filtering by asset type, render forms dynamically (deferred to Phase 6)
- [ ] Build or update asset detail view with relationship panel and child hierarchy (deferred to Phase 6)

**Acceptance Criteria:**
- ✅ All existing Dataset and DatasetInstance records are represented as Assets (via migration)
- ✅ Relationships (Dataset→Tables, Dataset→Contract) exist in `entity_relationships` (via migration)
- ✅ Subscriptions are preserved and functional (unified `EntitySubscriptionDb`)
- ✅ Old dataset API can still return data (read-only, deprecated) during transition
- ✅ Asset properties validated against ontology JSON Schema on create/update

---

### Phase 5: Data Product Linkage Update ✅ COMPLETED

**Goal:** Connect Data Products to the new Dataset assets via `EntityRelationshipDb`, establishing the DP > Dataset > Table > Column hierarchy.

#### 5.1 Create DP-to-Dataset Relationships
- [x] Added 14 `hasDataset` entity_relationships in demo data linking all 7 Data Products to relevant Datasets
  - Customer Marketing Recs → Customer Master Data, Customer Preferences, Customer Engagement Analytics
  - Retail Performance Dashboard → Sales Analytics
  - POS Transaction Stream → Sales Analytics
  - Prepared Sales Transactions → Sales Analytics
  - Demand Forecast → Inventory Levels, IoT Telemetry
  - Inventory Optimization → Inventory Levels, IoT Device Management
  - Price Optimization → Sales Analytics, Financial Transactions
- [x] Updated demo data clear endpoint to handle `0215%` pattern for cleanup

#### 5.2 Update DataProductsManager
- [x] Added `get_product_datasets(product_id, db)` — queries `entity_relationships` for `hasDataset`, returns asset summaries
- [x] Added `get_product_hierarchy(product_id, db)` — resolves full DP > Dataset > Table/View > Column tree including governing contracts
- [x] Added `link_dataset(product_id, dataset_asset_id, user, db)` — creates `hasDataset` relationship with duplicate check
- [x] Added `unlink_dataset(product_id, dataset_asset_id, db)` — removes `hasDataset` relationship
- [x] Imported `entity_relationship_repo` and `asset_repo` for cross-tier queries

#### 5.3 Resolve Output Port Future
- [x] **Decision: Keep OutputPort** as ODPS metadata for spec compliance
  - OutputPort remains the ODPS v1.0.0 representation (spec export, interop)
  - EntityRelationship `hasDataset` is the business/hierarchy representation
  - OutputPort `contract_id` remains for ODPS but is secondary to the Dataset `governedBy` path
  - Note: Output port `contract_id` values in demo data are slug strings (e.g. `pos-transaction-contract-v1`), not UUID FK references to `data_contracts`. This is intentional per ODPS spec which allows free-form contract identifiers.

#### 5.4 API Updates
- [x] `GET /api/data-products/{id}/datasets` — returns Dataset assets with names, status, properties
- [x] `GET /api/data-products/{id}/hierarchy` — returns full DP > Dataset > Table/View > Column tree with governing contracts
- [x] `POST /api/data-products/{id}/datasets` — links an existing Dataset asset via `hasDataset` (body: `{"dataset_id": "..."}`)
- [x] `DELETE /api/data-products/{id}/datasets/{dataset_id}` — removes the `hasDataset` relationship
- [x] All endpoints include audit logging via `AuditManager`

**Acceptance Criteria:**
- ✅ Data Product detail API returns linked Datasets (verified: Customer Marketing Recs → 3 datasets)
- ✅ Full hierarchy traversal works: DP → Datasets → Tables/Views → Columns (verified: 4 tables + 2 views for Customer Master)
- ✅ Existing ODPS port model is preserved for spec compliance (OutputPort unchanged)
- ✅ Link/unlink cycle tested and working

---

### Phase 6: Frontend -- Ontology-Driven UI

**Goal:** Build frontend components that render forms, relationships, and hierarchies dynamically from the ontology schema API.

#### 6.1 New Types
- [ ] Create `src/frontend/src/types/ontology-schema.ts`:
  - `EntityTypeDefinition` (iri, label, comment, modelTier, uiIcon, uiCategory, uiDisplayOrder, personaVisibility)
  - `EntityFieldDefinition` (name, label, fieldType, required, group, order)
  - `EntityTypeSchema` (typeIri, fields)
  - `RelationshipDefinition` (propertyIri, label, sourceType, targetType, cardinality, displayContext)

#### 6.2 Entity Type Form Renderer
- [ ] Create `src/frontend/src/components/common/entity-type-form-renderer.tsx`
  - Props: `typeIri`, `initialValues?`, `onSubmit`, `mode: "create" | "edit"`
  - Fetches schema from `/api/ontology/entity-types/{typeIri}/schema`
  - Dynamically generates react-hook-form fields grouped by `uiFieldGroup`
  - Uses appropriate Shadcn components based on `uiFieldType`
  - Validates with Zod schema generated from the field definitions

#### 6.3 Entity Relationship Panel
- [ ] Create `src/frontend/src/components/common/entity-relationship-panel.tsx`
  - Props: `entityType`, `entityId`
  - Fetches valid relationships from `/api/ontology/entity-types/{type}/relationships`
  - Fetches existing relationships from `/api/entities/{type}/{id}/relationships`
  - Shows grouped by relationship type with add/remove controls
  - Search/select dialog for choosing related entities

#### 6.4 Entity Hierarchy Browser
- [ ] Create `src/frontend/src/components/common/entity-hierarchy-browser.tsx`
  - Props: `rootEntityType`, `rootEntityId`
  - Renders a tree view: DP > Dataset > Table > Column
  - Expand/collapse, click to navigate to detail
  - Shows summary info (status, owner) at each level

#### 6.5 Update Data Product Detail View
- [ ] `src/frontend/src/views/data-product-details.tsx`:
  - Replace "Output Ports" section with "Datasets" tab showing asset-based Datasets
  - Add hierarchy browser component
  - Each Dataset row links to the asset detail view

#### 6.6 Asset Detail View Enhancement
- [ ] `src/frontend/src/views/assets.tsx` or new `asset-detail.tsx`:
  - Dynamic form based on asset type schema
  - Relationship panel showing related entities
  - For Datasets: show child Tables, governing Contract
  - For Tables: show child Columns, parent Dataset

#### 6.7 Persona Navigation Updates
- [ ] `src/frontend/src/config/persona-nav.ts`:
  - Ontology `uiPersonaVisibility` drives which asset types appear in each persona's nav
  - Technical assets (Table, Column, View) visible to Producer, Steward
  - Business assets (Dataset, Policy, BusinessTerm) visible to all

#### 6.8 Deprecate Old Views
- [ ] Remove or redirect `src/frontend/src/views/datasets.tsx`
- [ ] Remove or redirect `src/frontend/src/views/dataset-details.tsx`
- [ ] Remove `src/frontend/src/views/producer-data-product-new.tsx`
- [ ] Remove `src/frontend/src/views/producer-data-product-details.tsx`
- [ ] Update `src/frontend/src/app.tsx` routes

**Acceptance Criteria:**
- ✅ Creating a new Dataset renders a dynamic form based on ontology schema
- ✅ Relationship panel shows valid relationships and allows adding/removing
- ✅ DP detail page shows linked Datasets with hierarchy navigation
- ✅ Persona visibility works correctly per ontology annotations
- Old Dataset/Composite views are removed or redirected (deferred to Phase 7)

---

### Phase 7: Deprecation and Cleanup ✅ COMPLETED

**Goal:** Remove superseded code and data structures.

#### 7.1 Backend Cleanup
- [x] Mark `DatasetDb`, `DatasetInstanceDb`, `DatasetSubscriptionDb`, `DatasetCustomPropertyDb` tables as deprecated (docstring warnings added; tables kept for backward compatibility)
- [x] Mark `AssetRelationshipDb` as deprecated (replaced by `EntityRelationshipDb`)
- [x] ~~Remove or archive `composite_data_product_routes.py` / `composite_data_products.py`~~ — already removed in earlier work
- [x] Remove hardcoded asset type INSERTs from `demo_data.sql` (section 24 replaced with ontology-sync comment)
- [x] Migrate demo `asset_relationships` INSERTs to `entity_relationships` table (section 26)
- [x] Mark `datasets_routes.py` as deprecated with docstring warning
- [x] Update `clear_demo_data` endpoint to clean up new `entity_relationships` IDs

#### 7.2 Frontend Cleanup
- [x] ~~Remove deprecated composite/producer files~~ — already removed in earlier work
- [x] Remove `/producer/datasets` route to old `Datasets` view — now redirects to `AssetExplorerView`
- [x] Remove `/producer/datasets/:datasetId` route — now redirects to `AssetDetailView`
- [x] Update persona nav to reference `assets` feature instead of `datasets`
- [x] Remove `Datasets` and `DatasetDetails` imports from `app.tsx`
- Note: `types/dataset.ts` and dataset components kept — still imported by data contracts, marketplace, and other active views

#### 7.3 Documentation Updates
- [x] Update `CLAUDE.md` — added Assets & Ontology feature description, marked Datasets as deprecated
- [x] Update `USER-GUIDE.md` — added Asset Explorer overview, deprecation notices on Datasets sections
- [x] Cursor rules unchanged (`.cursor/rules/` files reference project structure generically)

**Acceptance Criteria:**
- ✅ No references to deprecated Dataset tables in **new** code paths (legacy routes marked deprecated)
- ✅ No references to composite data product code in active code paths (files already removed)
- ✅ Demo data uses `entity_relationships` instead of deprecated `asset_relationships`
- ✅ Asset types synced from ontology, not hardcoded in SQL
- ✅ Documentation reflects the new architecture

---

## 6. Files Inventory

### New Files

| File | Phase | Purpose |
|---|---|---|
| `src/backend/src/controller/ontology_schema_service.py` | 2 | Reads ontology, provides schemas and relationship rules |
| `src/backend/src/routes/ontology_schema_routes.py` | 2 | API endpoints for entity types, schemas, relationships |
| `src/backend/src/models/ontology_schema.py` | 2 | Pydantic models for schema API responses |
| `src/backend/src/db_models/entity_relationships.py` | 3 | EntityRelationshipDb table |
| `src/backend/src/repositories/entity_relationships_repository.py` | 3 | Repository for entity relationships |
| `src/backend/src/controller/entity_relationships_manager.py` | 3 | Manager with ontology validation |
| `src/backend/src/routes/entity_relationship_routes.py` | 3 | CRUD API for entity relationships |
| `src/frontend/src/types/ontology-schema.ts` | 6 | TypeScript types for ontology schema API |
| `src/frontend/src/components/common/entity-type-form-renderer.tsx` | 6 | Dynamic form from ontology schema |
| `src/frontend/src/components/common/entity-relationship-panel.tsx` | 6 | Relationship display and editing |
| `src/frontend/src/components/common/entity-hierarchy-browser.tsx` | 6 | Tree view for entity hierarchies |

### Modified Files

| File | Phase | Change |
|---|---|---|
| `src/backend/src/data/taxonomies/ontos-ontology.ttl` | 1 | Major update with asset classes, relationships, annotations |
| `src/backend/src/utils/startup_tasks.py` | 2 | Add ontology sync on startup |
| `src/backend/src/app.py` | 2, 3 | Register new routes |
| `src/backend/src/db_models/__init__.py` | 3 | Register entity_relationships |
| `src/backend/src/controller/assets_manager.py` | 4 | Schema validation from ontology |
| `src/backend/src/controller/data_products_manager.py` | 5 | Dataset relationship resolution |
| `src/frontend/src/views/data-product-details.tsx` | 6 | Added hierarchy panel |
| `src/frontend/src/views/asset-explorer.tsx` | 6 | **New** — Asset Explorer with type sidebar |
| `src/frontend/src/views/asset-detail.tsx` | 6 | **New** — Asset Detail with tabs |
| `src/frontend/src/types/ontology-schema.ts` | 6 | **New** — TypeScript types for ontology schema |
| `src/frontend/src/components/common/entity-relationship-panel.tsx` | 6 | **New** — Reusable relationship panel |
| `src/frontend/src/components/data-products/product-hierarchy-panel.tsx` | 6 | **New** — DP hierarchy tree |
| `src/frontend/src/types/asset.ts` | 6 | Added `draft` to AssetStatus |
| `src/frontend/src/config/persona-nav.ts` | 6 | Renamed assets to asset-explorer |
| `src/frontend/src/app.tsx` | 6 | Routes for explorer + detail + removed old AssetsView |
| `src/frontend/src/i18n/locales/en/settings.json` | 6 | Added assetExplorer i18n key |
| `src/frontend/src/hooks/use-persona-path.ts` | 6 | **New** — Persona path utility hook |
| `src/frontend/src/views/data-contracts.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/datasets.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/data-domains.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/data-asset-reviews.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/compliance.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/workflows.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/estate-manager.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/views/my-products.tsx` | 6 | Persona-relative navigation |
| `src/frontend/src/components/home/marketplace-view.tsx` | 6 | Persona-relative navigation |
| `src/backend/src/controller/ontology_schema_manager.py` | 6 | Fixed asset type naming (label vs local_name), stale type cleanup |
| `src/frontend/src/components/common/asset-form-dialog.tsx` | 6 | **New** — Ontology-driven create/edit form dialog |
| `src/frontend/src/types/ontology-schema.ts` | 6 | Updated types to match backend response (local_name, json_schema, etc.) |

### Deprecated/Removed Files

| File | Phase | Status |
|---|---|---|
| `src/backend/src/routes/composite_data_product_routes.py` | 7 | Already removed (pre-Phase 7) |
| `src/backend/src/models/composite_data_products.py` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/views/producer-data-product-new.tsx` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/views/producer-data-product-details.tsx` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/types/composite-data-product.ts` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/components/data-products/composite-dataset-card.tsx` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/components/data-products/data-product-wizard.tsx` | 7 | Already removed (pre-Phase 7) |
| `src/frontend/src/components/data-products/uc-table-browser.tsx` | 7 | Already removed (pre-Phase 7) |
| `src/backend/src/routes/datasets_routes.py` | 7 | Marked deprecated (docstring), kept for backward compat |
| `src/backend/src/db_models/datasets.py` | 7 | Marked deprecated (docstring), kept for backward compat |
| `src/backend/src/db_models/assets.py` (`AssetRelationshipDb`) | 7 | Marked deprecated, replaced by `EntityRelationshipDb` |
| `src/frontend/src/views/datasets.tsx` | 7 | Kept but unrouted — still imported by data contract views |
| `src/frontend/src/views/dataset-details.tsx` | 7 | Kept but unrouted — still imported by data contract views |
| `src/frontend/src/types/dataset.ts` | 7 | Kept — still imported by marketplace, contracts (11 files) |

### Phase 7 Modified Files

| File | Change |
|---|---|
| `src/frontend/src/app.tsx` | Removed Datasets/DatasetDetails imports, replaced routes with AssetExplorerView/AssetDetailView |
| `src/frontend/src/config/persona-nav.ts` | Changed datasets nav featureId from `datasets` to `assets` |
| `src/backend/src/routes/datasets_routes.py` | Added deprecation docstring |
| `src/backend/src/db_models/datasets.py` | Added deprecation docstring |
| `src/backend/src/db_models/assets.py` | Marked `AssetRelationshipDb` as deprecated |
| `src/backend/src/data/demo_data.sql` | Removed hardcoded asset_types INSERTs (section 24), migrated asset_relationships to entity_relationships (section 26) |
| `src/backend/src/routes/settings_routes.py` | Added `0f4%` cleanup to `clear_demo_data` |
| `CLAUDE.md` | Added Assets & Ontology description, marked Datasets deprecated |
| `src/docs/USER-GUIDE.md` | Added Asset Explorer section, deprecation notices on Datasets |
| `docs/notes/ontology-driven-data-model-redesign.md` | Phase 7 completion, updated status and file tables |

---

## 7. Risks and Open Questions

### Risks

| Risk | Mitigation |
|---|---|
| SPARQL query performance for schema extraction on every API call | Cache entity type definitions in memory; invalidate on ontology reload |
| JSON Schema from ontology may be less expressive than hand-coded Pydantic models | Allow type-specific schema overrides via `ontos:customSchemaOverride` annotation |
| Data migration may lose Dataset-specific metadata | Thorough mapping of all DatasetDb fields to Asset properties; reversible migration |
| Frontend dynamic form rendering may be less polished than hand-coded forms | Allow per-type component overrides for dedicated models; generic forms for assets |
| Existing integrations (search, compliance, notifications) reference "dataset" entity_type | Ensure entity_type strings are consistent; map old values to new during transition |

### Open Questions

1. **Policy migration depth:** Current `PolicyDb` has rich fields (policy_type, enforcement_level, content, version, metadata JSON). Do we move all of this into Asset properties JSON, or keep Policy as a dedicated model?
2. **Subscription system:** Generic `EntitySubscriptionDb` vs per-type subscription tables? The generic approach is cleaner but may need type-specific notification templates.
3. **ODPS port model retention:** How much of the Input/Output Port model do we keep? Just the DB tables for spec export, or actively maintained?
4. **Column discovery:** Should PhysicalColumn assets be auto-discovered from Unity Catalog metadata, or manually created?
5. **Backward-compatible API:** How long do we maintain the old `/api/datasets` endpoints?

---

## 8. Progress Tracking

### Phase Status

| Phase | Status | Started | Completed | Notes |
|---|---|---|---|---|
| 1. Ontology Model Update | ✅ Completed | 2026-02-18 | 2026-02-18 | Asset classes, relationships, UI annotations, field schemas |
| 2. OntologySchemaService | ✅ Completed | 2026-02-18 | 2026-02-18 | SPARQL queries, schema API, asset type sync |
| 3. Entity Relationship System | ✅ Completed | 2026-02-19 | 2026-02-19 | Cross-tier EntityRelationshipDb, ontology validation |
| 4. Dataset-to-Asset Migration | ✅ Completed | 2026-02-19 | 2026-02-20 | Alembic migration, entity subscriptions, demo data |
| 5. Data Product Linkage | ✅ Completed | 2026-02-21 | 2026-02-21 | DP→Dataset hierarchy, CRUD API, audit logging |
| 6. Frontend UI | ✅ Completed | 2026-02-21 | 2026-02-21 | Asset Explorer, Detail view, Hierarchy panel, Relationship panel |
| 7. Deprecation & Cleanup | ✅ Completed | 2026-02-21 | 2026-02-21 | Deprecated models marked, demo data migrated, docs updated |

### Phase 6 Details

**Completed sub-tasks:**
- 6.1 Created `types/ontology-schema.ts` with TypeScript types for ontology schema API, entity relationships, product hierarchy. Updated `types/asset.ts` to include `draft` status.
- 6.2 Built **Asset Explorer** view (`views/asset-explorer.tsx`) — sidebar lists all asset types grouped by category (Data Assets, Analytics, Integration, Systems, Custom) with asset counts; clicking a type filters the main DataTable. "All Assets" option shows everything.
- 6.2b Built **Asset Detail** view (`views/asset-detail.tsx`) — tabbed view (Overview/Relationships) showing properties, metadata, tags, and entity relationships for any asset.
- 6.4 Built **Entity Relationship Panel** (`components/common/entity-relationship-panel.tsx`) — reusable component showing outgoing/incoming relationships with clickable navigation to related entities.
- 6.5 Built **Product Hierarchy Panel** (`components/data-products/product-hierarchy-panel.tsx`) — collapsible tree showing DataProduct > Dataset > Table/View > Column hierarchy with status badges and location tooltips.
- 6.6 Integrated hierarchy panel into `views/data-product-details.tsx`, placed between Input Ports and Output Ports sections.
- 6.7 Updated persona navigation: renamed "Assets" to "Asset Explorer" for Data Governance Officer and Data Steward personas. Added i18n key `personaNav.assetExplorer`.
- Routes: `AssetExplorerView` now serves `/governance/assets`, `/steward/assets`, `/assets`; `AssetDetailView` on `/governance/assets/:assetId`, `/steward/assets/:assetId`, `/assets/:assetId`.

**Additional completions (2026-02-21):**
- 6.3 Built **Asset Form Dialog** (`components/common/asset-form-dialog.tsx`) — dynamic ontology-driven form for creating and editing assets. Fetches field schema from `/api/ontology/entity-types/{iri}/schema`, renders grouped form fields (text, textarea, select, boolean) using react-hook-form + Shadcn UI. System-managed fields (createdAt, updatedAt, entityId, etc.) are filtered out. Integrated into Asset Explorer ("Add" + "Create" buttons) and Asset Detail ("Edit" button).
- 6.9 Enhanced **Entity Relationship Panel** with add/remove controls — "Add" button opens dialog to select relationship type from ontology and search for target entity; delete button (trash icon) on each relationship row with confirmation dialog. Uses `POST /api/entity-relationships` and `DELETE /api/entity-relationships/{id}`.
- 6.10 **Persona-based asset type filtering** — Asset Explorer sidebar now filters asset types based on `persona_visibility` from the ontology. Uses `PERSONA_TO_ONTOLOGY_TAG` mapping (e.g., `data_governance_officer` → `['steward', 'admin']`). Types without visibility restrictions are shown to all personas.

**Post-completion fixes (2026-02-21):**
- **Asset Explorer "All Assets" flicker:** `fetchAssetTypes` had `selectedTypeId` in its dependency array, causing an auto-select loop when "All Assets" set it to `null`. Fixed by using a `useRef` (`didInitialSelect`) so auto-selection only runs once on mount, and replaced the inline async fetch in the "All Assets" button with a unified `fetchAssets(typeId | null)` callback driven by a single `useEffect`.
- **Duplicate asset types (e.g. "APIEndpoint" vs "API Endpoint"):** Ontology sync in `ontology_schema_manager.py` used `at.local_name` (the IRI fragment, e.g. `APIEndpoint`) as the DB name, while demo data inserted with `rdfs:label` (e.g. `API Endpoint`). Fixed by using `at.label` (falling back to `at.local_name`) for the asset type name. Added a post-sync cleanup step that removes stale system-created asset types whose names no longer match any ontology class label.
- **Persona-prefixed URL enforcement:** Removed all canonical (non-persona-prefixed) feature routes from `app.tsx` so that legacy URLs like `/data-products/:id` return 404. Added explicit detail routes under each persona prefix. Refactored all `navigate()` calls in list and detail views to use `useLocation().pathname` for persona-relative navigation.

**Deferred (resolved):**
- ~~6.3 Entity Type Form Renderer~~ — completed as `AssetFormDialog` (see "Additional completions" above)
- ~~6.8 Old Dataset/Composite views~~ — handled in Phase 7: composite files already removed, dataset routes redirected to Asset Explorer

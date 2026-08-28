# Plan: Unified Entity Lifecycle Tracking

> Source PRD: [#86](https://github.com/databrickslabs/ontos/issues/86) / `docs/prd-unified-lifecycle-tracking.md`

## Architectural decisions

Durable decisions that apply across all phases:

- **Three orthogonal dimensions**: Status (lifecycle), Certification (levelled trust), and Publication (marketplace scope) are independent, never conflated into a single enum.

- **Entity scope**:
  - Data Products + Data Contracts: all three dimensions
  - Datasets + Assets: Status + Certification only (no independent publication)
  - Ontology Concepts (ConceptStatus): unchanged, separate lifecycle (deferred alignment)

- **Shared status enum**: One `EntityStatus` with values `draft`, `sandbox`, `proposed`, `under_review`, `approved`, `active`, `deprecated`, `retired`. Per-entity `valid_transitions` dicts control reachability.

- **Certification schema** (on each certifiable entity table):
  - `certification_level` (Integer, nullable, FK-like reference to `certification_levels.level_order`)
  - `inherited_certification_level` (Integer, nullable, persisted)
  - `certified_at`, `certified_by`, `certification_expires_at`, `certification_notes`

- **Certification levels config table** (`certification_levels`):
  - `id` (UUID PK), `level_order` (Integer, unique), `name`, `description`, `icon`, `color`, `created_at`, `updated_at`
  - Admin-configurable. Seed: Bronze (1), Silver (2), Gold (3).

- **Publication schema** (on Data Products + Data Contracts only):
  - `publication_scope` (String, default "none", indexed) with enum: `none`, `domain`, `organization`, `external`
  - `published_at`, `published_by`
  - Old `published` Boolean column dropped (clean break)

- **Certification API routes**:
  - `POST /api/data-products/{id}/certify` -- body: `{level, notes}`
  - `DELETE /api/data-products/{id}/certify` -- revoke
  - Same pattern for `/data-contracts/`, `/datasets/`, `/assets/`
  - Gated to Steward/Admin roles

- **Publication API routes**:
  - `POST /api/data-products/{id}/publish` -- body: `{scope}`
  - `DELETE /api/data-products/{id}/publish` -- unpublish
  - Same pattern for `/data-contracts/`
  - Prerequisite: entity status must be `active`

- **Marketplace route**: `GET /api/data-products/published` gains `?scope=`, `?domain_id=`, `?min_certification=` query params

- **Controller renames**:
  - `submit_for_certification()` -> `submit_for_review()`
  - `publish_product()` -> `activate_product()`
  - Route paths updated accordingly

- **Certification inheritance**: Transitive BFS through `entity_relationships`. Effective = `max(own, inherited)`. Persisted column, event-driven on certify/decertify.

- **Ontology properties**: `ontos:certificationLevel` (xsd:integer), `ontos:publicationScope` (xsd:string), `ontos:inheritedCertificationLevel` (xsd:integer). `ontos:lifecycle` deprecated.

- **Frontend components**: `CertificationBadge` (shield + level name), `PublicationBadge` (scope icon), `LifecycleSummaryPanel` (combined card for detail pages). Three inline badges in all list tables.

---

## Phase 1: Certification Levels Config

[#87](https://github.com/databrickslabs/ontos/issues/87)

**User stories**: 8, 9, 10

### What to build

Admin-configurable certification levels end-to-end. A new database table stores ordered trust levels (Bronze, Silver, Gold by default). CRUD API routes let admins manage them. A new "Certification Levels" section in the Settings page provides a drag-to-reorder table with add/edit/delete. Deletion is soft-prevented when a level is actively referenced by any entity.

### Acceptance criteria

- [ ] `certification_levels` table created via Alembic migration with seed data
- [ ] CRUD API routes (list, create, update, delete with guard) functional
- [ ] DELETE returns 409 with affected entity count when level is in use
- [ ] Settings page shows "Certification Levels" section (Admin only) with reorder, add, edit, delete
- [ ] Unit + integration tests for repository and routes

---

## Phase 2: Shared EntityStatus Enum + Ontology Alignment

[#88](https://github.com/databrickslabs/ontos/issues/88)

**User stories**: 13, 16, 22

### What to build

Unify the status lifecycle across all entity types. A shared `EntityStatus` enum replaces entity-specific enums. `CERTIFIED` and `PUBLISHED` are removed as status values. Transition maps are simplified (no `active -> certified`). Controller methods are renamed (`submit_for_certification` -> `submit_for_review`, `publish_product` -> `activate_product`). The ontology is updated: `ontos:status` options expanded, `ontos:lifecycle` deprecated, new certification/publication/inheritance properties added.

### Acceptance criteria

- [ ] Shared `EntityStatus` enum in backend and frontend, replacing entity-specific enums
- [ ] `CERTIFIED` and `PUBLISHED` removed from all status enums
- [ ] Transition maps simplified in all controllers
- [ ] Controller methods and route paths renamed
- [ ] Ontology updated: status options, lifecycle deprecated, new properties added
- [ ] Unit tests for valid/invalid transitions with simplified maps
- [ ] Existing tests updated for renamed methods/routes

---

## Phase 3: Data Product Certification

[#89](https://github.com/databrickslabs/ontos/issues/89) -- blocked by Phases 1, 2

**User stories**: 1, 20

### What to build

Certification for Data Products end-to-end. Certification columns added to the `data_products` table. A `CertificationInfo` model handles validation. Certify and decertify API endpoints are gated to Steward/Admin roles. Existing `status="certified"` rows are migrated to `status="active"` + top certification level. A `CertificationBadge` component shows the level visually. The product detail page gets a certification section; the product list table shows an inline badge.

### Acceptance criteria

- [ ] Certification columns on `data_products` via Alembic migration
- [ ] Data migration: `status="certified"` -> `status="active"` + top cert level
- [ ] Certify/decertify endpoints functional with Steward/Admin RBAC (403 for others)
- [ ] Level validated against `certification_levels` config table
- [ ] `CertificationBadge` component renders level name/icon, handles uncertified
- [ ] Certification section on product detail page; inline badge in product list
- [ ] Unit + component tests

---

## Phase 4: Data Product Publication Scope

[#90](https://github.com/databrickslabs/ontos/issues/90) -- blocked by Phase 2

**User stories**: 5, 6, 12

### What to build

Scoped publication for Data Products end-to-end. The `published` Boolean is replaced with `publication_scope` / `published_at` / `published_by` columns; old column dropped. Publish and unpublish API endpoints enforce the active-status prerequisite. Deprecation auto-unpublishes. The marketplace endpoint is fixed to filter by `publication_scope`. Existing `published=True` rows migrate to `publication_scope="organization"`. A `PublicationBadge` component and detail-page section are added.

### Acceptance criteria

- [ ] `published` column replaced with `publication_scope`, `published_at`, `published_by` via migration
- [ ] Data migration: `published=True` -> `publication_scope="organization"`
- [ ] Publish/unpublish endpoints enforce active-status prerequisite
- [ ] Deprecation auto-sets `publication_scope` to "none"
- [ ] Marketplace endpoint filters by `publication_scope != "none"` AND `status == "active"`
- [ ] `PublicationBadge` component; publish section on detail page; inline icon in list
- [ ] Demo data files updated
- [ ] Unit + component tests

---

## Phase 5: Data Contract Certification + Publication

[#91](https://github.com/databrickslabs/ontos/issues/91) -- blocked by Phases 3, 4

**User stories**: 4

### What to build

Extend certification and publication to Data Contracts, reusing infrastructure from Phases 3 and 4. Certification and publication columns added to `data_contracts`, old `published` column dropped. Contract-specific certify/publish/unpublish endpoints created. Existing contract data migrated. Badges wired into contract list and detail pages.

### Acceptance criteria

- [ ] Certification + publication columns on `data_contracts` via migration; `published` dropped
- [ ] Contract data migrated (certified status, published boolean)
- [ ] Certify/decertify and publish/unpublish endpoints for contracts
- [ ] Auto-unpublish on contract deprecation
- [ ] Badges on contract list and detail pages
- [ ] Unit tests

---

## Phase 6: Dataset + Asset Certification

[#92](https://github.com/databrickslabs/ontos/issues/92) -- blocked by Phase 3

**User stories**: 7

### What to build

Extend certification (without publication) to Datasets and Assets. Certification columns added to `datasets` and `assets` tables. Certify/decertify endpoints created for both entity types. Certification badge wired into dataset and asset list/detail pages.

### Acceptance criteria

- [ ] Certification columns on `datasets` and `assets` via migration
- [ ] Certify/decertify endpoints for datasets and assets with RBAC
- [ ] No publication fields (by design)
- [ ] Certification badge in dataset/asset list and detail pages
- [ ] Unit tests

---

## Phase 7: Certification Inheritance Propagation

[#93](https://github.com/databrickslabs/ontos/issues/93) -- blocked by Phase 6

**User stories**: 2, 11, 21

### What to build

Transitive certification inheritance through entity relationships. A BFS propagator walks `entity_relationships` on certify/decertify events, following the chain Product -> Contract -> Dataset -> Table/View. `inherited_certification_level` is computed and persisted on each downstream entity. The effective displayed level is `max(own, inherited)`. Decertification cascades inherited level removal. Circular references are handled safely. The `CertificationBadge` shows an "inherited" indicator when the level comes from a parent.

### Acceptance criteria

- [ ] BFS propagator walks relationships transitively on certify/decertify
- [ ] `inherited_certification_level` persisted on downstream entities
- [ ] Effective level = `max(own, inherited)` displayed correctly
- [ ] Decertification cascades inherited level removal
- [ ] Circular references handled (no infinite loops)
- [ ] Multi-hop chains work (Product -> Contract -> Dataset -> Table)
- [ ] "Inherited" indicator in CertificationBadge
- [ ] Unit tests: graph walk, max logic, multi-hop, circular refs, decertification cascade
- [ ] Integration test: certify product, verify downstream entities updated

---

## Phase 8: Lifecycle Summary Panel + Marketplace Filters

[#94](https://github.com/databrickslabs/ontos/issues/94) -- blocked by Phases 3, 4

**User stories**: 3, 14, 15, 17, 18, 19

### What to build

UI polish: a reusable `LifecycleSummaryPanel` showing all three dimensions with action buttons, wired to all entity detail pages. Three compact inline badges (status, cert, pub) in all entity list tables. Marketplace enhancements: certification level filter dropdown, sort by (newest, highest certification, most subscribers), and scope/domain/certification query params on the published endpoint.

### Acceptance criteria

- [ ] `LifecycleSummaryPanel` component shows status + certification + publication with permission-aware action buttons
- [ ] Panel wired to product, contract, and asset detail pages
- [ ] Three inline badges in all entity list tables
- [ ] Marketplace endpoint accepts `?min_certification=`, `?scope=`, `?domain_id=`
- [ ] Marketplace UI has certification level filter and sort-by options
- [ ] Component + integration tests

# PRD: Unified Entity Lifecycle Tracking

## Problem Statement

Today, the concepts of **lifecycle status**, **certification**, and **marketplace publication** are conflated across Ontos's major entities. "Certified" and "published" appear as values inside the `status` enum (e.g., `DataProductStatus.CERTIFIED`, `ConceptStatus.PUBLISHED`), but they are fundamentally orthogonal concerns: a Data Product can be `active` AND `certified` AND `published to the marketplace` simultaneously -- these are not mutually exclusive lifecycle states.

This creates several concrete problems:

- **Certification has no metadata.** Data Products and Contracts have `CERTIFIED` as a status value but no `certified_at`, `certified_by`, certification level, or expiration fields. Certification is a one-bit signal with no audit trail, no levels, and no inheritance.
- **Publication is a broken boolean.** Data Products, Contracts, and Datasets have a `published` Boolean column, but the marketplace endpoint (`get_published_products`) ignores it entirely and just filters by `status == 'active'`. The boolean carries no scope information (who can see it?).
- **Status enums are inconsistent.** Each entity has its own status enum with different values: Products have 9 values, Contracts have 8, Datasets have 5, Assets have 4. Some include `certified` and `published` as states, others don't.
- **No certification inheritance.** When a Data Product is certified, its downstream contracts, datasets, and tables should inherit trust -- but there's no mechanism for this.
- **No publication scope.** Publishing is binary (visible/not visible) with no concept of "visible within my domain" vs. "visible to the whole organization."

## Solution

Separate status, certification, and publication into **three orthogonal dimensions**, each with its own data model, API endpoints, and UI components:

1. **Status** tracks the entity's lifecycle (draft, proposed, under_review, approved, active, deprecated, retired). One shared `EntityStatus` enum, per-entity transition maps.
2. **Certification** tracks trust/quality with admin-configurable levels (e.g., Bronze/Silver/Gold). Includes full audit metadata (who, when, expires) and transitive inheritance through entity relationships (Product -> Contract -> Dataset -> Table).
3. **Publication** tracks marketplace visibility with scoped values (none / domain / organization / external). Replaces the broken boolean `published` column.

## User Stories

1. As a **Data Steward**, I want to certify a Data Product at a specific trust level (e.g., "Gold"), so that consumers can gauge the product's quality and governance maturity at a glance.
2. As a **Data Steward**, I want certification to automatically propagate from a Data Product to its linked contracts, datasets, and tables, so that downstream assets inherit trust without manual certification of each one.
3. As a **Data Consumer**, I want to filter the marketplace by certification level (e.g., "Silver or higher"), so that I only discover products that meet my organization's quality bar.
4. As a **Data Consumer**, I want to see certification, publication scope, and lifecycle status as separate visual indicators on each product, so that I can distinguish between "active but uncertified" and "active and gold-certified."
5. As a **Data Producer**, I want publishing a product to the marketplace to be a separate action from activating it, so that I can have an active product that is only visible to my team before I choose to publish it organization-wide.
6. As a **Data Producer**, I want to publish a product with a scope of "domain" so that only users within my data domain can discover it, before I promote it to "organization" scope.
7. As a **Data Producer**, I want to see the effective certification level of my entity (including any inherited level from a parent product), so that I know my dataset is covered even if I haven't independently certified it.
8. As an **Admin**, I want to configure the certification levels available in my organization (number of levels, names like "Bronze/Silver/Gold," icons, colors), so that the certification scheme matches our governance framework.
9. As an **Admin**, I want to be prevented from deleting a certification level that is actively used by entities, so that I don't accidentally invalidate existing certifications.
10. As an **Admin**, I want to drag-and-reorder certification levels in the Settings page, so that I can adjust the level hierarchy as our governance matures.
11. As a **Data Steward**, I want decertifying a product to cascade inherited certification removal to downstream entities, so that trust signals stay accurate.
12. As a **Data Producer**, I want deprecating a product to automatically unpublish it from the marketplace, so that consumers don't discover deprecated products.
13. As a **Data Producer**, I want the "submit for certification" action renamed to "submit for review" (since it moves the entity from draft to proposed, not to certified), so that the UI language matches the actual workflow.
14. As a **Data Consumer**, I want to sort marketplace results by highest certification level, so that I can quickly find the most trusted products.
15. As a **Data Consumer**, I want to sort marketplace results by newest or most subscribers, so that I can find popular or recent products.
16. As any **App User**, I want a consistent status lifecycle across all entity types (Products, Contracts, Datasets, Assets), so that I don't have to learn different status values for each.
17. As a **Data Steward**, I want certification expiration to be reportable via the existing Compliance Check feature, so that I can set up workflows to alert owners before certifications lapse.
18. As a **Data Producer**, I want to see a "Lifecycle Summary" panel on entity detail pages that shows status, certification, and publication info together with action buttons, so that I can manage all three dimensions from one place.
19. As a **Data Consumer**, I want to see three compact inline indicators (status badge, certification shield, publication icon) in table/list views, so that I can scan entities quickly without opening each detail page.
20. As a **Data Steward**, I want only Stewards and Admins to be able to certify entities at any level, so that certification is a governed process rather than self-service.
21. As a **Data Producer**, I want the effective certification level to be max(own, inherited), so that if my table is independently certified Gold but its parent product is Silver, the table still shows Gold.
22. As any **App User**, I want "certified" removed from the status dropdown (since it's now a separate dimension), so that the lifecycle states are clean and non-overlapping.

## Implementation Decisions

### Entity Scope

- **Data Products + Data Contracts** get all three dimensions (Status, Certification, Publication).
- **Datasets + Assets** (Tables, Views, etc.) get Status + Certification only -- they don't independently publish to the marketplace; they inherit marketplace visibility from their parent Product.
- **Ontology Concepts** (ConceptStatus) stay on their own lifecycle for now (RDF-backed, different storage mechanism). Alignment is deferred to a future milestone.

### Dimension 1: Status

- One shared `EntityStatus` enum with 8 values: `draft`, `sandbox`, `proposed`, `under_review`, `approved`, `active`, `deprecated`, `retired`.
- `CERTIFIED`, `PUBLISHED`, and `IN_REVIEW` are removed from all entity-specific enums.
- `SANDBOX` is kept as an optional pre-production testing state (only reachable via Products' transition map).
- Each entity type defines its own `valid_transitions` dict that restricts which states are reachable.
- `APPROVED` and `ACTIVE` are both retained: approved = governance signed off; active = live and serving data.
- Simplified Data Product/Contract transition map (no more `active -> certified`):
  - `active` can only transition to `deprecated`
  - `deprecated` can transition to `retired` or back to `active`
  - `retired` is terminal

### Dimension 2: Certification

- **Admin-configurable levels** stored in a `certification_levels` config table (id, level_order, name, description, icon, color). Not hardcoded.
- Default seed data: Bronze (1), Silver (2), Gold (3).
- Entities store `certification_level` as an integer ordinal (references `level_order` from the config table). `NULL` = uncertified.
- Additional fields on entities: `inherited_certification_level`, `certified_at`, `certified_by`, `certification_expires_at`, `certification_notes`.
- `inherited_certification_level` is a **persisted column**, updated event-driven on certification change (not computed on read).
- Effective displayed level = `max(own_level, inherited_level)`.
- Only **Stewards and Admins** can certify (any level).
- Inheritance propagates **transitively** via BFS walk of `entity_relationships` (Product -> Contract -> Dataset -> Table/View). Flows into asset-backed entities.
- Certification expiration is reported via the **Compliance Check** feature, not a separate background job.
- Admin UI in Settings page: drag-to-reorder, add/edit/delete with soft-prevent if a level is referenced by entities.

### Dimension 3: Publication

- Fixed `PublicationScope` enum: `none`, `domain`, `organization`, `external`. Not admin-configurable.
- Entity must be in `active` status to publish. Auto-unpublish (scope set to `none`) on deprecation.
- Old `published` Boolean column is **dropped** (clean break, no hybrid property).
- Fields: `publication_scope`, `published_at`, `published_by`.
- Three-tier visibility model: Tier 1 (personal draft via `draft_owner_id`), Tier 2 (team/project visible, scope=none), Tier 3 (marketplace visible, scope != none).
- Applies only to Data Products and Data Contracts.

### API Design

- **Certify:** `POST /api/{entity-type}/{id}/certify` with `{level, notes}` body; `DELETE /api/{entity-type}/{id}/certify` to revoke.
- **Publish:** `POST /api/{entity-type}/{id}/publish` with `{scope}` body; `DELETE /api/{entity-type}/{id}/publish` to unpublish.
- **Marketplace:** `GET /api/data-products/published` gains `?scope=`, `?domain_id=`, `?min_certification=` query params.
- Status transition remains `POST /api/{entity-type}/{id}/{action}` (e.g., `/activate`, `/deprecate`).

### Controller Refactoring

- `submit_for_certification()` renamed to `submit_for_review()` (it does draft->proposed, which is a review action)
- `certify_product()` replaced by new `certify_entity(level, notes)`
- `publish_product()` renamed to `activate_product()` (it does approved->active)
- New methods: `publish_entity(scope)`, `unpublish_entity()`, `decertify_entity()`

### Ontology Changes

- Update `ontos:status` uiSelectOptions to the full canonical set. Per-type overrides control which options appear for each entity type.
- Add properties: `ontos:certificationLevel` (xsd:integer), `ontos:publicationScope` (xsd:string), `ontos:inheritedCertificationLevel` (xsd:integer).
- Deprecate `ontos:lifecycle` (redundant with `ontos:status`).
- Existing `ontos:certifiedAt`, `ontos:certifiedBy`, `ontos:certificationExpiresAt` remain as-is.

### Migration Strategy

- **One Alembic migration** adds all new columns, the config table, migrates data, and drops the `published` column.
- Data migration: `published=True` -> `publication_scope="organization"`; `status="certified"` -> `status="active"` + `certification_level=3` (Gold, the top seed level).
- **Phased implementation** of controller/API/UI changes.

### Frontend

- Three inline badges per row in list tables: status badge (colored), certification badge (shield + level name), publication scope icon (lock/users/globe).
- Reusable `LifecycleSummaryPanel` component on all entity detail pages.
- Marketplace: domain filter + certification level dropdown + sort by (newest, highest cert, most subscribers).

### Modules

1. **Lifecycle Core** (`models/lifecycle.py` + `types/lifecycle.ts`): Shared enums and Pydantic models.
2. **Certification Config**: DB model, repository, CRUD routes for `certification_levels` table.
3. **Certification Service**: `certify_entity()` / `decertify_entity()` with RBAC enforcement.
4. **Certification Inheritance Propagator**: BFS walk of `entity_relationships`, persists `inherited_certification_level`.
5. **Publication Service**: `publish_entity(scope)` / `unpublish_entity()` with status prerequisite enforcement.
6. **Status Transition Engine**: Refactored `transition_status()` with simplified transition maps + auto-unpublish side effect.
7. **Alembic Migration**: Single migration file.
8. **Frontend Components**: `CertificationBadge`, `PublicationBadge`, `LifecycleSummaryPanel`.

## Testing Decisions

### Testing Philosophy

Tests should verify **external behavior through public interfaces**, not implementation details. A good test:
- Calls the module's public API (manager method, API endpoint, component render)
- Asserts observable outcomes (DB state, HTTP response, rendered UI)
- Does not mock internal implementation details
- Uses fixtures for setup (following existing `conftest.py` patterns)

### Backend Tests (pytest)

All backend modules will be tested. Prior art follows the existing patterns in `src/tests/unit/` (mock dependencies, test manager methods) and `src/tests/integration/` (test routes via TestClient).

| Module | Test Type | What to Test |
|---|---|---|
| Lifecycle Core | Unit | Enum membership, `CertificationInfo`/`PublicationInfo` Pydantic validation (field constraints, defaults) |
| Certification Config | Unit + Integration | CRUD for certification levels, ordering, deletion guard when level is referenced |
| Certification Service | Unit | Certify with valid/invalid level, RBAC enforcement (mock user roles), expiration field handling, decertification |
| Certification Inheritance Propagator | Unit | BFS correctness with mock relationship graphs, max(own, inherited) logic, multi-hop chains, circular reference handling |
| Publication Service | Unit | Publish with valid/invalid scope, status prerequisite enforcement (reject if not active), auto-unpublish on deprecation |
| Status Transition Engine | Unit | Valid transitions accepted, invalid transitions rejected, auto-unpublish side effect on deprecation, simplified map (no certified state) |
| Alembic Migration | Integration | Run migration up/down, verify column existence, verify data migration correctness |

Prior art: `test_data_products_manager.py` (manager unit tests with mocked DB session and dependencies), `test_data_product_routes.py` (integration route tests), `test_settings_repository.py` (config CRUD tests).

### Frontend Tests (Vitest + React Testing Library)

| Module | Test Type | What to Test |
|---|---|---|
| `lifecycle.ts` types | Unit | Type guard functions, enum value sets |
| `CertificationBadge` | Component | Renders correct level name/icon, handles null (uncertified), shows inherited indicator |
| `PublicationBadge` | Component | Renders correct scope icon, handles each scope value |
| `LifecycleSummaryPanel` | Component | Renders all three dimensions, action buttons enabled/disabled based on status/permissions |

Prior art: `data-product-form-dialog.test.tsx` (component rendering tests), `permissions-store.test.ts` (store/hook tests).

## Out of Scope

- **Ontology Concept (ConceptStatus) alignment**: ConceptStatus stays on its own lifecycle. Alignment with EntityStatus deferred to a future milestone.
- **Compliance-driven auto-certification**: Automatically promoting certification level based on compliance scores is not part of this work.
- **External publication integration**: The `external` publication scope is defined in the enum but no external-facing API or federation mechanism is built.
- **Certification criteria checklists**: Formal checklists that stewards must complete before certifying are deferred.
- **Multi-approver certification workflows**: Only single-actor certification (one steward/admin) is supported; multi-step approval chains are deferred.
- **Notification triggers for certification/publication changes**: Subscriber notifications on cert/publish events can be added incrementally but are not in scope.
- **Search index updates**: Search ranking by certification level is not in scope (can be added later).

## Further Notes

- **Implementation phases**: Phase 1a (data model + migration), Phase 1b (backend logic + API), Phase 2a (frontend types), Phase 2b (frontend UI + Settings), Phase 3 (certification inheritance).
- **Backward compatibility**: This is a breaking change for the `published` column (clean break) and for any code referencing `status = "certified"`. The Alembic migration handles data migration; all code references must be updated in the same release.
- **Demo data**: The `demo_data_loader.py` and any YAML demo data files that reference `status: certified` or `published: true` will need updating.
- **ODPS/ODCS alignment**: The ODPS and ODCS specs include "certified" as a lifecycle state. Our implementation intentionally deviates by treating certification as a separate dimension. This is noted but not considered a compliance issue since the standards are advisory.

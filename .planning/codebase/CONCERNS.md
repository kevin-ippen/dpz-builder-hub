# Codebase Concerns

**Analysis Date:** 2026-03-11

## Tech Debt

**Large Manager Classes:**
- Issue: Several manager classes exceed 3000+ lines, particularly `DataContractsManager` (6063 lines), making them difficult to maintain and test.
- Files: `src/backend/src/controller/data_contracts_manager.py` (6063 lines), `src/backend/src/controller/semantic_models_manager.py` (3802 lines), `src/backend/src/controller/data_products_manager.py` (3339 lines)
- Impact: Hard to navigate, increases cognitive load, higher bug risk, difficult unit testing, slower development velocity
- Fix approach: Break into smaller focused classes using composition or domain-driven design; consider splitting by feature/concern

**Large View Components (Frontend):**
- Issue: Multiple React components exceed 1300+ lines, particularly `data-contract-details.tsx` (3140 lines), `data-contract-wizard-dialog.tsx` (2071 lines), and `data-product-details.tsx` (1820 lines)
- Files: `src/frontend/src/views/data-contract-details.tsx`, `src/frontend/src/components/data-contracts/data-contract-wizard-dialog.tsx`, `src/frontend/src/views/data-product-details.tsx`
- Impact: Difficult to refactor, increased re-render performance issues, hard to test complex logic, maintainability nightmare
- Fix approach: Extract sub-components into separate files; move complex business logic to custom hooks; use container/presentation pattern

**Loose Typing in Frontend:**
- Issue: Multiple components use `any` type assertion for payloads instead of proper TypeScript interfaces
- Files: `src/frontend/src/components/costs/entity-costs-panel.tsx`, `src/frontend/src/components/access/handle-access-grant-dialog.tsx`, `src/frontend/src/components/data-contracts/self-service-dialog.tsx`, `src/frontend/src/components/data-contracts/dqx-suggestions-dialog.tsx`, `src/frontend/src/components/data-products/custom-property-form-dialog.tsx`
- Impact: Type safety lost, potential runtime errors, harder to refactor, IDE autocomplete disabled
- Fix approach: Create specific TypeScript interfaces for each payload; remove all `as any` casts; enforce strict type checking in tsconfig

**Debug Logging Left in Production Code:**
- Issue: Multiple `[DEBUG MANAGER]` log statements left in `DataContractsManager` during active development
- Files: `src/backend/src/controller/data_contracts_manager.py` (lines containing `[DEBUG MANAGER]` prefix)
- Impact: Log pollution, performance overhead, exposes internal structure details
- Fix approach: Remove or convert to conditional DEBUG-level logs; use proper logging framework with levels

**Print Statements in Workflows:**
- Issue: Multiple `print()` statements used instead of proper logging in production workflows
- Files: `src/backend/src/workflows/uc_bulk_import/uc_bulk_import.py`, `src/backend/src/workflows/dqx_profile_datasets/dqx_profile_datasets.py`
- Impact: Output not captured by monitoring/observability systems, harder to debug in production
- Fix approach: Replace all `print()` with logger.info/debug calls

**Datasets Module Deprecation Not Fully Migrated:**
- Issue: `DatasetsManager` marked as deprecated in CLAUDE.md but routes still exist at `/api/datasets`, creating confusion about which API to use
- Files: `src/backend/src/routes/datasets_routes.py`, `src/backend/src/controller/datasets_manager.py` (1686 lines)
- Impact: API consumers unsure which endpoint to use, code duplication with `/api/assets` routes, maintenance burden
- Fix approach: Create migration guide; deprecate routes with proper HTTP warnings; set timeline for removal; redirect clients to assets API

**Hardcoded Fallback Values:**
- Issue: Multiple hardcoded fallback values for missing or undetermined data (e.g., defaulting to TABLE type when asset type determination fails)
- Files: `src/backend/src/controller/data_asset_reviews_manager.py` (line 74: returns AssetType.TABLE as fallback)
- Impact: Silent failures, incorrect data propagation, harder to debug issues
- Fix approach: Raise explicit exceptions with clear error messages instead of silently defaulting

## Known Bugs

**Asset Type Determination Fallback:**
- Symptoms: When asset FQN is malformed or non-standard, defaults to TABLE type without explicit error
- Files: `src/backend/src/controller/data_asset_reviews_manager.py` lines 65-79
- Trigger: Call `_determine_asset_type()` with invalid FQN format (not 3 parts separated by dots) or when WorkspaceClient unavailable
- Workaround: Ensure FQN is properly formatted as `catalog.schema.object` before passing to function

**Settings Manager Performance Issue:**
- Symptoms: Call to retrieve settings blocks entire request, particularly slow call mentioned in code comment
- Files: `src/backend/src/controller/settings_manager.py` (comment on line marked "TODO: This call is too slow")
- Trigger: Calling `get_settings()` endpoint during high load
- Workaround: Consider caching strategy; implement async loading; reduce frequency of setting lookups
- Impact: High request latency, potential timeout issues under load

**Audit Logging Not Implemented:**
- Symptoms: Tests have commented-out audit logging assertions
- Files: `src/backend/src/tests/integration/test_teams_routes.py` (multiple TODO comments about audit logging)
- Trigger: Operations on sensitive entities (teams, roles) that should be logged
- Impact: No audit trail for compliance-critical operations, security/governance gap

## Performance Bottlenecks

**Unbounded Database Queries:**
- Problem: Multiple `.query().all()` calls without pagination or result limits in tools/commands
- Files: `src/backend/src/tools/domains.py`, `src/backend/src/tools/teams.py`, `src/backend/src/tools/projects.py`, `src/backend/src/tools/data_products.py`, `src/backend/src/tools/data_contracts.py`
- Cause: Using hardcoded `.limit(500)` in some places but `.all()` in others; no consistent pagination strategy
- Improvement path: Implement cursor-based or offset pagination; add query result size limits; monitor slow queries; add database indexes on frequently filtered columns

**281 Database Queries in Repositories:**
- Problem: Large number of query operations across repositories may indicate N+1 query problems
- Files: `src/backend/src/repositories/*.py` (aggregate of 281 query operations)
- Cause: Lack of eager loading, missing relationship preloading (selectinload, joinedload)
- Improvement path: Profile with SQLAlchemy query logging; use selectinload for relationships; consolidate multiple small queries into single batch query

**Settings Manager Initialization:**
- Problem: Initialization loads JobsManager, WorkspaceDeployer, and persisted settings synchronously, blocking startup
- Files: `src/backend/src/controller/settings_manager.py` lines 135-168
- Cause: Three potentially slow operations (SDK initialization, file I/O, database loading) in constructor
- Improvement path: Defer heavy initialization; use lazy loading pattern; move to async startup task; implement timeout with fallback

**Frontend Component Re-renders:**
- Problem: Large monolithic components re-render entire UI for minor state changes
- Files: `src/frontend/src/views/data-contract-details.tsx` (3140 lines), `src/frontend/src/components/data-contracts/data-contract-wizard-dialog.tsx` (2071 lines)
- Cause: Global state updates trigger top-level re-render; lack of memo/useMemo optimization; no virtualization for lists
- Improvement path: Extract sub-components with React.memo; use useCallback for handlers; implement virtualization for large lists; split state into smaller stores

## Fragile Areas

**Data Contract Validation:**
- Files: `src/backend/src/controller/data_contracts_manager.py` (validate_schema method, validate_contract_text method)
- Why fragile: Multiple validation paths (format, schema, references), overlapping responsibilities, limited error context
- Safe modification: Add comprehensive test coverage before modifying validation logic; document all validation rules; create validation utilities module
- Test coverage: Need unit tests for edge cases (circular references, reserved keywords, schema collisions)

**Workflow Executor:**
- Files: `src/backend/src/common/workflow_executor.py` (1851 lines)
- Why fragile: Complex state machine, handles multiple workflow types, integrates with external Databricks API, lacks explicit error recovery
- Safe modification: Add integration tests for each workflow type; implement circuit breaker pattern; add comprehensive logging at each step
- Test coverage: Missing tests for workflow failure scenarios, timeout handling, partial execution recovery

**Asset Type Determination Logic:**
- Files: `src/backend/src/controller/data_asset_reviews_manager.py` (lines 65-120)
- Why fragile: Depends on WorkspaceClient availability, FQN format validation, SDK exceptions; multiple fallback paths
- Safe modification: Add explicit protocol detection; improve error messages; create abstraction for asset type resolution
- Test coverage: Need tests for missing/invalid FQN formats, SDK failures, protocol-based asset types (mdm://)

**Session Management:**
- Files: `src/backend/src/common/database.py` (threading, token refresh logic, connection pooling)
- Why fragile: Thread-local state, OAuth token refresh loop, singleton pattern, potential race conditions
- Safe modification: Review thread safety of `_oauth_token` and `_token_refresh_lock`; add comprehensive logging for token refresh events
- Test coverage: Need concurrent load tests for session creation; tests for token expiration scenarios

## Scaling Limits

**Monolithic Managers:**
- Current capacity: Single managers handling all CRUD, validation, search indexing, delivery, and notifications for their domain
- Limit: Performance degrades as operation complexity increases; difficult to parallelize; high memory footprint
- Scaling path: Extract services (SearchService, DeliveryService, ValidationService); implement event-driven architecture; separate read/write concerns

**Query Performance:**
- Current capacity: 281 repository queries across codebase; some workloads load 500+ records without filtering
- Limit: Database becomes bottleneck; response times exceed 2-5 seconds for complex queries; connection pool exhaustion
- Scaling path: Implement database indexing strategy; add query result pagination throughout; use read replicas for search operations; consider caching layer (Redis)

**Frontend Component Rendering:**
- Current capacity: Single 3000+ line component can render in <1s on modern hardware
- Limit: Mobile devices, older browsers, low-end laptops experience significant lag; scrolling/interactions stutter
- Scaling path: Component splitting (done above); virtualization for lists; lazy load dialog contents; implement progressive enhancement

## Dependencies at Risk

**Removed OpenAI Client:**
- Risk: Code comment indicates OpenAI client was removed, but LLM features may still be referenced
- Files: `src/backend/src/controller/data_asset_reviews_manager.py` line 14 (commented import)
- Impact: LLM analysis features will fail at runtime if invoked
- Migration plan: Document which features depend on LLM; either restore OpenAI integration or remove LLM-dependent features; add feature flags for optional LLM

**Optional MLflow Dependency:**
- Risk: MLflow imported lazily to prevent startup failures, suggests it's optional but handling is unclear
- Files: `src/backend/src/controller/data_asset_reviews_manager.py` lines 15-16 (comment about lazy import)
- Impact: Features requiring MLflow may fail mysteriously if import fails; no clear error messages
- Migration plan: Document MLflow as optional dependency; create proper feature flag; provide fallback behavior when MLflow unavailable

## Missing Critical Features

**Audit Trail for Sensitive Operations:**
- Problem: No comprehensive audit logging for security-critical operations (role changes, entitlements updates, compliance violations)
- Blocks: Regulatory compliance (SOX, GDPR, HIPAA), security investigations, breach analysis
- File references: `src/backend/src/tests/integration/test_teams_routes.py` (audit tests commented out)

**Permission Boundary Enforcement:**
- Problem: Permissions checked but unclear if all API endpoints enforce user permissions consistently
- Blocks: Multi-tenant scenarios, user isolation, security posture unclear
- Test coverage needed: Permission boundary testing across all endpoints

## Test Coverage Gaps

**Data Contract Manager Complex Logic:**
- What's not tested: Schema validation with circular references, complex contract versioning, relationship updates with validation
- Files: `src/backend/src/controller/data_contracts_manager.py`
- Risk: Critical business logic changes break silently; regressions in validation rules
- Priority: High

**Large Frontend Components:**
- What's not tested: Behavior of 3000+ line data-contract-details component, complex state interactions, edge cases in form submission
- Files: `src/frontend/src/views/data-contract-details.tsx`, `src/frontend/src/components/data-contracts/data-contract-wizard-dialog.tsx`
- Risk: UI regressions, accessibility issues, broken workflows
- Priority: High

**Workflow Execution Error Paths:**
- What's not tested: Workflow failure scenarios, timeout handling, partial execution recovery, rollback behavior
- Files: `src/backend/src/common/workflow_executor.py`
- Risk: Silent failures, data inconsistency, unrecovered resources
- Priority: High

**Permission System Enforcement:**
- What's not tested: User permission isolation across different roles, boundary conditions (user at role change), feature access denials
- Files: `src/backend/src/common/authorization.py`, route files
- Risk: Security vulnerability, unauthorized access, privilege escalation
- Priority: High

**Database Query Performance:**
- What's not tested: Query performance with realistic data volumes (1000+ records), N+1 detection, slow query identification
- Files: `src/backend/src/repositories/*.py`
- Risk: Performance degradation undetected; slow queries in production
- Priority: Medium

---

*Concerns audit: 2026-03-11*

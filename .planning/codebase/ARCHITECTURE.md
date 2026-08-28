# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** Multi-layered REST API (FastAPI backend) with SPA frontend (React), using **RORO pattern** (Receive an Object, Return an Object) with **Repository** and **Manager** abstraction layers.

**Key Characteristics:**
- Strict separation of concerns across routes → managers → repositories → database models
- Dependency injection throughout via FastAPI's `Depends()` mechanism
- Feature-based authorization with role/permission system
- Manager classes as searchable assets implementing abstract `SearchableAsset` interface
- Async support for SDK calls and background task execution

## Layers

**Route Layer (API Endpoints):**
- Purpose: Expose HTTP endpoints, handle request/response serialization, enforce permissions
- Location: `src/backend/src/routes/*.py` (e.g., `data_product_routes.py`, `compliance_routes.py`)
- Contains: FastAPI routers with `@router.post()`, `@router.get()` decorators
- Depends on: Manager instances, dependency injectors, Pydantic request models
- Used by: HTTP clients (frontend, external integrations)
- Pattern: Each route delegates business logic to a Manager class

**Controller/Manager Layer (Business Logic):**
- Purpose: Implement application logic, coordinate between repositories and external services
- Location: `src/backend/src/controller/*_manager.py` (49 manager classes total)
- Contains: Classes like `DataProductsManager`, `DataContractsManager`, `SearchManager`, `ComplianceManager`
- Depends on: Repository classes, WorkspaceClient (Databricks SDK), NotificationsManager
- Used by: Routes (via dependency injection) and other managers
- Pattern: Each manager implements CRUD operations and domain-specific logic; some implement `SearchableAsset` interface for indexing

**Repository Layer (Data Access):**
- Purpose: Abstract database access, map between Pydantic API models and SQLAlchemy DB models
- Location: `src/backend/src/repositories/*_repository.py`
- Contains: CRUD operations on SQLAlchemy models
- Depends on: SQLAlchemy ORM, database models
- Used by: Manager classes
- Pattern: Extends `CRUDBase[ModelType, CreateSchemaType, UpdateSchemaType]` generic base class

**Model Layers (Data Structures):**
- **API Models (Pydantic):** `src/backend/src/models/*.py` — Validate incoming requests, serialize responses (ODPS-compliant, with extensions)
- **Database Models (SQLAlchemy):** `src/backend/src/db_models/*.py` — Define table schemas and relationships
- Pattern: Repositories map between API and DB models; managers accept/return API models

**Common/Utilities Layer:**
- Purpose: Cross-cutting concerns, configuration, middleware, authorization
- Location: `src/backend/src/common/` — 40+ utility modules
- Key modules:
  - `database.py` — Session management, initialization
  - `config.py` — Settings loading from environment
  - `authorization.py` — Permission checking, user detail fetching
  - `middleware.py` — Request logging, error handling
  - `search_interfaces.py` — `SearchableAsset` interface definition
  - `search_registry.py` — `@searchable_asset` decorator and manager registry
  - `dependencies.py` — FastAPI dependency providers (managers, sessions, users)
  - `workspace_client.py` — Databricks SDK client
  - `logging.py` — Structured logging

## Data Flow

**Create/Update Data Product Flow:**

1. **Frontend (React):** User submits form in `DataProductForm` component → calls `POST /api/data-products` via `useApi` hook
2. **Route Handler:** `data_product_routes.py` receives request with `DataProductCreate` model
3. **Authorization:** `PermissionChecker` dependency validates user has `FEATURE_ID.READ_WRITE` permission
4. **Manager:** `DataProductsManager.create_product()` receives API model (`DataProductCreate`)
5. **Repository:** `DataProductRepository.create()` maps to DB model (`DataProductDb`), persists to database
6. **Notifications:** Manager publishes notifications via `NotificationsManager` (if configured)
7. **Search Indexing:** Manager updates search index via `SearchManager.build_index()` (if `SearchableAsset` implemented)
8. **Response:** Manager returns API model (`DataProduct`), route returns JSON to frontend

**Fetch & Filter Flow:**

1. **Frontend:** Page mounts, calls `useApi('/api/data-products?status=active')` in `useEffect`
2. **Route Handler:** `GET /api/data-products` with query parameters
3. **Manager:** Queries repository with filters → returns paginated results
4. **Repository:** Executes SQLAlchemy query with eager loading (`selectinload`) to avoid N+1 queries
5. **Response:** JSON array sent to frontend, stored in state/store

**Search Flow:**

1. **SearchManager** initialized at startup, collects all managers implementing `SearchableAsset`
2. Builds in-memory index from all indexed entities (Data Products, Contracts, Compliance items, etc.)
3. `POST /api/search` receives query string, returns ranked results across all asset types
4. Optional: LLM-powered search via `LLMSearchManager` for semantic queries

**Permission/Authorization Flow:**

1. **User Login:** Frontend calls `/api/user/permissions` on app load → fetches via Databricks SDK
2. **Store:** `permissions-store` (Zustand) caches user permissions and available roles
3. **Feature Guard:** Routes check `PermissionChecker(FEATURE_ID, FeatureAccessLevel.READ_WRITE)` dependency
4. **UI Guard:** Frontend conditionally renders components based on `hasPermission(featureId, level)`
5. **Role Override:** Admin can apply temporary role override (stored in user session) for testing

**State Management:**

**Backend:** Stateless per-request (sessions via dependency injection)
**Frontend:**
- Global: Zustand stores (`permissions-store`, `user-store`, `notifications-store`, `copilot-store`)
- Local: React `useState` in components
- Transient: API responses cached via `useApi` hook
- Persistent: Settings via localStorage (e.g., theme, UI preferences)

## Key Abstractions

**SearchableAsset Interface:**
- Purpose: Enable managers to expose indexed entities for global search
- Location: `src/common/search_interfaces.py`
- Examples: `DataProductsManager`, `DataContractsManager`, `ComplianceManager`
- Pattern: Manager implements `get_search_index_items()` → returns `List[SearchIndexItem]` → SearchManager aggregates

**DeliveryMixin:**
- Purpose: Support automatic delivery of changes to configured delivery modes (Direct via grants, Indirect via Git)
- Location: `src/common/delivery_mixin.py`
- Examples: `DataProductsManager`, `DataContractsManager`
- Pattern: Manager calls `self.trigger_delivery()` after entity changes → DeliveryService routes to Git/grants

**PermissionChecker Dependency:**
- Purpose: Enforce feature-level access control on routes
- Location: `src/common/authorization.py`
- Example: `@router.post(..., dependencies=[Depends(PermissionChecker('data-products', FeatureAccessLevel.READ_WRITE))])`
- Pattern: Returns boolean; raises HTTPException 403 if denied

**Pydantic Models as Single Source of Truth:**
- Purpose: API schema is defined once in `src/models/*.py`, auto-validated on all requests
- Pattern: Requests validated via `DataProductCreate`, responses via `DataProduct` with optional fields
- Extension: ODPS-compliant (`apiVersion`, `kind`, `spec`, `status`) with Databricks extensions (tags, assets)

## Entry Points

**Backend Server:**
- Location: `src/backend/src/app.py`
- Triggers: `databricks bundle deploy` or local `uvicorn --reload`
- Responsibilities:
  - Initialize configuration & logging
  - Set up database connection and session factory
  - Instantiate all managers as singletons in `app.state`
  - Register all routes
  - Mount static frontend assets
  - Configure CORS and middleware
  - Define startup/shutdown event handlers

**Startup Sequence:**
1. Config loading (environment variables, settings)
2. Database initialization (`init_db`)
3. Manager instantiation (`initialize_managers`) — managers read from DB, rebuild search indices
4. Git service initialization (if configured for indirect delivery)
5. Grant manager initialization (if configured for direct delivery)
6. Delivery service initialization (coordinates all delivery modes)

**Frontend Entry:**
- Location: `src/frontend/src/app.tsx`
- Mounts to: `index.html` root element
- Responsibilities:
  - Set up React Router with named routes
  - Initialize global stores (permissions, user, notifications)
  - Set up theme provider, tooltip provider, toaster
  - Render Layout with nested routes

**Route Structure:**
- `/` — Home page (role-dependent: different views for Admin vs. Data Producer vs. Consumer)
- `/data-products` — Data Products list view
- `/data-products/:productId` — Product detail view
- `/data-contracts` — Contracts list
- `/concepts/*` — Nested concept browser routes (browser, search, graph, hierarchy)
- `/settings/*` — Admin settings pages (nested layout)
- `/search` — Global search
- `/{full_path:path}` — SPA catch-all (serves `index.html` for client-side routing)

## Error Handling

**Strategy:** Structured exception handling with detailed logging; HTTP exceptions propagate to client with error details

**Patterns:**

**Backend:**
```python
try:
    result = manager.create_product(data)
except ValueError as e:
    logger.error("Validation error: %s", e)
    raise HTTPException(status_code=400, detail=str(e))
except PermissionDenied:
    raise HTTPException(status_code=403, detail="Insufficient permissions")
except Exception as e:
    logger.exception("Unexpected error")
    raise HTTPException(status_code=500, detail="Internal server error")
```

**Frontend:**
```typescript
try {
    const response = await fetch('/api/endpoint');
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
} catch (error) {
    console.error("Request failed:", error);
    useToast().error(error.message);
    throw error;
}
```

**Custom Middleware:**
- `LoggingMiddleware` — Logs all requests/responses with timing
- `ErrorHandlingMiddleware` — Catches unhandled exceptions, returns 500 with logging

## Cross-Cutting Concerns

**Logging:**
- Backend: Configured in `config.py`, exposed via `get_logger(__name__)` function
- File location: `/tmp/backend.log` (development), configurable via `LOG_FILE` env var
- Level: DEBUG/INFO/WARNING/ERROR, configurable via `LOG_LEVEL` env var
- Frontend: Console logs; backend logs shipped to file system

**Validation:**
- **Backend:** Pydantic models auto-validate all API inputs; custom validators for complex fields (e.g., ODPS contract validation in `compliance_dsl.py`)
- **Frontend:** Zod schemas in form components; react-hook-form for form state

**Authentication:**
- Databricks OAuth (implicit in Databricks App environment)
- User details fetched via Databricks SDK on app startup
- Cached in permission stores; validated on each protected route

**Caching:**
- Backend: In-memory search index built at startup
- Frontend: Browser cache for static assets; localStorage for UI preferences; transient fetch cache in `useApi`

**Audit Trail:**
- Backend: `AuditManager` logs all entity changes (create, update, delete)
- Location: `src/controller/audit_manager.py`
- Stored in: Database table `audit_log`
- Accessible via: `/api/audit` endpoint

---

*Architecture analysis: 2026-03-11*

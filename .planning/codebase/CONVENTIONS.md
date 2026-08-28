# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

**Files:**
- Python: lowercase with underscores (e.g., `data_products_manager.py`, `data_products_repository.py`)
- TypeScript/React: lowercase with dashes (e.g., `data-products.tsx`, `use-api.ts`, `permissions-store.test.ts`)

**Functions:**
- Python: snake_case (e.g., `create_product`, `get_statuses`, `move_to_sandbox`)
- TypeScript: camelCase (e.g., `useApi`, `checkApiResponse`, `getDomainIdByName`)
- Async functions: Use `async def` in Python, `async` functions in TypeScript

**Variables:**
- Python: snake_case with auxiliary verbs (e.g., `is_loading`, `has_permission`, `_db`, `_repo`)
- TypeScript: camelCase with auxiliary verbs (e.g., `isLoading`, `hasPermission`, `isOpen`, `canWrite`)
- Unused variables: Prefix with underscore (e.g., `_statuses`, `_subscriptionsLoading`, `_setOwners`)

**Types:**
- Python: PascalCase for classes and Enums (e.g., `DataProduct`, `DataProductStatus`, `DataProductRepository`)
- TypeScript: PascalCase for interfaces and types (e.g., `DataProductFormDialogProps`, `ApiResponse<T>`, `CheckApiResponseFn`)
- Database models: PascalCase with `Db` suffix (e.g., `DataProductDb`, `DescriptionDb`, `CustomPropertyDb`)

**Module/Manager Classes:**
- Python: PascalCase with descriptive suffixes: `Manager` for business logic (e.g., `DataProductsManager`), `Repository` for data access (e.g., `DataProductRepository`)

## Code Style

**Formatting:**
- Python: Ruff formatter with 100-character line length
  - Configuration in `src/pyproject.toml` under `[tool.ruff.format]`
  - Quote style: double quotes
- TypeScript: Prettier with 100-character print width
  - Configuration in `src/frontend/.prettierrc`
  - Semi-colons: always
  - Single quotes: true (unless JSX, then double quotes)
  - Trailing comma: es5
  - Arrow parens: always

**Linting:**
- Python: Ruff with eslint-style output
  - Configuration in `src/pyproject.toml` under `[tool.ruff.lint]`
  - Selected rules: E, W, F, I (isort), B, C4, UP, SIM
  - Ignored: E501 (line length), B008 (FastAPI depends), B904 (raise without from)
  - isort first-party: `src`
- TypeScript: ESLint (typescript-eslint) with Prettier compatibility
  - Configuration in `src/frontend/eslint.config.js`
  - Rules allow `any` as warning (not error) for existing code
  - Unused variables: allow underscore prefix (argsIgnorePattern: `^_`)
  - Relaxed React rules for jsx-runtime

## Import Organization

**Order (Python):**
1. Standard library imports (e.g., `import os`, `from datetime import datetime`)
2. Third-party imports (e.g., `from fastapi import APIRouter`, `from sqlalchemy.orm import Session`)
3. Local application imports (e.g., `from src.models.data_products import DataProduct`, `from src.controller.data_products_manager import DataProductsManager`)

**Order (TypeScript):**
1. React and framework imports (e.g., `import React, { useState } from 'react'`)
2. Third-party library imports (e.g., `import { useTranslation } from 'react-i18next'`, `import { Button } from '@/components/ui/button'`)
3. Internal component imports
4. Type imports (e.g., `import { DataProduct } from '@/types/data-product'`)
5. Hook imports (e.g., `import { useApi } from '@/hooks/use-api'`)
6. Store imports (e.g., `import useBreadcrumbStore from '@/stores/breadcrumb-store'`)
7. Utility imports

**Path Aliases:**
- TypeScript: `@/*` maps to `src/*` (configured in `tsconfig.json`)
- Python: First-party package is `src` (configured in `ruff.lint.isort`)

## Error Handling

**Patterns:**
- Python:
  - Use specific exception types first, then generic fallback (e.g., `ValidationError`, `SQLAlchemyError`, `ValueError`)
  - Log before raising: `logger.error(msg); raise HTTPException(...)`
  - Use guard clauses and early returns
  - Structure: `try: ... except SpecificError as e: logger.error(...); raise ... except Exception as e: logger.exception(...); raise HTTPException(500, ...)`
  - Manager/repository layer catches specific exceptions, re-raises or wraps
  - Route layer catches exceptions and converts to HTTPException with appropriate status codes
- TypeScript:
  - Error responses structured as `{ data: T | { detail?: string }, error?: string | null }`
  - Check `response.error` first, then check if `data` contains error detail field
  - Logging via `console.error()` with context prefix (e.g., `"[useApi] GET error from"`)
  - Toasts for user-facing errors via `useToast()` hook
  - Try-catch in hooks with setError state (e.g., `setError(errorMsg)`)

## Logging

**Framework:** Python `logging` module + `get_logger(__name__)` from `src.common.logging`

**Patterns:**
- Python:
  - Get logger at module level: `logger = get_logger(__name__)`
  - Log levels: DEBUG (detailed state), INFO (important milestones), WARNING (recoverable issues), ERROR (failures with context), EXCEPTION (for catch blocks)
  - Include relevant IDs: `logger.debug(f"Manager creating ODPS product from data: {product_data}")`
  - In catch blocks: `logger.exception()` to include traceback, OR `logger.error(msg)` for message-only
  - Critical issues: `logger.critical()`
- TypeScript:
  - Browser console methods: `console.log()`, `console.warn()`, `console.error()`
  - Prefix with feature/hook name: `console.error("[useApi] GET error from", url, ":", error)`
  - Suppress specific warnings in test setup (e.g., React.forwardRef warnings)

## Comments

**When to Comment:**
- Explain non-obvious business logic (e.g., why status must be checked before operations)
- Complex validation rules or ODPS/ODCS spec references
- Integration points with Databricks APIs
- Workarounds for known issues
- Do NOT comment obvious code

**JSDoc/TSDoc:**
- Python: Docstrings for modules, classes, and public methods
  - Format: Triple-quoted strings with description, Args, Returns sections
  - Example from codebase: `"""Create a new ODPS v1.0.0 Data Product...\n\n Args: ...\n"""`
- TypeScript: JSDoc comments for exported functions and types
  - Use inline comments sparingly; let code be self-explanatory

## Function Design

**Size:**
- Keep functions focused and under 50 lines where practical
- Manager methods often orchestrate: call repository, handle notifications, log
- Repository methods handle mapping and database operations

**Parameters:**
- Python: Use type hints extensively; Optional types must have defaults or be checked
  - Manager constructors use optional parameters with warnings if not provided (e.g., `ws_client: Optional[WorkspaceClient] = None`)
- TypeScript: Full type signatures; Props interfaces for React components
  - Generic types for reusable utilities (e.g., `<T>` in `useApi`)

**Return Values:**
- Python: Return Pydantic API models from managers, SQLAlchemy models from repositories
- TypeScript: Return typed objects (e.g., `Promise<ApiResponse<T>>` from hooks)

## Module Design

**Exports:**
- Python:
  - Managers and repositories are instantiated as singletons at app startup, stored in `app.state`
  - Access via dependency injection: `Depends(get_data_products_manager)` in routes
  - See `src/common/dependencies.py` for dependency injector functions
- TypeScript:
  - React components exported as default or named exports
  - Zustand stores exported with hook name (e.g., `export default usePermissionsStore`)
  - Hooks exported as named exports (e.g., `export const useApi = () => ...`)
  - Types exported as named exports (e.g., `export interface ApiResponse<T> { ... }`)

**Barrel Files:**
- TypeScript: Component groups use `index.ts` for re-exports (e.g., `src/frontend/src/components/mdm/index.ts`)
- Python: Not commonly used; each module imported directly

## Type System

**TypeScript:**
- Strict mode enabled in `tsconfig.json`
- No unused locals or parameters allowed (`noUnusedLocals`, `noUnusedParameters`)
- Avoid `any`; use generics or union types instead
- Database/API model mapping: use explicit type conversions, avoid implicit coercion

**Python:**
- Use Pydantic `BaseModel` for API contracts
- Use SQLAlchemy models for database contracts
- Use `Optional[T]` for nullable fields with defaults
- Enum usage for status values and constants (e.g., `DataProductStatus` enum)

---

*Convention analysis: 2026-03-11*

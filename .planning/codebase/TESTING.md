# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

**Backend (Python):**
- Runner: pytest 7.0+
- Config: `src/pyproject.toml` under `[tool.pytest.ini_options]`
- Assertion Library: pytest built-in assertions
- Coverage Tool: pytest-cov 4.0+ with HTML, XML, and term-missing reports

**Frontend (TypeScript/React):**
- Runner: Vitest
- Config: `src/frontend/vitest.config.ts`
- Assertion Library: Vitest built-in + `@testing-library/jest-dom/vitest`
- Coverage Tool: c8 (v8 provider) with text, json, html, lcov reporters
- E2E Testing: Playwright with MCP integration (`src/frontend/playwright.config.ts`)

**Run Commands:**

Backend:
```bash
hatch -e dev run test              # Run all tests
hatch -e dev run test-unit         # Run unit tests only
hatch -e dev run test-integration  # Run integration tests only
hatch -e dev run test-cov          # Run with HTML coverage report
hatch -e dev run test-cov-xml      # Run with XML coverage report
```

Frontend:
```bash
# Vitest unit/component tests
vitest                             # Run in watch mode
vitest run                         # Run once
vitest run --coverage              # Generate coverage report

# Playwright E2E tests
playwright test                    # Run all specs
playwright test --ui               # Interactive mode
playwright test --headed           # Show browser
```

## Test File Organization

**Location:**

Backend:
- Path: `src/backend/src/tests/` or `src/backend/tests/`
- Structure:
  - `src/tests/unit/` - Unit tests (mocked dependencies)
  - `src/tests/integration/` - Integration tests (real dependencies where practical)
- Naming: `test_*.py` (e.g., `test_data_products_manager.py`)

Frontend:
- Path: `src/frontend/src/` (co-located with source)
- Structure:
  - `**/*.test.ts` or `**/*.test.tsx` - Unit/component tests (vitest)
  - `src/tests/*.spec.ts` - E2E tests (Playwright, excluded from vitest)
  - `tests/*.spec.ts` - Additional E2E tests
- Naming:
  - Vitest: `*.test.ts`, `*.test.tsx`
  - Playwright: `*.spec.ts` (E2E scenarios)

**Naming:**
- Python: `test_{feature}.py` (e.g., `test_data_products_manager.py`, `test_search_manager.py`)
- TypeScript: `{component}.test.ts` or `{component}.test.tsx` (e.g., `permissions-store.test.ts`, `tag-chip.test.tsx`)

## Test Structure

**Backend Test Suite Organization:**

```python
"""
Unit tests for DataProductsManager - ODPS v1.0.0 Data Products

Tests business logic for data product operations including:
- CRUD operations (create, read, update, delete)
- Product lifecycle transitions (draft → proposed → active → deprecated)
- Contract integration
- Tag management
- Search functionality
"""
import pytest
from unittest.mock import Mock, MagicMock, patch

class TestDataProductsManager:
    """Test suite for DataProductsManager"""

    @pytest.fixture
    def mock_ws_client(self):
        """Create a mocked Databricks WorkspaceClient."""
        return MagicMock()

    @pytest.fixture
    def manager(self, db_session: Session, mock_ws_client, mock_notifications_manager):
        """Create DataProductsManager instance for testing."""
        return DataProductsManager(
            db=db_session,
            ws_client=mock_ws_client,
            notifications_manager=mock_notifications_manager
        )

    @pytest.fixture
    def sample_product_data(self):
        """Sample data product data for testing."""
        return {
            "id": str(uuid.uuid4()),
            "name": "Test Data Product",
            # ... required fields
        }

    # =====================================================================
    # Create Product Tests
    # =====================================================================

    def test_create_product_success(self, manager, db_session, sample_product_data):
        """Test successful product creation with all required fields."""
        # Act
        result = manager.create_product(sample_product_data, db=db_session)

        # Assert
        assert result is not None
        assert result.id == sample_product_data["id"]
        # Verify DB persistence
        db_product = db_session.query(DataProductDb).filter_by(id=result.id).first()
        assert db_product is not None
```

**Frontend Test Suite Organization:**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import usePermissionsStore from './permissions-store';

describe('Permissions Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      usePermissionsStore.setState({
        permissions: {},
        isLoading: false,
        error: null,
      });
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => usePermissionsStore());
      expect(result.current.permissions).toEqual({});
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('fetchPermissions', () => {
    it('fetches and sets permissions successfully', async () => {
      // Arrange
      const mockPermissions = { 'data-products': 'READ_WRITE' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockPermissions,
      });

      const { result } = renderHook(() => usePermissionsStore());

      // Act
      await act(async () => {
        await result.current.fetchPermissions();
      });

      // Assert
      expect(result.current.permissions).toEqual(mockPermissions);
      expect(result.current.error).toBeNull();
    });
  });
});
```

**Patterns:**
- Arrange-Act-Assert (AAA) pattern for test structure
- Descriptive test names: `test_feature_scenario_expected_result`
- Group related tests with nested describe blocks or class test organization
- One assertion per test when practical (allows pinpointing failures)
- Comments above test sections (e.g., `# =====================================================================`)

## Mocking

**Framework:**
- Python: `unittest.mock` (MagicMock, Mock, patch)
- TypeScript: Vitest mocking (`vi.fn()`, `vi.mock()`, `vi.spyOn()`)

**Patterns:**

Python:
```python
@pytest.fixture
def mock_ws_client(self):
    """Create a mocked Databricks WorkspaceClient."""
    mock = MagicMock()
    mock.clusters.list.return_value = []
    mock.catalogs.list.return_value = []
    return mock

@patch('src.controller.data_products_manager.uuid.uuid4')
def test_with_patch(self, mock_uuid):
    """Test with patched global function."""
    mock_uuid.return_value = 'mocked-id'
    # ... test code
```

TypeScript:
```typescript
// Mock fetch globally in test setup
global.fetch = vi.fn();

// Arrange - set mock return value
(global.fetch as any).mockResolvedValueOnce({
  ok: true,
  json: async () => mockData,
});

// Clean up
vi.clearAllMocks();
vi.restoreAllMocks();
```

**What to Mock:**
- External SDK clients (Databricks WorkspaceClient, etc.)
- HTTP requests (via `fetch` or axios)
- Database access (provide real in-memory DB instead where practical)
- Dependent managers (NotificationsManager, TagsManager)
- Global browser APIs (localStorage, fetch, ResizeObserver, IntersectionObserver)

**What NOT to Mock:**
- Repository/CRUD logic - test with real in-memory SQLite when practical
- Pydantic/Zod validation - test error cases
- Zustand store mutations - test state changes directly
- Custom hooks internal logic - test via renderHook or component mount

## Fixtures and Factories

**Test Data (Python):**

```python
@pytest.fixture
def sample_product_data(self):
    """Sample data product data for testing."""
    return {
        "id": str(uuid.uuid4()),
        "name": "Test Data Product",
        "description": {"purpose": "Test product for unit tests"},
        "version": "1.0.0",
        "status": "draft",
        "productType": "sourceAligned",
        "owner": "test@example.com",
        "tags": ["test", "sample"],
    }
```

**Test Data (TypeScript):**

```typescript
const mockPermissions = {
  'data-products': FeatureAccessLevel.READ_WRITE,
  'data-contracts': FeatureAccessLevel.READ_ONLY,
};

const mockUser = new UserInfo(
  username="testuser",
  email="test@example.com",
  display_name="Test User",
  active=True,
  groups=["users", "data_consumers"],
);
```

**Location:**
- Python: Inline in test files as fixtures, or in helper modules like `src/tests/helpers.py`
- TypeScript: Inline in test files, or in mock data files (e.g., `src/test/mockData/`)

**Database Fixture (Python):**

File: `src/backend/src/tests/conftest.py`

```python
@pytest.fixture(scope="function", autouse=True)
def db_session(setup_test_database):
    """
    Provides a database session for each test function, with transaction rollback.
    Uses in-memory SQLite with StaticPool for persistence.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    db = TestingSessionLocal(bind=connection)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield db

    # Cleanup
    db.close()
    transaction.rollback()
    connection.close()
    app.dependency_overrides.pop(get_db, None)
```

## Coverage

**Requirements:** Not enforced via thresholds (disabled in configs)

**View Coverage:**

Backend:
```bash
hatch -e dev run test-cov          # Generates htmlcov/index.html
open backend/htmlcov/index.html
```

Frontend:
```bash
vitest run --coverage              # Generates coverage/index.html
open coverage/index.html
```

**Configuration:**

Backend (`src/pyproject.toml`):
```toml
[tool.coverage.run]
source = ["backend/src"]
omit = [
    "*/tests/*",
    "*/test_*.py",
    "*/__init__.py",
]

[tool.coverage.report]
precision = 2
show_missing = true
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "@abstractmethod",
]
```

Frontend (`src/frontend/vitest.config.ts`):
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html', 'lcov'],
  exclude: [
    'node_modules/',
    'src/test/',
    '**/*.d.ts',
    'src/components/ui/**',  // Exclude Shadcn base components
  ],
  all: true,
}
```

## Test Types

**Unit Tests:**
- Scope: Single function/method in isolation
- Approach: Mock all external dependencies
- Backend example: `test_create_product_success` tests manager method with mocked repo and SDK
- Frontend example: `test_has_correct_initial_state` tests store initialization
- Location: `src/tests/unit/` (backend), `**/*.test.ts` (frontend)

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Real database (in-memory SQLite), mocked external APIs (SDK, HTTP)
- Backend example: Manager + Repository + Database
- Location: `src/tests/integration/` (backend)

**E2E Tests (Frontend):**
- Scope: Full user workflows (navigate, interact, assert)
- Approach: Real browser via Playwright, real API endpoints
- Tools: Playwright MCP integration (`mcp__playwright__browser_*`)
- Location: `src/frontend/src/tests/*.spec.ts` or `tests/*.spec.ts`
- Example: `contract-outputport-mapping.spec.ts`

## Common Patterns

**Async Testing (Python):**

```python
@pytest.mark.asyncio
async def test_async_operation(self, manager):
    """Test async operation."""
    # Act
    result = await manager.async_method()

    # Assert
    assert result is not None
```

**Async Testing (TypeScript):**

```typescript
it('fetches and sets permissions successfully', async () => {
  // Arrange
  const mockData = { /* ... */ };
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => mockData,
  });

  const { result } = renderHook(() => usePermissionsStore());

  // Act
  await act(async () => {
    await result.current.fetchPermissions();
  });

  // Assert
  expect(result.current.permissions).toEqual(mockData);
});
```

**Error Testing (Python):**

```python
def test_create_product_validation_error(self, manager, db_session):
    """Test error handling for invalid product data."""
    # Arrange
    invalid_data = {"name": "Test"}  # Missing required fields

    # Act & Assert
    with pytest.raises(ValueError, match="Invalid ODPS product data"):
        manager.create_product(invalid_data, db=db_session)
```

**Error Testing (TypeScript):**

```typescript
it('handles fetch errors gracefully', async () => {
  // Arrange
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status: 500,
    json: async () => ({ detail: 'Server error' }),
  });

  const { result } = renderHook(() => usePermissionsStore());

  // Act & Assert
  try {
    await act(async () => {
      await result.current.fetchPermissions();
    });
  } catch (error) {
    expect(result.current.error).toBeTruthy();
  }
});
```

**Component Testing (TypeScript/React):**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

it('renders button and handles click', () => {
  // Arrange
  const handleClick = vi.fn();

  // Act
  render(<Button onClick={handleClick}>Click me</Button>);
  const button = screen.getByRole('button', { name: /click me/i });
  fireEvent.click(button);

  // Assert
  expect(handleClick).toHaveBeenCalledOnce();
});
```

**Browser Environment Mocking (Frontend):**

File: `src/frontend/src/test/setup.ts`

```typescript
// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  // ... implementation
}
global.IntersectionObserver = MockIntersectionObserver;

// Mock localStorage
const localStorageMock = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = value; },
  removeItem: (key) => { delete store[key]; },
  clear: () => { store = {}; },
};
global.localStorage = localStorageMock as any;
```

---

*Testing analysis: 2026-03-11*

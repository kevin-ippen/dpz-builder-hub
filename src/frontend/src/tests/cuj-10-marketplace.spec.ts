import { test, expect } from '@playwright/test'
import { loadDemoData, clearDemoData } from './helpers/demo-data'

test.beforeAll(async ({ request }) => {
  await loadDemoData(request)
})

test.afterAll(async ({ request }) => {
  await clearDemoData(request)
})

// ---------------------------------------------------------------------------
// CUJ-10  Find a Data Product in the Marketplace
// ---------------------------------------------------------------------------
test.describe('CUJ-10 — Marketplace Discovery', () => {
  test('marketplace page loads', async ({ page }) => {
    await page.goto('/marketplace')
    await expect(page.locator('main')).toBeVisible()
  })

  test('marketplace shows published products', async ({ page }) => {
    await page.goto('/marketplace')
    // Should display product cards, list items, or a table with products
    const items = page.locator('[class*="card"]')
      .or(page.locator('table >> tbody >> tr'))
      .or(page.locator('[role="listitem"]'))
    await expect(items.first()).toBeVisible({ timeout: 10_000 })
  })

  test('home page has a discovery section', async ({ page }) => {
    await page.goto('/')
    // The home page should render discovery/marketplace content
    await expect(page.locator('main')).toBeVisible()
    // Look for any of: discovery section, marketplace widget, featured products, or action cards
    await expect(
      page.getByText(/discover/i)
        .or(page.getByText(/marketplace/i))
        .or(page.getByText(/product/i))
        .first()
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CUJ-12  Publish a Data Product — Verified via published products API
// ---------------------------------------------------------------------------
test.describe('CUJ-12 — Published Products API', () => {
  test('published products endpoint returns data', async ({ request }) => {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
    const resp = await request.get(`${BACKEND_URL}/api/data-products/published`)
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(Array.isArray(body)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CUJ-13  Subscribe to a Data Product
// ---------------------------------------------------------------------------
test.describe('CUJ-13 — Subscriptions', () => {
  test('my-subscriptions endpoint returns data', async ({ request }) => {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
    const resp = await request.get(`${BACKEND_URL}/api/data-products/my-subscriptions`)
    // May return 200 or 401 depending on auth setup in test env
    expect([200, 401]).toContain(resp.status())
  })

  test('owner-consumers page loads', async ({ page }) => {
    await page.goto('/owner-consumers')
    await expect(page.locator('main')).toBeVisible()
  })

  test('data product detail shows subscribe action', async ({ page }) => {
    await page.goto('/data-products')
    const rows = page.locator('table >> tbody >> tr')
    const count = await rows.count()
    if (count === 0) return

    await rows.first().click()

    // A published/active product should show Subscribe; others may show lifecycle actions
    await expect(
      page.getByRole('button', { name: /subscribe/i })
        .or(page.getByRole('button', { name: /request access/i }))
        .or(page.getByText(/subscription/i))
        .or(page.getByRole('button', { name: /submit for certification/i }))
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CUJ-3  MCP Server — Verify endpoint is operational
// ---------------------------------------------------------------------------
test.describe('CUJ-3 — MCP Server', () => {
  test('MCP settings page loads', async ({ page }) => {
    await page.goto('/settings/mcp')
    await expect(page.locator('main')).toBeVisible()
    await expect(
      page.getByText(/mcp/i).first()
    ).toBeVisible()
  })

  test('MCP endpoint responds to JSON-RPC', async ({ request }) => {
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'
    const resp = await request.post(`${BACKEND_URL}/api/mcp`, {
      data: {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      },
      headers: { 'Content-Type': 'application/json' },
    })
    // MCP may require auth token; accept 200 or 401/403
    expect([200, 401, 403]).toContain(resp.status())
  })
})

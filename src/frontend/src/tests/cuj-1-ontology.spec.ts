import { test, expect } from '@playwright/test'
import { loadDemoData, clearDemoData } from './helpers/demo-data'

test.beforeAll(async ({ request }) => {
  await loadDemoData(request)
})

test.afterAll(async ({ request }) => {
  await clearDemoData(request)
})

// ---------------------------------------------------------------------------
// CUJ-1  Build / Manage Ontology
// ---------------------------------------------------------------------------
test.describe('CUJ-1 — Ontology Management', () => {
  test('semantic models settings page loads', async ({ page }) => {
    await page.goto('/settings/semantic-models')
    await expect(page.getByText(/rdf sources/i).first()).toBeVisible()
  })

  test('lists uploaded semantic models', async ({ page }) => {
    await page.goto('/settings/semantic-models')
    // The page should display at least the built-in ontos-ontology model
    await expect(page.locator('table, [role="list"], [data-testid]').first()).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// CUJ-7  Visualize and Explore the Ontology Graph
// ---------------------------------------------------------------------------
test.describe('CUJ-7 — Graph Visualization & Exploration', () => {
  test('graph visualization page loads', async ({ page }) => {
    await page.goto('/concepts/graph')
    // Cytoscape renders into a div container; verify the page loaded
    await expect(page.locator('#cy, [class*="cytoscape"], canvas, svg').first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('KG search page loads', async ({ page }) => {
    await page.goto('/concepts/search')
    // Verify search interface renders with input or tabs
    await expect(
      page.getByRole('textbox').or(page.getByRole('tablist')).first()
    ).toBeVisible()
  })

  test('hierarchy browser loads with items', async ({ page }) => {
    await page.goto('/concepts/hierarchy')
    // Should display a tree or list of ontology items
    const treeItems = page.locator('[role="treeitem"]')
      .or(page.locator('[role="tree"]'))
      .or(page.locator('table >> tbody >> tr'))
      .or(page.locator('[class*="tree"] li'))
    await expect(treeItems.first()).toBeVisible({ timeout: 10_000 })
  })

  test('ontology generator page loads', async ({ page }) => {
    await page.goto('/concepts/generator')
    // Verify the generator form/interface renders
    await expect(page.locator('form, textarea, [role="textbox"]').first()).toBeVisible()
  })
})

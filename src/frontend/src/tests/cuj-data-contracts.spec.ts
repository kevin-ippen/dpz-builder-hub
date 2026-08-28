import { test, expect } from '@playwright/test'
import { loadDemoData, clearDemoData } from './helpers/demo-data'

test.beforeAll(async ({ request }) => {
  await loadDemoData(request)
})

test.afterAll(async ({ request }) => {
  await clearDemoData(request)
})

// ---------------------------------------------------------------------------
// CUJ — Data Contracts CRUD & Lifecycle
// ---------------------------------------------------------------------------
test.describe('Data Contracts — List & Navigation', () => {
  test('lists existing data contracts', async ({ page }) => {
    await page.goto('/data-contracts')
    const rows = page.locator('table >> tbody >> tr')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('views data contract detail page', async ({ page }) => {
    await page.goto('/data-contracts')
    const rows = page.locator('table >> tbody >> tr')
    await rows.first().click()

    // Detail page should show contract content
    await expect(page.locator('main')).toBeVisible()
    await expect(
      page.getByText(/schema/i)
        .or(page.getByText(/quality/i))
        .or(page.getByText(/version/i))
        .first()
    ).toBeVisible()
  })

  test('lifecycle action buttons appear on detail page', async ({ page }) => {
    await page.goto('/data-contracts')
    const rows = page.locator('table >> tbody >> tr')
    if ((await rows.count()) === 0) return

    await rows.first().click()

    const submitBtn = page.getByRole('button', { name: /submit for review/i })
    const approveBtn = page.getByRole('button', { name: /^approve$/i })
    const rejectBtn = page.getByRole('button', { name: /^reject$/i })
    const publishBtn = page.getByRole('button', { name: /^publish$/i })

    await expect(
      submitBtn.or(approveBtn).or(rejectBtn).or(publishBtn)
    ).toBeVisible()
  })
})

test.describe.serial('Data Contracts — Create & Delete', () => {
  const contractName = `PW Contract ${Date.now()}`

  test('creates a new data contract', async ({ page }) => {
    await page.goto('/data-contracts')
    await page.getByRole('button', { name: /new contract/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // The basic form dialog requires Name
    await dialog.getByLabel(/^name/i).fill(contractName)

    // Version defaults to 0.0.1; fill if empty
    const versionInput = dialog.getByLabel(/version/i)
    if (await versionInput.isVisible()) {
      const val = await versionInput.inputValue().catch(() => '')
      if (!val) await versionInput.fill('0.0.1')
    }

    await dialog.getByRole('button', { name: /create contract/i }).click()
    await expect(dialog).toHaveCount(0)
  })

  test('new contract appears in the list', async ({ page }) => {
    await page.goto('/data-contracts')
    await expect(page.getByText(contractName)).toBeVisible()
  })

  test('deletes the created data contract', async ({ page }) => {
    await page.goto('/data-contracts')

    const row = page.locator('table >> tbody >> tr', { hasText: contractName })
    const deleteBtn = row.getByTitle(/delete/i)
      .or(row.getByRole('button', { name: /delete/i }))

    // Register native confirm() handler before clicking
    page.on('dialog', (d) => d.accept())
    await deleteBtn.first().click()

    await expect(page.getByText(contractName)).toHaveCount(0, { timeout: 5_000 })
  })
})

// ---------------------------------------------------------------------------
// Data Contract Detail — Sections
// ---------------------------------------------------------------------------
test.describe('Data Contract Detail — Content Sections', () => {
  test('detail page shows schema section', async ({ page }) => {
    await page.goto('/data-contracts')
    const rows = page.locator('table >> tbody >> tr')
    if ((await rows.count()) === 0) return

    await rows.first().click()

    await expect(
      page.getByText(/schema/i).first()
    ).toBeVisible()
  })

  test('detail page shows quality section', async ({ page }) => {
    await page.goto('/data-contracts')
    const rows = page.locator('table >> tbody >> tr')
    if ((await rows.count()) === 0) return

    await rows.first().click()

    await expect(
      page.getByText(/quality/i).first()
    ).toBeVisible()
  })
})

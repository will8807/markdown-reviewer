import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { PlaywrightWorld } from '../support/world'
import { prisma } from '../../lib/db'

let demoSourceId: string | null = null
let demoProjectId: string | null = null

Given('the demo project is running at {string}', function (this: PlaywrightWorld, url: string) {
  this.baseUrl = url
})

Given('I am on the viewer for the demo source', async function (this: PlaywrightWorld) {
  // Discover the seeded project and source from the DB
  if (!demoProjectId || !demoSourceId) {
    const source = await prisma.source.findFirst({
      where: { type: 'LOCAL' },
      include: { project: true },
    })
    if (!source) throw new Error('No local source found — run pnpm db:seed first')
    demoProjectId = source.projectId
    demoSourceId = source.id
  }

  await this.page.goto(`${this.baseUrl}/projects/${demoProjectId}/sources/${demoSourceId}`)
  // Wait for the file tree to load
  await this.page.waitForSelector('[data-testid="file-tree"]')
})

Then('the file tree contains {string}', async function (this: PlaywrightWorld, filename: string) {
  const treeLocator = this.page.locator('[data-testid="file-tree"]')
  await expect(treeLocator.getByText(filename, { exact: false }).first()).toBeVisible({ timeout: 5000 })
})

When('I click the file {string} in the tree', async function (this: PlaywrightWorld, filename: string) {
  const treeLocator = this.page.locator('[data-testid="file-tree"]')
  await treeLocator.getByText(filename, { exact: true }).first().click()
  await this.page.waitForLoadState('networkidle')
})

Then('the page contains a heading {string}', async function (this: PlaywrightWorld, heading: string) {
  const content = this.page.locator('[data-testid="main-content"]')
  await expect(content.getByRole('heading', { name: heading })).toBeVisible({ timeout: 5000 })
})

Then('the page contains a table', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  await expect(content.locator('table').first()).toBeVisible({ timeout: 5000 })
})

When('I click a link that leads to a missing file', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  const brokenLink = content.getByRole('link', { name: 'Broken Link' })
  await brokenLink.click()
  await this.page.waitForLoadState('networkidle')
})

Then('I see a file-not-found message', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  await expect(content.getByText(/file not found/i)).toBeVisible({ timeout: 5000 })
})

Then('the page does not show a server error', async function (this: PlaywrightWorld) {
  await expect(this.page.getByText(/500|Internal Server Error/i)).not.toBeVisible()
})

Then('the page contains a checked checkbox', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  await expect(content.locator('input[type="checkbox"][checked]').first()).toBeVisible({ timeout: 5000 })
})

Then('the page contains an unchecked checkbox', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  await expect(content.locator('input[type="checkbox"]:not([checked])').first()).toBeVisible({ timeout: 5000 })
})

Then('the page contains a highlighted code block', async function (this: PlaywrightWorld) {
  const content = this.page.locator('[data-testid="main-content"]')
  // pre[style] is the reliable shiki marker (background-color inline style) since lazy-loading may defer class addition
  await expect(content.locator('pre[style]').first()).toBeVisible({ timeout: 15_000 })
})

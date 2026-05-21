import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from '../support/world'

const DEMO_SOURCE_ID = 'demo-source'

// --- Teardown ---

After(async function (this: PlaywrightWorld) {
  if (this.cleanupThreadIds.length > 0) {
    await prisma.commentThread.deleteMany({ where: { id: { in: this.cleanupThreadIds } } })
    this.cleanupThreadIds = []
  }
  // Catch threads created via UI during submission scenarios
  await prisma.commentThread.deleteMany({
    where: { sourceId: DEMO_SOURCE_ID, anchor: { selectedText: 'Demo Project' } },
  })
})

// --- Setup steps ---

Given('a comment thread exists on {string} anchoring {string}', async function (
  this: PlaywrightWorld,
  filename: string,
  selectedText: string,
) {
  const file = await prisma.fileEntry.upsert({
    where: { sourceId_path: { sourceId: DEMO_SOURCE_ID, path: filename } },
    update: {},
    create: { sourceId: DEMO_SOURCE_ID, path: filename },
  })

  const thread = await prisma.commentThread.create({
    data: {
      sourceId: DEMO_SOURCE_ID,
      fileId: file.id,
      anchor: {
        create: {
          type: 'TEXT_SELECTION',
          filePath: filename,
          selectedText,
          prefix: null,
        },
      },
    },
  })

  this.cleanupThreadIds.push(thread.id)
})

// --- Comment panel assertions ---

Then('the comment panel shows the quoted text {string}', async function (
  this: PlaywrightWorld,
  text: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  await expect(panel.locator('blockquote').filter({ hasText: text })).toBeVisible({ timeout: 5000 })
})

// --- Text selection steps ---

When('I select the heading {string}', async function (this: PlaywrightWorld, headingText: string) {
  const article = this.page.locator('article')
  const heading = article.getByRole('heading', { name: headingText })
  await heading.click({ clickCount: 3 })
})

Then('a Comment popover appears', async function (this: PlaywrightWorld) {
  await expect(this.page.getByRole('tooltip').getByRole('button', { name: 'Comment' })).toBeVisible({
    timeout: 3000,
  })
})

// --- Comment submission steps ---

When('I click the Comment popover button', async function (this: PlaywrightWorld) {
  await this.page.getByRole('tooltip').getByRole('button', { name: 'Comment' }).click()
})

When('I type {string} in the comment composer', async function (
  this: PlaywrightWorld,
  text: string,
) {
  const textarea = this.page.getByPlaceholder('Add a comment…')
  await textarea.fill(text)
})

When('I submit the comment', async function (this: PlaywrightWorld) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  await panel.getByRole('button', { name: 'Comment' }).click()
  await this.page.waitForLoadState('networkidle')
})

// --- Highlight assertions ---

Then('the document has the {string} highlight applied', async function (
  this: PlaywrightWorld,
  highlightName: string,
) {
  await this.page.waitForFunction(
    (name: string) => typeof CSS !== 'undefined' && 'highlights' in CSS && CSS.highlights.has(name),
    highlightName,
    { timeout: 5000 },
  )
})

// --- Thread interaction steps ---

When('I click the thread quoting {string} in the comment panel', async function (
  this: PlaywrightWorld,
  text: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
  await thread.click()
})

When('I click {string} on the thread quoting {string}', async function (
  this: PlaywrightWorld,
  buttonLabel: string,
  text: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
  await thread.getByRole('button', { name: buttonLabel }).click()
})

When('I type {string} in the reply composer for {string}', async function (
  this: PlaywrightWorld,
  replyText: string,
  _threadText: string,
) {
  const textarea = this.page.getByPlaceholder('Reply…')
  await textarea.fill(replyText)
})

When('I submit the reply for {string}', async function (
  this: PlaywrightWorld,
  _threadText: string,
) {
  await this.page.getByRole('button', { name: 'Reply' }).click()
  await this.page.waitForLoadState('networkidle')
})

Then('the comment panel shows the reply {string} in the thread quoting {string}', async function (
  this: PlaywrightWorld,
  replyText: string,
  threadText: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: threadText })
  await expect(thread.getByText(replyText, { exact: false })).toBeVisible({ timeout: 5000 })
})

When('I click the {string} status button on the thread quoting {string}', async function (
  this: PlaywrightWorld,
  label: string,
  text: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
  await thread.getByRole('button', { name: label }).click()
  await this.page.waitForLoadState('networkidle')
})

Then('the thread quoting {string} shows the badge {string}', async function (
  this: PlaywrightWorld,
  text: string,
  badge: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
  await expect(thread.locator(`text=${badge}`)).toBeVisible({ timeout: 5000 })
})

When('I click the {string} status filter', async function (
  this: PlaywrightWorld,
  filter: string,
) {
  await this.page.getByTestId(`status-filter-${filter}`).click()
  await this.page.waitForTimeout(300)
})

Then('the comment panel shows the thread quoting {string}', async function (
  this: PlaywrightWorld,
  text: string,
) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  await expect(panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })).toBeVisible({ timeout: 5000 })
})

Then('the comment panel shows no threads matching the filter', async function (this: PlaywrightWorld) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  await expect(panel.getByText('No threads match the current filters.')).toBeVisible({ timeout: 5000 })
})

Then('the sort toggle shows {string}', async function (this: PlaywrightWorld, label: string) {
  await expect(this.page.getByTestId('sort-toggle')).toHaveText(label, { timeout: 5000 })
})

When('I click the sort toggle', async function (this: PlaywrightWorld) {
  await this.page.getByTestId('sort-toggle').click()
  await this.page.waitForTimeout(200)
})

Then('after reloading the page the thread quoting {string} still shows the badge {string}', async function (
  this: PlaywrightWorld,
  text: string,
  badge: string,
) {
  await this.page.reload()
  await this.page.waitForLoadState('networkidle')
  // Re-open the file to load threads into the panel
  await this.page.locator('[data-testid="file-tree"] a').filter({ hasText: 'README.md' }).click()
  await this.page.waitForLoadState('networkidle')
  const panel = this.page.locator('[data-testid="comment-panel"]')
  const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
  await expect(thread.locator(`text=${badge}`)).toBeVisible({ timeout: 5000 })
})

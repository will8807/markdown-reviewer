import { After, Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import type { PlaywrightWorld } from '../support/world'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

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

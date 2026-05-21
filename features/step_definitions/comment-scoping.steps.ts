import { Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { PlaywrightWorld } from '../support/world'

Then('the file tree shows an open-comment badge on {string}', async function (
  this: PlaywrightWorld,
  filename: string,
) {
  const basename = filename.split('/').pop() ?? filename
  const treeLink = this.page.locator(`[data-testid="file-tree"] a[href*="${basename}"]`).first()
  await expect(treeLink.locator('span[title*="open comment"]')).toBeVisible({ timeout: 10_000 })
})

Then('the file tree shows no comment badge on {string}', async function (
  this: PlaywrightWorld,
  filename: string,
) {
  const basename = filename.split('/').pop() ?? filename
  const treeLink = this.page.locator(`[data-testid="file-tree"] a[href*="${basename}"]`).first()
  await expect(treeLink.locator('span[title*="open comment"]')).not.toBeVisible({ timeout: 5_000 })
})

Then('the changed-files list shows an open-comment badge on {string}', async function (
  this: PlaywrightWorld,
  filename: string,
) {
  const item = this.page.locator(`[data-testid="diff-file-item"][data-path="${filename}"]`)
  await expect(item.locator('span[title*="open comment"]')).toBeVisible({ timeout: 10_000 })
})

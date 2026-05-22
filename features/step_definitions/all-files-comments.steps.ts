import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { PlaywrightWorld } from '../support/world'

When('I set the comment scope to {string}', async function (this: PlaywrightWorld, scope: string) {
  const panel = this.page.locator('[data-testid="comment-panel"]')
  await panel.getByRole('button', { name: scope, exact: true }).click()
  // Switching to "All files" triggers a fetch; let it settle.
  await this.page.waitForLoadState('networkidle')
  await this.page.waitForTimeout(300)
})

Then(
  'the thread quoting {string} shows the file label {string}',
  async function (this: PlaywrightWorld, quote: string, label: string) {
    const panel = this.page.locator('[data-testid="comment-panel"]')
    const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: quote })
    await expect(thread.locator('[data-testid="thread-file-label"]')).toHaveText(label, {
      timeout: 5000,
    })
  },
)

Then('the file {string} is open in the viewer', async function (this: PlaywrightWorld, filePath: string) {
  await expect
    .poll(() => new URL(this.page.url()).searchParams.get('path'), { timeout: 10_000 })
    .toBe(filePath)
  await this.page.waitForLoadState('networkidle')
})

import { test, expect } from '@playwright/test'

test('smoke: app shell renders three regions', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="file-tree"]')).toBeVisible()
  await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
  await expect(page.locator('[data-testid="comment-panel"]')).toBeVisible()
})

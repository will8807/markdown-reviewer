import { setWorldConstructor, World } from '@cucumber/cucumber'
import { Browser, BrowserContext, Page, APIResponse, chromium } from '@playwright/test'

export class PlaywrightWorld extends World {
  browser!: Browser
  context!: BrowserContext
  page!: Page
  baseUrl: string = 'http://localhost:3000'
  cleanupThreadIds: string[] = []
  cleanupSourceIds: string[] = []
  lastApiResponse: APIResponse | null = null

  async openBrowser(): Promise<void> {
    this.browser = await chromium.launch()
    this.context = await this.browser.newContext()
    this.page = await this.context.newPage()
  }

  async closeBrowser(): Promise<void> {
    await this.browser?.close()
  }
}

setWorldConstructor(PlaywrightWorld)

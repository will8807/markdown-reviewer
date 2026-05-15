import { Before, After } from '@cucumber/cucumber'
import type { PlaywrightWorld } from './world'

Before(async function (this: PlaywrightWorld) {
  await this.openBrowser()
})

After(async function (this: PlaywrightWorld) {
  await this.closeBrowser()
})

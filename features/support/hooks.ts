import { Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import type { PlaywrightWorld } from './world'

setDefaultTimeout(30_000)

Before(async function (this: PlaywrightWorld) {
  await this.openBrowser()
})

After(async function (this: PlaywrightWorld) {
  await this.closeBrowser()
})

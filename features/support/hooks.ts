import { Before, After, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from './world'

setDefaultTimeout(30_000)

// Clean leftover GIT sources from previous failed runs so each test session
// starts with only the seeded LOCAL demo source.
BeforeAll(async function () {
  await prisma.source.deleteMany({
    where: { projectId: 'demo-project', type: 'GIT' },
  })
})

Before(async function (this: PlaywrightWorld) {
  await this.openBrowser()
})

After(async function (this: PlaywrightWorld) {
  await this.closeBrowser()
})

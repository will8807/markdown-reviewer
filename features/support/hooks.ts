import { Before, After, setDefaultTimeout } from '@cucumber/cucumber'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from './world'

setDefaultTimeout(30_000)

// Before each scenario: wipe state a previous failed After hook may have left
// behind so every scenario starts against a predictable baseline.
Before(async function (this: PlaywrightWorld) {
  await Promise.all([
    // GIT sources (and their cascade-deleted threads) from previous scenarios
    prisma.source.deleteMany({ where: { projectId: 'demo-project', type: 'GIT' } }),
    // Comment threads on the seeded LOCAL demo-source (none are seeded)
    prisma.commentThread.deleteMany({ where: { sourceId: 'demo-source' } }),
  ])
})

Before(async function (this: PlaywrightWorld) {
  await this.openBrowser()
})

After(async function (this: PlaywrightWorld) {
  await this.closeBrowser()
})

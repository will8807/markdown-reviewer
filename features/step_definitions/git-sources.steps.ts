import { Given, When, Then, After, DataTable } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { execFileSync, execSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from '../support/world'

const DEMO_PROJECT_ID = 'demo-project'

// Module-level fixture registry — created once, cleaned up on process exit
const fixtures = new Map<string, string>() // fixture name → bare repo path

function createFixture(name: string): string {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'bdd-git-'))
  const originDir = join(tmpRoot, 'origin')
  const bareDir = join(tmpRoot, name)

  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: originDir, stdio: 'pipe' })

  execFileSync('git', ['init', originDir], { stdio: 'pipe' })
  git(['config', 'user.email', 'test@test.com'])
  git(['config', 'user.name', 'Test'])

  // main: README, guide/setup.md, obsolete.md
  writeFileSync(join(originDir, 'README.md'), '# Demo Project\n\nWelcome to the project\n')
  mkdirSync(join(originDir, 'guide'), { recursive: true })
  writeFileSync(join(originDir, 'guide', 'setup.md'), '# Setup Guide\n')
  writeFileSync(join(originDir, 'obsolete.md'), '# Obsolete\n\ndeprecated\n')
  git(['add', '-A'])
  git(['commit', '-m', 'init'])
  git(['branch', '-M', 'main'])

  // feature/copyedits: edit README, edit guide/setup.md, add guide/new-page.md, remove obsolete.md
  git(['checkout', '-b', 'feature/copyedits'])
  writeFileSync(join(originDir, 'README.md'), '# Demo Project\n\nWelcome to the docs\n')
  writeFileSync(join(originDir, 'guide', 'setup.md'), '# Setup Guide Updated\n')
  writeFileSync(join(originDir, 'guide', 'new-page.md'), '# New page\n')
  git(['rm', 'obsolete.md'])
  git(['add', '-A'])
  git(['commit', '-m', 'copyedits'])
  git(['checkout', 'main'])

  execFileSync('git', ['clone', '--bare', originDir, bareDir], { stdio: 'pipe' })

  process.on('exit', () => {
    try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  return bareDir
}

// --- Setup ---

Given(
  'a local bare git repository fixture {string} exists with:',
  function (this: PlaywrightWorld, name: string, _table: DataTable) {
    if (!fixtures.has(name)) {
      fixtures.set(name, createFixture(name))
    }
  },
)

Given('the Git source {string} has been added', async function (
  this: PlaywrightWorld,
  sourceName: string,
) {
  const fixtureName = `${sourceName}.git`
  const fixtureDir = fixtures.get(fixtureName)
  if (!fixtureDir) throw new Error(`Fixture "${fixtureName}" not found — run Background step first`)

  const source = await prisma.source.create({
    data: {
      projectId: DEMO_PROJECT_ID,
      type: 'GIT',
      name: sourceName,
      gitUrl: fixtureDir,
    },
  })
  this.cleanupSourceIds.push(source.id)
})

Given('I am on the project page for the demo project', async function (this: PlaywrightWorld) {
  await this.page.goto(`${this.baseUrl}/projects/${DEMO_PROJECT_ID}`)
  await this.page.waitForLoadState('networkidle')
})

Given('I am on the viewer for {string} at ref {string}', async function (
  this: PlaywrightWorld,
  sourceName: string,
  ref: string,
) {
  const source = await prisma.source.findFirst({
    where: { name: sourceName, projectId: DEMO_PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!source) throw new Error(`Source "${sourceName}" not found`)
  await this.page.goto(
    `${this.baseUrl}/projects/${DEMO_PROJECT_ID}/sources/${source.id}?ref=${encodeURIComponent(ref)}`,
  )
  await this.page.waitForSelector('[data-testid="file-tree"]')
})

// --- Actions ---

When('I add a Git source pointing at fixture {string}', async function (
  this: PlaywrightWorld,
  fixtureName: string,
) {
  const fixtureDir = fixtures.get(fixtureName)
  if (!fixtureDir) throw new Error(`Fixture "${fixtureName}" not found`)

  await this.page.getByTestId('git-url-input').fill(fixtureDir)
  await this.page.getByRole('button', { name: 'Add Git Source' }).click()
  await this.page.waitForLoadState('networkidle')

  // Register newly-created source for cleanup
  const source = await prisma.source.findFirst({
    where: { gitUrl: fixtureDir },
    orderBy: { createdAt: 'desc' },
  })
  if (source) this.cleanupSourceIds.push(source.id)
})

When(
  'I add a Git source pointing at {string}',
  async function (this: PlaywrightWorld, gitUrl: string) {
    await this.page.getByTestId('git-url-input').fill(gitUrl)
    await this.page.getByRole('button', { name: 'Add Git Source' }).click()
    await this.page.waitForLoadState('networkidle')
  },
)

When('I open the revision picker for {string}', async function (
  this: PlaywrightWorld,
  _sourceName: string,
) {
  // The revision picker is the ref-select dropdown rendered by the viewer's FileTree.
  // Navigate to the source viewer first so the picker is visible.
  const source = await prisma.source.findFirst({
    where: { name: _sourceName, projectId: DEMO_PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!source) throw new Error(`Source "${_sourceName}" not found`)
  await this.page.goto(
    `${this.baseUrl}/projects/${DEMO_PROJECT_ID}/sources/${source.id}`,
  )
  await this.page.waitForSelector('[data-testid="ref-select"]', { timeout: 15_000 })
})

When('I open the viewer for {string} at ref {string}', async function (
  this: PlaywrightWorld,
  sourceName: string,
  ref: string,
) {
  const source = await prisma.source.findFirst({
    where: { name: sourceName, projectId: DEMO_PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!source) throw new Error(`Source "${sourceName}" not found`)
  await this.page.goto(
    `${this.baseUrl}/projects/${DEMO_PROJECT_ID}/sources/${source.id}?ref=${encodeURIComponent(ref)}`,
  )
  await this.page.waitForSelector('[data-testid="file-tree"]')
})

When('I switch the ref to {string}', async function (this: PlaywrightWorld, ref: string) {
  // The refs dropdown is populated by an async fetch on mount. Wait for the
  // target option to actually exist before trying to select it, otherwise
  // selectOption hangs waiting on Playwright's default action timeout.
  // <option> is never "visible" in Playwright's sense (it lives inside a
  // collapsed <select>), so wait for "attached" instead.
  await this.page
    .locator(`[data-testid="ref-select"] option[value="${ref}"]`)
    .waitFor({ state: 'attached', timeout: 15_000 })
  await this.page.getByTestId('ref-select').selectOption(ref)
  // router.replace is async; wait for the URL to reflect the new ref. Don't
  // wait for networkidle — long-running client effects can keep the network
  // "busy" past Cucumber's 30s step timeout. The next assertion has its own
  // wait for the tree to finish re-rendering.
  await this.page.waitForURL((url) => url.search.includes(`ref=${encodeURIComponent(ref)}`), {
    timeout: 5_000,
  })
})

When(
  'I request the file {string} from {string} at ref {string}',
  async function (this: PlaywrightWorld, filePath: string, sourceName: string, ref: string) {
    const source = await prisma.source.findFirst({
      where: { name: sourceName, projectId: DEMO_PROJECT_ID },
    })
    if (!source) throw new Error(`Source "${sourceName}" not found`)
    const url = `/api/projects/${DEMO_PROJECT_ID}/sources/${source.id}/files?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(ref)}`
    this.lastApiResponse = await this.page.request.get(`${this.baseUrl}${url}`)
  },
)

// --- Assertions ---

Then('a new source named {string} appears in the source list', async function (
  this: PlaywrightWorld,
  name: string,
) {
  await expect(this.page.getByTestId('source-list').getByText(name)).toBeVisible({
    timeout: 5000,
  })
})

Then('the source list shows {string} as a Git source', async function (
  this: PlaywrightWorld,
  name: string,
) {
  // toContainText is case-sensitive, so "GIT" won't match "git" in the fixture path
  const card = this.page.getByTestId('source-list').locator('[data-testid="source-card"]').filter({ hasText: name })
  await expect(card).toContainText('GIT', { timeout: 5000 })
})

Then('the revision picker lists the branch {string}', async function (
  this: PlaywrightWorld,
  branch: string,
) {
  const select = this.page.getByTestId('ref-select')
  await expect(select.locator(`option[value="${branch}"]`)).toHaveCount(1, { timeout: 10_000 })
})

Then('the file tree does not contain {string}', async function (
  this: PlaywrightWorld,
  filename: string,
) {
  const tree = this.page.locator('[data-testid="file-tree"]')
  // Match by basename in href (mirror of "the file tree contains")
  const basename = filename.split('/').pop() ?? filename
  const link = tree.locator(`a[href*="${basename}"]`)
  await expect(link).not.toBeVisible({ timeout: 5000 })
})

Then('I see an error message about the repository being unreachable', async function (
  this: PlaywrightWorld,
) {
  await expect(this.page.getByText(/unreachable|could not.*clone|failed.*clone/i)).toBeVisible({
    timeout: 10_000,
  })
})

Then('no new source appears in the source list', async function (this: PlaywrightWorld) {
  // Invalid URL clone fails — source must not be persisted
  const count = await prisma.source.count({
    where: { gitUrl: 'https://invalid.example/does-not-exist.git' },
  })
  expect(count).toBe(0)
})

Then('the response is a 400 with a path-safety error', async function (this: PlaywrightWorld) {
  expect(this.lastApiResponse?.status()).toBe(400)
})

// --- Teardown ---

After(async function (this: PlaywrightWorld) {
  if (this.cleanupSourceIds.length > 0) {
    await prisma.source.deleteMany({ where: { id: { in: this.cleanupSourceIds } } })
    this.cleanupSourceIds = []
  }
})

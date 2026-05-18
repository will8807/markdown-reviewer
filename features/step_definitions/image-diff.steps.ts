import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from '../support/world'

const DEMO_PROJECT_ID = 'demo-project'

// ── Fixture creation ─────────────────────────────────────────────────────────

// Module-level registry so the bare repo is created only once per process.
const imageFixtures = new Map<string, { bareDir: string; sourceId: string | null }>()

async function createImageFixture(name: string): Promise<string> {
  const sharp = (await import('sharp')).default

  const tmpRoot = mkdtempSync(join(tmpdir(), 'bdd-img-'))
  const originDir = join(tmpRoot, 'origin')
  const bareDir = join(tmpRoot, `${name}.git`)

  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: originDir, stdio: 'pipe' })

  execFileSync('git', ['init', originDir], { stdio: 'pipe' })
  git(['config', 'user.email', 'test@test.com'])
  git(['config', 'user.name', 'Test'])

  mkdirSync(join(originDir, 'assets'), { recursive: true })

  // logo.png — red 20x20 (will be yellow on feature/copyedits → visually different)
  const redPng = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).png().toBuffer()
  writeFileSync(join(originDir, 'assets', 'logo.png'), redPng)

  // banner.png — blue 20x20 (identical bytes on both branches → not in diff)
  const bluePng = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 0, b: 255 } },
  }).png().toBuffer()
  writeFileSync(join(originDir, 'assets', 'banner.png'), bluePng)

  // removed.png — green 20x20 (deleted on feature/copyedits)
  const greenPng = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).png().toBuffer()
  writeFileSync(join(originDir, 'assets', 'removed.png'), greenPng)

  // diagram.svg — simple SVG, red rect (modified on feature/copyedits)
  writeFileSync(
    join(originDir, 'assets', 'diagram.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect fill="red" width="20" height="20"/></svg>',
  )

  git(['add', '-A'])
  git(['commit', '-m', 'init'])
  git(['branch', '-M', 'main'])

  // feature/copyedits: modify logo.png, keep banner.png, delete removed.png,
  //   add new-diagram.svg, modify diagram.svg
  git(['checkout', '-b', 'feature/copyedits'])

  const yellowPng = await sharp({
    create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 255, b: 0 } },
  }).png().toBuffer()
  writeFileSync(join(originDir, 'assets', 'logo.png'), yellowPng)

  git(['rm', 'assets/removed.png'])

  writeFileSync(
    join(originDir, 'assets', 'new-diagram.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><circle fill="blue" r="15" cx="15" cy="15"/></svg>',
  )

  writeFileSync(
    join(originDir, 'assets', 'diagram.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect fill="blue" width="20" height="20"/></svg>',
  )

  git(['add', '-A'])
  git(['commit', '-m', 'image changes'])
  git(['checkout', 'main'])

  execFileSync('git', ['clone', '--bare', originDir, bareDir], { stdio: 'pipe' })

  process.on('exit', () => {
    try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {}
  })

  return bareDir
}

// ── Background ────────────────────────────────────────────────────────────────

Given(
  'an image diff fixture {string} has been set up',
  async function (this: PlaywrightWorld, sourceName: string) {
    let fixture = imageFixtures.get(sourceName)

    if (!fixture) {
      const bareDir = await createImageFixture(sourceName)
      fixture = { bareDir, sourceId: null }
      imageFixtures.set(sourceName, fixture)
    }

    const source = await prisma.source.create({
      data: {
        projectId: DEMO_PROJECT_ID,
        type: 'GIT',
        name: sourceName,
        gitUrl: fixture.bareDir,
      },
    })
    fixture.sourceId = source.id
    this.cleanupSourceIds.push(source.id)
  },
)

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSourceId(name: string): Promise<string> {
  const source = await prisma.source.findFirst({
    where: { name, projectId: DEMO_PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!source) throw new Error(`Source "${name}" not found`)
  return source.id
}

async function gotoCompare(
  world: PlaywrightWorld,
  sourceId: string,
  base: string,
  head: string,
  path?: string,
) {
  const params = new URLSearchParams({ base, head })
  if (path) params.set('path', path)
  await world.page.goto(
    `${world.baseUrl}/projects/${DEMO_PROJECT_ID}/sources/${sourceId}/compare?${params}`,
  )
  await world.page.waitForLoadState('networkidle')
}

// ── Navigation ────────────────────────────────────────────────────────────────

Given(
  'I am viewing the image diff for {string} between {string} and {string}',
  async function (this: PlaywrightWorld, filePath: string, base: string, head: string) {
    const sourceId = await getSourceId('docs-repo')
    await gotoCompare(this, sourceId, base, head, filePath)
    await this.page
      .locator('[data-testid="image-diff"]')
      .waitFor({ state: 'visible', timeout: 20_000 })
    await this.page.waitForTimeout(500)
  },
)

// ── Changed-files list ────────────────────────────────────────────────────────

Then(
  'the changed-files list contains {string} with a head preview thumbnail',
  async function (this: PlaywrightWorld, path: string) {
    const item = this.page.locator(`[data-testid="diff-file-item"][data-path="${path}"]`)
    await expect(item).toBeVisible({ timeout: 10_000 })
    await expect(item.locator('img[alt="head"]')).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the changed-files list contains {string} marked as added with a head preview thumbnail',
  async function (this: PlaywrightWorld, path: string) {
    const item = this.page.locator(
      `[data-testid="diff-file-item"][data-path="${path}"][data-status="added"]`,
    )
    await expect(item).toBeVisible({ timeout: 10_000 })
    await expect(item.locator('img[alt="head"]')).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the changed-files list contains {string} marked as removed with a base preview thumbnail',
  async function (this: PlaywrightWorld, path: string) {
    const item = this.page.locator(
      `[data-testid="diff-file-item"][data-path="${path}"][data-status="removed"]`,
    )
    await expect(item).toBeVisible({ timeout: 10_000 })
    await expect(item.locator('img[alt="base"]')).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the changed-files list does not contain {string}',
  async function (this: PlaywrightWorld, path: string) {
    await expect(
      this.page.locator(`[data-testid="diff-file-item"][data-path="${path}"]`),
    ).not.toBeVisible({ timeout: 5_000 })
  },
)

// ── Image diff renderer ───────────────────────────────────────────────────────

Then('an image diff renderer is shown in side-by-side mode', async function (this: PlaywrightWorld) {
  const renderer = this.page.locator('[data-testid="image-diff"]')
  await expect(renderer).toBeVisible({ timeout: 15_000 })
  await expect(renderer).toHaveAttribute('data-mode', 'side-by-side', { timeout: 5_000 })
})

Then('the base image is visible', async function (this: PlaywrightWorld) {
  await expect(
    this.page.locator('[data-testid="image-diff"] img[alt="base"]'),
  ).toBeVisible({ timeout: 10_000 })
})

Then('the head image is visible', async function (this: PlaywrightWorld) {
  await expect(
    this.page.locator('[data-testid="image-diff"] img[alt="head"]'),
  ).toBeVisible({ timeout: 10_000 })
})

Then('the head image overlay is visible', async function (this: PlaywrightWorld) {
  // Onion-skin mode: the head img has an explicit opacity style
  const headImg = this.page.locator('[data-testid="image-diff"] img[alt="head"]').last()
  await expect(headImg).toBeVisible({ timeout: 5_000 })
  const opacity = await headImg.evaluate((el) => (el as HTMLElement).style.opacity)
  expect(Number(opacity)).toBeGreaterThan(0)
  expect(Number(opacity)).toBeLessThanOrEqual(1)
})

Then(
  'the text {string} is shown',
  async function (this: PlaywrightWorld, text: string) {
    await expect(
      this.page.locator('[data-testid="image-diff"]').getByText(text, { exact: false }),
    ).toBeVisible({ timeout: 5_000 })
  },
)

// ── Mode switching ────────────────────────────────────────────────────────────

When(
  'I switch the image diff mode to {string}',
  async function (this: PlaywrightWorld, mode: string) {
    await this.page.locator(`[data-testid="image-diff-mode-${mode}"]`).click()
    await this.page.waitForTimeout(300)
  },
)

Then(
  'the image diff mode is {string}',
  async function (this: PlaywrightWorld, mode: string) {
    await expect(this.page.locator('[data-testid="image-diff"]')).toHaveAttribute(
      'data-mode',
      mode,
      { timeout: 3_000 },
    )
  },
)

Then('a draggable divider handle is visible', async function (this: PlaywrightWorld) {
  // The divider handle is a rounded circle inside the slider container
  await expect(
    this.page.locator('[data-testid="image-diff"] [class*="rounded-full"]'),
  ).toBeVisible({ timeout: 5_000 })
})

// ── Pixel diff ────────────────────────────────────────────────────────────────

Then('the pixel diff image is shown', async function (this: PlaywrightWorld) {
  await expect(
    this.page.locator('[data-testid="pixel-diff-img"]'),
  ).toBeVisible({ timeout: 30_000 })
})

Then(
  'the pixel-diff image response has an immutable cache header',
  async function (this: PlaywrightWorld) {
    const src = await this.page.locator('[data-testid="pixel-diff-img"]').getAttribute('src')
    if (!src) throw new Error('pixel-diff-img has no src')
    const resp = await this.page.request.get(`${this.baseUrl}${src}`)
    const cc = resp.headers()['cache-control'] ?? ''
    expect(cc).toContain('immutable')
  },
)

// ── Path traversal ────────────────────────────────────────────────────────────

When(
  'I request the asset {string} from {string} at ref {string}',
  async function (this: PlaywrightWorld, assetPath: string, sourceName: string, ref: string) {
    const sourceId = await getSourceId(sourceName)
    const url = `/api/projects/${DEMO_PROJECT_ID}/sources/${sourceId}/assets?path=${encodeURIComponent(assetPath)}&ref=${encodeURIComponent(ref)}`
    this.lastApiResponse = await this.page.request.get(`${this.baseUrl}${url}`)
  },
)

Then('the response status is {int}', async function (this: PlaywrightWorld, status: number) {
  expect(this.lastApiResponse?.status()).toBe(status)
})

// ── Teardown ──────────────────────────────────────────────────────────────────

After(async function (this: PlaywrightWorld) {
  // GIT source cleanup is handled by the After hook in git-sources.steps.ts
  // (it deletes all IDs in cleanupSourceIds). No additional teardown needed.
})

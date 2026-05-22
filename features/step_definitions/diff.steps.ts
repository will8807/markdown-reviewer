import { Given, When, Then, After } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { execFileSync } from 'child_process'
import { prisma } from '../../lib/db'
import type { PlaywrightWorld } from '../support/world'

const DEMO_PROJECT_ID = 'demo-project'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSourceId(name: string): Promise<string> {
  const source = await prisma.source.findFirst({
    where: { name, projectId: DEMO_PROJECT_ID },
    orderBy: { createdAt: 'desc' },
  })
  if (!source) throw new Error(`Source "${name}" not found in DB`)
  return source.id
}

async function resolveSha(sourceId: string, ref: string): Promise<string> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } })
  if (!source?.gitUrl) throw new Error(`Source "${sourceId}" has no gitUrl`)
  return execFileSync('git', ['rev-parse', ref], {
    cwd: source.gitUrl,
    encoding: 'utf8',
  }).trim()
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

When(
  'I open the compare view for {string} with base {string} and head {string}',
  async function (this: PlaywrightWorld, sourceName: string, base: string, head: string) {
    const sourceId = await getSourceId(sourceName)
    await gotoCompare(this, sourceId, base, head)
  },
)

Given(
  'I am on the compare view for {string} with base {string} and head {string}',
  async function (this: PlaywrightWorld, sourceName: string, base: string, head: string) {
    const sourceId = await getSourceId(sourceName)
    await gotoCompare(this, sourceId, base, head)
  },
)

Given(
  'I am viewing the diff for {string} with base {string} and head {string}',
  async function (this: PlaywrightWorld, filePath: string, base: string, head: string) {
    const sourceId = await getSourceId('docs-repo')
    await gotoCompare(this, sourceId, base, head, filePath)
    // Wait for at least one diff panel or placeholder to appear
    await this.page
      .locator('[data-testid="diff-base-panel"], [data-testid="diff-head-panel"]')
      .or(this.page.getByText('File did not exist on base.'))
      .or(this.page.getByText('File does not exist on head.'))
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
    // The threads-updated → applyCommentMarkers chain runs after the panel is
    // visible. Give it a generous beat: RenderedDiff fires diff-opened up to
    // 500ms post-mount, then the panel makes an API call before threads-updated
    // re-broadcasts. 1500ms covers both.
    await this.page.waitForTimeout(1500)
  },
)

When('I open the diff for {string}', async function (this: PlaywrightWorld, filePath: string) {
  await this.page.locator(`[data-testid="diff-file-item"][data-path="${filePath}"]`).click()
  await this.page.waitForLoadState('networkidle')
  // Wait for the rendered diff or placeholder to settle
  await this.page.waitForTimeout(500)
})

When('I change head to {string}', async function (this: PlaywrightWorld, ref: string) {
  await this.page.getByTestId('head-ref-select').selectOption(ref)
  await this.page.waitForLoadState('networkidle')
})

When('I collapse the changed-files pane', async function (this: PlaywrightWorld) {
  await this.page.locator('button[title="Collapse file list"]').click()
  // The pane width animates over 200ms; let it settle.
  await this.page.waitForTimeout(400)
})

Then('the diff shows highlighted changed blocks', async function (this: PlaywrightWorld) {
  // Changed blocks get an inline background-color applied imperatively by
  // RenderedDiff. Poll because the highlight runs in a post-render effect.
  await expect
    .poll(
      () =>
        this.page.evaluate(() => {
          const panel = document.querySelector('[data-testid="diff-base-panel"]')
          if (!panel) return 0
          return [...panel.querySelectorAll<HTMLElement>('[data-source-start]')].filter(
            (el) => el.style.backgroundColor !== '',
          ).length
        }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0)
})

// ── Changed-files list ────────────────────────────────────────────────────────

Then(
  'the changed-files list contains {string}',
  async function (this: PlaywrightWorld, path: string) {
    await expect(
      this.page.locator(`[data-testid="diff-file-item"][data-path="${path}"]`),
    ).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the changed-files list contains {string} marked as added',
  async function (this: PlaywrightWorld, path: string) {
    await expect(
      this.page.locator(`[data-testid="diff-file-item"][data-path="${path}"][data-status="added"]`),
    ).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the changed-files list contains {string} marked as removed',
  async function (this: PlaywrightWorld, path: string) {
    await expect(
      this.page.locator(
        `[data-testid="diff-file-item"][data-path="${path}"][data-status="removed"]`,
      ),
    ).toBeVisible({ timeout: 10_000 })
  },
)

Then('the changed-files list is empty', async function (this: PlaywrightWorld) {
  await expect(this.page.getByText('No changed files.')).toBeVisible({ timeout: 5_000 })
})

Then(
  'the diff area shows a {string} message',
  async function (this: PlaywrightWorld, _msg: string) {
    const diffView = this.page.getByTestId('diff-view')
    await expect(diffView).toBeVisible({ timeout: 5_000 })
    await expect(
      diffView.getByText(/Select a file from the list|Choose a base|no changes/i),
    ).toBeVisible({ timeout: 5_000 })
  },
)

// ── Diff content ──────────────────────────────────────────────────────────────

Then(
  'the diff shows a removed line containing {string}',
  async function (this: PlaywrightWorld, text: string) {
    // "Removed" content lives in the base panel (red side)
    const base = this.page.getByTestId('diff-base-panel')
    await expect(base.getByText(text, { exact: false })).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the diff shows an added line containing {string}',
  async function (this: PlaywrightWorld, text: string) {
    // "Added" content lives in the head panel (green side)
    const head = this.page.getByTestId('diff-head-panel')
    await expect(head.getByText(text, { exact: false })).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the diff shows context lines from the surrounding paragraph',
  async function (this: PlaywrightWorld) {
    // Both panels have annotated prose blocks
    const base = this.page.getByTestId('diff-base-panel')
    const head = this.page.getByTestId('diff-head-panel')
    await expect(base.locator('[data-source-start]').first()).toBeVisible({ timeout: 5_000 })
    await expect(head.locator('[data-source-start]').first()).toBeVisible({ timeout: 5_000 })
  },
)

Then('the diff shows the file as added', async function (this: PlaywrightWorld) {
  // Base panel is replaced by a placeholder when the file didn't exist on base
  await expect(this.page.getByText('File did not exist on base.')).toBeVisible({ timeout: 10_000 })
})

Then('the diff shows the file as removed', async function (this: PlaywrightWorld) {
  // Head panel is replaced by a placeholder when the file doesn't exist on head
  await expect(this.page.getByText('File does not exist on head.')).toBeVisible({ timeout: 10_000 })
})

Then('the diff shows no removed lines', async function (this: PlaywrightWorld) {
  // For an added file the base side shows the placeholder, not removed content
  await expect(this.page.getByText('File did not exist on base.')).toBeVisible({ timeout: 5_000 })
})

Then('the diff shows no added lines', async function (this: PlaywrightWorld) {
  // For a removed file the head side shows the placeholder, not added content
  await expect(this.page.getByText('File does not exist on head.')).toBeVisible({ timeout: 5_000 })
})

// ── Commenting on diff blocks ─────────────────────────────────────────────────

// Click on a diff block and wait for the composer to appear. The click event
// listener attaches in a client-side useEffect, so on first load the click can
// race with hydration. Retry a few times until the composer shows up.
async function clickDiffBlockUntilComposer(world: PlaywrightWorld, side: 'base' | 'head', text: string) {
  const panel = world.page.getByTestId(`diff-${side}-panel`)
  const block = panel.getByText(text, { exact: false }).first()
  const composer = world.page.getByPlaceholder('Add a comment…')
  for (let i = 0; i < 6; i++) {
    await block.click()
    try {
      await composer.waitFor({ state: 'visible', timeout: 1500 })
      return
    } catch { /* retry */ }
  }
  throw new Error(`Composer did not appear after clicking ${side}-panel block containing "${text}"`)
}

When(
  'I click the comment button on the added line containing {string}',
  async function (this: PlaywrightWorld, text: string) {
    await clickDiffBlockUntilComposer(this, 'head', text)
  },
)

When(
  'I click the comment button on the removed line containing {string}',
  async function (this: PlaywrightWorld, text: string) {
    await clickDiffBlockUntilComposer(this, 'base', text)
  },
)

Then(
  'the diff line containing {string} has a comment indicator',
  async function (this: PlaywrightWorld, _text: string) {
    // After a thread is created, RenderedDiff injects .diff-comment-marker badges
    await expect(
      this.page.getByTestId('diff-view').locator('.diff-comment-marker'),
    ).toBeVisible({ timeout: 5_000 })
  },
)

When(
  'I click the comment indicator on the line containing {string}',
  async function (this: PlaywrightWorld, _text: string) {
    // The marker is injected asynchronously after threads load. Wait for it.
    const marker = this.page.getByTestId('diff-view').locator('.diff-comment-marker').first()
    await marker.click({ timeout: 10_000 })
    await this.page.waitForTimeout(300)
  },
)

Then(
  'the thread quoting {string} is focused in the comment panel',
  async function (this: PlaywrightWorld, text: string) {
    const panel = this.page.locator('[data-testid="comment-panel"]')
    const thread = panel.locator('[data-testid="comment-thread"]').filter({ hasText: text })
    // The active thread gets the amber border class
    await expect(thread).toHaveClass(/border-amber-400/, { timeout: 5_000 })
  },
)

Then(
  'the comment panel does not show the quoted text {string}',
  async function (this: PlaywrightWorld, text: string) {
    const panel = this.page.locator('[data-testid="comment-panel"]')
    await expect(
      panel.locator('blockquote').filter({ hasText: text }),
    ).not.toBeVisible({ timeout: 5_000 })
  },
)

// ── DB setup ──────────────────────────────────────────────────────────────────

Given(
  'a comment thread exists on {string} anchoring the added line {string} between {string} and {string}',
  async function (
    this: PlaywrightWorld,
    filePath: string,
    selectedText: string,
    base: string,
    head: string,
  ) {
    const sourceId = await getSourceId('docs-repo')
    const [baseSha, headSha] = await Promise.all([
      resolveSha(sourceId, base),
      resolveSha(sourceId, head),
    ])

    const thread = await prisma.commentThread.create({
      data: {
        sourceId,
        anchor: {
          create: {
            type: 'DIFF_HUNK',
            filePath,
            diffSide: 'head',
            // "Welcome to the docs" is line 3 in the head README.md
            lineStart: 3,
            lineEnd: 3,
            selectedText,
            hunkId: `${baseSha}:${headSha}`,
          },
        },
      },
    })

    const author = await prisma.user.findFirst()
    if (author) {
      await prisma.comment.create({
        data: { threadId: thread.id, authorId: author.id, body: 'pre-existing comment' },
      })
    }

    this.cleanupThreadIds.push(thread.id)
  },
)

// ── Stored anchor assertion ───────────────────────────────────────────────────

Then(
  'the stored anchor records side {string}',
  async function (this: PlaywrightWorld, side: string) {
    const sourceId = await getSourceId('docs-repo')
    const thread = await prisma.commentThread.findFirst({
      where: { sourceId, anchor: { type: 'DIFF_HUNK' } },
      include: { anchor: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(thread?.anchor?.diffSide).toBe(side)
    if (thread && !this.cleanupThreadIds.includes(thread.id)) {
      this.cleanupThreadIds.push(thread.id)
    }
  },
)

// ── Teardown ──────────────────────────────────────────────────────────────────

After(async function (this: PlaywrightWorld) {
  // Clean up DIFF_HUNK threads created via the browser during diff scenarios
  // (IDs not captured in cleanupThreadIds since they were submitted through UI)
  const sources = await prisma.source.findMany({
    where: { name: 'docs-repo', projectId: DEMO_PROJECT_ID },
  })
  if (sources.length > 0) {
    await prisma.commentThread.deleteMany({
      where: {
        sourceId: { in: sources.map((s) => s.id) },
        anchor: { type: 'DIFF_HUNK' },
        id: { notIn: this.cleanupThreadIds },
      },
    })
  }
})

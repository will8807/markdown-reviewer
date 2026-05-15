import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { cloneOrFetch } from '@/lib/sources/gitSource'
import { listChangedFiles, computeFileDiff } from '@/lib/diff/computeDiff'

let tmpRoot: string
let originDir: string
let bareDir: string
let baseSha: string
let headSha: string

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' })
}

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'diff-test-'))
  originDir = join(tmpRoot, 'origin')
  bareDir = join(tmpRoot, 'bare.git')

  execFileSync('git', ['init', originDir], { stdio: 'pipe' })
  git(['config', 'user.email', 'test@test.com'], originDir)
  git(['config', 'user.name', 'Test'], originDir)

  // base commit: README.md + docs/guide.md + logo.png (binary, has NUL byte)
  writeFileSync(
    join(originDir, 'README.md'),
    [
      '# Project',
      '',
      'Welcome to the project.',
      '',
      'This is the introduction.',
      '',
      'See the guide for setup.',
    ].join('\n') + '\n',
  )
  mkdirSync(join(originDir, 'docs'), { recursive: true })
  writeFileSync(join(originDir, 'docs', 'guide.md'), '# Guide\n\nFollow these steps.\n')
  // NUL byte forces git to treat as binary
  writeFileSync(join(originDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0xff, 0xd8]))

  git(['add', '-A'], originDir)
  git(['commit', '-m', 'base'], originDir)
  git(['branch', '-M', 'main'], originDir)
  baseSha = git(['rev-parse', 'HEAD'], originDir).trim()

  // head commit: modified README, removed guide, added new-feature, changed binary
  writeFileSync(
    join(originDir, 'README.md'),
    [
      '# Project',
      '',
      'Welcome to the project — now with more features.',
      '',
      'This is the updated introduction.',
      '',
      'See the new feature guide for details.',
    ].join('\n') + '\n',
  )
  unlinkSync(join(originDir, 'docs', 'guide.md'))
  writeFileSync(join(originDir, 'docs', 'new-feature.md'), '# New Feature\n\nExciting new capability.\n')
  writeFileSync(join(originDir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x0a, 0xff, 0xd9]))

  git(['add', '-A'], originDir)
  git(['commit', '-m', 'update'], originDir)
  headSha = git(['rev-parse', 'HEAD'], originDir).trim()

  await cloneOrFetch(originDir, bareDir)
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// listChangedFiles
// ---------------------------------------------------------------------------

describe('listChangedFiles', () => {
  it('returns all changed files', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('README.md')
    expect(paths).toContain('docs/guide.md')
    expect(paths).toContain('docs/new-feature.md')
    expect(paths).toContain('logo.png')
  })

  it('marks README.md as modified', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const readme = files.find((f) => f.path === 'README.md')!
    expect(readme.status).toBe('modified')
  })

  it('marks docs/guide.md as removed', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const guide = files.find((f) => f.path === 'docs/guide.md')!
    expect(guide.status).toBe('removed')
  })

  it('marks docs/new-feature.md as added', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const nf = files.find((f) => f.path === 'docs/new-feature.md')!
    expect(nf.status).toBe('added')
  })

  it('added file has non-zero additions and zero deletions', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const nf = files.find((f) => f.path === 'docs/new-feature.md')!
    expect(nf.additions).toBeGreaterThan(0)
    expect(nf.deletions).toBe(0)
  })

  it('removed file has zero additions and non-zero deletions', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    const guide = files.find((f) => f.path === 'docs/guide.md')!
    expect(guide.additions).toBe(0)
    expect(guide.deletions).toBeGreaterThan(0)
  })

  it('all paths are POSIX (no backslashes)', async () => {
    const files = await listChangedFiles(bareDir, baseSha, headSha)
    expect(files.every((f) => !f.path.includes('\\'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeFileDiff — modified file
// ---------------------------------------------------------------------------

describe('computeFileDiff — modified file', () => {
  let result: Awaited<ReturnType<typeof computeFileDiff>>

  beforeAll(async () => {
    result = await computeFileDiff(bareDir, baseSha, headSha, 'README.md')
  })

  it('status is "modified"', () => {
    expect(result.status).toBe('modified')
  })

  it('isBinary is false', () => {
    expect(result.isBinary).toBe(false)
  })

  it('has at least one hunk', () => {
    expect(result.hunks.length).toBeGreaterThan(0)
  })

  it('hunk headers start with @@', () => {
    for (const hunk of result.hunks) {
      expect(hunk.header).toMatch(/^@@/)
    }
  })

  it('has lines with side "base" (removed lines)', () => {
    const baseLines = result.hunks.flatMap((h) => h.lines).filter((l) => l.side === 'base')
    expect(baseLines.length).toBeGreaterThan(0)
  })

  it('has lines with side "head" (added lines)', () => {
    const headLines = result.hunks.flatMap((h) => h.lines).filter((l) => l.side === 'head')
    expect(headLines.length).toBeGreaterThan(0)
  })

  it('has lines with side "context"', () => {
    const ctxLines = result.hunks.flatMap((h) => h.lines).filter((l) => l.side === 'context')
    expect(ctxLines.length).toBeGreaterThan(0)
  })

  it('line content does not include the leading +/-/space diff character', () => {
    const allLines = result.hunks.flatMap((h) => h.lines)
    for (const line of allLines) {
      expect(line.content).not.toMatch(/^[+\- ]/)
    }
  })

  it('base-side lines carry positive line numbers', () => {
    const baseLine = result.hunks.flatMap((h) => h.lines).find((l) => l.side === 'base')!
    expect(baseLine.lineNumber).toBeGreaterThan(0)
  })

  it('head-side lines carry positive line numbers', () => {
    const headLine = result.hunks.flatMap((h) => h.lines).find((l) => l.side === 'head')!
    expect(headLine.lineNumber).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeFileDiff — added file
// ---------------------------------------------------------------------------

describe('computeFileDiff — added file', () => {
  let result: Awaited<ReturnType<typeof computeFileDiff>>

  beforeAll(async () => {
    result = await computeFileDiff(bareDir, baseSha, headSha, 'docs/new-feature.md')
  })

  it('status is "added"', () => {
    expect(result.status).toBe('added')
  })

  it('isBinary is false', () => {
    expect(result.isBinary).toBe(false)
  })

  it('all lines have side "head"', () => {
    const lines = result.hunks.flatMap((h) => h.lines)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => l.side === 'head')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeFileDiff — removed file
// ---------------------------------------------------------------------------

describe('computeFileDiff — removed file', () => {
  let result: Awaited<ReturnType<typeof computeFileDiff>>

  beforeAll(async () => {
    result = await computeFileDiff(bareDir, baseSha, headSha, 'docs/guide.md')
  })

  it('status is "removed"', () => {
    expect(result.status).toBe('removed')
  })

  it('isBinary is false', () => {
    expect(result.isBinary).toBe(false)
  })

  it('all lines have side "base"', () => {
    const lines = result.hunks.flatMap((h) => h.lines)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => l.side === 'base')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeFileDiff — binary file
// ---------------------------------------------------------------------------

describe('computeFileDiff — binary file', () => {
  let result: Awaited<ReturnType<typeof computeFileDiff>>

  beforeAll(async () => {
    result = await computeFileDiff(bareDir, baseSha, headSha, 'logo.png')
  })

  it('isBinary is true', () => {
    expect(result.isBinary).toBe(true)
  })

  it('has no hunks', () => {
    expect(result.hunks).toHaveLength(0)
  })

  it('status is "modified"', () => {
    expect(result.status).toBe('modified')
  })
})

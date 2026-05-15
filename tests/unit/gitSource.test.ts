import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { cloneOrFetch, listRefs, resolveRef, scanTree, readFile } from '@/lib/sources/gitSource'

let tmpRoot: string
let originDir: string
let bareDir: string
let mainSha: string
let copyeditsSha: string

function git(args: string[], cwd: string) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' })
}

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'gs-test-'))
  originDir = join(tmpRoot, 'origin')
  bareDir = join(tmpRoot, 'bare.git')

  execFileSync('git', ['init', originDir], { stdio: 'pipe' })
  git(['config', 'user.email', 'test@test.com'], originDir)
  git(['config', 'user.name', 'Test'], originDir)

  // main branch: README.md + a non-md file to verify scan filtering
  writeFileSync(join(originDir, 'README.md'), '# Hello\n\nWelcome to the project\n')
  writeFileSync(join(originDir, 'image.png'), 'fake-png-bytes')
  git(['add', '-A'], originDir)
  git(['commit', '-m', 'init'], originDir)
  git(['branch', '-M', 'main'], originDir)
  mainSha = git(['rev-parse', 'HEAD'], originDir).trim()

  // feature/copyedits: edited README, new nested file
  git(['checkout', '-b', 'feature/copyedits'], originDir)
  writeFileSync(join(originDir, 'README.md'), '# Hello\n\nWelcome to the docs\n')
  mkdirSync(join(originDir, 'guide'), { recursive: true })
  writeFileSync(join(originDir, 'guide', 'setup.md'), '# Setup Guide\n')
  git(['add', '-A'], originDir)
  git(['commit', '-m', 'copyedits'], originDir)
  copyeditsSha = git(['rev-parse', 'HEAD'], originDir).trim()

  git(['checkout', 'main'], originDir)

  await cloneOrFetch(originDir, bareDir)
})

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('cloneOrFetch', () => {
  it('creates a bare git repo at the destination', () => {
    expect(existsSync(join(bareDir, 'HEAD'))).toBe(true)
    expect(existsSync(join(bareDir, 'refs'))).toBe(true)
    expect(existsSync(join(bareDir, 'config'))).toBe(true)
  })

  it('is idempotent — a second call fetches and does not throw', async () => {
    await expect(cloneOrFetch(originDir, bareDir)).resolves.toBeUndefined()
  })

  it('throws when the source URL is unreachable', async () => {
    const notGit = join(tmpRoot, 'not-a-repo')
    mkdirSync(notGit, { recursive: true })
    await expect(cloneOrFetch(notGit, join(tmpRoot, 'fail.git'))).rejects.toThrow()
  })
})

describe('listRefs', () => {
  it('includes both branches from the origin', async () => {
    const refs = await listRefs(bareDir)
    const names = refs.map((r) => r.name)
    expect(names).toContain('main')
    expect(names).toContain('feature/copyedits')
  })

  it('each ref carries a full 40-char SHA', async () => {
    const refs = await listRefs(bareDir)
    for (const ref of refs) {
      expect(ref.sha).toMatch(/^[0-9a-f]{40}$/)
    }
  })

  it('marks branch refs with type "branch"', async () => {
    const refs = await listRefs(bareDir)
    const branchNames = refs.filter((r) => r.type === 'branch').map((r) => r.name)
    expect(branchNames).toContain('main')
    expect(branchNames).toContain('feature/copyedits')
  })
})

describe('resolveRef', () => {
  it('resolves "main" to the expected SHA', async () => {
    expect(await resolveRef(bareDir, 'main')).toBe(mainSha)
  })

  it('resolves "feature/copyedits" to the expected SHA', async () => {
    expect(await resolveRef(bareDir, 'feature/copyedits')).toBe(copyeditsSha)
  })

  it('resolves an abbreviated SHA to its full form', async () => {
    expect(await resolveRef(bareDir, mainSha.slice(0, 8))).toBe(mainSha)
  })

  it('throws for an unknown ref', async () => {
    await expect(resolveRef(bareDir, 'nonexistent-branch')).rejects.toThrow()
  })
})

describe('scanTree', () => {
  it('returns markdown files present on main', async () => {
    const files = await scanTree(bareDir, mainSha)
    expect(files).toContain('README.md')
  })

  it('excludes non-markdown files (image.png is on main but should not appear)', async () => {
    const files = await scanTree(bareDir, mainSha)
    expect(files.some((f) => !f.endsWith('.md'))).toBe(false)
    expect(files).not.toContain('image.png')
  })

  it('returns nested markdown files added on feature branch', async () => {
    const files = await scanTree(bareDir, copyeditsSha)
    expect(files).toContain('guide/setup.md')
  })

  it('does not include files from another branch', async () => {
    const mainFiles = await scanTree(bareDir, mainSha)
    expect(mainFiles).not.toContain('guide/setup.md')
  })

  it('returns sorted POSIX paths without backslashes', async () => {
    const files = await scanTree(bareDir, copyeditsSha)
    expect(files).toContain('guide/setup.md')
    expect(files.every((f) => !f.includes('\\'))).toBe(true)
    expect(files).toEqual([...files].sort())
  })
})

describe('readFile', () => {
  it('returns a Buffer with correct content from main', async () => {
    const buf = await readFile(bareDir, mainSha, 'README.md')
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.toString()).toContain('Welcome to the project')
  })

  it('returns the edited content from the feature branch SHA', async () => {
    const buf = await readFile(bareDir, copyeditsSha, 'README.md')
    expect(buf.toString()).toContain('Welcome to the docs')
  })

  it('reads a nested file from the feature branch', async () => {
    const buf = await readFile(bareDir, copyeditsSha, 'guide/setup.md')
    expect(buf.toString()).toContain('Setup Guide')
  })

  it('throws when the path does not exist at the given SHA', async () => {
    await expect(readFile(bareDir, mainSha, 'guide/setup.md')).rejects.toThrow()
  })

  it('throws on path traversal', async () => {
    await expect(readFile(bareDir, mainSha, '../outside.txt')).rejects.toThrow(/path traversal/i)
  })
})

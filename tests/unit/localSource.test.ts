import { describe, it, expect } from 'vitest'
import path from 'path'
import { scan, read } from '@/lib/sources/localSource'

const demoRoot = path.resolve(import.meta.dirname, '../../demo-content')

describe('scan', () => {
  it('returns all markdown files as POSIX relative paths', async () => {
    const files = await scan(demoRoot)
    expect(files).toContain('README.md')
    expect(files).toContain('advanced.md')
    expect(files).toContain('guide/README.md')
    expect(files).toContain('guide/setup.md')
  })

  it('includes non-markdown text files', async () => {
    const files = await scan(demoRoot)
    expect(files).toContain('package.json')
    expect(files).toContain('Dockerfile')
    expect(files).toContain('scripts/publish.sh')
  })

  it('does not include binary files', async () => {
    const files = await scan(demoRoot)
    expect(files.every((f) => !f.endsWith('.png'))).toBe(true)
  })

  it('uses forward slashes on all platforms', async () => {
    const files = await scan(demoRoot)
    const hasBackslash = files.some((f) => f.includes('\\'))
    expect(hasBackslash).toBe(false)
  })
})

describe('read', () => {
  it('returns the file contents', async () => {
    const content = await read(demoRoot, 'README.md')
    expect(content).toContain('# Demo Project')
  })

  it('reads a nested file', async () => {
    const content = await read(demoRoot, 'guide/setup.md')
    expect(content).toContain('# Setup Guide')
  })

  it('throws on path traversal', async () => {
    await expect(read(demoRoot, '../package.json')).rejects.toThrow(/path traversal/i)
  })

  it('throws for a missing file', async () => {
    await expect(read(demoRoot, 'does-not-exist.md')).rejects.toThrow()
  })
})

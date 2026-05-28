import { describe, it, expect } from 'vitest'
import { isMarkdownPath } from '@/lib/files/fileType'

describe('isMarkdownPath', () => {
  it('returns true for .md', () => {
    expect(isMarkdownPath('README.md')).toBe(true)
  })

  it('returns true for .markdown', () => {
    expect(isMarkdownPath('NOTES.markdown')).toBe(true)
  })

  it('is case-insensitive on the extension', () => {
    expect(isMarkdownPath('README.MD')).toBe(true)
    expect(isMarkdownPath('Notes.Markdown')).toBe(true)
  })

  it('returns true for .md files inside nested directories', () => {
    expect(isMarkdownPath('docs/guide/setup.md')).toBe(true)
  })

  it('returns true for filenames with multiple dots ending in .md', () => {
    expect(isMarkdownPath('foo.test.md')).toBe(true)
  })

  it('returns false for source code extensions', () => {
    expect(isMarkdownPath('src/app.ts')).toBe(false)
    expect(isMarkdownPath('src/app.tsx')).toBe(false)
    expect(isMarkdownPath('lib/util.js')).toBe(false)
    expect(isMarkdownPath('main.py')).toBe(false)
    expect(isMarkdownPath('main.rs')).toBe(false)
    expect(isMarkdownPath('main.go')).toBe(false)
  })

  it('returns false for config / data extensions', () => {
    expect(isMarkdownPath('package.json')).toBe(false)
    expect(isMarkdownPath('config.yaml')).toBe(false)
    expect(isMarkdownPath('config.yml')).toBe(false)
    expect(isMarkdownPath('config.toml')).toBe(false)
    expect(isMarkdownPath('.env')).toBe(false)
  })

  it('returns false for shell scripts', () => {
    expect(isMarkdownPath('scripts/deploy.sh')).toBe(false)
  })

  it('returns false for files with no extension', () => {
    expect(isMarkdownPath('Dockerfile')).toBe(false)
    expect(isMarkdownPath('Makefile')).toBe(false)
    expect(isMarkdownPath('LICENSE')).toBe(false)
  })

  it('returns false for files with no extension in a nested directory', () => {
    expect(isMarkdownPath('build/Dockerfile')).toBe(false)
  })

  it('returns false for an empty path', () => {
    expect(isMarkdownPath('')).toBe(false)
  })

  it('does not treat a directory ending in ".md" as markdown', () => {
    expect(isMarkdownPath('docs.md/index.html')).toBe(false)
  })

  it('returns false for image extensions (handled by image diff)', () => {
    expect(isMarkdownPath('assets/logo.png')).toBe(false)
    expect(isMarkdownPath('assets/diagram.svg')).toBe(false)
  })
})

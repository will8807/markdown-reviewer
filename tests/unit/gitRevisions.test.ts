import { describe, it, expect } from 'vitest'
import path from 'path'
import { getRepoDir } from '@/lib/sources/gitRevisions'

describe('getRepoDir', () => {
  it('returns an absolute path', () => {
    expect(path.isAbsolute(getRepoDir('abc123'))).toBe(true)
  })

  it('path ends with .data/git/<sourceId>', () => {
    const dir = getRepoDir('my-source-id')
    expect(dir.replace(/\\/g, '/')).toMatch(/\.data\/git\/my-source-id$/)
  })

  it('different sourceIds produce different paths', () => {
    expect(getRepoDir('source-a')).not.toBe(getRepoDir('source-b'))
  })

  it('sourceId is used verbatim as the final path segment', () => {
    const id = 'clx123abc'
    const dir = getRepoDir(id)
    expect(path.basename(dir)).toBe(id)
  })
})

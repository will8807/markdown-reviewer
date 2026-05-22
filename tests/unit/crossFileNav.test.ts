import { describe, it, expect } from 'vitest'
import { compareUrlForFile, viewerUrlForFile, shouldNavigateForThread } from '@/lib/comments/crossFileNav'

describe('viewerUrlForFile', () => {
  it('builds a viewer URL for a root file', () => {
    expect(viewerUrlForFile('p1', 's1', 'README.md')).toBe(
      '/projects/p1/sources/s1?path=README.md',
    )
  })

  it('encodes nested file paths', () => {
    expect(viewerUrlForFile('p1', 's1', 'guide/setup.md')).toBe(
      '/projects/p1/sources/s1?path=guide%2Fsetup.md',
    )
  })
})

describe('compareUrlForFile', () => {
  it('builds a compare URL with refs and file path', () => {
    expect(compareUrlForFile('p1', 's1', 'guide/setup.md', 'base sha', 'head/sha')).toBe(
      '/projects/p1/sources/s1/compare?base=base+sha&head=head%2Fsha&path=guide%2Fsetup.md',
    )
  })
})

describe('shouldNavigateForThread', () => {
  it('never navigates in file scope', () => {
    expect(shouldNavigateForThread('file', 'guide/setup.md', 'README.md')).toBe(false)
  })

  it('navigates in all scope when the thread is in another file', () => {
    expect(shouldNavigateForThread('all', 'guide/setup.md', 'README.md')).toBe(true)
  })

  it('does not navigate when the thread is in the current file', () => {
    expect(shouldNavigateForThread('all', 'README.md', 'README.md')).toBe(false)
  })

  it('does not navigate when the thread has no file path', () => {
    expect(shouldNavigateForThread('all', null, 'README.md')).toBe(false)
    expect(shouldNavigateForThread('all', undefined, 'README.md')).toBe(false)
  })

  it('navigates when no file is currently open', () => {
    expect(shouldNavigateForThread('all', 'guide/setup.md', null)).toBe(true)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import {
  markReviewed,
  markUnreviewed,
  getReviewedEntry,
  getReviewedMap,
  clearReviewedForSource,
  type ReviewedEntry,
} from '@/lib/review/reviewedFiles'

beforeEach(() => {
  localStorage.clear()
})

const SHA_A = 'abc1234'
const SHA_B = 'def5678'

describe('markReviewed + getReviewedEntry', () => {
  it('returns null for an unreviewed file', () => {
    expect(getReviewedEntry('src1', 'README.md')).toBeNull()
  })

  it('returns an entry after marking reviewed', () => {
    markReviewed('src1', 'README.md', SHA_A)
    const entry = getReviewedEntry('src1', 'README.md')
    expect(entry).not.toBeNull()
    expect(entry!.sha).toBe(SHA_A)
  })

  it('stamps reviewedAt with a timestamp', () => {
    const before = Date.now()
    markReviewed('src1', 'README.md', SHA_A)
    const after = Date.now()
    const entry = getReviewedEntry('src1', 'README.md')!
    expect(entry.reviewedAt).toBeGreaterThanOrEqual(before)
    expect(entry.reviewedAt).toBeLessThanOrEqual(after)
  })

  it('allows null sha (local source with no git)', () => {
    markReviewed('src1', 'README.md', null)
    expect(getReviewedEntry('src1', 'README.md')!.sha).toBeNull()
  })

  it('re-marking updates the sha and timestamp', () => {
    markReviewed('src1', 'README.md', SHA_A)
    const first = getReviewedEntry('src1', 'README.md')!

    markReviewed('src1', 'README.md', SHA_B)
    const second = getReviewedEntry('src1', 'README.md')!

    expect(second.sha).toBe(SHA_B)
    expect(second.reviewedAt).toBeGreaterThanOrEqual(first.reviewedAt)
  })

  it('is scoped by sourceId — same path in a different source is independent', () => {
    markReviewed('src1', 'README.md', SHA_A)
    expect(getReviewedEntry('src2', 'README.md')).toBeNull()
  })
})

describe('markUnreviewed', () => {
  it('removes an existing reviewed entry', () => {
    markReviewed('src1', 'README.md', SHA_A)
    markUnreviewed('src1', 'README.md')
    expect(getReviewedEntry('src1', 'README.md')).toBeNull()
  })

  it('is a no-op when the file was not reviewed', () => {
    expect(() => markUnreviewed('src1', 'README.md')).not.toThrow()
  })

  it('only removes the targeted file, not others in the same source', () => {
    markReviewed('src1', 'README.md', SHA_A)
    markReviewed('src1', 'guide/setup.md', SHA_A)
    markUnreviewed('src1', 'README.md')
    expect(getReviewedEntry('src1', 'guide/setup.md')).not.toBeNull()
  })
})

describe('getReviewedMap', () => {
  it('returns an empty map when nothing is reviewed', () => {
    expect(getReviewedMap('src1').size).toBe(0)
  })

  it('returns all reviewed files for a source', () => {
    markReviewed('src1', 'README.md', SHA_A)
    markReviewed('src1', 'guide/setup.md', SHA_B)
    markReviewed('src2', 'README.md', SHA_A)

    const map = getReviewedMap('src1')
    expect(map.size).toBe(2)
    expect(map.has('README.md')).toBe(true)
    expect(map.has('guide/setup.md')).toBe(true)
    expect(map.has('src2')).toBe(false)
  })

  it('entry values include sha and reviewedAt', () => {
    markReviewed('src1', 'README.md', SHA_A)
    const entry = getReviewedMap('src1').get('README.md') as ReviewedEntry
    expect(entry.sha).toBe(SHA_A)
    expect(typeof entry.reviewedAt).toBe('number')
  })
})

describe('stale detection helper', () => {
  it('entry sha matches current sha — not stale', () => {
    markReviewed('src1', 'README.md', SHA_A)
    const entry = getReviewedEntry('src1', 'README.md')!
    expect(entry.sha === SHA_A).toBe(true)
  })

  it('entry sha differs from current sha — stale', () => {
    markReviewed('src1', 'README.md', SHA_A)
    const entry = getReviewedEntry('src1', 'README.md')!
    expect(entry.sha === SHA_B).toBe(false)
  })
})

describe('clearReviewedForSource', () => {
  it('removes all reviewed entries for a source', () => {
    markReviewed('src1', 'README.md', SHA_A)
    markReviewed('src1', 'guide/setup.md', SHA_A)
    clearReviewedForSource('src1')
    expect(getReviewedMap('src1').size).toBe(0)
  })

  it('does not affect entries for other sources', () => {
    markReviewed('src1', 'README.md', SHA_A)
    markReviewed('src2', 'README.md', SHA_A)
    clearReviewedForSource('src1')
    expect(getReviewedEntry('src2', 'README.md')).not.toBeNull()
  })
})

describe('persistence', () => {
  it('survives round-trips through localStorage', () => {
    markReviewed('src1', 'README.md', SHA_A)
    expect(getReviewedEntry('src1', 'README.md')!.sha).toBe(SHA_A)
  })

  it('survives malformed JSON in storage', () => {
    localStorage.setItem('markdown-reviewer:reviewed-files', 'not-json{{')
    expect(() => getReviewedEntry('src1', 'README.md')).not.toThrow()
    expect(getReviewedEntry('src1', 'README.md')).toBeNull()
  })
})

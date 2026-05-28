import { describe, it, expect, beforeEach } from 'vitest'
import {
  recordView,
  getRecent,
  pruneMissingSources,
  clearRecent,
  type RecentEntry,
} from '@/lib/activity/recentFiles'

const A: Omit<RecentEntry, 'viewedAt'> = {
  projectId: 'p1',
  sourceId: 'src1',
  sourceName: 'Demo Content',
  projectName: 'Demo Project',
  filePath: 'README.md',
}
const B: Omit<RecentEntry, 'viewedAt'> = {
  projectId: 'p1',
  sourceId: 'src1',
  sourceName: 'Demo Content',
  projectName: 'Demo Project',
  filePath: 'advanced.md',
}
const C: Omit<RecentEntry, 'viewedAt'> = {
  projectId: 'p2',
  sourceId: 'src2',
  sourceName: 'Internal Wiki',
  projectName: 'Engineering',
  filePath: 'docs/setup.md',
}

beforeEach(() => {
  localStorage.clear()
})

describe('recordView + getRecent', () => {
  it('returns an empty list when nothing has been recorded', () => {
    expect(getRecent()).toEqual([])
  })

  it('records a single view and returns it', () => {
    recordView(A)
    const recent = getRecent()
    expect(recent).toHaveLength(1)
    expect(recent[0]).toMatchObject(A)
  })

  it('stamps each entry with a viewedAt timestamp', () => {
    const before = Date.now()
    recordView(A)
    const after = Date.now()
    const entry = getRecent()[0]
    expect(entry.viewedAt).toBeGreaterThanOrEqual(before)
    expect(entry.viewedAt).toBeLessThanOrEqual(after)
  })

  it('orders the most recently viewed file first', () => {
    recordView(A)
    recordView(B)
    recordView(C)
    expect(getRecent().map((r) => r.filePath)).toEqual([
      'docs/setup.md',
      'advanced.md',
      'README.md',
    ])
  })
})

describe('dedup', () => {
  it('re-recording a file moves it to the front instead of duplicating', () => {
    recordView(A)
    recordView(B)
    recordView(A)
    const recent = getRecent()
    expect(recent).toHaveLength(2)
    expect(recent[0].filePath).toBe('README.md')
    expect(recent[1].filePath).toBe('advanced.md')
  })

  it('dedups by (sourceId, filePath) — same path in a different source is a different entry', () => {
    recordView({ ...A, filePath: 'README.md' })
    recordView({ ...A, sourceId: 'src2', sourceName: 'Other', projectId: 'p2', filePath: 'README.md' })
    expect(getRecent()).toHaveLength(2)
  })
})

describe('cap', () => {
  it('keeps at most 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      recordView({ ...A, filePath: `file-${i}.md` })
    }
    expect(getRecent()).toHaveLength(10)
  })

  it('drops the oldest entries when the cap is hit', () => {
    for (let i = 0; i < 12; i++) {
      recordView({ ...A, filePath: `file-${i}.md` })
    }
    const paths = getRecent().map((r) => r.filePath)
    expect(paths[0]).toBe('file-11.md')
    expect(paths).not.toContain('file-0.md')
    expect(paths).not.toContain('file-1.md')
  })

  it('honors a custom limit on getRecent', () => {
    for (let i = 0; i < 5; i++) {
      recordView({ ...A, filePath: `file-${i}.md` })
    }
    expect(getRecent(3)).toHaveLength(3)
  })
})

describe('persistence', () => {
  it('persists across reads (round-trips through localStorage)', () => {
    recordView(A)
    recordView(B)
    // Simulating a fresh page load is a no-op — getRecent reads from
    // localStorage every call, so the second read returns the same data.
    expect(getRecent()).toHaveLength(2)
    expect(getRecent()[0].filePath).toBe('advanced.md')
  })

  it('survives malformed JSON in storage', () => {
    localStorage.setItem('markdown-reviewer:recent-files', 'not-json{{{')
    expect(() => getRecent()).not.toThrow()
    expect(getRecent()).toEqual([])
  })

  it('clearRecent removes all entries', () => {
    recordView(A)
    recordView(B)
    clearRecent()
    expect(getRecent()).toEqual([])
  })
})

describe('pruneMissingSources', () => {
  it('drops entries whose sourceId is not in the valid set', () => {
    recordView(A) // src1
    recordView(C) // src2
    pruneMissingSources(new Set(['src1']))
    const recent = getRecent()
    expect(recent).toHaveLength(1)
    expect(recent[0].sourceId).toBe('src1')
  })

  it('is a no-op when every source still exists', () => {
    recordView(A)
    recordView(C)
    pruneMissingSources(new Set(['src1', 'src2']))
    expect(getRecent()).toHaveLength(2)
  })

  it('clears the list when none of the sources are valid', () => {
    recordView(A)
    recordView(C)
    pruneMissingSources(new Set())
    expect(getRecent()).toEqual([])
  })
})

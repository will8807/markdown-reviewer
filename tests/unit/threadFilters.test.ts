import { describe, it, expect } from 'vitest'
import { filterThreads, sortThreads } from '@/lib/comments/threadFilters'

const author1 = { id: 'user-1' }
const author2 = { id: 'user-2' }

const makeThread = (
  id: string,
  status: string,
  resolved: boolean,
  authors: Array<{ id: string }>,
  createdAt = '2024-01-01T00:00:00Z',
) => ({
  id,
  status,
  resolved,
  comments: authors.map((author) => ({ author })),
  createdAt,
})

const threads = [
  makeThread('t1', 'OPEN', false, [author1], '2024-01-01T00:00:00Z'),
  makeThread('t2', 'ACCEPTED', false, [author2], '2024-01-02T00:00:00Z'),
  makeThread('t3', 'REJECTED', false, [author1, author2], '2024-01-03T00:00:00Z'),
  makeThread('t4', 'DISCUSS', false, [author2], '2024-01-04T00:00:00Z'),
  makeThread('t5', 'OPEN', true, [author1], '2024-01-05T00:00:00Z'),
]

describe('filterThreads — status', () => {
  it('returns all threads when status is "all"', () => {
    expect(filterThreads(threads, { status: 'all' })).toHaveLength(5)
  })

  it('returns all threads when no filter is provided', () => {
    expect(filterThreads(threads, {})).toHaveLength(5)
  })

  it('filters to open (non-resolved OPEN) threads', () => {
    const result = filterThreads(threads, { status: 'open' })
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('filters to accepted threads', () => {
    const result = filterThreads(threads, { status: 'accepted' })
    expect(result.map((t) => t.id)).toEqual(['t2'])
  })

  it('filters to rejected threads', () => {
    const result = filterThreads(threads, { status: 'rejected' })
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })

  it('filters to discuss threads', () => {
    const result = filterThreads(threads, { status: 'discuss' })
    expect(result.map((t) => t.id)).toEqual(['t4'])
  })

  it('filters to resolved threads', () => {
    const result = filterThreads(threads, { status: 'resolved' })
    expect(result.map((t) => t.id)).toEqual(['t5'])
  })
})

describe('filterThreads — author', () => {
  it('returns threads where the author has at least one comment', () => {
    const result = filterThreads(threads, { authorId: 'user-1' })
    expect(result.map((t) => t.id)).toEqual(['t1', 't3', 't5'])
  })

  it('returns empty array when no threads match the author', () => {
    expect(filterThreads(threads, { authorId: 'user-99' })).toHaveLength(0)
  })
})

describe('filterThreads — combined', () => {
  it('applies both status and author filters', () => {
    const result = filterThreads(threads, { status: 'rejected', authorId: 'user-1' })
    expect(result.map((t) => t.id)).toEqual(['t3'])
  })
})

describe('sortThreads', () => {
  it('sorts ascending by createdAt', () => {
    const sorted = sortThreads([threads[4], threads[0], threads[2]], 'asc')
    expect(sorted.map((t) => t.id)).toEqual(['t1', 't3', 't5'])
  })

  it('sorts descending by createdAt', () => {
    const sorted = sortThreads([threads[0], threads[4], threads[2]], 'desc')
    expect(sorted.map((t) => t.id)).toEqual(['t5', 't3', 't1'])
  })

  it('does not mutate the input array', () => {
    const input = [threads[1], threads[0]]
    sortThreads(input, 'asc')
    expect(input[0].id).toBe('t2')
  })
})

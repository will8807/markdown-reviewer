import { describe, it, expect } from 'vitest'
import { filterThreadsForUser, type ThreadWithComments } from '@/lib/activity/threadsForUser'

const t = (
  id: string,
  resolved: boolean,
  authors: string[],
  timestamps: string[] = authors.map(() => '2026-01-01T00:00:00Z'),
): ThreadWithComments => ({
  id,
  resolved,
  source: { id: 'src1', name: 'Demo Content', project: { id: 'p1', name: 'Demo Project' } },
  file: { path: 'README.md' },
  anchor: { selectedText: 'snippet' },
  comments: authors.map((authorId, i) => ({
    id: `${id}-c${i}`,
    authorId,
    body: `body ${i}`,
    createdAt: timestamps[i],
  })),
})

describe('filterThreadsForUser', () => {
  it('returns threads where the user authored the original comment', () => {
    const threads = [t('a', false, ['user-1']), t('b', false, ['user-2'])]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result.map((r) => r.id)).toEqual(['a'])
  })

  it('returns threads where the user replied on a thread someone else started', () => {
    const threads = [t('a', false, ['user-2', 'user-1'])]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result.map((r) => r.id)).toEqual(['a'])
  })

  it('excludes threads the user is not involved in at all', () => {
    const threads = [t('a', false, ['user-2', 'user-3'])]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result).toEqual([])
  })

  it('excludes resolved threads even if the user is involved', () => {
    const threads = [t('a', true, ['user-1'])]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result).toEqual([])
  })

  it('orders by most-recent comment first', () => {
    const threads = [
      t('older', false, ['user-1'], ['2026-01-01T00:00:00Z']),
      t('newer', false, ['user-1'], ['2026-05-01T00:00:00Z']),
      t('middle', false, ['user-1'], ['2026-03-01T00:00:00Z']),
    ]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result.map((r) => r.id)).toEqual(['newer', 'middle', 'older'])
  })

  it('uses the latest comment timestamp on each thread, not the first', () => {
    const threads = [
      // Thread A: started long ago but recently replied to
      t('a', false, ['user-2', 'user-1'], ['2026-01-01T00:00:00Z', '2026-05-01T00:00:00Z']),
      // Thread B: started recently but no follow-up
      t('b', false, ['user-1'], ['2026-04-01T00:00:00Z']),
    ]
    const result = filterThreadsForUser(threads, 'user-1')
    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('returns an empty list when no threads involve the user', () => {
    const threads = [t('a', false, ['user-2']), t('b', false, ['user-3'])]
    expect(filterThreadsForUser(threads, 'user-1')).toEqual([])
  })

  it('returns an empty list for an empty input', () => {
    expect(filterThreadsForUser([], 'user-1')).toEqual([])
  })

  it('handles a thread with no comments by excluding it', () => {
    const threads: ThreadWithComments[] = [
      { ...t('a', false, ['user-1']), comments: [] },
    ]
    expect(filterThreadsForUser(threads, 'user-1')).toEqual([])
  })
})

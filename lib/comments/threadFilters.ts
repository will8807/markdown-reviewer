export type StatusFilter = 'all' | 'open' | 'accepted' | 'rejected' | 'discuss' | 'resolved'

export interface FilterableThread {
  id: string
  status: string
  resolved: boolean
  comments: Array<{ author: { id: string } }>
}

export function filterThreads<T extends FilterableThread>(
  threads: T[],
  opts: { status?: StatusFilter; authorId?: string },
): T[] {
  let result = threads

  if (opts.status && opts.status !== 'all') {
    result = result.filter((t) => {
      if (opts.status === 'resolved') return t.resolved
      if (opts.status === 'open') return !t.resolved
      if (opts.status === 'accepted') return t.status === 'ACCEPTED'
      if (opts.status === 'rejected') return t.status === 'REJECTED'
      if (opts.status === 'discuss') return t.status === 'DISCUSS'
      return true
    })
  }

  if (opts.authorId) {
    result = result.filter((t) =>
      t.comments.some((c) => c.author.id === opts.authorId),
    )
  }

  return result
}

export function sortThreads<T extends { createdAt: string }>(
  threads: T[],
  direction: 'asc' | 'desc',
): T[] {
  return [...threads].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return direction === 'asc' ? diff : -diff
  })
}

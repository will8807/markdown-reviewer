export interface ThreadWithComments {
  id: string
  resolved: boolean
  source: { id: string; name: string; project: { id: string; name: string } }
  file: { path: string }
  anchor: { selectedText: string }
  comments: { id: string; authorId: string; body: string; createdAt: string }[]
}

export function filterThreadsForUser(
  threads: ThreadWithComments[],
  userId: string,
): ThreadWithComments[] {
  return threads
    .filter((t) => {
      if (t.resolved) return false
      if (t.comments.length === 0) return false
      return t.comments.some((c) => c.authorId === userId)
    })
    .sort((a, b) => {
      const latestA = Math.max(...a.comments.map((c) => new Date(c.createdAt).getTime()))
      const latestB = Math.max(...b.comments.map((c) => new Date(c.createdAt).getTime()))
      return latestB - latestA
    })
}

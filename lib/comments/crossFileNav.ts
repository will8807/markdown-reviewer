// Helpers for navigating from a comment in the panel to the file it anchors.

export type CommentScope = 'file' | 'all'

export function viewerUrlForFile(projectId: string, sourceId: string, filePath: string): string {
  return `/projects/${projectId}/sources/${sourceId}?path=${encodeURIComponent(filePath)}`
}

export function compareUrlForFile(
  projectId: string,
  sourceId: string,
  filePath: string,
  baseSha: string,
  headSha: string,
): string {
  const params = new URLSearchParams({ base: baseSha, head: headSha, path: filePath })
  return `/projects/${projectId}/sources/${sourceId}/compare?${params.toString()}`
}

// True when activating a thread requires opening a different file first —
// only in all-files scope, and only when the thread lives in another file.
export function shouldNavigateForThread(
  scope: CommentScope,
  threadFilePath: string | null | undefined,
  currentFilePath: string | null,
): boolean {
  if (scope !== 'all') return false
  if (!threadFilePath) return false
  return threadFilePath !== currentFilePath
}

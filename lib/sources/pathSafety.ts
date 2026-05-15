import path from 'path'

export function assertSafe(root: string, requestedPath: string): void {
  const normalized = requestedPath.replace(/\\/g, '/')
  const resolved = path.posix.resolve(root.replace(/\\/g, '/'), normalized)
  const safeRoot = path.posix.resolve(root.replace(/\\/g, '/'))
  if (resolved !== safeRoot && !resolved.startsWith(safeRoot + '/')) {
    throw new Error(`Path traversal detected: "${requestedPath}" escapes root "${root}"`)
  }
}

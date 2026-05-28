const MARKDOWN_EXTS = new Set(['.md', '.markdown'])

export function isMarkdownPath(path: string): boolean {
  const lastSlash = path.lastIndexOf('/')
  const filename = path.slice(lastSlash + 1)
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return false
  return MARKDOWN_EXTS.has(filename.slice(dot).toLowerCase())
}

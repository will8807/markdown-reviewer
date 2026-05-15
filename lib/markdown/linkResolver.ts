import path from 'path'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

interface Options {
  projectId: string
  sourceId: string
  filePath: string
}

function resolveRelative(from: string, rel: string): string {
  return path.posix.normalize(path.posix.join(path.posix.dirname(from), rel))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rehypeLinkResolver: Plugin<[Options], any> = (options) => {
  const { projectId, sourceId, filePath } = options
  const viewerBase = `/projects/${projectId}/sources/${sourceId}`
  const assetsBase = `/api/projects/${projectId}/sources/${sourceId}/assets`

  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'a') {
        const href = node.properties?.href
        if (
          typeof href === 'string' &&
          !href.startsWith('http') &&
          !href.startsWith('#') &&
          !href.startsWith('mailto:')
        ) {
          const resolved = resolveRelative(filePath, href)
          node.properties = {
            ...node.properties,
            href: `${viewerBase}?path=${encodeURIComponent(resolved)}`,
          }
        }
      }

      if (node.tagName === 'img') {
        const src = node.properties?.src
        if (typeof src === 'string' && !src.startsWith('http') && !src.startsWith('data:')) {
          const resolved = resolveRelative(filePath, src)
          node.properties = {
            ...node.properties,
            src: `${assetsBase}?path=${encodeURIComponent(resolved)}`,
          }
        }
      }
    })
  }
}

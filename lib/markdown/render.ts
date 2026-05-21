import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import { sanitizeSchema } from './sanitizeSchema'
import { rehypeLinkResolver } from './linkResolver'

interface RenderOptions {
  projectId: string
  sourceId: string
  filePath: string
  includeSourceLines?: boolean
  ref?: string
}

// Unified's type inference breaks with long plugin chains — cast at the seam.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProcessor = ReturnType<typeof unified> & { use: (...args: any[]) => any; process: (src: string) => Promise<{ toString(): string }> }

// Annotates MDAST block nodes with data-source-start / data-source-end via
// hProperties so remark-rehype forwards them as HTML data attributes.
const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'blockquote', 'list', 'listItem',
  'code', 'tableRow', 'thematicBreak',
])

function remarkSourceLines() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function walk(node: any) {
      if (BLOCK_TYPES.has(node.type) && node.position) {
        node.data = node.data ?? {}
        node.data.hProperties = {
          ...(node.data.hProperties ?? {}),
          dataSourceStart: node.position.start.line,
          dataSourceEnd: node.position.end.line,
        }
      }
      if (node.children) {
        for (const child of node.children) walk(child)
      }
    }
    walk(tree)
  }
}

// @shikijs/rehype replaces each <pre> with a fresh fragment from codeToHast
// (see node_modules/@shikijs/rehype/dist/core.mjs: `parent.children[index] = fragment`).
// The replacement discards data-source-start/end that remarkSourceLines added,
// so the diff viewer can't highlight changed code blocks. Bridge the attrs by
// capturing them in document order before shiki, then restoring by order after.
// Shiki transforms <pre> nodes 1-to-1 so the order is stable.
function makeSourceLineBridge() {
  const lines: Array<{ start: number; end: number } | null> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capture = () => (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'pre') return
      // mdast-util-to-hast applies hProperties to the <code> child, not <pre>
      const codeChild = node.children?.find((c: any) => c.type === 'element' && c.tagName === 'code')
      const src = codeChild ?? node
      const start = src.properties?.dataSourceStart
      const end = src.properties?.dataSourceEnd
      lines.push(start !== undefined ? { start: Number(start), end: Number(end) } : null)
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const restore = () => (tree: any) => {
    let idx = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'pre') return
      const info = lines[idx++]
      if (!info) return
      node.properties = node.properties ?? {}
      node.properties.dataSourceStart = info.start
      node.properties.dataSourceEnd = info.end
    })
  }

  return { capture, restore }
}

export async function renderMarkdown(content: string, options: RenderOptions): Promise<string> {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm) as unknown as AnyProcessor

  if (options.includeSourceLines) {
    p.use(remarkSourceLines)
  }

  p.use(remarkRehype, { allowDangerousHtml: false })
  p.use(rehypeSlug)
  p.use(rehypeAutolinkHeadings, { behavior: 'wrap' })

  if (options.includeSourceLines) {
    const bridge = makeSourceLineBridge()
    p.use(bridge.capture)
    p.use(rehypeShiki, { theme: 'github-light', lazy: true })
    p.use(bridge.restore)
  } else {
    p.use(rehypeShiki, { theme: 'github-light', lazy: true })
  }

  p.use(rehypeLinkResolver, options)
  p.use(rehypeSanitize, sanitizeSchema)
  p.use(rehypeStringify)

  const file = await p.process(content)
  return file.toString()
}

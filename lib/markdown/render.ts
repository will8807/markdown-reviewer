import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeShiki from '@shikijs/rehype'
import rehypeStringify from 'rehype-stringify'
import { sanitizeSchema } from './sanitizeSchema'
import { rehypeLinkResolver } from './linkResolver'

interface RenderOptions {
  projectId: string
  sourceId: string
  filePath: string
  includeSourceLines?: boolean
}

// Unified's type inference breaks with long plugin chains — cast at the seam.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProcessor = ReturnType<typeof unified> & { use: (...args: any[]) => any; process: (src: string) => Promise<{ toString(): string }> }

// Annotates MDAST block nodes with data-source-start / data-source-end via
// hProperties so remark-rehype forwards them as HTML data attributes.
const BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'blockquote', 'list', 'listItem',
  'code', 'table', 'thematicBreak',
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
  p.use(rehypeShiki, { theme: 'github-light', lazy: true })
  p.use(rehypeLinkResolver, options)
  p.use(rehypeSanitize, sanitizeSchema)
  p.use(rehypeStringify)

  const file = await p.process(content)
  return file.toString()
}

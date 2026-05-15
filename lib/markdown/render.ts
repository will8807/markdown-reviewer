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
}

// Unified's type inference breaks with long plugin chains — cast at the seam.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProcessor = ReturnType<typeof unified> & { use: (...args: any[]) => any; process: (src: string) => Promise<{ toString(): string }> }

export async function renderMarkdown(content: string, options: RenderOptions): Promise<string> {
  const p = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' }) as unknown as AnyProcessor

  p.use(rehypeShiki, { theme: 'github-light', lazy: true })
  p.use(rehypeLinkResolver, options)
  p.use(rehypeSanitize, sanitizeSchema)
  p.use(rehypeStringify)

  const file = await p.process(content)
  return file.toString()
}

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { readFile } from 'fs/promises'
import { join } from 'path'

const DOCS_ROOT = join(process.cwd(), 'content')

export interface DocPage {
  slug: string
  title: string
  html: string
}

export async function getDocPage(slug: string): Promise<DocPage> {
  const filePath = join(DOCS_ROOT, `${slug}.md`)
  const raw = await readFile(filePath, 'utf8')

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeStringify)

  const file = await processor.process(raw)
  const html = String(file)

  // Pull the first h1 as the title
  const match = raw.match(/^#\s+(.+)$/m)
  const title = match?.[1] ?? slug

  return { slug, title, html }
}

export async function getAllSlugs(): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  const entries = await readdir(DOCS_ROOT)
  return entries
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort()
}

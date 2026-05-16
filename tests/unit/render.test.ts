import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/lib/markdown/render'

const opts = { projectId: 'proj1', sourceId: 'src1', filePath: 'README.md' }

describe('renderMarkdown', () => {
  // First render call cold-starts Shiki, which can take >5s on Windows. The
  // other render tests benefit from the already-warm singleton, so a per-test
  // bump only on the first one is enough.
  it('renders a heading', { timeout: 15_000 }, async () => {
    const html = await renderMarkdown('# Hello', opts)
    expect(html).toContain('<h1')
    expect(html).toContain('Hello')
  })

  it('renders a GFM table', async () => {
    const md = `| A | B |\n| - | - |\n| 1 | 2 |`
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('<table')
    expect(html).toContain('<td')
  })

  it('renders a GFM task list', async () => {
    const md = `- [x] done\n- [ ] todo`
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('renders a fenced code block with shiki markup', async () => {
    const md = '```ts\nconst x = 1\n```'
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('<pre')
    expect(html).toContain('<code')
  })

  it('strips script tags (XSS)', async () => {
    const md = '<script>alert(1)</script>'
    const html = await renderMarkdown(md, opts)
    expect(html).not.toContain('<script')
  })

  it('strips javascript: href (XSS)', async () => {
    const md = '[click](javascript:alert(1))'
    const html = await renderMarkdown(md, opts)
    expect(html).not.toContain('javascript:')
  })

  it('rewrites relative internal links to viewer URLs', async () => {
    const md = '[Setup](guide/setup.md)'
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('/projects/proj1/sources/src1?path=')
    expect(html).toContain('guide%2Fsetup.md')
  })

  it('rewrites relative image src to assets API', async () => {
    const md = '![Logo](assets/logo.png)'
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('/api/projects/proj1/sources/src1/assets?path=')
    expect(html).toContain('assets%2Flogo.png')
  })

  it('leaves absolute links untouched', async () => {
    const md = '[External](https://example.com)'
    const html = await renderMarkdown(md, opts)
    expect(html).toContain('href="https://example.com"')
  })

  it('adds id slugs to headings (prefixed by sanitizer)', async () => {
    const html = await renderMarkdown('## My Section', opts)
    // rehype-sanitize applies clobberPrefix "user-content-" to all ids
    expect(html).toContain('id="user-content-my-section"')
  })
})

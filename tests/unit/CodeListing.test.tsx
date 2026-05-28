import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import CodeListing from '@/components/CodeListing'

afterEach(cleanup)

describe('CodeListing', () => {
  it('renders one row per line of content', () => {
    const { container } = render(
      <CodeListing content={'const a = 1\nconst b = 2\nconst c = 3\n'} />,
    )
    const rows = container.querySelectorAll('[data-testid="code-line"]')
    expect(rows.length).toBe(3)
  })

  it('numbers lines starting from 1', () => {
    const { container } = render(
      <CodeListing content={'first\nsecond\nthird\n'} />,
    )
    const gutters = container.querySelectorAll('[data-testid="code-line-number"]')
    expect(Array.from(gutters).map((g) => g.textContent?.trim())).toEqual(['1', '2', '3'])
  })

  it('renders line content verbatim, preserving whitespace and source tokens', () => {
    const { container } = render(
      <CodeListing content={'    const x = "<div>" // 2 spaces ➜ ok\n'} />,
    )
    const content = container.querySelector('[data-testid="code-line-content"]')
    expect(content?.textContent).toBe('    const x = "<div>" // 2 spaces ➜ ok')
  })

  it('does not run the content through the markdown renderer', () => {
    const { container } = render(
      <CodeListing content={'# Not a heading\n**not bold**\n'} />,
    )
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('strong')).toBeNull()
    const firstLine = container.querySelector('[data-testid="code-line-content"]')
    expect(firstLine?.textContent).toBe('# Not a heading')
  })

  it('escapes HTML so a script tag in source does not execute', () => {
    const { container } = render(
      <CodeListing content={'<script>alert(1)</script>\n'} />,
    )
    expect(container.querySelector('script')).toBeNull()
    const content = container.querySelector('[data-testid="code-line-content"]')
    expect(content?.textContent).toBe('<script>alert(1)</script>')
  })

  it('renders an empty file as zero rows', () => {
    const { container } = render(<CodeListing content={''} />)
    expect(container.querySelectorAll('[data-testid="code-line"]').length).toBe(0)
  })

  it('renders a final line without trailing newline', () => {
    const { container } = render(
      <CodeListing content={'only line, no newline'} />,
    )
    const rows = container.querySelectorAll('[data-testid="code-line"]')
    expect(rows.length).toBe(1)
    expect(rows[0].querySelector('[data-testid="code-line-content"]')?.textContent).toBe(
      'only line, no newline',
    )
  })

  it('exposes a stable root for selection-based comments', () => {
    render(<CodeListing content={'a\nb\n'} />)
    expect(screen.getByTestId('code-listing')).toBeTruthy()
  })

  it('uses a monospace font (so source code lines up)', () => {
    const { container } = render(<CodeListing content={'a\n'} />)
    const listing = container.querySelector('[data-testid="code-listing"]') as HTMLElement | null
    expect(listing).not.toBeNull()
    const cls = listing!.className
    expect(cls).toMatch(/\bfont-mono\b/)
  })
})

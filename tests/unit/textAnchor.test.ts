import { describe, it, expect } from 'vitest'
import { serializeSelection, findAnchor, renderedOffsetOf } from '@/lib/anchors/textAnchor'

const TEXT = 'The quick brown fox jumps over the lazy dog'

describe('serializeSelection', () => {
  it('captures selectedText, prefix, suffix, and offsets', () => {
    const anchor = serializeSelection(TEXT, 4, 9, 'README.md')
    expect(anchor.selectedText).toBe('quick')
    expect(anchor.charStart).toBe(4)
    expect(anchor.charEnd).toBe(9)
    expect(anchor.prefix).toBe('The ')
    expect(anchor.suffix).toBe(' brown fox jumps over the lazy dog')
    expect(anchor.filePath).toBe('README.md')
  })

  it('handles selection at start (empty prefix)', () => {
    const anchor = serializeSelection(TEXT, 0, 3, 'a.md')
    expect(anchor.selectedText).toBe('The')
    expect(anchor.prefix).toBe('')
  })

  it('handles selection at end (empty suffix)', () => {
    const anchor = serializeSelection(TEXT, 40, 43, 'a.md')
    expect(anchor.selectedText).toBe('dog')
    expect(anchor.suffix).toBe('')
  })
})

describe('findAnchor', () => {
  it('finds an anchor using full context', () => {
    const anchor = serializeSelection(TEXT, 4, 9, 'README.md')
    const result = findAnchor(TEXT, anchor)
    expect(result).not.toBeNull()
    expect(result!.charStart).toBe(4)
    expect(result!.charEnd).toBe(9)
    expect(result!.exact).toBe(true)
  })

  it('falls back to prefix+text when suffix changed', () => {
    const anchor = serializeSelection(TEXT, 4, 9, 'README.md')
    const modified = TEXT.replace('fox jumps over', 'cat ran across')
    const result = findAnchor(modified, { ...anchor, suffix: 'fox jumps' })
    expect(result).not.toBeNull()
    expect(modified.slice(result!.charStart, result!.charEnd)).toBe('quick')
    expect(result!.exact).toBe(false)
  })

  it('falls back to selectedText alone when context changed', () => {
    const anchor = serializeSelection(TEXT, 4, 9, 'README.md')
    const result = findAnchor('A slow quick red fox', {
      ...anchor,
      prefix: 'THE ',
      suffix: ' brown',
    })
    expect(result).not.toBeNull()
    expect(result!.charStart).toBe(7)
  })

  it('returns null when selectedText is not found', () => {
    const anchor = serializeSelection(TEXT, 4, 9, 'README.md')
    const result = findAnchor('Completely different text here', {
      ...anchor,
      selectedText: 'quick',
    })
    expect(result).toBeNull()
  })
})

describe('renderedOffsetOf', () => {
  function makeArticle(html: string): HTMLElement {
    const el = document.createElement('article')
    el.innerHTML = html
    document.body.appendChild(el)
    return el
  }

  afterEach(() => { document.body.innerHTML = '' })

  it('returns the offset within a single text node', () => {
    const article = makeArticle('<p>hello world</p>')
    const textNode = article.querySelector('p')!.firstChild as Text
    expect(renderedOffsetOf(article, textNode, 0)).toBe(0)
    expect(renderedOffsetOf(article, textNode, 5)).toBe(5)
  })

  it('counts characters from preceding text nodes', () => {
    const article = makeArticle('<p>foo</p><p>bar</p>')
    const secondText = article.querySelectorAll('p')[1].firstChild as Text
    expect(renderedOffsetOf(article, secondText, 0)).toBe(3)
    expect(renderedOffsetOf(article, secondText, 3)).toBe(6)
  })

  it('handles nested elements spanning multiple text nodes', () => {
    const article = makeArticle('<p><strong>bold</strong> rest</p>')
    const restNode = article.querySelector('p')!.lastChild as Text
    expect(renderedOffsetOf(article, restNode, 0)).toBe(4)
    expect(renderedOffsetOf(article, restNode, 5)).toBe(9)
  })
})

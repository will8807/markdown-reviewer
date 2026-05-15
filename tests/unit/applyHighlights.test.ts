import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyHighlights, type HighlightThread } from '@/lib/highlights/applyHighlights'

// --- CSS Custom Highlight API mock ---

class MockHighlight {
  ranges: Range[]
  constructor(...ranges: Range[]) { this.ranges = ranges }
}

const mockSet = vi.fn()
const mockClear = vi.fn()

beforeEach(() => {
  vi.stubGlobal('Highlight', MockHighlight)
  vi.stubGlobal('CSS', { highlights: { set: mockSet, clear: mockClear } })
  mockSet.mockClear()
  mockClear.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

// --- Helpers ---

function makeArticle(html: string): HTMLElement {
  const el = document.createElement('article')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

function thread(overrides: Partial<HighlightThread> = {}): HighlightThread {
  return {
    id: 't1',
    resolved: false,
    anchor: { selectedText: 'hello', prefix: null, renderedStart: null, renderedEnd: null },
    ...overrides,
  }
}

// --- Tests ---

describe('applyHighlights', () => {
  it('clears existing highlights before applying new ones', () => {
    const article = makeArticle('<p>hello</p>')
    applyHighlights(article, [])
    expect(mockClear).toHaveBeenCalledOnce()
  })

  it('no-ops when CSS.highlights is not supported', () => {
    vi.stubGlobal('CSS', {})
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(article, [thread()])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('skips resolved threads', () => {
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(article, [thread({ resolved: true })])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('skips threads with null anchor', () => {
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(article, [thread({ anchor: null })])
    expect(mockSet).not.toHaveBeenCalled()
  })

  it('uses renderedStart/renderedEnd directly when stored', () => {
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(article, [
      thread({ anchor: { selectedText: 'hello', prefix: null, renderedStart: 0, renderedEnd: 5 } }),
    ])
    expect(mockSet).toHaveBeenCalledWith('comment-thread', expect.any(MockHighlight))
    const highlight = mockSet.mock.calls[0][1] as MockHighlight
    expect(highlight.ranges).toHaveLength(1)
    const range = highlight.ranges[0]
    expect(range.toString()).toBe('hello')
  })

  it('falls back to text search when rendered offsets are absent', () => {
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(article, [
      thread({ anchor: { selectedText: 'world', prefix: null, renderedStart: null, renderedEnd: null } }),
    ])
    expect(mockSet).toHaveBeenCalledWith('comment-thread', expect.any(MockHighlight))
    const highlight = mockSet.mock.calls[0][1] as MockHighlight
    expect(highlight.ranges[0].toString()).toBe('world')
  })

  it('uses prefix context to disambiguate duplicate text', () => {
    const article = makeArticle('<p>fox fox</p>')
    applyHighlights(article, [
      thread({ anchor: { selectedText: 'fox', prefix: 'x ', renderedStart: null, renderedEnd: null } }),
    ])
    const highlight = mockSet.mock.calls[0][1] as MockHighlight
    // second "fox" follows "x " — range should start at offset 4
    expect(highlight.ranges[0].startOffset).toBe(4)
  })

  it('puts the active thread in a separate highlight group', () => {
    const article = makeArticle('<p>hello world</p>')
    applyHighlights(
      article,
      [
        thread({ id: 'a', anchor: { selectedText: 'hello', prefix: null, renderedStart: 0, renderedEnd: 5 } }),
        thread({ id: 'b', anchor: { selectedText: 'world', prefix: null, renderedStart: 6, renderedEnd: 11 } }),
      ],
      'a',
    )
    const calls = Object.fromEntries(mockSet.mock.calls.map(([k, v]) => [k, v]))
    expect(calls['comment-thread-active'].ranges[0].toString()).toBe('hello')
    expect(calls['comment-thread'].ranges[0].toString()).toBe('world')
  })

  it('skips an anchor when rendered offsets are out of range', () => {
    const article = makeArticle('<p>hi</p>')
    applyHighlights(article, [
      thread({ anchor: { selectedText: null, prefix: null, renderedStart: 999, renderedEnd: 1005 } }),
    ])
    expect(mockSet).not.toHaveBeenCalled()
  })
})

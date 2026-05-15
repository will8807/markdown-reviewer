import { describe, it, expect } from 'vitest'
import { serializeSelection, findAnchor } from '@/lib/anchors/textAnchor'

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

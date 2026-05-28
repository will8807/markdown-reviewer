import { describe, it, expect } from 'vitest'
import { buildLineCommentAnchor } from '@/lib/comments/lineCommentAnchor'
import type { DiffLine } from '@/lib/diff/computeDiff'

const ctx = {
  sourceId: 'src1',
  filePath: 'src/app.ts',
  baseSha: 'aaaa1111',
  headSha: 'bbbb2222',
}

describe('buildLineCommentAnchor', () => {
  it('records side "head" for an added line', () => {
    const line: DiffLine = { side: 'head', lineNumber: 12, content: 'const a = 1' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.diffSide).toBe('head')
  })

  it('records side "base" for a removed line', () => {
    const line: DiffLine = { side: 'base', lineNumber: 7, content: 'const old = 0' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.diffSide).toBe('base')
  })

  it('sets lineStart and lineEnd to the clicked line number', () => {
    const line: DiffLine = { side: 'head', lineNumber: 42, content: 'foo' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.lineStart).toBe(42)
    expect(anchor.lineEnd).toBe(42)
  })

  it('carries the line content as selectedText so the panel can quote it', () => {
    const line: DiffLine = { side: 'head', lineNumber: 3, content: 'export function foo() {}' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.selectedText).toBe('export function foo() {}')
  })

  it('forwards the diff context (sourceId, filePath, baseSha, headSha)', () => {
    const line: DiffLine = { side: 'head', lineNumber: 1, content: 'x' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.sourceId).toBe('src1')
    expect(anchor.filePath).toBe('src/app.ts')
    expect(anchor.baseSha).toBe('aaaa1111')
    expect(anchor.headSha).toBe('bbbb2222')
  })

  it('throws or returns null for a context line (cannot comment on unchanged lines)', () => {
    const line: DiffLine = { side: 'context', lineNumber: 5, content: 'unchanged' }
    expect(() => buildLineCommentAnchor(line, ctx)).toThrow()
  })

  it('preserves whitespace in the line content', () => {
    const line: DiffLine = { side: 'head', lineNumber: 1, content: '    indented' }
    const anchor = buildLineCommentAnchor(line, ctx)
    expect(anchor.selectedText).toBe('    indented')
  })
})

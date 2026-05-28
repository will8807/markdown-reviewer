import type { DiffLine } from '@/lib/diff/computeDiff'

interface DiffContext {
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
}

export interface LineCommentAnchor extends DiffContext {
  diffSide: 'base' | 'head'
  lineStart: number
  lineEnd: number
  selectedText: string
}

export function buildLineCommentAnchor(line: DiffLine, ctx: DiffContext): LineCommentAnchor {
  if (line.side === 'context') {
    throw new Error('Cannot create a comment anchor on a context line')
  }
  return {
    ...ctx,
    diffSide: line.side,
    lineStart: line.lineNumber,
    lineEnd: line.lineNumber,
    selectedText: line.content,
  }
}

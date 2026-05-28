'use client'

import { useEffect } from 'react'
import { setPanelContext } from '@/lib/comments/panelContext'
import { buildLineCommentAnchor } from '@/lib/comments/lineCommentAnchor'
import type { DiffHunk, DiffLine } from '@/lib/diff/computeDiff'

const LINE_BG: Record<DiffLine['side'], string> = {
  base: 'bg-red-50 dark:bg-red-950/40',
  head: 'bg-green-50 dark:bg-green-950/40',
  context: '',
}

const LINE_GUTTER: Record<DiffLine['side'], string> = {
  base: 'text-red-400 dark:text-red-600 bg-red-100/50 dark:bg-red-950/60',
  head: 'text-green-600 dark:text-green-400 bg-green-100/50 dark:bg-green-950/60',
  context: 'text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900',
}

const SIDE_PREFIX: Record<DiffLine['side'], string> = {
  base: '-',
  head: '+',
  context: ' ',
}

interface Props {
  projectId: string
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
  hunks: DiffHunk[]
  status: 'added' | 'removed' | 'modified' | 'renamed'
}

export default function CodeDiff({
  sourceId,
  filePath,
  baseSha,
  headSha,
  hunks,
  status,
}: Props) {
  useEffect(() => {
    const fire = () => {
      setPanelContext({ type: 'diff', sourceId, filePath, baseSha, headSha })
      window.dispatchEvent(
        new CustomEvent('diff-opened', { detail: { sourceId, filePath, baseSha, headSha } }),
      )
    }
    const t1 = setTimeout(fire, 0)
    const t2 = setTimeout(fire, 150)
    const t3 = setTimeout(fire, 500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [sourceId, filePath, baseSha, headSha])

  const handleComment = (line: DiffLine) => {
    const anchor = buildLineCommentAnchor(line, { sourceId, filePath, baseSha, headSha })
    window.dispatchEvent(
      new CustomEvent('diff-comment-requested', { detail: anchor }),
    )
    window.dispatchEvent(new CustomEvent('open-comment-panel'))
  }

  if (hunks.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        {status === 'added'
          ? 'File added (empty).'
          : status === 'removed'
          ? 'File removed (was empty).'
          : 'No differences.'}
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-collapse text-xs font-mono">
        <tbody>
          {hunks.map((hunk, hi) => (
            <>
              <tr key={`hunk-${hi}`} data-testid="diff-hunk-header">
                <td
                  colSpan={4}
                  className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-mono text-xs px-4 py-1 select-none"
                >
                  {hunk.header}
                </td>
              </tr>
              {hunk.lines.map((line, li) => (
                <tr
                  key={`${hi}-${li}`}
                  data-testid="diff-line"
                  data-side={line.side}
                  data-line-number={line.lineNumber}
                  className={`group ${LINE_BG[line.side]}`}
                >
                  <td className={`select-none w-6 text-center ${LINE_GUTTER[line.side]} px-1`}>
                    {SIDE_PREFIX[line.side]}
                  </td>
                  <td className={`select-none text-right pr-3 pl-2 w-12 ${LINE_GUTTER[line.side]}`}>
                    {line.lineNumber}
                  </td>
                  <td className="px-3 py-0.5 whitespace-pre w-full">
                    {line.content || ' '}
                  </td>
                  {line.side !== 'context' && (
                    <td className="w-8 pr-2">
                      <button
                        onClick={() => handleComment(line)}
                        className="hidden group-hover:block text-zinc-400 hover:text-blue-500 leading-none"
                        aria-label="Comment on this line"
                      >
                        ●
                      </button>
                    </td>
                  )}
                  {line.side === 'context' && <td className="w-8" />}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

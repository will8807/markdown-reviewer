'use client'

import { useEffect, useState } from 'react'
import type { FileDiff, DiffLine } from '@/lib/diff/computeDiff'

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

function DiffLineRow({
  line,
  onComment,
}: {
  line: DiffLine
  onComment?: (line: DiffLine) => void
}) {
  return (
    <tr
      data-testid="diff-line"
      data-side={line.side}
      data-line-number={line.lineNumber}
      className={`group ${LINE_BG[line.side]}`}
    >
      {/* gutter: prefix char */}
      <td
        className={`select-none w-6 text-center text-xs font-mono ${LINE_GUTTER[line.side]} px-1`}
      >
        {SIDE_PREFIX[line.side]}
      </td>
      {/* line number */}
      <td
        className={`select-none text-right text-xs font-mono pr-3 pl-2 w-12 ${LINE_GUTTER[line.side]}`}
      >
        {line.lineNumber}
      </td>
      {/* content */}
      <td className="font-mono text-xs px-3 py-0.5 whitespace-pre w-full">
        {line.content || ' '}
      </td>
      {/* comment gutter button */}
      {onComment && (
        <td className="w-8 pr-2">
          <button
            onClick={() => onComment(line)}
            className="hidden group-hover:block text-zinc-400 hover:text-blue-500 text-xs leading-none"
            aria-label="Comment on this line"
          >
            ●
          </button>
        </td>
      )}
    </tr>
  )
}

interface Props {
  projectId: string
  sourceId: string
  baseSha: string
  headSha: string
  filePath: string
}

export default function UnifiedDiff({ projectId, sourceId, baseSha, headSha, filePath }: Props) {
  const [diff, setDiff] = useState<FileDiff | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDiff(null)
    setError(null)
    const url =
      `/api/projects/${projectId}/sources/${sourceId}/compare/file` +
      `?base=${encodeURIComponent(baseSha)}&head=${encodeURIComponent(headSha)}&path=${encodeURIComponent(filePath)}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { diff: FileDiff }) => setDiff(data.diff))
      .catch(() => setError('Failed to load diff.'))
  }, [projectId, sourceId, baseSha, headSha, filePath])

  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>
  if (!diff) return <p className="p-4 text-sm text-zinc-400">Loading diff…</p>

  if (diff.isBinary) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Binary file</p>
        <p className="font-mono text-xs">{filePath}</p>
        <p className="mt-2 text-xs">Binary files cannot be shown as a unified diff.</p>
      </div>
    )
  }

  if (diff.hunks.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-500">
        <p>{diff.status === 'added' ? 'File added (empty).' : diff.status === 'removed' ? 'File removed (was empty).' : 'No differences.'}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {diff.hunks.map((hunk, hi) => (
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
                <DiffLineRow key={`${hi}-${li}`} line={line} />
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

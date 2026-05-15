'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { DiffHunk } from '@/lib/diff/computeDiff'

interface Props {
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
  baseHtml: string | null
  headHtml: string | null
  hunks: DiffHunk[]
  status: 'added' | 'removed' | 'modified' | 'renamed'
}

function applyHighlights(
  container: HTMLElement | null,
  changedLines: Set<number>,
  side: 'base' | 'head',
) {
  if (!container) return
  const elements = container.querySelectorAll<HTMLElement>('[data-source-start]')
  const bg = side === 'base' ? 'rgba(254,202,202,0.45)' : 'rgba(187,247,208,0.45)'
  const border = side === 'base' ? '3px solid rgba(239,68,68,0.35)' : '3px solid rgba(34,197,94,0.35)'

  for (const el of elements) {
    const start = parseInt(el.dataset.sourceStart ?? '0', 10)
    const end = parseInt(el.dataset.sourceEnd ?? '0', 10)
    let changed = false
    for (let ln = start; ln <= end; ln++) {
      if (changedLines.has(ln)) { changed = true; break }
    }
    if (changed) {
      el.style.backgroundColor = bg
      el.style.borderLeft = border
      el.style.paddingLeft = '0.5rem'
      el.style.borderRadius = '2px'
    } else {
      el.style.backgroundColor = ''
      el.style.borderLeft = ''
      el.style.paddingLeft = ''
    }
  }
}

export default function RenderedDiff({
  sourceId,
  filePath,
  baseSha,
  headSha,
  baseHtml,
  headHtml,
  hunks,
  status,
}: Props) {
  const baseRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const baseChangedLines = useMemo(
    () => new Set(hunks.flatMap((h) => h.lines.filter((l) => l.side === 'base').map((l) => l.lineNumber))),
    [hunks],
  )
  const headChangedLines = useMemo(
    () => new Set(hunks.flatMap((h) => h.lines.filter((l) => l.side === 'head').map((l) => l.lineNumber))),
    [hunks],
  )

  // Highlight changed blocks after HTML is in the DOM
  useEffect(() => { applyHighlights(baseRef.current, baseChangedLines, 'base') }, [baseHtml, baseChangedLines])
  useEffect(() => { applyHighlights(headRef.current, headChangedLines, 'head') }, [headHtml, headChangedLines])

  // Proportional scroll sync
  useEffect(() => {
    const base = baseRef.current
    const head = headRef.current
    if (!base || !head) return

    const fromBase = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      const pct = base.scrollTop / Math.max(1, base.scrollHeight - base.clientHeight)
      head.scrollTop = pct * Math.max(1, head.scrollHeight - head.clientHeight)
      syncingRef.current = false
    }
    const fromHead = () => {
      if (syncingRef.current) return
      syncingRef.current = true
      const pct = head.scrollTop / Math.max(1, head.scrollHeight - head.clientHeight)
      base.scrollTop = pct * Math.max(1, base.scrollHeight - base.clientHeight)
      syncingRef.current = false
    }

    base.addEventListener('scroll', fromBase, { passive: true })
    head.addEventListener('scroll', fromHead, { passive: true })
    return () => {
      base.removeEventListener('scroll', fromBase)
      head.removeEventListener('scroll', fromHead)
    }
  }, [])

  // Notify CommentPanel that a diff is open so it loads the right threads
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('diff-opened', { detail: { sourceId, filePath, baseSha, headSha } }),
    )
  }, [sourceId, filePath, baseSha, headSha])

  // Click-to-comment: find the closest annotated ancestor and dispatch event
  const makeClickHandler = useCallback(
    (side: 'base' | 'head') => (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-source-start]')
      if (!el) return
      const lineStart = parseInt(el.dataset.sourceStart ?? '0', 10)
      const lineEnd = parseInt(el.dataset.sourceEnd ?? '0', 10)
      if (!lineStart) return
      const selectedText =
        window.getSelection()?.toString().trim() ||
        el.textContent?.trim().slice(0, 300) ||
        ''
      window.dispatchEvent(
        new CustomEvent('diff-comment-requested', {
          detail: { sourceId, filePath, diffSide: side, lineStart, lineEnd, selectedText, baseSha, headSha },
        }),
      )
    },
    [sourceId, filePath, baseSha, headSha],
  )

  useEffect(() => {
    const base = baseRef.current
    const head = headRef.current
    if (!base || !head) return
    const baseH = makeClickHandler('base')
    const headH = makeClickHandler('head')
    base.addEventListener('click', baseH)
    head.addEventListener('click', headH)
    return () => {
      base.removeEventListener('click', baseH)
      head.removeEventListener('click', headH)
    }
  }, [makeClickHandler])

  return (
    <div className="flex h-full overflow-hidden divide-x divide-zinc-200 dark:divide-zinc-700">
      {/* Base panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-4 py-1 text-xs font-mono text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-b border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
          base · {baseSha.slice(0, 8)}
        </div>
        {baseHtml ? (
          <div
            ref={baseRef}
            className="flex-1 overflow-y-auto p-6 prose prose-zinc dark:prose-invert max-w-none cursor-pointer"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: baseHtml }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-zinc-400 italic">
            {status === 'added' ? 'File did not exist on base.' : 'No base content.'}
          </div>
        )}
      </div>

      {/* Head panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-4 py-1 text-xs font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 border-b border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
          head · {headSha.slice(0, 8)}
        </div>
        {headHtml ? (
          <div
            ref={headRef}
            className="flex-1 overflow-y-auto p-6 prose prose-zinc dark:prose-invert max-w-none cursor-pointer"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: headHtml }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-sm text-zinc-400 italic">
            {status === 'removed' ? 'File does not exist on head.' : 'No head content.'}
          </div>
        )}
      </div>
    </div>
  )
}

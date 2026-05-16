'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { DiffHunk } from '@/lib/diff/computeDiff'

interface ThreadAnchor {
  type: string
  diffSide: string | null
  lineStart: number | null
  lineEnd: number | null
}

interface Thread {
  id: string
  resolved: boolean
  anchor: ThreadAnchor | null
}

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

function applyCommentMarkers(
  container: HTMLElement | null,
  threads: Thread[],
  side: 'base' | 'head',
) {
  if (!container) return

  // Remove stale markers
  for (const m of container.querySelectorAll('.diff-comment-marker')) m.remove()

  const openThreads = threads.filter(
    (t) => !t.resolved && t.anchor?.type === 'DIFF_HUNK' && t.anchor.diffSide === side,
  )
  if (!openThreads.length) return

  for (const el of container.querySelectorAll<HTMLElement>('[data-source-start]')) {
    const blockStart = parseInt(el.dataset.sourceStart ?? '0', 10)
    const blockEnd = parseInt(el.dataset.sourceEnd ?? '0', 10)

    const matching = openThreads.filter((t) => {
      const ls = t.anchor!.lineStart ?? 0
      const le = t.anchor!.lineEnd ?? ls
      return ls <= blockEnd && le >= blockStart
    })
    if (!matching.length) continue

    // Position the parent block relatively so the badge can be absolute
    const prev = el.style.position
    if (!prev || prev === 'static') el.style.position = 'relative'

    const badge = document.createElement('span')
    badge.className = 'diff-comment-marker'
    badge.dataset.threadId = matching[0].id
    badge.title = `${matching.length} comment${matching.length > 1 ? 's' : ''}`
    badge.textContent = String(matching.length)
    Object.assign(badge.style, {
      position: 'absolute',
      top: '0',
      right: '0',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '1.25rem',
      height: '1.25rem',
      padding: '0 0.25rem',
      borderRadius: '9999px',
      fontSize: '0.65rem',
      fontWeight: '700',
      lineHeight: '1',
      background: 'rgba(245,158,11,0.9)',
      color: '#fff',
      cursor: 'pointer',
      zIndex: '10',
      userSelect: 'none',
    })
    el.appendChild(badge)
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
  const threadsRef = useRef<Thread[]>([])

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

  // Listen for thread updates and apply comment markers
  useEffect(() => {
    const handler = (e: Event) => {
      const { threads } = (e as CustomEvent<{ threads: Thread[] }>).detail
      threadsRef.current = threads
      applyCommentMarkers(baseRef.current, threads, 'base')
      applyCommentMarkers(headRef.current, threads, 'head')
    }
    window.addEventListener('threads-updated', handler)
    return () => window.removeEventListener('threads-updated', handler)
  }, [])

  // Re-apply markers after HTML changes (new file selected)
  useEffect(() => {
    applyCommentMarkers(baseRef.current, threadsRef.current, 'base')
  }, [baseHtml])
  useEffect(() => {
    applyCommentMarkers(headRef.current, threadsRef.current, 'head')
  }, [headHtml])

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

  // Notify CommentPanel that a diff is open so it loads the right threads.
  // CommentPanel is a sibling-aside that mounts AFTER this component, so its
  // diff-opened listener may not be attached when we first dispatch. Fire
  // three times spread out — by 500ms, even slow hydration has registered the
  // listener, so the last event always lands.
  useEffect(() => {
    const fire = () =>
      window.dispatchEvent(
        new CustomEvent('diff-opened', { detail: { sourceId, filePath, baseSha, headSha } }),
      )
    const t1 = setTimeout(fire, 0)
    const t2 = setTimeout(fire, 150)
    const t3 = setTimeout(fire, 500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [sourceId, filePath, baseSha, headSha])

  // Click handler: marker → focus-thread; block → diff-comment-requested
  const makeClickHandler = useCallback(
    (side: 'base' | 'head') => (e: MouseEvent) => {
      const target = e.target as HTMLElement

      // Clicked on a comment badge
      const marker = target.closest<HTMLElement>('.diff-comment-marker')
      if (marker) {
        e.stopPropagation()
        const threadId = marker.dataset.threadId
        if (threadId) {
          window.dispatchEvent(new CustomEvent('focus-thread', { detail: { threadId } }))
        }
        return
      }

      const el = target.closest<HTMLElement>('[data-source-start]')
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
    const baseH = base ? makeClickHandler('base') : null
    const headH = head ? makeClickHandler('head') : null
    if (base && baseH) base.addEventListener('click', baseH)
    if (head && headH) head.addEventListener('click', headH)
    return () => {
      if (base && baseH) base.removeEventListener('click', baseH)
      if (head && headH) head.removeEventListener('click', headH)
    }
  }, [makeClickHandler, baseHtml, headHtml])

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
            data-testid="diff-base-panel"
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
            data-testid="diff-head-panel"
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

'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import type { DiffHunk } from '@/lib/diff/computeDiff'
import { setPanelContext } from '@/lib/comments/panelContext'

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
  onImageClick?: (path: string) => void
}

// ── Word-level diff helpers ──────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text.match(/\w+|[^\w]+/g) ?? []
}

type WordOp = { type: 'equal' | 'delete' | 'insert'; text: string }

function computeWordDiff(aText: string, bText: string): { baseOps: WordOp[]; headOps: WordOp[] } {
  const tA = tokenize(aText)
  const tB = tokenize(bText)
  const m = tA.length, n = tB.length

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = tA[i - 1] === tB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])

  type RawOp = { type: 'equal' | 'delete' | 'insert'; aIdx?: number; bIdx?: number }
  const raw: RawOp[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && tA[i - 1] === tB[j - 1]) {
      raw.push({ type: 'equal', aIdx: i - 1, bIdx: j - 1 }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      raw.push({ type: 'insert', bIdx: j - 1 }); j--
    } else {
      raw.push({ type: 'delete', aIdx: i - 1 }); i--
    }
  }
  raw.reverse()

  const baseOps = raw.filter(o => o.type !== 'insert').map(o => ({ type: o.type as 'equal' | 'delete', text: tA[o.aIdx!] }))
  const headOps = raw.filter(o => o.type !== 'delete').map(o => ({ type: o.type as 'equal' | 'insert', text: tB[o.bIdx!] }))
  return { baseOps, headOps }
}

function changedRanges(ops: WordOp[], opType: 'delete' | 'insert'): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = []
  let offset = 0
  for (const op of ops) {
    if (op.type === opType) {
      const last = ranges[ranges.length - 1]
      // Merge adjacent ranges so multi-token inserts render as one continuous mark
      if (last && last.end === offset) last.end = offset + op.text.length
      else ranges.push({ start: offset, end: offset + op.text.length })
    }
    offset += op.text.length
  }
  return ranges
}

function wrapTextRanges(el: HTMLElement, ranges: Array<{ start: number; end: number }>, color: string) {
  if (!ranges.length) return
  const textNodes: Array<{ node: Text; start: number }> = []
  let offset = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let cur: Node | null
  while ((cur = walker.nextNode())) {
    const tn = cur as Text
    textNodes.push({ node: tn, start: offset })
    offset += tn.length
  }
  for (let ti = textNodes.length - 1; ti >= 0; ti--) {
    const { node, start: nStart } = textNodes[ti]
    const nEnd = nStart + node.length
    const overlapping = ranges.filter(r => r.end > nStart && r.start < nEnd)
    if (!overlapping.length) continue
    const splits = new Set<number>([0, node.length])
    for (const r of overlapping) {
      const ls = r.start - nStart, le = r.end - nStart
      if (ls > 0 && ls < node.length) splits.add(ls)
      if (le > 0 && le < node.length) splits.add(le)
    }
    const sorted = [...splits].sort((a, b) => a - b)
    const parent = node.parentNode!
    const frag = document.createDocumentFragment()
    const fullText = node.textContent!
    for (let k = 0; k < sorted.length - 1; k++) {
      const s = sorted[k], e = sorted[k + 1]
      const chunk = fullText.slice(s, e)
      const absStart = nStart + s, absEnd = nStart + e
      const isChanged = ranges.some(r => r.start <= absStart && r.end >= absEnd)
      if (isChanged) {
        const mark = document.createElement('span')
        mark.className = 'diff-word-mark'
        mark.style.setProperty('background-color', color, 'important')
        mark.textContent = chunk
        frag.appendChild(mark)
      } else {
        frag.appendChild(document.createTextNode(chunk))
      }
    }
    parent.replaceChild(frag, node)
  }
}

function clearWordMarks(container: HTMLElement) {
  for (const mark of container.querySelectorAll('.diff-word-mark')) {
    const parent = mark.parentNode!
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  }
  container.normalize()
}

function applyWordHighlights(
  baseContainer: HTMLElement | null,
  headContainer: HTMLElement | null,
  baseChangedLines: Set<number>,
  headChangedLines: Set<number>,
) {
  if (!baseContainer || !headContainer) return
  clearWordMarks(baseContainer)
  clearWordMarks(headContainer)

  const isChangedBlock = (el: HTMLElement, changedLines: Set<number>) => {
    const s = parseInt(el.dataset.sourceStart ?? '0', 10)
    const e = parseInt(el.dataset.sourceEnd ?? String(s), 10)
    for (let ln = s; ln <= e; ln++) if (changedLines.has(ln)) return true
    return false
  }

  const changedBase = Array.from(baseContainer.querySelectorAll<HTMLElement>('[data-source-start]'))
    .filter(el => isChangedBlock(el, baseChangedLines))
  const changedHead = Array.from(headContainer.querySelectorAll<HTMLElement>('[data-source-start]'))
    .filter(el => isChangedBlock(el, headChangedLines))

  // Pair by tag name to avoid aligning, e.g., a <pre> in base with an <hr> in
  // head when the two changed-block lists have different shapes. Within a tag
  // group, use content-similarity matching (Jaccard on token sets) so that an
  // inserted/deleted row doesn't shift subsequent rows out of alignment.
  const groupByTag = (els: HTMLElement[]) => {
    const map = new Map<string, HTMLElement[]>()
    for (const el of els) {
      const arr = map.get(el.tagName) ?? []
      arr.push(el)
      map.set(el.tagName, arr)
    }
    return map
  }
  const baseByTag = groupByTag(changedBase)
  const headByTag = groupByTag(changedHead)

  for (const [tag, bGroup] of baseByTag) {
    const hGroup = headByTag.get(tag)
    if (!hGroup) continue

    // Compute Jaccard similarity between token sets to find the best-matching
    // counterpart for each element, rather than relying on document order.
    // This handles cases like an inserted table row shifting subsequent rows
    // so that position-based pairing would match the wrong rows.
    const makeTokenSet = (s: string) => new Set(tokenize(s).filter(t => t.trim()))
    const bTokenSets = bGroup.map(el => makeTokenSet(el.textContent ?? ''))
    const hTokenSets = hGroup.map(el => makeTokenSet(el.textContent ?? ''))

    type Score = { bi: number; hi: number; sim: number }
    const scores: Score[] = []
    for (let bi = 0; bi < bGroup.length; bi++) {
      const bToks = bTokenSets[bi]
      for (let hi = 0; hi < hGroup.length; hi++) {
        const hToks = hTokenSets[hi]
        const intersection = [...bToks].filter(t => hToks.has(t)).length
        const union = new Set([...bToks, ...hToks]).size
        scores.push({ bi, hi, sim: union ? intersection / union : 0 })
      }
    }
    scores.sort((a, b) => b.sim - a.sim)

    const usedB = new Set<number>(), usedH = new Set<number>()
    for (const { bi, hi, sim } of scores) {
      if (usedB.has(bi) || usedH.has(hi)) continue
      if (sim < 0.1) break
      const bEl = bGroup[bi], hEl = hGroup[hi]
      const bText = bEl.textContent ?? '', hText = hEl.textContent ?? ''
      if (!bText || !hText || bText.length + hText.length > 4000) continue
      const { baseOps, headOps } = computeWordDiff(bText, hText)
      wrapTextRanges(bEl, changedRanges(baseOps, 'delete'), 'rgba(239,68,68,0.6)')
      wrapTextRanges(hEl, changedRanges(headOps, 'insert'), 'rgba(34,197,94,0.6)')
      usedB.add(bi); usedH.add(hi)
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────

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
      el.style.borderRadius = '2px'
      if (el.tagName === 'TR') {
        // border-left and padding don't apply to <tr>; style the first cell instead
        const firstCell = el.querySelector<HTMLElement>('td, th')
        if (firstCell) { firstCell.style.borderLeft = border; firstCell.style.paddingLeft = '0.5rem' }
      } else {
        el.style.borderLeft = border
        el.style.paddingLeft = '0.5rem'
      }
    } else {
      el.style.backgroundColor = ''
      el.style.borderLeft = ''
      el.style.paddingLeft = ''
      if (el.tagName === 'TR') {
        const firstCell = el.querySelector<HTMLElement>('td, th')
        if (firstCell) { firstCell.style.borderLeft = ''; firstCell.style.paddingLeft = '' }
      }
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
  onImageClick,
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

  // Stable dangerouslySetInnerHTML objects. React 19's updateProperties
  // re-applies dangerouslySetInnerHTML whenever the prop object's identity
  // changes; a fresh {__html} literal each render would re-set innerHTML on
  // every re-render, destroying the imperatively-applied highlights below.
  const baseInner = useMemo(() => (baseHtml ? { __html: baseHtml } : undefined), [baseHtml])
  const headInner = useMemo(() => (headHtml ? { __html: headHtml } : undefined), [headHtml])

  // Highlight changed blocks after HTML is in the DOM
  useEffect(() => { applyHighlights(baseRef.current, baseChangedLines, 'base') }, [baseHtml, baseChangedLines])
  useEffect(() => { applyHighlights(headRef.current, headChangedLines, 'head') }, [headHtml, headChangedLines])

  // Word-level highlights (runs after block highlights; both target different DOM layers)
  useEffect(() => {
    applyWordHighlights(baseRef.current, headRef.current, baseChangedLines, headChangedLines)
  }, [baseHtml, headHtml, baseChangedLines, headChangedLines])

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
  }, [baseHtml, headHtml])

  // Notify CommentPanel that a diff is open so it loads the right threads.
  // CommentPanel is a sibling-aside that mounts AFTER this component, so its
  // diff-opened listener may not be attached when we first dispatch. Fire
  // three times spread out — by 500ms, even slow hydration has registered the
  // listener, so the last event always lands.
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

  // Click handler: badges → focus-thread; tagged images → image diff navigation
  const makeClickHandler = useCallback(
    () => (e: MouseEvent) => {
      const target = e.target as HTMLElement

      const marker = target.closest<HTMLElement>('.diff-comment-marker')
      if (marker) {
        e.stopPropagation()
        const threadId = marker.dataset.threadId
        if (threadId) window.dispatchEvent(new CustomEvent('focus-thread', { detail: { threadId } }))
        return
      }

      const img = target.closest<HTMLElement>('img[data-compare-path]')
      if (img?.dataset.comparePath && onImageClick) {
        e.preventDefault()
        onImageClick(img.dataset.comparePath)
      }
    },
    [onImageClick],
  )

  // Mouseup handler: detect text selection → broadcast diff-selection-changed
  const makeMouseUpHandler = useCallback(
    (side: 'base' | 'head') => () => {
      const sel = window.getSelection()
      const selectedText = sel?.toString().trim() ?? ''
      if (!selectedText || !sel?.rangeCount) {
        window.dispatchEvent(new CustomEvent('diff-selection-changed', { detail: null }))
        return
      }
      const range = sel.getRangeAt(0)
      const anchor = range.startContainer.parentElement?.closest<HTMLElement>('[data-source-start]')
        ?? range.endContainer.parentElement?.closest<HTMLElement>('[data-source-start]')
      if (!anchor) {
        window.dispatchEvent(new CustomEvent('diff-selection-changed', { detail: null }))
        return
      }
      const lineStart = parseInt(anchor.dataset.sourceStart ?? '0', 10)
      const lineEnd = parseInt(anchor.dataset.sourceEnd ?? '0', 10)
      if (!lineStart) {
        window.dispatchEvent(new CustomEvent('diff-selection-changed', { detail: null }))
        return
      }
      window.dispatchEvent(new CustomEvent('diff-selection-changed', {
        detail: { side, lineStart, lineEnd, selectedText },
      }))
    },
    [],
  )

  // Clear selection when file changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('diff-selection-changed', { detail: null }))
  }, [sourceId, filePath, baseSha, headSha])

  useEffect(() => {
    const base = baseRef.current
    const head = headRef.current
    const handler = makeClickHandler()
    const baseUp = makeMouseUpHandler('base')
    const headUp = makeMouseUpHandler('head')
    if (base) { base.addEventListener('click', handler); base.addEventListener('mouseup', baseUp) }
    if (head) { head.addEventListener('click', handler); head.addEventListener('mouseup', headUp) }
    return () => {
      if (base) { base.removeEventListener('click', handler); base.removeEventListener('mouseup', baseUp) }
      if (head) { head.removeEventListener('click', handler); head.removeEventListener('mouseup', headUp) }
    }
  }, [makeClickHandler, makeMouseUpHandler, baseHtml, headHtml])

  return (
    <div className="flex h-full overflow-hidden divide-x divide-zinc-200 dark:divide-zinc-700">
      {/* eslint-disable-next-line react/no-danger */}
      <style>{`.diff-word-mark{border-radius:2px;color:inherit;padding:0 1px;}${onImageClick ? 'img[data-compare-path]{cursor:pointer;}' : ''}`}</style>
      {/* Base panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="px-4 py-1 text-xs font-mono text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border-b border-zinc-200 dark:border-zinc-700 shrink-0 select-none">
          base · {baseSha.slice(0, 8)}
        </div>
        {baseHtml ? (
          <div
            ref={baseRef}
            data-testid="diff-base-panel"
            className="flex-1 overflow-y-auto p-6 prose prose-zinc dark:prose-invert max-w-none"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={baseInner}
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
            className="flex-1 overflow-y-auto p-6 prose prose-zinc dark:prose-invert max-w-none"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={headInner}
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

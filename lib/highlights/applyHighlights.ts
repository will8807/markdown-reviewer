export interface HighlightThread {
  id: string
  resolved: boolean
  anchor: {
    selectedText: string | null
    prefix: string | null
    renderedStart: number | null
    renderedEnd: number | null
  } | null
}

export function applyHighlights(article: HTMLElement, threads: HighlightThread[], activeId?: string): void {
  if (!supportsHighlights()) return
  CSS.highlights.clear()

  const { nodes, offsets } = buildTextMap(article)
  const ranges: Range[] = []
  const activeRanges: Range[] = []

  for (const thread of threads) {
    if (thread.resolved || !thread.anchor) continue

    const range = resolveRange(nodes, offsets, thread.anchor)
    if (!range) continue

    if (thread.id === activeId) activeRanges.push(range)
    else ranges.push(range)
  }

  if (ranges.length > 0) CSS.highlights.set('comment-thread', new Highlight(...ranges))
  if (activeRanges.length > 0) CSS.highlights.set('comment-thread-active', new Highlight(...activeRanges))
}

function resolveRange(
  nodes: Text[],
  offsets: number[],
  anchor: HighlightThread['anchor'] & object,
): Range | null {
  // Use stored rendered offsets when available (exact, handles duplicates)
  if (anchor.renderedStart != null && anchor.renderedEnd != null) {
    return buildRange(nodes, offsets, anchor.renderedStart, anchor.renderedEnd)
  }
  // Fallback: text search for comments created before this field existed
  if (!anchor.selectedText) return null
  const totalText = nodes.map(n => n.textContent ?? '').join('')
  const idx = findInText(totalText, anchor.selectedText, anchor.prefix ?? '')
  if (idx === -1) return null
  return buildRange(nodes, offsets, idx, idx + anchor.selectedText.length)
}

function supportsHighlights(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS
}

function buildTextMap(root: HTMLElement) {
  const nodes: Text[] = []
  const offsets: number[] = []
  let pos = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    offsets.push(pos)
    nodes.push(node as Text)
    pos += (node as Text).textContent?.length ?? 0
  }
  return { nodes, offsets }
}

function findInText(haystack: string, needle: string, prefix: string): number {
  if (prefix) {
    const ctx = prefix.slice(-20)
    const idx = haystack.indexOf(ctx + needle)
    if (idx !== -1) return idx + ctx.length
  }
  return haystack.indexOf(needle)
}

function buildRange(nodes: Text[], offsets: number[], start: number, end: number): Range | null {
  const s = findNodeAt(nodes, offsets, start)
  const e = findNodeAt(nodes, offsets, end)
  if (!s || !e) return null
  const range = document.createRange()
  range.setStart(s.node, s.localOffset)
  range.setEnd(e.node, e.localOffset)
  return range
}

function findNodeAt(nodes: Text[], offsets: number[], pos: number) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (offsets[i] <= pos) {
      const localOffset = pos - offsets[i]
      if (localOffset > (nodes[i].textContent?.length ?? 0)) return null
      return { node: nodes[i], localOffset }
    }
  }
  return null
}

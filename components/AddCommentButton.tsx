'use client'

import { useState, useEffect } from 'react'

interface DiffContext {
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
}

interface DiffSelection {
  side: 'base' | 'head'
  lineStart: number
  lineEnd: number
  selectedText: string
  renderedStart: number | null
  renderedEnd: number | null
}

interface PopoverState {
  x: number
  y: number
  selection: DiffSelection
}

export default function AddCommentButton() {
  const [diffCtx, setDiffCtx] = useState<DiffContext | null>(null)
  const [popover, setPopover] = useState<PopoverState | null>(null)

  useEffect(() => {
    const onOpened = (e: Event) => {
      setDiffCtx((e as CustomEvent<DiffContext>).detail)
      setPopover(null)
    }
    const onSelection = (e: Event) => {
      const selection = (e as CustomEvent<DiffSelection | null>).detail
      if (!selection) {
        setPopover(null)
        return
      }

      const browserSelection = window.getSelection()
      if (!browserSelection?.rangeCount) {
        setPopover(null)
        return
      }

      const rect = browserSelection.getRangeAt(0).getBoundingClientRect()
      setPopover({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        selection,
      })
    }
    window.addEventListener('diff-opened', onOpened)
    window.addEventListener('diff-selection-changed', onSelection)
    return () => {
      window.removeEventListener('diff-opened', onOpened)
      window.removeEventListener('diff-selection-changed', onSelection)
    }
  }, [])

  if (!diffCtx || !popover) return null

  const onClick = () => {
    if (!diffCtx) return
    window.dispatchEvent(
      new CustomEvent('diff-comment-requested', {
        detail: {
          sourceId: diffCtx.sourceId,
          filePath: diffCtx.filePath,
          baseSha: diffCtx.baseSha,
          headSha: diffCtx.headSha,
          diffSide: popover.selection.side,
          lineStart: popover.selection.lineStart,
          lineEnd: popover.selection.lineEnd,
          selectedText: popover.selection.selectedText,
          renderedStart: popover.selection.renderedStart ?? undefined,
          renderedEnd: popover.selection.renderedEnd ?? undefined,
        },
      }),
    )
    window.dispatchEvent(new CustomEvent('open-comment-panel'))
    setPopover(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: popover.x,
        top: popover.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
      }}
    >
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        Comment
      </button>
    </div>
  )
}

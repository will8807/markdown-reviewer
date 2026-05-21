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
}

export default function AddCommentButton() {
  const [diffCtx, setDiffCtx] = useState<DiffContext | null>(null)
  const [diffSelection, setDiffSelection] = useState<DiffSelection | null>(null)

  useEffect(() => {
    const onOpened = (e: Event) => {
      setDiffCtx((e as CustomEvent<DiffContext>).detail)
      setDiffSelection(null)
    }
    const onSelection = (e: Event) => {
      setDiffSelection((e as CustomEvent<DiffSelection | null>).detail)
    }
    window.addEventListener('diff-opened', onOpened)
    window.addEventListener('diff-selection-changed', onSelection)
    return () => {
      window.removeEventListener('diff-opened', onOpened)
      window.removeEventListener('diff-selection-changed', onSelection)
    }
  }, [])

  if (!diffCtx) return null

  const onClick = () => {
    if (!diffSelection || !diffCtx) return
    window.dispatchEvent(
      new CustomEvent('diff-comment-requested', {
        detail: {
          sourceId: diffCtx.sourceId,
          filePath: diffCtx.filePath,
          baseSha: diffCtx.baseSha,
          headSha: diffCtx.headSha,
          diffSide: diffSelection.side,
          lineStart: diffSelection.lineStart,
          lineEnd: diffSelection.lineEnd,
          selectedText: diffSelection.selectedText,
        },
      }),
    )
    window.dispatchEvent(new CustomEvent('open-comment-panel'))
    setDiffSelection(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={!diffSelection}
      title={diffSelection ? 'Add a comment on the selected text' : 'Highlight text in the diff first'}
      className="rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-500"
    >
      Add Comment
    </button>
  )
}

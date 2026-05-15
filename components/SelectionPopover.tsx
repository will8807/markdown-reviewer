'use client'

import { useEffect, useRef, useState } from 'react'
import { serializeSelection, renderedOffsetOf } from '@/lib/anchors/textAnchor'

interface Props {
  sourceContent: string
  filePath: string
  onCreateThread: (anchor: ReturnType<typeof serializeSelection>) => void
}

interface PopoverState {
  x: number
  y: number
  anchor: ReturnType<typeof serializeSelection>
}


export default function SelectionPopover({ sourceContent, filePath, onCreateThread }: Props) {
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setPopover(null)
        return
      }

      const text = selection.toString().trim()
      if (!text) {
        setPopover(null)
        return
      }

      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      const idx = sourceContent.indexOf(text)
      if (idx === -1) {
        setPopover(null)
        return
      }

      const anchor = serializeSelection(sourceContent, idx, idx + text.length, filePath)

      // Capture exact rendered offsets from the live DOM selection
      const article = document.querySelector('article')
      if (article) {
        anchor.renderedStart = renderedOffsetOf(article, range.startContainer, range.startOffset)
        anchor.renderedEnd = renderedOffsetOf(article, range.endContainer, range.endOffset)
      }

      setPopover({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        anchor,
      })
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [sourceContent, filePath])

  if (!popover) return null

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
        ref={buttonRef}
        onClick={() => {
          onCreateThread(popover.anchor)
          setPopover(null)
          window.getSelection()?.removeAllRanges()
        }}
        className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        Comment
      </button>
    </div>
  )
}

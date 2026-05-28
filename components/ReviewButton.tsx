'use client'

import { useEffect, useState } from 'react'
import { markReviewed, markUnreviewed, getReviewedEntry } from '@/lib/review/reviewedFiles'

interface Props {
  sourceId: string
  filePath: string
  sha: string | null
}

export default function ReviewButton({ sourceId, filePath, sha }: Props) {
  const [entry, setEntry] = useState(() => getReviewedEntry(sourceId, filePath))

  useEffect(() => {
    setEntry(getReviewedEntry(sourceId, filePath))
  }, [sourceId, filePath])

  const isReviewed = entry !== null
  const isStale = isReviewed && sha !== null && entry.sha !== null && entry.sha !== sha

  function toggle() {
    if (isReviewed && !isStale) {
      markUnreviewed(sourceId, filePath)
      setEntry(null)
    } else {
      markReviewed(sourceId, filePath, sha)
      setEntry({ sha, reviewedAt: Date.now() })
    }
    window.dispatchEvent(new CustomEvent('reviewed-files-updated', { detail: { sourceId } }))
  }

  if (isStale) {
    return (
      <button
        data-testid="review-btn"
        onClick={toggle}
        title="File has changed since you last reviewed it — click to mark reviewed again"
        className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <span>⚠ Changed since reviewed</span>
      </button>
    )
  }

  if (isReviewed) {
    return (
      <button
        data-testid="review-btn"
        onClick={toggle}
        title="Click to unmark"
        className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
      >
        <span>Reviewed ✓</span>
      </button>
    )
  }

  return (
    <button
      data-testid="review-btn"
      onClick={toggle}
      className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 transition-colors"
    >
      <span>Mark as reviewed</span>
    </button>
  )
}

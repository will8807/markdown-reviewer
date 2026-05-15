'use client'

import { useCallback } from 'react'
import { useParams } from 'next/navigation'
import MarkdownViewer from './MarkdownViewer'
import SelectionPopover from './SelectionPopover'
import type { serializeSelection } from '@/lib/anchors/textAnchor'

interface Props {
  html: string
  sourceContent: string
  filePath: string
  fileId: string | null
  devUserId: string | null
}

export default function ViewerClient({ html, sourceContent, filePath, fileId, devUserId }: Props) {
  const params = useParams<{ projectId: string; sourceId: string }>()

  const handleCreateThread = useCallback(
    (anchor: ReturnType<typeof serializeSelection>) => {
      if (!params?.sourceId) return
      // Hand off to CommentPanel via a custom event — it owns the composer UI
      window.dispatchEvent(
        new CustomEvent('comment-requested', {
          detail: { anchor, sourceId: params.sourceId, fileId, devUserId },
        })
      )
    },
    [params, fileId, devUserId]
  )

  return (
    <div className="relative">
      <SelectionPopover
        sourceContent={sourceContent}
        filePath={filePath}
        onCreateThread={handleCreateThread}
      />
      <MarkdownViewer html={html} />
    </div>
  )
}

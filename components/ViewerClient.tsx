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
}

export default function ViewerClient({ html, sourceContent, filePath, fileId }: Props) {
  const params = useParams<{ projectId: string; sourceId: string }>()

  const handleCreateThread = useCallback(
    (anchor: ReturnType<typeof serializeSelection>) => {
      if (!params?.sourceId) return
      window.dispatchEvent(
        new CustomEvent('comment-requested', {
          detail: { anchor, sourceId: params.sourceId, fileId },
        })
      )
    },
    [params, fileId]
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

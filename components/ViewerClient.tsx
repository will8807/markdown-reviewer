'use client'

import { useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import MarkdownViewer from './MarkdownViewer'
import SelectionPopover from './SelectionPopover'
import type { serializeSelection } from '@/lib/anchors/textAnchor'
import { setPanelContext } from '@/lib/comments/panelContext'

interface Props {
  html: string
  sourceContent: string
  filePath: string
  fileId: string | null
  sha: string | null
}

export default function ViewerClient({ html, sourceContent, filePath, fileId, sha }: Props) {
  const params = useParams<{ projectId: string; sourceId: string }>()

  useEffect(() => {
    if (!fileId) return
    setPanelContext({ type: 'file', fileId, sha: sha ?? undefined })
    window.dispatchEvent(new CustomEvent('file-opened', { detail: { fileId, sha } }))
  }, [fileId, sha])

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

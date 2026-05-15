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
    async (anchor: ReturnType<typeof serializeSelection>) => {
      if (!params?.sourceId) return

      const threadRes = await fetch('/api/comment-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: params.sourceId,
          fileId: fileId ?? undefined,
          anchor: {
            type: 'TEXT_SELECTION',
            filePath: anchor.filePath,
            selectedText: anchor.selectedText,
            prefix: anchor.prefix,
            suffix: anchor.suffix,
            charStart: anchor.charStart,
            charEnd: anchor.charEnd,
          },
        }),
      })

      if (!threadRes.ok) return
      const thread = (await threadRes.json()) as { id: string; fileId: string | null }

      // Add initial comment
      if (devUserId && thread.id) {
        const body = window.prompt('Add a comment:')
        if (body?.trim()) {
          await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threadId: thread.id, authorId: devUserId, body: body.trim() }),
          })
        }
      }

      // Notify comment panel to refresh
      const effectiveFileId = thread.fileId ?? fileId
      if (effectiveFileId) {
        window.dispatchEvent(
          new CustomEvent('thread-created', { detail: { fileId: effectiveFileId } })
        )
      }
    },
    [params, filePath, fileId, devUserId]
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

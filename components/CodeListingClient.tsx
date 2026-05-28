'use client'

import { useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import CodeListing from './CodeListing'
import SelectionPopover from './SelectionPopover'
import ReviewButton from './ReviewButton'
import type { serializeSelection } from '@/lib/anchors/textAnchor'
import { setPanelContext } from '@/lib/comments/panelContext'
import { recordView } from '@/lib/activity/recentFiles'

interface Props {
  content: string
  filePath: string
  fileId: string | null
  sha: string | null
  sourceName: string
  projectId: string
  projectName: string
}

export default function CodeListingClient({
  content,
  filePath,
  fileId,
  sha,
  sourceName,
  projectId,
  projectName,
}: Props) {
  const params = useParams<{ projectId: string; sourceId: string }>()

  useEffect(() => {
    if (!fileId) return
    setPanelContext({ type: 'file', fileId, filePath, sha: sha ?? undefined })
    window.dispatchEvent(new CustomEvent('file-opened', { detail: { fileId, filePath, sha } }))
  }, [fileId, filePath, sha])

  useEffect(() => {
    if (!params?.sourceId) return
    recordView({ projectId, sourceId: params.sourceId, sourceName, projectName, filePath })
  }, [params?.sourceId, projectId, sourceName, projectName, filePath])

  const handleCreateThread = useCallback(
    (anchor: ReturnType<typeof serializeSelection>) => {
      if (!params?.sourceId) return
      window.dispatchEvent(
        new CustomEvent('comment-requested', {
          detail: { anchor, sourceId: params.sourceId, fileId },
        }),
      )
    },
    [params, fileId],
  )

  return (
    <div className="relative p-4">
      <div className="flex items-center justify-end pb-2">
        {params?.sourceId && (
          <ReviewButton sourceId={params.sourceId} filePath={filePath} sha={sha} />
        )}
      </div>
      <SelectionPopover
        sourceContent={content}
        filePath={filePath}
        onCreateThread={handleCreateThread}
      />
      <CodeListing content={content} />
    </div>
  )
}

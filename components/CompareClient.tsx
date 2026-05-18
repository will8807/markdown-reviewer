'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DiffFileList from './DiffFileList'
import RenderedDiff from './RenderedDiff'
import ImageDiff from './ImageDiff'
import type { ChangedFile, DiffHunk } from '@/lib/diff/computeDiff'

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
function isImagePath(p: string) {
  const dot = p.lastIndexOf('.')
  return dot !== -1 && IMAGE_EXTS.has(p.slice(dot).toLowerCase())
}

interface RefInfo {
  name: string
  sha: string
  type: 'branch' | 'tag'
}

interface ActiveFileDiff {
  baseHtml: string | null
  headHtml: string | null
  hunks: DiffHunk[]
  isBinary: boolean
  status: 'added' | 'removed' | 'modified' | 'renamed'
}

interface Props {
  projectId: string
  sourceId: string
  files: ChangedFile[]
  baseSha: string | null
  headSha: string | null
  base: string | null
  head: string | null
  activePath: string | null
  activeFileDiff: ActiveFileDiff | null
}

export default function CompareClient({
  projectId,
  sourceId,
  files,
  baseSha,
  headSha,
  base,
  head,
  activePath,
  activeFileDiff,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [refs, setRefs] = useState<RefInfo[]>([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/sources/${sourceId}/refs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRefs(data?.refs ?? []))
      .catch(() => {})
  }, [projectId, sourceId])

  const navigate = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k)
        else params.set(k, v)
      }
      router.replace(`/projects/${projectId}/sources/${sourceId}/compare?${params.toString()}`)
    },
    [router, searchParams, projectId, sourceId],
  )

  const handleFileSelect = useCallback((path: string) => navigate({ path }), [navigate])

  const refOptions = refs.map((r) => (
    <option key={r.name} value={r.name}>
      {r.name}
    </option>
  ))

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: ref pickers + changed-files list */}
      <div className="w-72 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-700 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 w-8 shrink-0">base</label>
            <select
              data-testid="base-ref-select"
              value={base ?? ''}
              onChange={(e) => navigate({ base: e.target.value, path: null })}
              className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {!base && <option value="">— select —</option>}
              {refOptions}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 w-8 shrink-0">head</label>
            <select
              data-testid="head-ref-select"
              value={head ?? ''}
              onChange={(e) => navigate({ head: e.target.value, path: null })}
              className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {!head && <option value="">— select —</option>}
              {refOptions}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <DiffFileList
            files={files}
            activePath={activePath}
            onSelect={handleFileSelect}
            projectId={projectId}
            sourceId={sourceId}
            baseSha={baseSha}
            headSha={headSha}
          />
        </div>
      </div>

      {/* Right: rendered diff or empty state */}
      <div className="flex-1 overflow-hidden" data-testid="diff-view">
        {activePath && activeFileDiff && baseSha && headSha ? (
          isImagePath(activePath) ? (
            <ImageDiff
              projectId={projectId}
              sourceId={sourceId}
              filePath={activePath}
              baseSha={baseSha}
              headSha={headSha}
              status={activeFileDiff.status}
            />
          ) : activeFileDiff.isBinary ? (
            <div className="p-8 text-sm text-zinc-500">
              <p className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Binary file</p>
              <p className="font-mono text-xs">{activePath}</p>
              <p className="mt-2 text-xs">Binary files cannot be shown as a rendered diff.</p>
            </div>
          ) : (
            <RenderedDiff
              sourceId={sourceId}
              filePath={activePath}
              baseSha={baseSha}
              headSha={headSha}
              baseHtml={activeFileDiff.baseHtml}
              headHtml={activeFileDiff.headHtml}
              hunks={activeFileDiff.hunks}
              status={activeFileDiff.status}
            />
          )
        ) : (
          <div className="p-8 text-zinc-400 text-sm">
            {base && head
              ? 'Select a file from the list to view its diff.'
              : 'Choose a base and head ref to compare.'}
          </div>
        )}
      </div>
    </div>
  )
}

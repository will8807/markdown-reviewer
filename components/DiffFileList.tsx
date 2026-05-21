'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChangedFile } from '@/lib/diff/computeDiff'

interface ThreadCounts {
  open: number
  resolved: number
}

const STATUS_LABEL: Record<ChangedFile['status'], string> = {
  added: 'A',
  removed: 'D',
  modified: 'M',
  renamed: 'R',
}

const STATUS_CLASS: Record<ChangedFile['status'], string> = {
  added: 'text-green-600 dark:text-green-400',
  removed: 'text-red-600 dark:text-red-400',
  modified: 'text-yellow-600 dark:text-yellow-400',
  renamed: 'text-blue-600 dark:text-blue-400',
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])

function isImage(filePath: string) {
  const dot = filePath.lastIndexOf('.')
  return dot !== -1 && IMAGE_EXTS.has(filePath.slice(dot).toLowerCase())
}

function assetUrl(projectId: string, sourceId: string, filePath: string, sha: string) {
  const p = new URLSearchParams({ path: filePath, ref: sha })
  return `/api/projects/${projectId}/sources/${sourceId}/assets?${p}`
}

// ── Comment badges ───────────────────────────────────────────────────────────

function CommentBadge({ counts }: { counts: ThreadCounts | undefined }) {
  if (!counts || (counts.open === 0 && counts.resolved === 0)) return null
  return (
    <span className="flex items-center gap-1 shrink-0">
      {counts.open > 0 && (
        <span
          title={`${counts.open} open comment${counts.open === 1 ? '' : 's'}`}
          className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
        >
          {counts.open}
        </span>
      )}
      {counts.resolved > 0 && (
        <span
          title={`${counts.resolved} resolved`}
          className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        >
          ✓{counts.resolved}
        </span>
      )}
    </span>
  )
}

// ── Tree construction ────────────────────────────────────────────────────────

interface DiffTreeNode {
  name: string
  path: string
  children?: DiffTreeNode[]
  file?: ChangedFile
}

function buildDiffTree(files: ChangedFile[]): DiffTreeNode[] {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
  const root: DiffTreeNode[] = []

  for (const file of sorted) {
    const parts = file.path.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const fullPath = parts.slice(0, i + 1).join('/')
      const isLeaf = i === parts.length - 1

      let node = nodes.find((n) => n.name === part)
      if (!node) {
        node = isLeaf
          ? { name: part, path: fullPath, file }
          : { name: part, path: fullPath, children: [] }
        nodes.push(node)
      }
      if (!isLeaf) nodes = node.children!
    }
  }

  return root
}

// ── Rendering ────────────────────────────────────────────────────────────────

interface Props {
  files: ChangedFile[]
  activePath: string | null
  onSelect: (path: string) => void
  projectId?: string
  sourceId?: string
  baseSha?: string | null
  headSha?: string | null
}

function Thumbnail({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-8 h-8 object-cover rounded border border-zinc-200 dark:border-zinc-700 shrink-0 bg-zinc-100 dark:bg-zinc-800"
    />
  )
}

function DiffTreeNodes({
  nodes,
  activePath,
  onSelect,
  projectId,
  sourceId,
  baseSha,
  headSha,
  depth,
  threadCounts,
}: {
  nodes: DiffTreeNode[]
  activePath: string | null
  onSelect: (path: string) => void
  projectId?: string
  sourceId?: string
  baseSha?: string | null
  headSha?: string | null
  depth: number
  threadCounts: Record<string, ThreadCounts>
}) {
  return (
    <ul>
      {nodes.map((node) => {
        if (node.children) {
          return (
            <li key={node.path}>
              <span
                className="block py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 select-none"
                style={{ paddingLeft: `${depth * 12 + 12}px` }}
              >
                {node.name}
              </span>
              <DiffTreeNodes
                nodes={node.children}
                activePath={activePath}
                onSelect={onSelect}
                projectId={projectId}
                sourceId={sourceId}
                baseSha={baseSha}
                headSha={headSha}
                depth={depth + 1}
                threadCounts={threadCounts}
              />
            </li>
          )
        }

        const file = node.file!
        const canShowThumbs = !!(projectId && sourceId)
        const showThumb = canShowThumbs && isImage(file.path)
        const baseThumbUrl =
          showThumb && baseSha && file.status !== 'added'
            ? assetUrl(projectId!, sourceId!, file.path, baseSha)
            : null
        const headThumbUrl =
          showThumb && headSha && file.status !== 'removed'
            ? assetUrl(projectId!, sourceId!, file.path, headSha)
            : null

        return (
          <li key={file.path}>
            <button
              onClick={() => onSelect(file.path)}
              data-testid="diff-file-item"
              data-path={file.path}
              data-status={file.status}
              style={{ paddingLeft: `${depth * 12 + 12}px` }}
              className={`w-full text-left flex items-center gap-2 pr-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                activePath === file.path ? 'bg-blue-50 dark:bg-blue-900/30' : ''
              }`}
            >
              <span className={`font-bold w-4 shrink-0 ${STATUS_CLASS[file.status]}`}>
                {STATUS_LABEL[file.status]}
              </span>

              {showThumb ? (
                <div className="flex items-center gap-1 shrink-0">
                  {baseThumbUrl && <Thumbnail src={baseThumbUrl} alt="base" />}
                  {baseThumbUrl && headThumbUrl && (
                    <span className="text-zinc-400 text-[10px]">→</span>
                  )}
                  {headThumbUrl && <Thumbnail src={headThumbUrl} alt="head" />}
                </div>
              ) : null}

              <span className="flex-1 truncate font-mono text-zinc-700 dark:text-zinc-300">
                {node.name}
              </span>
              <CommentBadge counts={threadCounts[file.path]} />
              <span className="shrink-0 text-zinc-400 tabular-nums">
                {file.additions > 0 && (
                  <span className="text-green-600 dark:text-green-400">+{file.additions}</span>
                )}
                {file.additions > 0 && file.deletions > 0 && <span className="mx-0.5">/</span>}
                {file.deletions > 0 && (
                  <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function DiffFileList({
  files,
  activePath,
  onSelect,
  projectId,
  sourceId,
  baseSha,
  headSha,
}: Props) {
  const [threadCounts, setThreadCounts] = useState<Record<string, ThreadCounts>>({})

  const fetchCounts = useCallback(() => {
    if (!projectId || !sourceId || !baseSha || !headSha) return
    const p = new URLSearchParams({ base: baseSha, head: headSha })
    fetch(`/api/projects/${projectId}/sources/${sourceId}/thread-counts?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { counts?: Record<string, ThreadCounts> } | null) => {
        if (data?.counts) setThreadCounts(data.counts)
      })
      .catch(() => {})
  }, [projectId, sourceId, baseSha, headSha])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  // Refresh when threads are added or changed
  useEffect(() => {
    const handler = () => fetchCounts()
    window.addEventListener('threads-updated', handler)
    return () => window.removeEventListener('threads-updated', handler)
  }, [fetchCounts])

  if (files.length === 0) {
    return <p className="p-4 text-sm text-zinc-400">No changed files.</p>
  }

  const tree = buildDiffTree(files)

  return (
    <div className="py-1" data-testid="diff-file-list">
      <DiffTreeNodes
        nodes={tree}
        activePath={activePath}
        onSelect={onSelect}
        projectId={projectId}
        sourceId={sourceId}
        baseSha={baseSha}
        headSha={headSha}
        depth={0}
        threadCounts={threadCounts}
      />
    </div>
  )
}

'use client'

import type { ChangedFile } from '@/lib/diff/computeDiff'

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

export default function DiffFileList({
  files,
  activePath,
  onSelect,
  projectId,
  sourceId,
  baseSha,
  headSha,
}: Props) {
  if (files.length === 0) {
    return <p className="p-4 text-sm text-zinc-400">No changed files.</p>
  }

  const canShowThumbs = !!(projectId && sourceId)

  return (
    <ul className="py-1" data-testid="diff-file-list">
      {files.map((file) => {
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
              className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
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
                {file.path}
              </span>
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

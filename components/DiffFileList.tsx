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

export default function DiffFileList({
  files,
  activePath,
  onSelect,
}: {
  files: ChangedFile[]
  activePath: string | null
  onSelect: (path: string) => void
}) {
  if (files.length === 0) {
    return <p className="p-4 text-sm text-zinc-400">No changed files.</p>
  }

  return (
    <ul className="py-1" data-testid="diff-file-list">
      {files.map((file) => (
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
      ))}
    </ul>
  )
}

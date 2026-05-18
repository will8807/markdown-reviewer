'use client'

import { useState, useRef, useCallback } from 'react'

type Mode = 'side-by-side' | 'slider' | 'onion-skin' | 'pixel-diff'

interface Props {
  projectId: string
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
  status: 'added' | 'removed' | 'modified' | 'renamed'
}

function assetUrl(projectId: string, sourceId: string, filePath: string, sha: string) {
  const p = new URLSearchParams({ path: filePath, ref: sha })
  return `/api/projects/${projectId}/sources/${sourceId}/assets?${p}`
}

function pixelDiffUrl(projectId: string, sourceId: string, filePath: string, baseSha: string, headSha: string) {
  const p = new URLSearchParams({ path: filePath, base: baseSha, head: headSha })
  return `/api/projects/${projectId}/sources/${sourceId}/compare/image?${p}`
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'side-by-side', label: 'Side by side' },
  { id: 'slider', label: 'Slider' },
  { id: 'onion-skin', label: 'Onion skin' },
  { id: 'pixel-diff', label: 'Pixel diff' },
]

export default function ImageDiff({ projectId, sourceId, filePath, baseSha, headSha, status }: Props) {
  const [mode, setMode] = useState<Mode>('side-by-side')
  const [opacity, setOpacity] = useState(0.5)
  const [sliderPos, setSliderPos] = useState(0.5)
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasBase = status !== 'added'
  const hasHead = status !== 'removed'
  const baseUrl = hasBase ? assetUrl(projectId, sourceId, filePath, baseSha) : null
  const headUrl = hasHead ? assetUrl(projectId, sourceId, filePath, headSha) : null

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setSliderPos(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }, [])

  const stopDrag = useCallback(() => { dragging.current = false }, [])

  return (
    <div data-testid="image-diff" data-mode={mode} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0 bg-white dark:bg-zinc-900">
        <span className="text-xs font-mono text-zinc-500 truncate max-w-xs">{filePath}</span>
        <div className="flex rounded border border-zinc-300 dark:border-zinc-600 overflow-hidden ml-auto">
          {MODES.map(({ id, label }) => {
            const disabled = id === 'pixel-diff' && (!hasBase || !hasHead)
            return (
              <button
                key={id}
                onClick={() => !disabled && setMode(id)}
                data-testid={`image-diff-mode-${id}`}
                disabled={disabled}
                className={[
                  'px-3 py-1 text-xs transition-colors',
                  disabled
                    ? 'opacity-40 cursor-not-allowed bg-white dark:bg-zinc-800 text-zinc-400'
                    : mode === id
                      ? 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
        {mode === 'onion-skin' && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-24"
            aria-label="Head opacity"
          />
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)]">
        {mode === 'side-by-side' && (
          <div className="flex gap-8 p-6 items-start">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-red-500 dark:text-red-400">base · {baseSha.slice(0, 8)}</span>
              {baseUrl ? (
                <img
                  src={baseUrl}
                  alt="base"
                  className="max-w-[40vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="text-sm text-zinc-400 italic p-6 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                  File did not exist on base.
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-mono text-green-600 dark:text-green-400">head · {headSha.slice(0, 8)}</span>
              {headUrl ? (
                <img
                  src={headUrl}
                  alt="head"
                  className="max-w-[40vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700"
                />
              ) : (
                <div className="text-sm text-zinc-400 italic p-6 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                  File does not exist on head.
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'slider' && (
          <div
            ref={containerRef}
            className="relative inline-block select-none"
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            {/* base underneath */}
            {baseUrl ? (
              <img src={baseUrl} alt="base" className="block max-w-[70vw] max-h-[80vh] object-contain" />
            ) : (
              <div className="w-64 h-48 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 italic">
                File did not exist on base.
              </div>
            )}
            {/* head clipped to left of slider */}
            {headUrl && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)` }}
              >
                <img src={headUrl} alt="head" className="block max-w-[70vw] max-h-[80vh] object-contain" />
              </div>
            )}
            {/* divider handle */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)] cursor-col-resize"
              style={{ left: `${sliderPos * 100}%` }}
              onMouseDown={() => { dragging.current = true }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-zinc-100 shadow-md border border-zinc-200 flex items-center justify-center text-zinc-600 text-xs font-bold select-none">
                ⟺
              </div>
            </div>
          </div>
        )}

        {mode === 'onion-skin' && (
          <div className="relative inline-block">
            {baseUrl ? (
              <img src={baseUrl} alt="base" className="block max-w-[70vw] max-h-[80vh] object-contain" />
            ) : (
              <div className="w-64 h-48 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 italic">
                File did not exist on base.
              </div>
            )}
            {headUrl && (
              <img
                src={headUrl}
                alt="head"
                className="absolute inset-0 max-w-[70vw] max-h-[80vh] object-contain"
                style={{ opacity }}
              />
            )}
          </div>
        )}

        {mode === 'pixel-diff' && (
          hasBase && hasHead ? (
            <div className="flex flex-col items-center gap-2 p-4">
              <p className="text-xs text-zinc-500">Changed pixels are highlighted. Unchanged areas are dimmed.</p>
              <img
                src={pixelDiffUrl(projectId, sourceId, filePath, baseSha, headSha)}
                alt="pixel diff"
                data-testid="pixel-diff-img"
                className="max-w-[70vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          ) : (
            <div className="text-sm text-zinc-400 italic p-6">
              Pixel diff requires both a base and head version of the file.
            </div>
          )
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import ImageRegionOverlay from './ImageRegionOverlay'
import { setPanelContext } from '@/lib/comments/panelContext'

type Mode = 'side-by-side' | 'slider' | 'onion-skin' | 'pixel-diff'

interface RegionThread {
  id: string
  anchor: {
    type: string
    diffSide: string | null
    imgX: number | null
    imgY: number | null
    imgW: number | null
    imgH: number | null
  } | null
}

interface Props {
  projectId: string
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
  status: 'added' | 'removed' | 'modified' | 'renamed'
  onBack?: () => void
  backLabel?: string
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

const ZOOM_MIN = 0.25
const ZOOM_MAX = 8
const ZOOM_STEP = 0.12

export default function ImageDiff({ projectId, sourceId, filePath, baseSha, headSha, status, onBack, backLabel }: Props) {
  const [mode, setMode] = useState<Mode>('side-by-side')
  const [opacity, setOpacity] = useState(0.5)
  const [sliderPos, setSliderPos] = useState(0.5)
  const [regionThreads, setRegionThreads] = useState<RegionThread[]>([])
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const panning = useRef(false)
  const panOrigin = useRef({ x: 0, y: 0, sl: 0, st: 0 })
  const sliderContainerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  const hasBase = status !== 'added'
  const hasHead = status !== 'removed'
  const baseUrl = hasBase ? assetUrl(projectId, sourceId, filePath, baseSha) : null
  const headUrl = hasHead ? assetUrl(projectId, sourceId, filePath, headSha) : null
  const pdUrl = pixelDiffUrl(projectId, sourceId, filePath, baseSha, headSha)

  // Reset zoom when file changes
  useEffect(() => { setZoom(1) }, [filePath, baseSha, headSha])

  // Ctrl+scroll to zoom; plain scroll is left to the browser (native pan).
  useEffect(() => {
    const el = viewerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z - e.deltaY * ZOOM_STEP * 0.01)))
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // Notify CommentPanel so it loads threads for this image file.
  useEffect(() => {
    const fire = () => {
      setPanelContext({ type: 'diff', sourceId, filePath, baseSha, headSha })
      window.dispatchEvent(
        new CustomEvent('diff-opened', { detail: { sourceId, filePath, baseSha, headSha } }),
      )
    }
    const t1 = setTimeout(fire, 0)
    const t2 = setTimeout(fire, 150)
    const t3 = setTimeout(fire, 500)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [sourceId, filePath, baseSha, headSha])

  // Receive IMAGE_REGION threads from CommentPanel via threads-updated event.
  useEffect(() => {
    const handler = (e: Event) => {
      const { threads } = (e as CustomEvent<{ threads: RegionThread[] }>).detail
      setRegionThreads(threads.filter((t) => t.anchor?.type === 'IMAGE_REGION'))
    }
    window.addEventListener('threads-updated', handler)
    return () => window.removeEventListener('threads-updated', handler)
  }, [])

  const handleRegionSelected = useCallback(
    (diffSide: 'base' | 'head', region: { imgX: number; imgY: number; imgW: number; imgH: number }) => {
      window.dispatchEvent(
        new CustomEvent('image-region-comment-requested', {
          detail: { sourceId, filePath, diffSide, baseSha, headSha, ...region },
        }),
      )
      // Ensure the side panel is expanded so the composer is visible
      window.dispatchEvent(new CustomEvent('open-comment-panel'))
    },
    [sourceId, filePath, baseSha, headSha],
  )

  const handleRegionClick = useCallback((threadId: string) => {
    window.dispatchEvent(new CustomEvent('focus-thread', { detail: { threadId } }))
  }, [])

  const regionsFor = (side: 'base' | 'head') =>
    regionThreads
      .filter((t) => t.anchor?.diffSide === side)
      .map((t) => ({
        threadId: t.id,
        imgX: t.anchor!.imgX!,
        imgY: t.anchor!.imgY!,
        imgW: t.anchor!.imgW!,
        imgH: t.anchor!.imgH!,
      }))

  const onViewerMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return
    panning.current = true
    panOrigin.current = {
      x: e.clientX, y: e.clientY,
      sl: viewerRef.current?.scrollLeft ?? 0,
      st: viewerRef.current?.scrollTop ?? 0,
    }
    e.preventDefault()
  }, [])

  const onViewerMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panning.current || !viewerRef.current) return
    viewerRef.current.scrollLeft = panOrigin.current.sl - (e.clientX - panOrigin.current.x)
    viewerRef.current.scrollTop  = panOrigin.current.st - (e.clientY - panOrigin.current.y)
  }, [])

  const stopPan = useCallback(() => { panning.current = false }, [])

  const onSliderMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging.current || !sliderContainerRef.current) return
    const rect = sliderContainerRef.current.getBoundingClientRect()
    setSliderPos(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)))
  }, [])

  const stopDrag = useCallback(() => { dragging.current = false }, [])

  const zoomPct = `${Math.round(zoom * 100)}%`

  return (
    <div data-testid="image-diff" data-mode={mode} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700 shrink-0 bg-white dark:bg-zinc-900">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
          >
            ← {backLabel ?? 'Back'}
          </button>
        )}
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

        {/* Zoom indicator + reset */}
        {zoom !== 1 && (
          <button
            onClick={() => setZoom(1)}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 tabular-nums"
            title="Reset zoom"
          >
            {zoomPct} ↺
          </button>
        )}

        {/* Open in new tab */}
        <button
          onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 px-1"
          title="Open in new tab"
        >
          ↗
        </button>
      </div>

      {/* Viewer */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-auto bg-[repeating-conic-gradient(#e4e4e7_0%_25%,#fff_0%_50%)] bg-[length:20px_20px] dark:bg-[repeating-conic-gradient(#27272a_0%_25%,#18181b_0%_50%)]"
        onMouseDown={onViewerMouseDown}
        onMouseMove={onViewerMouseMove}
        onMouseUp={stopPan}
        onMouseLeave={stopPan}
      >
        {/* min-h-full + min-w-fit + flex centering: content is centered when it fits,
            and scrollable in all directions (including left) when it overflows. */}
        <div className="min-h-full min-w-fit flex items-center justify-center" style={{ zoom }}>
          {mode === 'side-by-side' && (
            <div className="flex gap-8 p-6 items-start">
              {/* Base */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-mono text-red-500 dark:text-red-400">base · {baseSha.slice(0, 8)}</span>
                {baseUrl ? (
                  <div className="relative group">
                    <ImageRegionOverlay
                      regions={regionsFor('base')}
                      onRegionSelected={(r) => handleRegionSelected('base', r)}
                      onRegionClick={handleRegionClick}
                    >
                      <img src={baseUrl} alt="base" draggable={false}
                        className="max-w-[40vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700" />
                    </ImageRegionOverlay>
                    <a href={baseUrl} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-1 shadow"
                      title="Open in new tab">↗</a>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 italic p-6 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                    File did not exist on base.
                  </div>
                )}
              </div>

              {/* Head */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-mono text-green-600 dark:text-green-400">head · {headSha.slice(0, 8)}</span>
                {headUrl ? (
                  <div className="relative group">
                    <ImageRegionOverlay
                      regions={regionsFor('head')}
                      onRegionSelected={(r) => handleRegionSelected('head', r)}
                      onRegionClick={handleRegionClick}
                    >
                      <img src={headUrl} alt="head" draggable={false}
                        className="max-w-[40vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700" />
                    </ImageRegionOverlay>
                    <a href={headUrl} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-1 shadow"
                      title="Open in new tab">↗</a>
                  </div>
                ) : (
                  <div className="text-sm text-zinc-400 italic p-6 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                    File does not exist on head.
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === 'slider' && (
            <div className="relative group">
            <div
              ref={sliderContainerRef}
              className="relative inline-block select-none"
              onMouseMove={onSliderMouseMove}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
            >
              {baseUrl ? (
                <img src={baseUrl} alt="base" className="block max-w-[70vw] max-h-[80vh] object-contain" />
              ) : (
                <div className="w-64 h-48 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 italic">
                  File did not exist on base.
                </div>
              )}
              {headUrl && (
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)` }}>
                  <img src={headUrl} alt="head" className="block max-w-[70vw] max-h-[80vh] object-contain" />
                </div>
              )}
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
            {(baseUrl || headUrl) && (
              <a href={headUrl ?? baseUrl ?? ''} target="_blank" rel="noopener noreferrer"
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-1 shadow"
                title="Open in new tab">↗</a>
            )}
            </div>
          )}

          {mode === 'onion-skin' && (
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="relative inline-block group">
                {baseUrl ? (
                  <img src={baseUrl} alt="base" className="block max-w-[70vw] max-h-[80vh] object-contain" />
                ) : (
                  <div className="w-64 h-48 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-sm text-zinc-400 italic">
                    File did not exist on base.
                  </div>
                )}
                {headUrl && (
                  <img src={headUrl} alt="head" className="absolute inset-0 max-w-[70vw] max-h-[80vh] object-contain" style={{ opacity }} />
                )}
                {(baseUrl || headUrl) && (
                  <a href={headUrl ?? baseUrl ?? ''} target="_blank" rel="noopener noreferrer"
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-1 shadow"
                    title="Open in new tab">↗</a>
                )}
              </div>
              <input
                type="range" min={0} max={1} step={0.01} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-48" aria-label="Head opacity"
              />
            </div>
          )}

          {mode === 'pixel-diff' && (
            hasBase && hasHead ? (
              <div className="flex flex-col items-center gap-2 p-4">
                <p className="text-xs text-zinc-500">Changed pixels are highlighted. Unchanged areas are dimmed.</p>
                <div className="relative group">
                  <img
                    src={pdUrl} alt="pixel diff" data-testid="pixel-diff-img"
                    className="max-w-[70vw] max-h-[75vh] object-contain shadow rounded border border-zinc-200 dark:border-zinc-700"
                  />
                  <a href={pdUrl} target="_blank" rel="noopener noreferrer"
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-white text-xs rounded px-2 py-1 shadow"
                    title="Open in new tab">↗</a>
                </div>
              </div>
            ) : (
              <div className="text-sm text-zinc-400 italic p-6">
                Pixel diff requires both a base and head version of the file.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

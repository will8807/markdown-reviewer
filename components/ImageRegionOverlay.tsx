'use client'

import { useRef, useState, useCallback } from 'react'

interface Region {
  threadId: string
  imgX: number
  imgY: number
  imgW: number
  imgH: number
}

interface Draft {
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  regions: Region[]
  onRegionSelected: (region: { imgX: number; imgY: number; imgW: number; imgH: number }) => void
  onRegionClick: (threadId: string) => void
  children: React.ReactNode
}

const MIN_SIZE = 0.02

export default function ImageRegionOverlay({ regions, onRegionSelected, onRegionClick, children }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const toNorm = useCallback((clientX: number, clientY: number) => {
    if (!wrapperRef.current) return { x: 0, y: 0 }
    const rect = wrapperRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) return  // let parent handle Ctrl+drag pan
    if ((e.target as HTMLElement).closest('[data-region]')) return
    e.preventDefault()
    const { x, y } = toNorm(e.clientX, e.clientY)
    dragStart.current = { x, y }
    setDraft({ x, y, w: 0, h: 0 })
  }, [toNorm])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStart.current) return
    const { x, y } = toNorm(e.clientX, e.clientY)
    const { x: x0, y: y0 } = dragStart.current
    setDraft({ x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0) })
  }, [toNorm])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragStart.current) return
    const { x, y } = toNorm(e.clientX, e.clientY)
    const { x: x0, y: y0 } = dragStart.current
    const region = { x: Math.min(x, x0), y: Math.min(y, y0), w: Math.abs(x - x0), h: Math.abs(y - y0) }
    dragStart.current = null
    setDraft(null)
    if (region.w >= MIN_SIZE && region.h >= MIN_SIZE) {
      onRegionSelected({ imgX: region.x, imgY: region.y, imgW: region.w, imgH: region.h })
    }
  }, [toNorm, onRegionSelected])

  const cancel = useCallback(() => { dragStart.current = null; setDraft(null) }, [])

  return (
    <div
      ref={wrapperRef}
      className="relative inline-block cursor-crosshair select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={cancel}
    >
      {children}

      {regions.map((r) => (
        <div
          key={r.threadId}
          data-region="true"
          onClick={(e) => { e.stopPropagation(); onRegionClick(r.threadId) }}
          className="absolute border-2 border-amber-400 bg-amber-400/20 hover:bg-amber-400/30 cursor-pointer transition-colors"
          style={{
            left: `${r.imgX * 100}%`,
            top: `${r.imgY * 100}%`,
            width: `${r.imgW * 100}%`,
            height: `${r.imgH * 100}%`,
          }}
        />
      ))}

      {draft && draft.w > 0.005 && draft.h > 0.005 && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.w * 100}%`,
            height: `${draft.h * 100}%`,
          }}
        />
      )}
    </div>
  )
}

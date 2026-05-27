"use client"

import { useEffect, useRef, useState } from "react"

interface DraggableImageProps {
  url: string
  onRemove: () => void
  initialTransform?: { x: number; y: number; scale: number }
  onTransformChange?: (t: { x: number; y: number; scale: number }) => void
}

type DragState =
  | { type: "move"; startX: number; startY: number; originX: number; originY: number }
  | { type: "resize"; centerX: number; centerY: number; startDist: number; scaleOrigin: number }

export function DraggableImage({ url, onRemove: _onRemove, initialTransform, onTransformChange }: DraggableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef    = useRef<HTMLDivElement>(null)
  const transform    = useRef(initialTransform ?? { x: 0, y: 0, scale: 1 })
  const dragState    = useRef<DragState | null>(null)
  const [handleVisible, setHandleVisible] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "e" || e.key === "E") setHandleVisible(v => !v)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function applyTransform() {
    if (!containerRef.current) return
    const { x, y, scale } = transform.current
    containerRef.current.style.transform =
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`
  }

  useEffect(() => {
    applyTransform()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function clampPosition() {
    const W = window.innerWidth
    const H = window.innerHeight
    const margin = 80
    transform.current.x = Math.max(-(W / 2 - margin), Math.min(W / 2 - margin, transform.current.x))
    transform.current.y = Math.max(-(H / 2 - margin), Math.min(H / 2 - margin, transform.current.y))
  }

  useEffect(() => {
    const container = containerRef.current
    const handle    = handleRef.current
    if (!container || !handle) return

    const onHandleDown = (e: PointerEvent) => {
      e.stopPropagation()
      const rect = container.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top  + rect.height / 2
      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      dragState.current = {
        type: "resize",
        centerX,
        centerY,
        startDist: Math.sqrt(dx * dx + dy * dy) || 1,
        scaleOrigin: transform.current.scale,
      }
      handle.setPointerCapture(e.pointerId)
    }

    const onContainerDown = (e: PointerEvent) => {
      dragState.current = {
        type: "move",
        startX: e.clientX,
        startY: e.clientY,
        originX: transform.current.x,
        originY: transform.current.y,
      }
      container.setPointerCapture(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      const ds = dragState.current
      if (!ds) return
      if (ds.type === "move") {
        transform.current.x = ds.originX + (e.clientX - ds.startX)
        transform.current.y = ds.originY + (e.clientY - ds.startY)
        clampPosition()
      } else {
        const dx = e.clientX - ds.centerX
        const dy = e.clientY - ds.centerY
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        transform.current.scale = Math.max(0.1, Math.min(4, ds.scaleOrigin * (dist / ds.startDist)))
      }
      applyTransform()
    }

    const onUp = () => {
      dragState.current = null
      onTransformChange?.(transform.current)
    }

    handle.addEventListener("pointerdown", onHandleDown)
    container.addEventListener("pointerdown", onContainerDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)

    return () => {
      handle.removeEventListener("pointerdown", onHandleDown)
      container.removeEventListener("pointerdown", onContainerDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed top-1/2 left-1/2 touch-none select-none cursor-grab active:cursor-grabbing"
      style={{ transform: "translate(-50%, -50%) scale(1)", zIndex: 10 }}
    >
      <img
        src={url}
        alt=""
        draggable={false}
        style={{
          display: "block",
          maxWidth: "min(60vw, 60vh)",
          maxHeight: "min(60vw, 60vh)",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      <div
        ref={handleRef}
        className={`absolute bottom-0 right-0 w-3.5 h-3.5 bg-white/80 rounded-tl cursor-nwse-resize touch-none transition-opacity duration-150 ${handleVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ zIndex: 11 }}
      />
    </div>
  )
}

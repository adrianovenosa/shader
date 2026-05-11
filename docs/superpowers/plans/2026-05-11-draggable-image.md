# Draggable Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static centered image overlay with a draggable, resizable `DraggableImage` component, and add a Remove button to the controls panel.

**Architecture:** A new `DraggableImage` component manages position and scale entirely via `useRef` — no React state during drag, DOM transforms applied imperatively. Pointer Events API handles both mouse and touch. `ShaderControls` gains an `imageUrl` prop to show/hide the Remove button.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Pointer Events API (no new dependencies)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/ui/draggable-image.tsx` | Create | Draggable + resizable image overlay |
| `components/ui/shader-controls.tsx` | Modify | Add `imageUrl` prop + Remove button |
| `app/page.tsx` | Modify | Swap `<img>` for `<DraggableImage>`, pass `imageUrl` to controls |

---

## Task 1: Create `DraggableImage` component

**Files:**
- Create: `components/ui/draggable-image.tsx`

- [ ] **Step 1: Create the file**

Create `components/ui/draggable-image.tsx` with this exact content:

```tsx
"use client"

import { useEffect, useRef } from "react"

interface DraggableImageProps {
  url: string
  onRemove: () => void
}

type DragState =
  | { type: "move"; startX: number; startY: number; originX: number; originY: number }
  | { type: "resize"; centerX: number; centerY: number; startDist: number; scaleOrigin: number }

export function DraggableImage({ url }: DraggableImageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef    = useRef<HTMLDivElement>(null)
  const transform    = useRef({ x: 0, y: 0, scale: 1 })
  const dragState    = useRef<DragState | null>(null)

  function applyTransform() {
    if (!containerRef.current) return
    const { x, y, scale } = transform.current
    containerRef.current.style.transform =
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`
  }

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

    const onUp = () => { dragState.current = null }

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
        className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-white/80 rounded-tl cursor-nwse-resize touch-none"
        style={{ zIndex: 11 }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/adrianovenosa/Code/Shader
npx tsc --noEmit 2>&1 | grep "draggable-image"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add components/ui/draggable-image.tsx
git commit -m "feat: add DraggableImage component with move and resize via Pointer Events"
```

---

## Task 2: Update `ShaderControls` — add `imageUrl` prop and Remove button

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Add `imageUrl` to the props interface**

In `components/ui/shader-controls.tsx`, replace the `ShaderControlsProps` interface and the destructuring:

**Find:**
```tsx
interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
  shaderId: string
  onShaderChange: (id: string) => void
}

export function ShaderControls({
  open,
  onToggle,
  params,
  onChange,
  onImageUpload,
  shaderId,
  onShaderChange,
}: ShaderControlsProps) {
```

**Replace with:**
```tsx
interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
  shaderId: string
  onShaderChange: (id: string) => void
  imageUrl: string | null
}

export function ShaderControls({
  open,
  onToggle,
  params,
  onChange,
  onImageUpload,
  shaderId,
  onShaderChange,
  imageUrl,
}: ShaderControlsProps) {
```

- [ ] **Step 2: Add Remove button below the upload button**

In `components/ui/shader-controls.tsx`, find the upload button section:

```tsx
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>
```

Replace with:

```tsx
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>

        {imageUrl && (
          <button
            onClick={() => onImageUpload(null)}
            className="border border-dashed border-red-500/30 rounded-lg p-2.5 flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
          >
            <span className="text-lg leading-none">🗑</span>
            <span className="text-[10px]">Remover imagem</span>
          </button>
        )}
```

- [ ] **Step 3: Build (expect error in app/page.tsx about missing `imageUrl` prop — that's fine)**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run build 2>&1 | tail -10
```

Expected: only error is `app/page.tsx` missing `imageUrl` prop. Zero errors inside `shader-controls.tsx`.

- [ ] **Step 4: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add imageUrl prop and Remove image button to ShaderControls"
```

---

## Task 3: Update `app/page.tsx` — wire `DraggableImage` and `imageUrl`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
"use client"

import { useState } from "react"
import { ShaderAnimation, defaultParams, type ShaderParams } from "@/components/ui/shader-lines"
import { ShaderControls } from "@/components/ui/shader-controls"
import { DraggableImage } from "@/components/ui/draggable-image"
import { DEFAULT_SHADER_ID } from "@/lib/shaders"

export default function Page() {
  const [params,    setParams]    = useState<ShaderParams>(defaultParams)
  const [imageUrl,  setImageUrl]  = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [shaderId,  setShaderId]  = useState(DEFAULT_SHADER_ID)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <ShaderAnimation params={params} shaderId={shaderId} />

      {imageUrl && (
        <DraggableImage url={imageUrl} onRemove={() => setImageUrl(null)} />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        params={params}
        onChange={setParams}
        onImageUpload={setImageUrl}
        shaderId={shaderId}
        onShaderChange={setShaderId}
        imageUrl={imageUrl}
      />
    </main>
  )
}
```

- [ ] **Step 2: Build — must be zero errors**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run build 2>&1 | tail -15
```

Expected: clean build, route `/` listed, zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire DraggableImage into page, pass imageUrl to ShaderControls"
```

---

## Task 4: End-to-end verification

**Files:** none — manual verification + final build

- [ ] **Step 1: Start dev server**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Upload and drag**

Click ⚙ to open the panel. Click "Carregar PNG" and upload any PNG.

| Action | Expected |
|--------|----------|
| Image appears | Centered on the shader canvas |
| Drag image body | Image follows pointer smoothly, no shader flicker |
| Release near edge | Image stays partially visible (80px margin clamped) |

- [ ] **Step 3: Resize**

Drag the small white square at the bottom-right corner of the image.

| Action | Expected |
|--------|----------|
| Drag corner outward | Image scales up proportionally |
| Drag corner inward | Image scales down proportionally |
| Scale past 4× | Stops growing |
| Scale below 0.1× | Stops shrinking |

- [ ] **Step 4: Remove**

With an image loaded, open the panel — "Remover imagem" button (red, dashed border) is visible. Click it.

| Action | Expected |
|--------|----------|
| Click "Remover imagem" | Image disappears, button disappears from panel |
| Upload again | New image appears at center, draggable |

- [ ] **Step 5: Final build**

```bash
cd /Users/adrianovenosa/Code/Shader
npm run build 2>&1 | tail -10
```

Expected: zero errors, clean output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: draggable image feature verified and complete"
```

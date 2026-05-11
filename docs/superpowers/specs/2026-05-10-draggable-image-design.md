# Draggable Image — Design Spec (Rodada 2)

**Date:** 2026-05-10  
**Status:** Approved

---

## Context

The project currently renders an uploaded PNG as a static, centered, non-interactive overlay (`pointer-events-none`). This spec covers making the image **draggable** (reposition) and **resizable** (via corner handle), plus a **Remove** button in the controls panel.

---

## Architecture

```
components/ui/draggable-image.tsx   ← NEW: draggable/resizable image overlay
components/ui/shader-controls.tsx   ← MODIFY: add imageUrl prop + Remove button
app/page.tsx                        ← MODIFY: replace <img> with DraggableImage,
                                               pass imageUrl to ShaderControls
```

**State flow:**
```
page.tsx
├── imageUrl: string | null  → <DraggableImage url onRemove>
│                            → <ShaderControls imageUrl onImageUpload onImageRemove>
└── setImageUrl              ← onRemove / onImageUpload callbacks
```

Position and scale live in `useRef` inside `DraggableImage` — they are never stored in React state. DOM transforms are applied imperatively during drag to avoid re-rendering the shader canvas.

---

## File Specifications

### `components/ui/draggable-image.tsx` — NEW

```ts
interface DraggableImageProps {
  url: string
  onRemove: () => void
}
```

**DOM structure:**

```
<div ref={containerRef}
     className="fixed top-1/2 left-1/2 touch-none select-none cursor-grab active:cursor-grabbing"
     style={{ transform: 'translate(-50%, -50%) scale(1)', zIndex: 10 }}>
  <img src={url} alt="" style={{ display: 'block', maxWidth: 'min(60vw, 60vh)', maxHeight: 'min(60vw, 60vh)', userSelect: 'none', pointerEvents: 'none' }} />
  <!-- corner handle -->
  <div ref={handleRef}
       className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-white/80 rounded-tl cursor-nwse-resize touch-none"
       style={{ zIndex: 11 }} />
</div>
```

**Internal refs:**

```ts
type DragState =
  | { type: 'move'; startX: number; startY: number; originX: number; originY: number }
  | { type: 'resize'; centerX: number; centerY: number; startDist: number; scaleOrigin: number }

const containerRef = useRef<HTMLDivElement>(null)
const handleRef    = useRef<HTMLDivElement>(null)
const transform    = useRef({ x: 0, y: 0, scale: 1 })
const dragState    = useRef<DragState | null>(null)
```

**`applyTransform()`:**

```ts
function applyTransform() {
  if (!containerRef.current) return
  const { x, y, scale } = transform.current
  containerRef.current.style.transform =
    `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`
}
```

**Pointer event handlers** — attached in `useEffect` on mount:

| Event | Target | Action |
|-------|--------|--------|
| `pointerdown` | **handle** | `e.stopPropagation()`; start **resize**: record container center (viewport coords) and start distance from pointer to center; `setPointerCapture` on handle |
| `pointerdown` | **container** | Start **move**: record startX/Y and current transform origin; `setPointerCapture` on container |
| `pointermove` | window | If move: `transform.x/y = origin + delta`; if resize: `transform.scale = scaleOrigin × (dist / startDist)`, clamp to `[0.1, 4]`; call `applyTransform()` |
| `pointerup` | window | Clear `dragState.current` |

Handle uses `stopPropagation` to prevent bubbling to the container's `pointerdown` listener, so the two gestures are cleanly separated.

**Boundary clamping** — applied continuously during move:

```ts
const W = window.innerWidth, H = window.innerHeight
const margin = 80  // px — minimum edge that must remain visible
transform.current.x = Math.max(-(W / 2 - margin), Math.min(W / 2 - margin, transform.current.x))
transform.current.y = Math.max(-(H / 2 - margin), Math.min(H / 2 - margin, transform.current.y))
```

**Scale clamp:** `[0.1, 4.0]` — prevents the image from disappearing or overflowing completely.

---

### `components/ui/shader-controls.tsx` — MODIFY

**New props:**

```ts
interface ShaderControlsProps {
  // ...existing...
  imageUrl: string | null           // NEW
}
```

`onImageUpload` already accepts `string | null` — calling it with `null` removes the image. No separate `onImageRemove` callback needed.

**Remove button** — rendered below the upload button, only when `imageUrl !== null`:

```tsx
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

---

### `app/page.tsx` — MODIFY

Replace the `<img>` element with `<DraggableImage>` and pass `imageUrl` to `ShaderControls`:

```tsx
import { DraggableImage } from "@/components/ui/draggable-image"

// in JSX:
{imageUrl && (
  <DraggableImage url={imageUrl} onRemove={() => setImageUrl(null)} />
)}

<ShaderControls
  // ...existing props...
  imageUrl={imageUrl}
/>
```

---

## Interaction Summary

| Gesture | Result |
|---------|--------|
| Drag image body | Reposition (pointer events, mouse + touch) |
| Drag bottom-right corner handle | Resize proportionally (scale from center) |
| Scale limits | 0.1× – 4.0× |
| Image out of bounds | Clamped: at least 20% visible |
| Click "Remover imagem" in panel | `setImageUrl(null)` → component unmounts |
| Upload new image while one exists | Replaces current (existing behavior) |

---

## File Map

| File | Action | Lines (est.) |
|------|--------|-------------|
| `components/ui/draggable-image.tsx` | Create | ~90 |
| `components/ui/shader-controls.tsx` | Modify — add `imageUrl` prop, Remove button | +10 |
| `app/page.tsx` | Modify — swap `<img>` for `<DraggableImage>`, pass `imageUrl` | +5 |

---

## Verification

1. `npm run build` — zero TypeScript errors
2. Upload a PNG → image appears centered, draggable by body, resizable by corner handle
3. Drag image to edge → clamped, at least 20% remains visible
4. Pinch/touch on mobile → resize works via pointer events
5. Open panel → "Remover imagem" button visible; click → image disappears
6. Upload another image → replaces the previous one without flash

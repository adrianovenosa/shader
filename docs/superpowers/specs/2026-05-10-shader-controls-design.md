# Shader Lines — Controls, Image Upload & Fullscreen

**Date:** 2026-05-10  
**Status:** Approved

---

## Context

The existing `ShaderAnimation` component renders a GLSL shader on a fixed-height div with hard-coded parameters and a text overlay. The goal is to:

1. Make the shader fill the full viewport (responsive)
2. Replace the text overlay with an optional user-uploaded PNG
3. Expose shader parameters via a floating controls panel

---

## Architecture

Three focused pieces wired together in `app/page.tsx`:

```
app/page.tsx                        ← state owner
├── <ShaderAnimation params={…} />  ← pure canvas renderer
├── <img src={imageUrl} />          ← PNG overlay (conditional)
└── <ShaderControls
      open={panelOpen}
      params={params}
      onChange={setParams}
      onImageUpload={setImageUrl}
    />
```

**State in `app/page.tsx`:**
- `params: ShaderParams` — all five shader parameters
- `imageUrl: string | null` — object URL of uploaded PNG
- `panelOpen: boolean` — whether the controls panel is visible

---

## Components

### `ShaderAnimation` — `components/ui/shader-lines.tsx`

Accepts `params` as props. On each param change, updates the corresponding Three.js uniform directly via a `uniformsRef` — no renderer teardown.

**Props:**
```ts
interface ShaderParams {
  speed: number       // time increment per frame  [0.005 – 0.2]
  lineWidth: number   // GLSL lineWidth uniform     [0.0001 – 0.003]
  mosaic: number      // fMosaicScal x & y value   [1.0 – 16.0]
  lines: number       // inner loop count (int)    [1 – 8]
  hue: number         // hue rotation in degrees   [0 – 360]
}

interface ShaderAnimationProps {
  params: ShaderParams
}
```

**Fullscreen:** the container div gets `className="fixed inset-0 w-full h-full"`. The renderer resize handler uses `window.innerWidth / window.innerHeight` instead of `getBoundingClientRect`.

**Hue shift:** applied in the fragment shader via a GLSL `hueShift(vec3, float)` helper that rotates the RGB output in YIQ space. Passed in as a `uniform float hue`.

**Uniform sync:** a `useEffect` watching `params` writes each value to `uniformsRef.current` without recreating the scene.

---

### `ShaderControls` — `components/ui/shader-controls.tsx`

Floating panel anchored to the top-right corner. A ⚙ button toggles `panelOpen`.

**Props:**
```ts
interface ShaderControlsProps {
  open: boolean
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
}
```

**Panel contents (top to bottom):**
1. Section label "Controles"
2. Slider — Velocidade (`speed`)
3. Slider — Espessura (`lineWidth`)
4. Slider — Pixelação (`mosaic`)
5. Slider — Linhas (`lines`, integer steps)
6. Slider — Cor / hue (rainbow gradient track)
7. Divider
8. Upload zone — click or drag-and-drop, `accept="image/png"`, creates `URL.createObjectURL`

**Styling:** dark glass card (`bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl`), positioned `absolute top-14 right-3` relative to a `fixed top-3 right-3` gear button wrapper.

**Animation:** panel fades + slides in with a CSS transition (`opacity` + `translateY`) driven by the `open` prop.

---

### PNG Overlay — inline in `app/page.tsx`

```tsx
{imageUrl && (
  <img
    src={imageUrl}
    alt=""
    className="fixed inset-0 m-auto max-w-[80vw] max-h-[80vh] object-contain pointer-events-none z-10"
  />
)}
```

No interaction, respects PNG transparency, stays centered at all viewport sizes.

---

## Data Flow

```
slider change → onChange(newParams) → page state → ShaderAnimation prop
                                                  → useEffect → uniform.value = x

file input → URL.createObjectURL → onImageUpload(url) → page state → <img src>
```

---

## File Changes

| File | Action |
|------|--------|
| `components/ui/shader-lines.tsx` | Refactor: accept `ShaderParams` props, add `hue` uniform, fullscreen layout, uniform sync effect |
| `components/ui/shader-controls.tsx` | Create: floating panel with sliders + upload zone |
| `app/page.tsx` | Rewrite: state owner, wire ShaderAnimation + ShaderControls + PNG overlay |
| `app/globals.css` | No changes expected |

---

## Verification

1. `npm run dev` — open `http://localhost:3000`
2. Shader fills viewport; resize browser window → canvas resizes without flicker
3. Click ⚙ → panel slides in; click again → hides
4. Move each slider → shader updates in real time, no stutter
5. Upload a PNG → image appears centered over shader with transparency intact
6. `npm run build` → zero TypeScript errors

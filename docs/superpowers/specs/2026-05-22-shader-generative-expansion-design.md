# Shader App — Generative Expansion Design

**Date:** 2026-05-22  
**Status:** Approved  

---

## Overview

Expand the Shader App to support:

1. **Per-mode param configs** with auto-save and named presets
2. **Custom output resolution** (W × H) with quick-preset buttons
3. **10 new generative modes** using p5.js, alongside the existing 4 GLSL shaders
4. **Two-tab panel UI**: Shaders / Generativo

---

## Section 1 — Architecture: Adapter Pattern

### RendererAdapter interface

Every rendering mode (GLSL or p5.js) implements a common interface:

```ts
interface RendererAdapter {
  mount(container: HTMLElement, params: Record<string, number>): void
  updateParams(params: Record<string, number>): void
  resize(width: number, height: number): void
  dispose(): void
}
```

### ModeDefinition

Each mode is a static descriptor registered in a central registry:

```ts
interface ParamSchema {
  key: string
  label: string           // display name (Portuguese)
  type: 'slider' | 'hue' | 'select' | 'button'
  min?: number
  max?: number
  step?: number
  default: number
  options?: string[]      // for type: 'select'
}

interface ModeDefinition {
  id: string
  name: string
  tab: 'shaders' | 'generative'
  thumbnail: { bg: string; accentColor: string }
  params: ParamSchema[]
  createAdapter(): RendererAdapter
}
```

### Adapters

- **ThreeAdapter** — wraps existing Three.js `ShaderAnimation` logic. The 4 GLSL shaders (Lines, Waves, Perlin, Fractal) move to `lib/modes/shaders/` and register as `ModeDefinition` entries.
- **P5Adapter** — instantiates `new p5(sketch, container)` inside `mount()`. Each p5.js mode provides a sketch factory. Params flow via a mutable ref updated in `updateParams()`.
- **ShaderTextureAdapter** — Three.js renderer that applies a GLSL shader as a `CanvasTexture` on a rotating 3D mesh (sphere / cube / torus). Does not use p5.js.

### File structure

```
lib/
  renderers/
    adapter.ts              ← RendererAdapter interface + ParamSchema types
    three-adapter.ts        ← wraps existing Three.js logic
    p5-adapter.ts           ← base P5Adapter class
    shader-texture-adapter.ts
  modes/
    index.ts                ← MODES registry (ModeDefinition[])
    shaders/
      lines.ts · waves.ts · perlin.ts · fractal.ts
    generative/
      color-interpolation.ts · kaleidoscope.ts · bezier-flow.ts
      noise-field.ts · smoke-particles.ts · shader-as-texture.ts
      game-of-life.ts · lissajous.ts · reaction-diffusion.ts
      truchet-tiles.ts
  presets.ts                ← localStorage read/write + auto-save logic
  output-size.ts            ← OutputSize state helpers
components/
  ui/
    canvas-renderer.tsx     ← mounts/swaps adapters based on activeModeId; on mode change calls dispose() on old adapter then mount() on new one
    mode-selector.tsx       ← tabbed grid of mode thumbnails
    shader-controls.tsx     ← refactored: static sliders replaced by dynamic rendering from active mode's paramSchema[]
    preset-panel.tsx        ← preset list + save-with-name UI
    output-frame.tsx        ← canvas wrapper with letterbox at custom resolution
```

---

## Section 2 — State & Persistence

### React state (page level)

```ts
activeModeId: string                              // currently shown mode
activeTab: 'shaders' | 'generative'
panelOpen: boolean
perModeParams: Record<string, Record<string, number>>  // auto-saved params
presets: Record<string, Preset[]>                 // named presets per mode
outputWidth: number
outputHeight: number
outputMode: 'full' | 'custom'
```

```ts
interface Preset {
  id: string          // crypto.randomUUID()
  name: string
  params: Record<string, number>
  createdAt: number   // Date.now()
}
```

### localStorage schema

Single key `"shader-app"` storing JSON:

```json
{
  "activeMode": "lines",
  "activeTab": "shaders",
  "modeParams": {
    "lines": { "speed": 0.05, "hue": 0 },
    "kaleidoscope": { "slices": 8, "speed": 0.03 }
  },
  "presets": {
    "lines": [{ "id": "...", "name": "Blue storm", "params": {}, "createdAt": 0 }]
  },
  "outputSize": { "width": 1920, "height": 1080, "mode": "custom" }
}
```

### Auto-save behaviour

| Event | Action |
|---|---|
| Mode change | Save current params to `modeParams[prevModeId]` before switching |
| Param slider change | Debounced 300ms write to `modeParams[activeModeId]` |
| Mode mount | Restore `modeParams[modeId]` or fall back to mode's `param.default` values |
| Preset load | Apply preset params to active params; does NOT overwrite auto-save entry |

---

## Section 3 — UI: Panel Layout

The controls panel gains a two-tab header at the top:

```
┌─────────────────────────────┐
│  [  Shaders  ] [ Generativo ]│  ← tab strip
├─────────────────────────────┤
│  mode grid (4 or 5 cols)    │  ← thumbnails for active tab
├─────────────────────────────┤
│  <Mode name>                │  ← section label
│  slider: Param A            │  ← rendered from paramSchema[]
│  slider: Param B            │
│  hue picker: Cor            │
├─────────────────────────────┤
│  Presets                    │
│  [Blue storm  ✕]            │  ← saved presets list
│  [Fast 12x    ✕]            │
│  [📌 Salvar preset]         │  ← opens inline name input
├─────────────────────────────┤
│  Output                     │
│  [1920] × [1080]            │  ← numeric inputs
│  [Full][1:1][16:9][9:16][4:3]│ ← quick preset chips
├─────────────────────────────┤
│  [🖼 Carregar PNG]          │  ← existing image upload
└─────────────────────────────┘
```

- Panel width increases from 224px to ~260px to accommodate the new sections.
- When `outputMode = 'custom'`, the `OutputFrame` component renders the canvas in a centred box with a dark letterbox background. The box dimensions match `outputWidth × outputHeight` scaled to fit the viewport.
- When `outputMode = 'full'`, behaviour is identical to today (canvas fills the screen).

---

## Section 4 — Mode Params

### GLSL Shaders (existing, unchanged)

All 4 retain their current params: `speed`, `lineWidth` (Espessura), `mosaic` (Pixelação), `lines` (Linhas), `hue` (Cor).

### p5.js Generative Modes

| Mode | Specific params | Shared |
|---|---|---|
| Color Interpolation | nCores 2–8, saturação 0–1, brilho 0–1, modo linear/radial | velocidade, hue |
| Kaleidoscope | fatias 2–24, zoom 0.5–3, rotação 0–360 | velocidade, hue |
| Bezier Flow | quantidade 1–60, espessura 0.5–5, decay 0.9–1, opacidade 0–1 | velocidade, hue |
| Noise Field | partículas 100–5000, escala noise 0.001–0.02, rastro 10–200 | velocidade, hue |
| Smoke Particles | taxa emissão 1–50, lifespan 30–300, dispersão 1–100, vento X/Y ±2 | velocidade, hue |
| Shader as Texture | forma sphere/cube/torus (select), rot X 0–0.1, rot Y 0–0.1, wireframe 0/1, shader fonte (select) | velocidade, hue |
| Game of Life | tamanho célula 2–20, fps 1–30, cor viva (hue), btn seed | — |
| Lissajous | freq X 1–10, freq Y 1–10, fase 0–6.28, decay 0.95–1, espessura 0.5–4 | velocidade, hue |
| Reaction Diffusion | feed 0.01–0.1, kill 0.04–0.07, difusão A 0.5–1.5, difusão B 0.1–0.5, steps/frame 1–10 | hue |
| Truchet Tiles | tamanho tile 10–80, espessura 0.5–5, animar 0/1, btn regen | velocidade, hue |

### Notes

- "Shader as Texture" uses `ShaderTextureAdapter` (Three.js), not p5.js. It lives in the Generativo tab because it behaves as a new visual mode, not a shader parameter.
- Game of Life uses discrete time steps, so `velocidade` continuous is replaced by an `fps` param.
- `btn` type params render as a trigger button (e.g. "Novo seed", "Regenerar") rather than a slider.

---

## Dependencies

- `p5` + `@types/p5` — new npm packages required
- No other new dependencies; Three.js already present

## Migration notes

- Existing `ShaderAnimation` component in `components/ui/shader-lines.tsx` is wrapped by `ThreeAdapter` — no logic deleted, just encapsulated.
- Existing `ShaderParams` type and `defaultParams` are superseded by the paramSchema system; the 4 GLSL mode definitions reproduce those same defaults in their `params[]` arrays.
- The static sliders in `shader-controls.tsx` (Velocidade, Espessura, Pixelação, Linhas, Cor) are removed and replaced by the dynamic paramSchema renderer — the labels may differ slightly to stay consistent with p5.js mode naming.

---

## Out of scope

- Export / download of frames or video
- Image upload as input to generative modes (future)
- Preset sharing / import-export JSON (future)

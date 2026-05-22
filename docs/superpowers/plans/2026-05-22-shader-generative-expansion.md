# Shader App — Generative Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add adapter-pattern architecture, per-mode param persistence with named presets, custom output resolution, and 10 new generative modes (p5.js + ShaderTextureAdapter) behind a two-tab panel UI.

**Architecture:** Every rendering mode implements `RendererAdapter` (`mount/updateParams/resize/dispose`). Modes are registered as `ModeDefinition` objects with a `ParamSchema[]` that drives dynamic control rendering. State (params, presets, output size) is persisted to a single `localStorage` key with debounced auto-save.

**Tech Stack:** Next.js 16, React 19, Three.js 0.184, p5 (new), Tailwind v4, TypeScript, Vitest (new)

---

## Task 1: Install deps + set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `__tests__/presets.test.ts` (placeholder — filled in Task 7)

- [ ] **Step 1: Install p5, @types/p5, vitest, @vitest/ui, jsdom**

```bash
npm install p5
npm install --save-dev @types/p5 vitest @vitest/ui jsdom
```

Expected: no errors, packages appear in `package.json`.

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify**

```bash
npm test
```
Expected: "No test files found" (passes with 0 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add p5.js and vitest dependencies"
```

---

## Task 2: RendererAdapter interface + ParamSchema types

**Files:**
- Create: `lib/renderers/adapter.ts`

- [ ] **Step 1: Create `lib/renderers/adapter.ts`**

```bash
mkdir -p lib/renderers
```

```ts
// lib/renderers/adapter.ts

export interface ParamSchema {
  key: string
  label: string
  type: 'slider' | 'hue' | 'select' | 'button'
  min?: number
  max?: number
  step?: number
  default: number
  options?: string[]
}

export interface ThumbnailDef {
  bg: string
  accentColor: string
}

export interface ModeDefinition {
  id: string
  name: string
  tab: 'shaders' | 'generative'
  thumbnail: ThumbnailDef
  thumbnailArt?: () => React.ReactNode
  params: ParamSchema[]
  createAdapter(): RendererAdapter
}

export interface RendererAdapter {
  mount(container: HTMLElement, params: Record<string, number>): void
  updateParams(params: Record<string, number>): void
  resize(width: number, height: number): void
  dispose(): void
}

export function defaultsFromSchema(params: ParamSchema[]): Record<string, number> {
  return Object.fromEntries(params.map(p => [p.key, p.default]))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (or only pre-existing errors unrelated to the new file).

- [ ] **Step 3: Commit**

```bash
git add lib/renderers/adapter.ts
git commit -m "feat: add RendererAdapter interface and ParamSchema types"
```

---

## Task 3: Export GLSL fragment shaders from lib/shaders.ts

**Files:**
- Modify: `lib/shaders.ts`

- [ ] **Step 1: Export fragment shader strings**

In `lib/shaders.ts`, change the four `const` declarations to `export const`:

```ts
// Change these four lines:
const linesFragment = PREAMBLE + `...`
const wavesFragment = PREAMBLE + `...`
const perlinFragment = PREAMBLE + `...`
const fractalFragment = PREAMBLE + `...`

// To:
export const linesFragment = PREAMBLE + `...`
export const wavesFragment = PREAMBLE + `...`
export const perlinFragment = PREAMBLE + `...`
export const fractalFragment = PREAMBLE + `...`
```

Keep the `SHADERS` array and `DEFAULT_SHADER_ID` exports unchanged (they are used by `ShaderTextureAdapter` in Task 22).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/shaders.ts
git commit -m "feat: export GLSL fragment shader strings from lib/shaders.ts"
```

---

## Task 4: ThreeAdapter

**Files:**
- Create: `lib/renderers/three-adapter.ts`

- [ ] **Step 1: Create `lib/renderers/three-adapter.ts`**

```ts
import * as THREE from 'three'
import type { RendererAdapter } from './adapter'

const VERTEX = `void main() { gl_Position = vec4(position, 1.0); }`

type Uniforms = {
  uTime: { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth: { value: number }
  uMosaic: { value: number }
  uLines: { value: number }
  uHue: { value: number }
}

export function createThreeAdapter(fragmentShader: string): RendererAdapter {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.Camera | null = null
  let uniforms: Uniforms | null = null
  let animId: number | null = null
  let speed = 0.05
  let onResize: (() => void) | null = null

  return {
    mount(container, params) {
      camera = new THREE.Camera()
      camera.position.z = 1
      scene = new THREE.Scene()

      uniforms = {
        uTime:       { value: 1.0 },
        uResolution: { value: new THREE.Vector2() },
        uLineWidth:  { value: params.lineWidth  ?? 0.0008 },
        uMosaic:     { value: params.mosaic     ?? 4.0 },
        uLines:      { value: params.lines      ?? 5 },
        uHue:        { value: ((params.hue ?? 0) * Math.PI) / 180 },
      }
      speed = params.speed ?? 0.05

      renderer = new THREE.WebGLRenderer()
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      const setSize = () => {
        if (!renderer || !uniforms) return
        const w = container.clientWidth  || window.innerWidth
        const h = container.clientHeight || window.innerHeight
        renderer.setSize(w, h)
        uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
      }
      onResize = setSize
      setSize()

      const geo = new THREE.PlaneGeometry(2, 2)
      const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader })
      scene.add(new THREE.Mesh(geo, mat))

      const tick = () => {
        animId = requestAnimationFrame(tick)
        uniforms!.uTime.value += speed
        renderer!.render(scene!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (!uniforms) return
      if (params.speed     !== undefined) speed = params.speed
      if (params.lineWidth !== undefined) uniforms.uLineWidth.value = params.lineWidth
      if (params.mosaic    !== undefined) uniforms.uMosaic.value    = params.mosaic
      if (params.lines     !== undefined) uniforms.uLines.value     = params.lines
      if (params.hue       !== undefined) uniforms.uHue.value       = (params.hue * Math.PI) / 180
    },

    resize(width, height) {
      if (!renderer || !uniforms) return
      renderer.setSize(width, height)
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
    },

    dispose() {
      if (animId) cancelAnimationFrame(animId)
      renderer?.dispose()
      renderer?.domElement.remove()
      renderer = null; scene = null; camera = null; uniforms = null; animId = null
    },
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/renderers/three-adapter.ts
git commit -m "feat: add ThreeAdapter wrapping Three.js GLSL renderer"
```

---

## Task 5: GLSL mode definitions + MODES registry

**Files:**
- Create: `lib/modes/shaders/lines.ts`
- Create: `lib/modes/shaders/waves.ts`
- Create: `lib/modes/shaders/perlin.ts`
- Create: `lib/modes/shaders/fractal.ts`
- Create: `lib/modes/index.ts`

- [ ] **Step 1: Create shader mode files**

```bash
mkdir -p lib/modes/shaders lib/modes/generative
```

`lib/modes/shaders/lines.ts`:
```ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { linesFragment } from '@/lib/shaders'

export const linesMode: ModeDefinition = {
  id: 'lines',
  name: 'Lines',
  tab: 'shaders',
  thumbnail: {
    bg: 'linear-gradient(160deg, #060d1f 0%, #0d1b3e 100%)',
    accentColor: 'rgba(80,160,255,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,   step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001,max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,     max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,     max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(linesFragment),
}
```

`lib/modes/shaders/waves.ts`:
```ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { wavesFragment } from '@/lib/shaders'

export const wavesMode: ModeDefinition = {
  id: 'waves',
  name: 'Waves',
  tab: 'shaders',
  thumbnail: {
    bg: 'linear-gradient(160deg, #080f12 0%, #0a1e14 100%)',
    accentColor: 'rgba(60,220,120,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,   step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001,max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,     max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,     max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(wavesFragment),
}
```

`lib/modes/shaders/perlin.ts`:
```ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { perlinFragment } from '@/lib/shaders'

export const perlinMode: ModeDefinition = {
  id: 'perlin',
  name: 'Perlin',
  tab: 'shaders',
  thumbnail: { bg: '#080608', accentColor: 'rgba(160,80,255,0.8)' },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,   step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001,max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,     max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,     max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(perlinFragment),
}
```

`lib/modes/shaders/fractal.ts`:
```ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { fractalFragment } from '@/lib/shaders'

export const fractalMode: ModeDefinition = {
  id: 'fractal',
  name: 'Fractal',
  tab: 'shaders',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 50% 50%, #1a0822 0%, #06020e 70%)',
    accentColor: 'rgba(255,100,200,0.7)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,   step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001,max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,     max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,     max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(fractalFragment),
}
```

- [ ] **Step 2: Create `lib/modes/index.ts` with stub generative entries (to be replaced in Tasks 13–22)**

```ts
import { linesMode }  from './shaders/lines'
import { wavesMode }  from './shaders/waves'
import { perlinMode } from './shaders/perlin'
import { fractalMode } from './shaders/fractal'
import type { ModeDefinition } from '@/lib/renderers/adapter'

export const MODES: ModeDefinition[] = [
  linesMode,
  wavesMode,
  perlinMode,
  fractalMode,
]

export const DEFAULT_MODE_ID = 'lines'
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add lib/modes/
git commit -m "feat: add GLSL mode definitions and MODES registry"
```

---

## Task 6: P5Adapter base class

**Files:**
- Create: `lib/renderers/p5-adapter.ts`

- [ ] **Step 1: Create `lib/renderers/p5-adapter.ts`**

```ts
import type { RendererAdapter } from './adapter'

export type SizeRef = { w: number; h: number }
export type SketchFactory = (
  p: any,
  getParams: () => Record<string, number>,
  size: SizeRef,
) => void

export function createP5Adapter(sketchFactory: SketchFactory): RendererAdapter {
  let p5Instance: any = null
  let disposed = false
  let currentParams: Record<string, number> = {}
  const size: SizeRef = { w: 0, h: 0 }

  return {
    mount(container, params) {
      currentParams = { ...params }
      disposed = false
      size.w = container.clientWidth  || window.innerWidth
      size.h = container.clientHeight || window.innerHeight

      import('p5').then(({ default: P5 }) => {
        if (disposed) return
        p5Instance = new (P5 as any)((p: any) => {
          sketchFactory(p, () => currentParams, size)
        }, container)
      })
    },

    updateParams(params) {
      currentParams = { ...currentParams, ...params }
    },

    resize(width, height) {
      size.w = width
      size.h = height
      p5Instance?.resizeCanvas(width, height)
    },

    dispose() {
      disposed = true
      p5Instance?.remove()
      p5Instance = null
    },
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/renderers/p5-adapter.ts
git commit -m "feat: add P5Adapter base class for p5.js generative modes"
```

---

## Task 7: presets.ts + tests

**Files:**
- Create: `lib/presets.ts`
- Create: `__tests__/presets.test.ts`

- [ ] **Step 1: Create `lib/presets.ts`**

```ts
const KEY = 'shader-app'

export interface Preset {
  id: string
  name: string
  params: Record<string, number>
  createdAt: number
}

interface Store {
  activeMode?: string
  activeTab?: 'shaders' | 'generative'
  modeParams?: Record<string, Record<string, number>>
  presets?: Record<string, Preset[]>
  outputSize?: { width: number; height: number; mode: 'full' | 'custom' }
}

function load(): Store {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function save(s: Store) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {}
}

export function loadModeParams(id: string): Record<string, number> | null {
  return load().modeParams?.[id] ?? null
}

export function saveModeParams(id: string, params: Record<string, number>) {
  const s = load()
  save({ ...s, modeParams: { ...s.modeParams, [id]: params } })
}

export function loadPresets(id: string): Preset[] {
  return load().presets?.[id] ?? []
}

export function addPreset(modeId: string, name: string, params: Record<string, number>): Preset {
  const preset: Preset = { id: crypto.randomUUID(), name, params, createdAt: Date.now() }
  const s = load()
  const existing = s.presets?.[modeId] ?? []
  save({ ...s, presets: { ...s.presets, [modeId]: [...existing, preset] } })
  return preset
}

export function removePreset(modeId: string, id: string) {
  const s = load()
  const existing = s.presets?.[modeId] ?? []
  save({ ...s, presets: { ...s.presets, [modeId]: existing.filter(p => p.id !== id) } })
}

export function loadOutputSize(): { width: number; height: number; mode: 'full' | 'custom' } {
  return load().outputSize ?? { width: 1920, height: 1080, mode: 'full' }
}

export function saveOutputSize(size: { width: number; height: number; mode: 'full' | 'custom' }) {
  save({ ...load(), outputSize: size })
}

export function loadLastMode(): { modeId: string | null; tab: 'shaders' | 'generative' } {
  const s = load()
  return { modeId: s.activeMode ?? null, tab: s.activeTab ?? 'shaders' }
}

export function saveActiveMode(modeId: string, tab: 'shaders' | 'generative') {
  save({ ...load(), activeMode: modeId, activeTab: tab })
}
```

- [ ] **Step 2: Write failing tests**

Create `__tests__/presets.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

import {
  loadModeParams, saveModeParams,
  loadPresets, addPreset, removePreset,
  loadOutputSize, saveOutputSize,
  loadLastMode, saveActiveMode,
} from '@/lib/presets'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('modeParams', () => {
  it('returns null when nothing saved', () => {
    expect(loadModeParams('lines')).toBeNull()
  })
  it('round-trips params', () => {
    saveModeParams('lines', { speed: 0.1, hue: 90 })
    expect(loadModeParams('lines')).toEqual({ speed: 0.1, hue: 90 })
  })
  it('does not overwrite other modes', () => {
    saveModeParams('lines', { speed: 0.1 })
    saveModeParams('waves', { speed: 0.2 })
    expect(loadModeParams('lines')).toEqual({ speed: 0.1 })
  })
})

describe('presets', () => {
  it('returns [] when none saved', () => {
    expect(loadPresets('lines')).toEqual([])
  })
  it('adds and loads preset', () => {
    const p = addPreset('lines', 'My preset', { speed: 0.1 })
    expect(p.name).toBe('My preset')
    expect(p.id).toBe('test-uuid')
    expect(loadPresets('lines')).toHaveLength(1)
  })
  it('removes preset by id', () => {
    addPreset('lines', 'A', { speed: 0.1 })
    removePreset('lines', 'test-uuid')
    expect(loadPresets('lines')).toHaveLength(0)
  })
})

describe('outputSize', () => {
  it('returns defaults when nothing saved', () => {
    expect(loadOutputSize()).toEqual({ width: 1920, height: 1080, mode: 'full' })
  })
  it('round-trips custom size', () => {
    saveOutputSize({ width: 1080, height: 1080, mode: 'custom' })
    expect(loadOutputSize()).toEqual({ width: 1080, height: 1080, mode: 'custom' })
  })
})

describe('activeMode', () => {
  it('returns null tab shaders by default', () => {
    expect(loadLastMode()).toEqual({ modeId: null, tab: 'shaders' })
  })
  it('round-trips mode + tab', () => {
    saveActiveMode('kaleidoscope', 'generative')
    expect(loadLastMode()).toEqual({ modeId: 'kaleidoscope', tab: 'generative' })
  })
})
```

- [ ] **Step 3: Run tests (expect fail — module not found)**

```bash
npm test
```

Expected: fail with "Cannot find module '@/lib/presets'"

- [ ] **Step 4: Add path alias to vitest config**

Update `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 5: Run tests again — expect pass**

```bash
npm test
```
Expected: all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/presets.ts __tests__/presets.test.ts vitest.config.ts
git commit -m "feat: add presets.ts localStorage helpers with tests"
```

---

## Task 8: CanvasRenderer component

**Files:**
- Create: `components/ui/canvas-renderer.tsx`

- [ ] **Step 1: Create `components/ui/canvas-renderer.tsx`**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { RendererAdapter } from '@/lib/renderers/adapter'
import { MODES } from '@/lib/modes'

interface Props {
  modeId: string
  params: Record<string, number>
}

export function CanvasRenderer({ modeId, params }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef   = useRef<RendererAdapter | null>(null)
  const paramsRef    = useRef(params)

  // Keep paramsRef current and push updates to live adapter
  useEffect(() => {
    paramsRef.current = params
    adapterRef.current?.updateParams(params)
  }, [params])

  // Swap adapter when mode changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    adapterRef.current?.dispose()
    container.innerHTML = ''

    const mode = MODES.find(m => m.id === modeId) ?? MODES[0]
    const adapter = mode.createAdapter()
    adapter.mount(container, paramsRef.current)
    adapterRef.current = adapter

    return () => {
      adapter.dispose()
      adapterRef.current = null
    }
  }, [modeId])

  // ResizeObserver drives adapter.resize()
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) adapterRef.current?.resize(width, height)
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/canvas-renderer.tsx
git commit -m "feat: add CanvasRenderer component (adapter mount/swap/resize)"
```

---

## Task 9: OutputFrame component

**Files:**
- Create: `components/ui/output-frame.tsx`

- [ ] **Step 1: Create `components/ui/output-frame.tsx`**

```tsx
'use client'

interface Props {
  mode: 'full' | 'custom'
  width: number
  height: number
  children: React.ReactNode
}

export function OutputFrame({ mode, width, height, children }: Props) {
  if (mode === 'full') {
    return <div className="fixed inset-0">{children}</div>
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/90">
      <div
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(${width}px, calc(100vw - 32px))`,
          maxHeight: 'calc(100vh - 32px)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/output-frame.tsx
git commit -m "feat: add OutputFrame component with letterbox support"
```

---

## Task 10: Refactor ShaderControls

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Replace `components/ui/shader-controls.tsx` entirely**

```tsx
'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MODES } from '@/lib/modes'
import type { Preset } from '@/lib/presets'
import type { ParamSchema } from '@/lib/renderers/adapter'

interface Props {
  open: boolean
  onToggle: () => void
  activeModeId: string
  activeTab: 'shaders' | 'generative'
  onTabChange: (tab: 'shaders' | 'generative') => void
  onModeChange: (id: string) => void
  params: Record<string, number>
  onParamChange: (p: Record<string, number>) => void
  presets: Preset[]
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onLoadPreset: (p: Preset) => void
  outputWidth: number
  outputHeight: number
  outputMode: 'full' | 'custom'
  onOutputChange: (w: number, h: number, mode: 'full' | 'custom') => void
  onImageUpload: (url: string | null) => void
  imageUrl: string | null
}

const OUTPUT_PRESETS = [
  { label: 'Full', w: 0, h: 0, mode: 'full' as const },
  { label: '1:1',  w: 1080, h: 1080, mode: 'custom' as const },
  { label: '16:9', w: 1920, h: 1080, mode: 'custom' as const },
  { label: '9:16', w: 1080, h: 1920, mode: 'custom' as const },
  { label: '4:3',  w: 1440, h: 1080, mode: 'custom' as const },
]

export function ShaderControls({
  open, onToggle, activeModeId, activeTab, onTabChange, onModeChange,
  params, onParamChange, presets, onSavePreset, onDeletePreset, onLoadPreset,
  outputWidth, outputHeight, outputMode, onOutputChange,
  onImageUpload, imageUrl,
}: Props) {
  const fileRef       = useRef<HTMLInputElement>(null)
  const prevUrlRef    = useRef<string | null>(null)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gearVisible, setGearVisible] = useState(true)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName]   = useState('')

  useEffect(() => {
    const show = () => {
      setGearVisible(true)
      clearTimeout(hideTimerRef.current!)
      hideTimerRef.current = setTimeout(() => setGearVisible(false), 3000)
    }
    show()
    window.addEventListener('mousemove', show)
    return () => { window.removeEventListener('mousemove', show); clearTimeout(hideTimerRef.current!) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') onToggle()
      if (e.key === 'f' || e.key === 'F') {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggle])

  const activeMode = MODES.find(m => m.id === activeModeId)
  const tabModes   = MODES.filter(m => m.tab === activeTab)

  const handleSlider = (schema: ParamSchema) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value)
    onParamChange({ ...params, [schema.key]: schema.step === 1 ? Math.round(raw) : raw })
  }

  const handleButton = (schema: ParamSchema) => () => {
    onParamChange({ ...params, [schema.key]: (params[schema.key] ?? 0) + 1 })
  }

  const handleSelect = (schema: ParamSchema, idx: number) => {
    onParamChange({ ...params, [schema.key]: idx })
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    const url = URL.createObjectURL(file)
    prevUrlRef.current = url
    onImageUpload(url)
    e.target.value = ''
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    onSavePreset(presetName.trim())
    setPresetName('')
    setSavingPreset(false)
  }

  const handleOutputW = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    if (v > 0) onOutputChange(v, outputHeight, 'custom')
  }

  const handleOutputH = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    if (v > 0) onOutputChange(outputWidth, v, 'custom')
  }

  return (
    <div className="fixed top-3 right-3 z-20">
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className={[
          'w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md',
          'flex items-center justify-center text-white/60 hover:text-white',
          'transition-opacity duration-500 text-base',
          gearVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >⚙</button>

      <div
        aria-hidden={!open}
        className={[
          'absolute top-11 right-0 w-64 max-h-[90vh] overflow-y-auto',
          'bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4',
          'flex flex-col gap-3',
          'transition-all duration-200 origin-top-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        ].join(' ')}
      >
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-lg p-0.5">
          {(['shaders', 'generative'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={[
                'text-[10px] py-1.5 rounded-md font-semibold transition-colors',
                activeTab === tab
                  ? 'bg-white/10 text-white'
                  : 'text-white/35 hover:text-white/60',
              ].join(' ')}
            >
              {tab === 'shaders' ? 'Shaders' : 'Generativo'}
            </button>
          ))}
        </div>

        {/* Mode grid */}
        <div className={`grid gap-1.5 ${activeTab === 'shaders' ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {tabModes.map(m => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              title={m.name}
              className={[
                'aspect-square rounded-lg overflow-hidden relative border-2 transition-colors',
                activeModeId === m.id ? 'border-blue-500' : 'border-transparent',
              ].join(' ')}
              style={{ background: m.thumbnail.bg }}
            >
              {m.thumbnailArt?.()}
              <span className="absolute bottom-0.5 inset-x-0 text-center text-[6px] font-semibold text-white/70 leading-none">
                {m.name}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-white/10" />

        {/* Dynamic controls */}
        {activeMode && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {activeMode.name}
            </p>
            {activeMode.params.map(schema => {
              const val = params[schema.key] ?? schema.default
              if (schema.type === 'hue') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/70">{schema.label}</span>
                    <span className="text-white/30">{Math.round(val)}°</span>
                  </div>
                  <input
                    type="range" min={0} max={360} step={1} value={val}
                    onChange={handleSlider(schema)}
                    className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                    style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
                  />
                </div>
              )
              if (schema.type === 'button') return (
                <button
                  key={schema.key}
                  onClick={handleButton(schema)}
                  className="border border-white/20 rounded-lg p-2 text-[10px] text-white/50 hover:text-white/80 hover:border-white/30 transition-colors"
                >
                  {schema.label}
                </button>
              )
              if (schema.type === 'select') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-white/70">{schema.label}</span>
                  <div className="flex gap-1 flex-wrap">
                    {schema.options?.map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => handleSelect(schema, i)}
                        className={[
                          'text-[9px] px-2 py-1 rounded-md transition-colors',
                          Math.round(val) === i
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            : 'bg-white/8 text-white/40 border border-white/10',
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
              // default: slider
              const display = schema.step === 1
                ? String(Math.round(val))
                : val.toFixed(schema.step && schema.step < 0.01 ? 4 : 3)
              return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/70">{schema.label}</span>
                    <span className="text-white/30">{display}</span>
                  </div>
                  <input
                    type="range" min={schema.min} max={schema.max} step={schema.step}
                    value={val} onChange={handleSlider(schema)}
                    className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                  />
                </div>
              )
            })}
          </>
        )}

        <div className="h-px bg-white/10" />

        {/* Presets */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Presets</p>
        {presets.length > 0 && (
          <div className="flex flex-col gap-1">
            {presets.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white/6 rounded-lg px-2.5 py-1.5">
                <button
                  onClick={() => onLoadPreset(p)}
                  className="text-[10px] text-white/60 hover:text-white flex-1 text-left"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.id)}
                  className="text-[9px] text-white/20 hover:text-red-400 ml-2"
                >✕</button>
              </div>
            ))}
          </div>
        )}
        {savingPreset ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSavingPreset(false) }}
              placeholder="Nome do preset"
              className="flex-1 bg-white/8 border border-white/15 rounded-md px-2 py-1 text-[10px] text-white/80 outline-none"
            />
            <button onClick={handleSavePreset} className="text-[10px] text-blue-400 px-2">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setSavingPreset(true)}
            className="border border-dashed border-indigo-500/40 rounded-lg p-2 text-[10px] text-indigo-400/70 hover:text-indigo-300 hover:border-indigo-400/60 transition-colors"
          >
            📌 Salvar preset
          </button>
        )}

        <div className="h-px bg-white/10" />

        {/* Output size */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Output</p>
        <div className="flex items-center gap-1.5">
          <input
            type="number" value={outputWidth} onChange={handleOutputW} min={1}
            className="w-full bg-white/7 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/70 text-center outline-none"
          />
          <span className="text-[10px] text-white/20">×</span>
          <input
            type="number" value={outputHeight} onChange={handleOutputH} min={1}
            className="w-full bg-white/7 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/70 text-center outline-none"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {OUTPUT_PRESETS.map(op => {
            const active = op.mode === 'full'
              ? outputMode === 'full'
              : outputMode === 'custom' && outputWidth === op.w && outputHeight === op.h
            return (
              <button
                key={op.label}
                onClick={() => onOutputChange(op.w || outputWidth, op.h || outputHeight, op.mode)}
                className={[
                  'text-[8px] px-2 py-0.5 rounded transition-colors',
                  active
                    ? 'bg-white/15 text-white/80 border border-white/20'
                    : 'bg-white/6 text-white/35 border border-white/8',
                ].join(' ')}
              >
                {op.label}
              </button>
            )
          })}
        </div>

        <div className="h-px bg-white/10" />

        {/* Image upload */}
        <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>
        {imageUrl && (
          <button
            onClick={() => onImageUpload(null)}
            className="border border-dashed border-red-500/30 rounded-lg p-2.5 flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 transition-colors"
          >
            <span className="text-lg leading-none">🗑</span>
            <span className="text-[10px]">Remover imagem</span>
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: refactor ShaderControls — tabs, dynamic params, presets, output size"
```

---

## Task 11: Refactor page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MODES, DEFAULT_MODE_ID } from '@/lib/modes'
import { CanvasRenderer } from '@/components/ui/canvas-renderer'
import { OutputFrame } from '@/components/ui/output-frame'
import { ShaderControls } from '@/components/ui/shader-controls'
import { DraggableImage } from '@/components/ui/draggable-image'
import {
  loadModeParams, saveModeParams, loadPresets, addPreset, removePreset,
  loadOutputSize, saveOutputSize, loadLastMode, saveActiveMode,
  type Preset,
} from '@/lib/presets'
import { defaultsFromSchema } from '@/lib/renderers/adapter'

const DEBOUNCE_MS = 300

export default function Page() {
  const [activeModeId, setActiveModeId] = useState(DEFAULT_MODE_ID)
  const [activeTab,    setActiveTab]    = useState<'shaders' | 'generative'>('shaders')
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [imageUrl,     setImageUrl]     = useState<string | null>(null)
  const [outputWidth,  setOutputWidth]  = useState(1920)
  const [outputHeight, setOutputHeight] = useState(1080)
  const [outputMode,   setOutputMode]   = useState<'full' | 'custom'>('full')
  const [params,       setParams]       = useState<Record<string, number>>(() => {
    const mode = MODES.find(m => m.id === DEFAULT_MODE_ID) ?? MODES[0]
    return defaultsFromSchema(mode.params)
  })
  const [presets, setPresets] = useState<Preset[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevModeId = useRef(DEFAULT_MODE_ID)

  // Restore persisted state on mount
  useEffect(() => {
    const { modeId, tab } = loadLastMode()
    const size = loadOutputSize()
    setOutputWidth(size.width)
    setOutputHeight(size.height)
    setOutputMode(size.mode)
    if (modeId) {
      const mode = MODES.find(m => m.id === modeId)
      if (mode) {
        setActiveModeId(modeId)
        setActiveTab(tab)
        prevModeId.current = modeId
        const stored = loadModeParams(modeId)
        setParams(stored ?? defaultsFromSchema(mode.params))
        setPresets(loadPresets(modeId))
      }
    }
  }, [])

  const handleModeChange = useCallback((id: string) => {
    // Auto-save current params before switching
    saveModeParams(prevModeId.current, params)
    prevModeId.current = id

    const mode = MODES.find(m => m.id === id) ?? MODES[0]
    const stored = loadModeParams(id)
    setActiveModeId(id)
    setActiveTab(mode.tab)
    setParams(stored ?? defaultsFromSchema(mode.params))
    setPresets(loadPresets(id))
    saveActiveMode(id, mode.tab)
  }, [params])

  const handleTabChange = useCallback((tab: 'shaders' | 'generative') => {
    setActiveTab(tab)
  }, [])

  const handleParamChange = useCallback((newParams: Record<string, number>) => {
    setParams(newParams)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveModeParams(prevModeId.current, newParams)
    }, DEBOUNCE_MS)
  }, [])

  const handleSavePreset = useCallback((name: string) => {
    const preset = addPreset(activeModeId, name, params)
    setPresets(prev => [...prev, preset])
  }, [activeModeId, params])

  const handleDeletePreset = useCallback((id: string) => {
    removePreset(activeModeId, id)
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [activeModeId])

  const handleLoadPreset = useCallback((preset: Preset) => {
    setParams(preset.params)
  }, [])

  const handleOutputChange = useCallback((w: number, h: number, mode: 'full' | 'custom') => {
    setOutputWidth(w)
    setOutputHeight(h)
    setOutputMode(mode)
    saveOutputSize({ width: w, height: h, mode })
  }, [])

  return (
    <main className="fixed inset-0 overflow-hidden">
      <OutputFrame mode={outputMode} width={outputWidth} height={outputHeight}>
        <CanvasRenderer modeId={activeModeId} params={params} />
      </OutputFrame>

      {imageUrl && (
        <DraggableImage url={imageUrl} onRemove={() => setImageUrl(null)} />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        activeModeId={activeModeId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onModeChange={handleModeChange}
        params={params}
        onParamChange={handleParamChange}
        presets={presets}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onLoadPreset={handleLoadPreset}
        outputWidth={outputWidth}
        outputHeight={outputHeight}
        outputMode={outputMode}
        onOutputChange={handleOutputChange}
        onImageUpload={setImageUrl}
        imageUrl={imageUrl}
      />
    </main>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: refactor page.tsx — per-mode params, presets, output size"
```

---

## Task 12: Checkpoint — verify existing shaders work

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visual checks**

Open http://localhost:3000 and verify:
- Lines shader renders fullscreen (same as before)
- ⚙ gear appears, fades after 3s
- Press H to open panel
- Panel shows "Shaders / Generativo" tabs
- Shaders tab shows 4 mode tiles (Lines, Waves, Perlin, Fractal)
- Click each shader — it switches
- Sliders work and update the shader in real time
- Change speed/hue/etc. on Lines, switch to Waves, come back to Lines — params are restored
- Save a preset: adjust hue, click "📌 Salvar preset", type name, press Enter — preset appears
- Click preset — params restore
- Delete preset — it disappears
- Output: type 1080 × 1080, see letterbox square canvas
- Click "Full" — returns to fullscreen
- F key toggles fullscreen

If any check fails, fix before proceeding.

> **Known regression to fix here:** The original shader thumbnails had custom CSS/SVG art (lines, waves, circles, rings). Task 5 omits `thumbnailArt` from the GLSL mode definitions. To restore: copy the art blocks from the OLD `ShaderThumbnailArt` function (visible in git history via `git show HEAD~:components/ui/shader-controls.tsx`) and add them as `thumbnailArt: () => <>{...}</>` on each GLSL ModeDefinition.

- [ ] **Step 3: Commit if any fixes were made**

```bash
git add -A
git commit -m "fix: checkpoint fixes after infrastructure refactor"
```

---

## Task 13: Color Interpolation mode

**Files:**
- Create: `lib/modes/generative/color-interpolation.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/color-interpolation.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    p.noStroke()
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, nCores = 5, saturacao = 0.8, brilho = 0.9 } = getParams()
    const t = p.frameCount * speed * 0.01
    const cols = 60, rows = 40
    const cw = p.width / cols + 1
    const ch = p.height / rows + 1

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = p.noise(i * 0.08, j * 0.08, t)
        const h2 = (hue + n * Math.round(nCores) * (360 / Math.round(nCores))) % 360
        p.fill(h2, saturacao * 100, brilho * 100)
        p.rect(i * (p.width / cols), j * (p.height / rows), cw, ch)
      }
    }
  }
}

export const colorInterpolationMode: ModeDefinition = {
  id: 'color-interpolation',
  name: 'Color Interp',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(135deg, #ff0080 0%, #00ffff 50%, #8000ff 100%)',
    accentColor: 'rgba(255,0,128,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,  step: 0.005, default: 0.05 },
    { key: 'nCores',    label: 'Nº cores',   type: 'slider', min: 2,     max: 8,    step: 1,     default: 5 },
    { key: 'saturacao', label: 'Saturação',  type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.8 },
    { key: 'brilho',    label: 'Brilho',     type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.9 },
    { key: 'hue',       label: 'Cor base',   type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**

```ts
import { linesMode }              from './shaders/lines'
import { wavesMode }              from './shaders/waves'
import { perlinMode }             from './shaders/perlin'
import { fractalMode }            from './shaders/fractal'
import { colorInterpolationMode } from './generative/color-interpolation'
import type { ModeDefinition }    from '@/lib/renderers/adapter'

export const MODES: ModeDefinition[] = [
  linesMode, wavesMode, perlinMode, fractalMode,
  colorInterpolationMode,
]

export const DEFAULT_MODE_ID = 'lines'
```

- [ ] **Step 3: Visual verification**

```bash
npm run dev
```
Open panel → Generativo tab → click Color Interp → confirm animated noise color field appears. Adjust sliders, confirm they affect the animation.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/color-interpolation.ts lib/modes/index.ts
git commit -m "feat: add Color Interpolation generative mode"
```

---

## Task 14: Kaleidoscope mode

**Files:**
- Create: `lib/modes/generative/kaleidoscope.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/kaleidoscope.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let pg: any

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    pg = p.createGraphics(size.w, size.h)
    pg.colorMode(pg.HSB, 360, 100, 100, 100)
    pg.noStroke()
  }

  p.draw = () => {
    const { speed = 0.03, hue = 0, fatias = 8, zoom = 1.0 } = getParams()
    const t = p.frameCount * speed * 0.01
    const n = Math.max(2, Math.round(fatias))
    const cx = p.width / 2, cy = p.height / 2

    pg.background(0)
    for (let i = 0; i < 80; i++) {
      const nx = p.noise(i * 0.2, 0, t)
      const ny = p.noise(i * 0.2, 100, t)
      const nh = p.noise(i * 0.2, 200, t)
      const x = (nx - 0.5) * p.width * 0.8 + cx
      const y = (ny - 0.5) * p.height * 0.8 + cy
      pg.fill((hue + nh * 120) % 360, 80, 90, 80)
      pg.ellipse(x, y, 30 + nh * 60, 30 + nh * 60)
    }

    p.background(0)
    const sliceAngle = (Math.PI * 2) / n
    for (let i = 0; i < n; i++) {
      p.push()
      p.translate(cx, cy)
      p.rotate(i * sliceAngle)
      p.scale(zoom, zoom)
      if (i % 2 === 1) p.scale(-1, 1)
      p.image(pg, -cx, -cy)
      p.pop()
    }
  }
}

export const kaleidoscopeMode: ModeDefinition = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(circle at 50% 50%, #2a0a4a 0%, #0a0015 70%)',
    accentColor: 'rgba(180,80,255,0.9)',
  },
  params: [
    { key: 'speed',  label: 'Velocidade', type: 'slider', min: 0.005, max: 0.15, step: 0.005, default: 0.03 },
    { key: 'fatias', label: 'Fatias',     type: 'slider', min: 2,     max: 24,   step: 1,     default: 8 },
    { key: 'zoom',   label: 'Zoom',       type: 'slider', min: 0.5,   max: 2.5,  step: 0.1,   default: 1.0 },
    { key: 'hue',    label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`** — append import and add `kaleidoscopeMode` to `MODES` array after `colorInterpolationMode`.

- [ ] **Step 3: Visual verification** — open Generativo tab, click Kaleidoscope. Confirm symmetrical mirror pattern. Adjust Fatias slider (2→24) to verify symmetry changes.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/kaleidoscope.ts lib/modes/index.ts
git commit -m "feat: add Kaleidoscope generative mode"
```

---

## Task 15: Bezier Flow mode

**Files:**
- Create: `lib/modes/generative/bezier-flow.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/bezier-flow.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.02, hue = 0, quantidade = 20, espessura = 1, decay = 0.97, opacidade = 0.8 } = getParams()
    const t = p.frameCount * speed * 0.01
    const w = p.width, h = p.height

    p.noStroke()
    p.fill(0, 0, 0, (1 - decay) * 100)
    p.rect(0, 0, w, h)

    p.noFill()
    const n = Math.round(quantidade)
    for (let i = 0; i < n; i++) {
      const fi = i / n
      const x1 = p.noise(fi, 0,  t) * w, y1 = p.noise(fi, 1,  t) * h
      const x2 = p.noise(fi, 2,  t + 1) * w, y2 = p.noise(fi, 3,  t + 1) * h
      const x3 = p.noise(fi, 4,  t + 0.5) * w, y3 = p.noise(fi, 5,  t + 0.5) * h
      const x4 = p.noise(fi, 6,  t) * w, y4 = p.noise(fi, 7,  t) * h
      const h2 = (hue + fi * 120 + t * 20) % 360
      p.stroke(h2, 80, 90, opacidade * 100)
      p.strokeWeight(espessura)
      p.bezier(x1, y1, x2, y2, x3, y3, x4, y4)
    }
  }
}

export const bezierFlowMode: ModeDefinition = {
  id: 'bezier-flow',
  name: 'Bezier Flow',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #001a0d 0%, #0d1a00 100%)',
    accentColor: 'rgba(60,220,120,0.9)',
  },
  params: [
    { key: 'speed',      label: 'Velocidade', type: 'slider', min: 0.005, max: 0.15, step: 0.005, default: 0.02 },
    { key: 'quantidade', label: 'Curvas',     type: 'slider', min: 1,     max: 60,   step: 1,     default: 20 },
    { key: 'espessura',  label: 'Espessura',  type: 'slider', min: 0.5,   max: 5,    step: 0.5,   default: 1 },
    { key: 'decay',      label: 'Rastro',     type: 'slider', min: 0.9,   max: 0.999,step: 0.001, default: 0.97 },
    { key: 'opacidade',  label: 'Opacidade',  type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.8 },
    { key: 'hue',        label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 120 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`** — import and push to `MODES`.

- [ ] **Step 3: Visual verification** — confirm animated Bezier trails. Adjust Rastro slider to see trail length change.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/bezier-flow.ts lib/modes/index.ts
git commit -m "feat: add Bezier Flow generative mode"
```

---

## Task 16: Noise Field mode

**Files:**
- Create: `lib/modes/generative/noise-field.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/noise-field.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

interface Particle { x: number; y: number; px: number; py: number }

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let particles: Particle[] = []

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, particulas = 1000, escalaRuido = 0.005, rastro = 80 } = getParams()
    const w = p.width, h = p.height
    const t = p.frameCount * speed * 0.003
    const target = Math.round(particulas)

    while (particles.length < target) particles.push({ x: p.random(w), y: p.random(h), px: 0, py: 0 })
    if (particles.length > target) particles = particles.slice(0, target)

    p.noStroke()
    p.fill(0, 0, 0, (1 / rastro) * 100)
    p.rect(0, 0, w, h)

    p.strokeWeight(1)
    for (const pt of particles) {
      pt.px = pt.x; pt.py = pt.y
      const angle = p.noise(pt.x * escalaRuido, pt.y * escalaRuido, t) * Math.PI * 4
      pt.x += Math.cos(angle) * speed * 15
      pt.y += Math.sin(angle) * speed * 15
      if (pt.x < 0 || pt.x > w || pt.y < 0 || pt.y > h) {
        pt.x = p.random(w); pt.y = p.random(h); pt.px = pt.x; pt.py = pt.y
      }
      const n = p.noise(pt.x * escalaRuido * 2, pt.y * escalaRuido * 2)
      p.stroke((hue + n * 120) % 360, 80, 90, 80)
      p.line(pt.px, pt.py, pt.x, pt.y)
    }
  }
}

export const noiseFieldMode: ModeDefinition = {
  id: 'noise-field',
  name: 'Noise Field',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #050510 0%, #0a0520 100%)',
    accentColor: 'rgba(120,80,255,0.9)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',    type: 'slider', min: 0.01,  max: 0.2,   step: 0.01,    default: 0.05 },
    { key: 'particulas',  label: 'Partículas',    type: 'slider', min: 100,   max: 5000,  step: 100,     default: 1000 },
    { key: 'escalaRuido', label: 'Escala noise',  type: 'slider', min: 0.001, max: 0.02,  step: 0.001,   default: 0.005 },
    { key: 'rastro',      label: 'Rastro',        type: 'slider', min: 10,    max: 200,   step: 5,       default: 80 },
    { key: 'hue',         label: 'Cor',           type: 'hue',    min: 0,     max: 360,   step: 1,       default: 200 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — confirm flow field particles. Increase Partículas to 5000, verify performance is acceptable.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/noise-field.ts lib/modes/index.ts
git commit -m "feat: add Noise Field (flow field) generative mode"
```

---

## Task 17: Smoke Particles mode

**Files:**
- Create: `lib/modes/generative/smoke-particles.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/smoke-particles.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

interface Smoke { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; hue: number }

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let particles: Smoke[] = []

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    p.noStroke()
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, taxaEmissao = 10, lifespan = 120, dispersao = 30, ventoX = 0, ventoY = 0 } = getParams()
    const w = p.width, h = p.height

    p.fill(0, 0, 0, 8)
    p.rect(0, 0, w, h)

    const emit = Math.round(taxaEmissao)
    for (let i = 0; i < emit; i++) {
      particles.push({
        x: w / 2 + p.random(-20, 20), y: h * 0.8,
        vx: p.random(-dispersao * 0.05, dispersao * 0.05) + ventoX * 0.2,
        vy: -p.random(0.5, 2) * speed * 20 + ventoY * 0.5,
        life: lifespan, maxLife: lifespan,
        r: p.random(10, 30),
        hue: (hue + p.random(-20, 20) + 360) % 360,
      })
    }

    particles = particles.filter(pt => pt.life > 0)
    for (const pt of particles) {
      pt.x  += pt.vx
      pt.y  += pt.vy
      pt.vx += (p.noise(pt.x * 0.01, pt.y * 0.01, p.frameCount * 0.01) - 0.5) * 0.3
      pt.life -= speed * 5
      const alpha = (pt.life / pt.maxLife) * 40
      const r = pt.r * (1 + (1 - pt.life / pt.maxLife) * 2)
      p.fill(pt.hue, 20, 95, alpha)
      p.ellipse(pt.x, pt.y, r, r)
    }
  }
}

export const smokeParticlesMode: ModeDefinition = {
  id: 'smoke-particles',
  name: 'Smoke',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #080808 0%, #151515 100%)',
    accentColor: 'rgba(200,200,200,0.6)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',   type: 'slider', min: 0.01, max: 0.2,   step: 0.01, default: 0.05 },
    { key: 'taxaEmissao', label: 'Emissão',      type: 'slider', min: 1,    max: 50,    step: 1,    default: 10 },
    { key: 'lifespan',    label: 'Duração',      type: 'slider', min: 30,   max: 300,   step: 10,   default: 120 },
    { key: 'dispersao',   label: 'Dispersão',    type: 'slider', min: 1,    max: 100,   step: 1,    default: 30 },
    { key: 'ventoX',      label: 'Vento X',      type: 'slider', min: -2,   max: 2,     step: 0.1,  default: 0 },
    { key: 'ventoY',      label: 'Vento Y',      type: 'slider', min: -2,   max: 2,     step: 0.1,  default: 0 },
    { key: 'hue',         label: 'Cor',          type: 'hue',    min: 0,    max: 360,   step: 1,    default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — smoke rising from bottom center. Adjust Vento X to drift sideways.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/smoke-particles.ts lib/modes/index.ts
git commit -m "feat: add Smoke Particles generative mode"
```

---

## Task 18: Game of Life mode

**Files:**
- Create: `lib/modes/generative/game-of-life.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/game-of-life.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let grid: boolean[][] = []
  let cols = 0, rows = 0
  let lastCell = 0, lastSeed = 0
  let fAccum = 0

  function init(cs: number) {
    cols = Math.floor(p.width / cs)
    rows = Math.floor(p.height / cs)
    grid = Array.from({ length: cols }, () =>
      Array.from({ length: rows }, () => p.random() < 0.3)
    )
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.noStroke()
    p.colorMode(p.HSB, 360, 100, 100, 100)
    lastCell = 4
    init(4)
  }

  p.draw = () => {
    const { fps = 10, tamanhoCelula = 4, hue = 120, seedTrigger = 0 } = getParams()
    const cs = Math.max(2, Math.round(tamanhoCelula))

    if (seedTrigger !== lastSeed) { lastSeed = seedTrigger; init(cs); lastCell = cs }
    if (cs !== lastCell) { lastCell = cs; init(cs) }

    fAccum += fps / 60
    if (fAccum < 1) return
    fAccum = 0

    const next = grid.map((col, i) => col.map((_, j) => {
      let alive = 0
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue
          if (grid[(i + di + cols) % cols][(j + dj + rows) % rows]) alive++
        }
      return grid[i][j] ? alive === 2 || alive === 3 : alive === 3
    }))
    grid = next

    p.background(0, 0, 8)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        if (grid[i][j]) {
          p.fill(hue, 70, 90)
          p.rect(i * cs, j * cs, cs - 1, cs - 1)
        }
  }
}

export const gameOfLifeMode: ModeDefinition = {
  id: 'game-of-life',
  name: 'Game of Life',
  tab: 'generative',
  thumbnail: {
    bg: '#050a05',
    accentColor: 'rgba(60,220,60,0.9)',
  },
  params: [
    { key: 'fps',           label: 'Velocidade (fps)', type: 'slider', min: 1,  max: 30,  step: 1, default: 10 },
    { key: 'tamanhoCelula', label: 'Tamanho célula',   type: 'slider', min: 2,  max: 20,  step: 1, default: 4 },
    { key: 'hue',           label: 'Cor',              type: 'hue',    min: 0,  max: 360, step: 1, default: 120 },
    { key: 'seedTrigger',   label: 'Novo seed',        type: 'button',                             default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — confirm GoL grid animates. Click "Novo seed" — grid resets with new random state.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/game-of-life.ts lib/modes/index.ts
git commit -m "feat: add Game of Life generative mode"
```

---

## Task 19: Lissajous mode

**Files:**
- Create: `lib/modes/generative/lissajous.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/lissajous.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.02, hue = 200, freqX = 3, freqY = 2, fase = 0, decay = 0.98, espessura = 1.5 } = getParams()
    const t = p.frameCount * speed * 0.03
    const cx = p.width / 2, cy = p.height / 2
    const r = Math.min(p.width, p.height) * 0.42

    p.noStroke()
    p.fill(0, 0, 0, (1 - decay) * 100)
    p.rect(0, 0, p.width, p.height)

    p.noFill()
    p.strokeWeight(espessura)
    const steps = 600
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2
      const x = cx + r * Math.sin(freqX * theta + fase + t)
      const y = cy + r * Math.sin(freqY * theta)
      p.stroke((hue + (i / steps) * 120) % 360, 80, 90, 80)
      p.point(x, y)
    }
  }
}

export const lissajousMode: ModeDefinition = {
  id: 'lissajous',
  name: 'Lissajous',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #0a0510 0%, #05000f 100%)',
    accentColor: 'rgba(100,100,255,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.1,  step: 0.005, default: 0.02 },
    { key: 'freqX',     label: 'Freq X',     type: 'slider', min: 1,     max: 10,   step: 1,     default: 3 },
    { key: 'freqY',     label: 'Freq Y',     type: 'slider', min: 1,     max: 10,   step: 1,     default: 2 },
    { key: 'fase',      label: 'Fase',       type: 'slider', min: 0,     max: 6.28, step: 0.05,  default: 0 },
    { key: 'decay',     label: 'Rastro',     type: 'slider', min: 0.95,  max: 0.999,step: 0.001, default: 0.98 },
    { key: 'espessura', label: 'Espessura',  type: 'slider', min: 0.5,   max: 4,    step: 0.5,   default: 1.5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 200 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — confirm Lissajous figure. Change Freq X and Y — confirm shape changes.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/lissajous.ts lib/modes/index.ts
git commit -m "feat: add Lissajous generative mode"
```

---

## Task 20: Reaction Diffusion mode

**Files:**
- Create: `lib/modes/generative/reaction-diffusion.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/reaction-diffusion.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let gridA: Float32Array, gridB: Float32Array
  let nextA: Float32Array, nextB: Float32Array
  let gw: number, gh: number

  function initGrid() {
    gw = Math.floor(p.width  / 2)
    gh = Math.floor(p.height / 2)
    gridA = new Float32Array(gw * gh).fill(1)
    gridB = new Float32Array(gw * gh)
    nextA = new Float32Array(gw * gh)
    nextB = new Float32Array(gw * gh)
    const cx = Math.floor(gw / 2), cy = Math.floor(gh / 2)
    for (let dx = -6; dx <= 6; dx++)
      for (let dy = -6; dy <= 6; dy++) {
        const idx = (cy + dy) * gw + (cx + dx)
        if (idx >= 0 && idx < gw * gh) gridB[idx] = 1
      }
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.pixelDensity(1)
    initGrid()
  }

  p.draw = () => {
    const { feed = 0.055, kill = 0.062, difusaoA = 1.0, difusaoB = 0.5, stepsFrame = 3, hue = 120 } = getParams()
    const steps = Math.round(stepsFrame)
    const hr = (hue * Math.PI) / 180

    for (let s = 0; s < steps; s++) {
      for (let y2 = 1; y2 < gh - 1; y2++) {
        for (let x2 = 1; x2 < gw - 1; x2++) {
          const i  = y2 * gw + x2
          const a  = gridA[i], b = gridB[i]
          const la = gridA[i-1] + gridA[i+1] + gridA[i-gw] + gridA[i+gw] - 4 * a
          const lb = gridB[i-1] + gridB[i+1] + gridB[i-gw] + gridB[i+gw] - 4 * b
          const abb = a * b * b
          nextA[i] = Math.max(0, Math.min(1, a + difusaoA * la - abb + feed * (1 - a)))
          nextB[i] = Math.max(0, Math.min(1, b + difusaoB * lb + abb - (kill + feed) * b))
        }
      }
      ;[gridA, nextA] = [nextA, gridA];
      [gridB, nextB] = [nextB, gridB]
    }

    p.loadPixels()
    const pd = p.pixels, pw = p.width, ph = p.height
    for (let y2 = 0; y2 < ph; y2++) {
      for (let x2 = 0; x2 < pw; x2++) {
        const gx  = Math.floor(x2 * gw / pw), gy = Math.floor(y2 * gh / ph)
        const val = Math.max(0, Math.min(1, gridA[gy * gw + gx] - gridB[gy * gw + gx]))
        const idx = (y2 * pw + x2) * 4
        pd[idx]   = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr))          * 255 * val)
        pd[idx+1] = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr + 2.094)) * 255 * val)
        pd[idx+2] = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr + 4.189)) * 255 * val)
        pd[idx+3] = 255
      }
    }
    p.updatePixels()
  }
}

export const reactionDiffusionMode: ModeDefinition = {
  id: 'reaction-diffusion',
  name: 'Reaction Diff',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 30% 40%, #0a1a08 0%, #030803 70%)',
    accentColor: 'rgba(80,200,80,0.8)',
  },
  params: [
    { key: 'feed',       label: 'Feed',      type: 'slider', min: 0.01,  max: 0.1,   step: 0.001, default: 0.055 },
    { key: 'kill',       label: 'Kill',      type: 'slider', min: 0.04,  max: 0.07,  step: 0.001, default: 0.062 },
    { key: 'difusaoA',   label: 'Difusão A', type: 'slider', min: 0.5,   max: 1.5,   step: 0.05,  default: 1.0 },
    { key: 'difusaoB',   label: 'Difusão B', type: 'slider', min: 0.1,   max: 0.5,   step: 0.05,  default: 0.5 },
    { key: 'stepsFrame', label: 'Steps',     type: 'slider', min: 1,     max: 10,    step: 1,     default: 3 },
    { key: 'hue',        label: 'Cor',       type: 'hue',    min: 0,     max: 360,   step: 1,     default: 120 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — organic growing patterns should emerge from center over ~5–10 seconds. Adjust feed/kill to change pattern type.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/reaction-diffusion.ts lib/modes/index.ts
git commit -m "feat: add Reaction Diffusion (Gray-Scott) generative mode"
```

---

## Task 21: Truchet Tiles mode

**Files:**
- Create: `lib/modes/generative/truchet-tiles.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create the mode**

```ts
// lib/modes/generative/truchet-tiles.ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let tiles: boolean[][] = []
  let lastTs = 0, lastTrigger = 0

  function gen(ts: number) {
    const c = Math.ceil(p.width  / ts) + 1
    const r = Math.ceil(p.height / ts) + 1
    tiles = Array.from({ length: c }, () => Array.from({ length: r }, () => p.random() < 0.5))
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    lastTs = 40
    gen(40)
  }

  p.draw = () => {
    const { tileSize = 40, espessura = 2, hue = 0, animar = 0, regenTrigger = 0 } = getParams()
    const ts = Math.max(10, Math.round(tileSize))

    if (regenTrigger !== lastTrigger) { lastTrigger = regenTrigger; gen(ts) }
    if (ts !== lastTs) { lastTs = ts; gen(ts) }

    p.background(0, 0, 5)
    p.noFill()
    p.strokeWeight(espessura)

    const t = p.frameCount * 0.008
    for (let i = 0; i < tiles.length; i++) {
      for (let j = 0; j < (tiles[i]?.length ?? 0); j++) {
        const hShift = animar > 0.5 ? (Math.sin(t + i * 0.4 + j * 0.6) * 30) : 0
        p.stroke((hue + hShift + 360) % 360, 70, 90)
        p.push()
        p.translate(i * ts, j * ts)
        if (tiles[i][j]) {
          p.arc(0,  0,  ts * 2, ts * 2, 0,         p.HALF_PI)
          p.arc(ts, ts, ts * 2, ts * 2, p.PI,       p.PI + p.HALF_PI)
        } else {
          p.arc(ts, 0,  ts * 2, ts * 2, p.HALF_PI,  p.PI)
          p.arc(0,  ts, ts * 2, ts * 2, -p.HALF_PI, 0)
        }
        p.pop()
      }
    }
  }
}

export const truchetTilesMode: ModeDefinition = {
  id: 'truchet-tiles',
  name: 'Truchet',
  tab: 'generative',
  thumbnail: {
    bg: '#050505',
    accentColor: 'rgba(200,160,80,0.8)',
  },
  params: [
    { key: 'tileSize',     label: 'Tamanho tile', type: 'slider', min: 10,  max: 80,  step: 5,   default: 40 },
    { key: 'espessura',    label: 'Espessura',    type: 'slider', min: 0.5, max: 5,   step: 0.5, default: 2 },
    { key: 'animar',       label: 'Animar cor',   type: 'slider', min: 0,   max: 1,   step: 1,   default: 0 },
    { key: 'hue',          label: 'Cor',          type: 'hue',    min: 0,   max: 360, step: 1,   default: 0 },
    { key: 'regenTrigger', label: 'Regenerar',    type: 'button',                               default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}
```

- [ ] **Step 2: Add to `lib/modes/index.ts`**.

- [ ] **Step 3: Visual verification** — arc tile pattern fills screen. Click "Regenerar" to get new random layout. Toggle "Animar cor" to see color cycling.

- [ ] **Step 4: Commit**

```bash
git add lib/modes/generative/truchet-tiles.ts lib/modes/index.ts
git commit -m "feat: add Truchet Tiles generative mode"
```

---

## Task 22: Shader as Texture mode

**Files:**
- Create: `lib/renderers/shader-texture-adapter.ts`
- Create: `lib/modes/generative/shader-as-texture.ts`
- Modify: `lib/modes/index.ts`

- [ ] **Step 1: Create `lib/renderers/shader-texture-adapter.ts`**

```ts
import * as THREE from 'three'
import type { RendererAdapter } from './adapter'
import { SHADERS } from '@/lib/shaders'

const VERT = `void main() { gl_Position = vec4(position, 1.0); }`

function makeGeometry(shape: number): THREE.BufferGeometry {
  if (shape === 1) return new THREE.BoxGeometry(2, 2, 2)
  if (shape === 2) return new THREE.TorusGeometry(1.2, 0.5, 32, 100)
  return new THREE.SphereGeometry(1.5, 64, 64)
}

export function createShaderTextureAdapter(): RendererAdapter {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let mesh: THREE.Mesh | null = null
  let animId: number | null = null
  let offRenderer: THREE.WebGLRenderer | null = null
  let offScene: THREE.Scene | null = null
  let offCamera: THREE.Camera | null = null
  let offUniforms: any = null
  let rt: THREE.WebGLRenderTarget | null = null
  let currentShape = 0, currentShader = 0
  let rotX = 0.005, rotY = 0.01, speed = 0.05

  return {
    mount(container, params) {
      const w = container.clientWidth  || window.innerWidth
      const h = container.clientHeight || window.innerHeight

      // Offscreen shader → texture
      offRenderer = new THREE.WebGLRenderer()
      offRenderer.setSize(512, 512)
      rt = new THREE.WebGLRenderTarget(512, 512)
      offCamera = new THREE.Camera()
      offScene  = new THREE.Scene()
      offUniforms = {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(512, 512) },
        uLineWidth:  { value: 0.0008 },
        uMosaic:     { value: 4 },
        uLines:      { value: 5 },
        uHue:        { value: 0 },
      }
      const shaderDef = SHADERS[Math.round(params.shaderFonte ?? 0)] ?? SHADERS[0]
      offScene.add(new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms: offUniforms, vertexShader: VERT, fragmentShader: shaderDef.fragmentShader }),
      ))
      currentShader = Math.round(params.shaderFonte ?? 0)

      // Main scene
      camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
      camera.position.z = 5
      scene    = new THREE.Scene()
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const dl = new THREE.DirectionalLight(0xffffff, 1)
      dl.position.set(5, 5, 5)
      scene.add(dl)

      const mat = new THREE.MeshStandardMaterial({ map: rt.texture })
      mesh = new THREE.Mesh(makeGeometry(0), mat)
      scene.add(mesh)

      speed = params.speed ?? 0.05
      rotX  = params.rotX  ?? 0.005
      rotY  = params.rotY  ?? 0.01

      const tick = () => {
        animId = requestAnimationFrame(tick)
        offUniforms.uTime.value += speed
        offRenderer!.setRenderTarget(rt); offRenderer!.render(offScene!, offCamera!); offRenderer!.setRenderTarget(null)
        if (mesh) { mesh.rotation.x += rotX; mesh.rotation.y += rotY }
        renderer!.render(scene!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (params.speed    !== undefined) speed = params.speed
      if (params.rotX     !== undefined) rotX  = params.rotX
      if (params.rotY     !== undefined) rotY  = params.rotY
      if (params.hue      !== undefined && offUniforms) offUniforms.uHue.value = (params.hue * Math.PI) / 180
      if (params.wireframe !== undefined && mesh)
        (mesh.material as THREE.MeshStandardMaterial).wireframe = params.wireframe > 0.5

      const newShape = Math.round(params.forma ?? 0)
      if (newShape !== currentShape && mesh) {
        mesh.geometry.dispose(); mesh.geometry = makeGeometry(newShape); currentShape = newShape
      }

      const newShader = Math.round(params.shaderFonte ?? 0)
      if (newShader !== currentShader && offScene && offUniforms) {
        const def = SHADERS[newShader] ?? SHADERS[0]
        offScene.clear()
        offScene.add(new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({ uniforms: offUniforms, vertexShader: VERT, fragmentShader: def.fragmentShader }),
        ))
        currentShader = newShader
      }
    },

    resize(width, height) {
      if (renderer && camera) {
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    },

    dispose() {
      if (animId) cancelAnimationFrame(animId)
      renderer?.dispose(); renderer?.domElement.remove()
      offRenderer?.dispose(); rt?.dispose()
      renderer = offRenderer = rt = scene = offScene = camera = offCamera = mesh = null; animId = null
    },
  }
}
```

- [ ] **Step 2: Create `lib/modes/generative/shader-as-texture.ts`**

```ts
import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createShaderTextureAdapter } from '@/lib/renderers/shader-texture-adapter'
import { SHADERS } from '@/lib/shaders'

export const shaderAsTextureMode: ModeDefinition = {
  id: 'shader-as-texture',
  name: 'Shader 3D',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 50% 40%, #1a1020 0%, #050308 70%)',
    accentColor: 'rgba(255,160,80,0.8)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',    type: 'slider', min: 0.005, max: 0.2,  step: 0.005, default: 0.05 },
    { key: 'forma',       label: 'Forma',         type: 'select', default: 0, options: ['Esfera', 'Cubo', 'Torus'] },
    { key: 'rotX',        label: 'Rotação X',     type: 'slider', min: 0,     max: 0.05, step: 0.001, default: 0.005 },
    { key: 'rotY',        label: 'Rotação Y',     type: 'slider', min: 0,     max: 0.05, step: 0.001, default: 0.01 },
    { key: 'wireframe',   label: 'Wireframe',     type: 'slider', min: 0,     max: 1,    step: 1,     default: 0 },
    { key: 'shaderFonte', label: 'Shader',        type: 'select', default: 0, options: SHADERS.map(s => s.name) },
    { key: 'hue',         label: 'Cor',           type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createShaderTextureAdapter(),
}
```

- [ ] **Step 3: Final `lib/modes/index.ts`** — add all remaining imports:

```ts
import { linesMode }              from './shaders/lines'
import { wavesMode }              from './shaders/waves'
import { perlinMode }             from './shaders/perlin'
import { fractalMode }            from './shaders/fractal'
import { colorInterpolationMode } from './generative/color-interpolation'
import { kaleidoscopeMode }       from './generative/kaleidoscope'
import { bezierFlowMode }         from './generative/bezier-flow'
import { noiseFieldMode }         from './generative/noise-field'
import { smokeParticlesMode }     from './generative/smoke-particles'
import { gameOfLifeMode }         from './generative/game-of-life'
import { lissajousMode }          from './generative/lissajous'
import { reactionDiffusionMode }  from './generative/reaction-diffusion'
import { truchetTilesMode }       from './generative/truchet-tiles'
import { shaderAsTextureMode }    from './generative/shader-as-texture'
import type { ModeDefinition }    from '@/lib/renderers/adapter'

export const MODES: ModeDefinition[] = [
  linesMode, wavesMode, perlinMode, fractalMode,
  colorInterpolationMode, kaleidoscopeMode, bezierFlowMode, noiseFieldMode,
  smokeParticlesMode, gameOfLifeMode, lissajousMode,
  reactionDiffusionMode, truchetTilesMode, shaderAsTextureMode,
]

export const DEFAULT_MODE_ID = 'lines'
```

- [ ] **Step 4: Visual verification** — open Shader 3D mode. Rotating sphere with Lines shader texture. Switch Forma to Cubo/Torus. Switch Shader source. Toggle Wireframe.

- [ ] **Step 5: Commit**

```bash
git add lib/renderers/shader-texture-adapter.ts lib/modes/generative/shader-as-texture.ts lib/modes/index.ts
git commit -m "feat: add Shader as Texture mode (ShaderTextureAdapter with 3D mesh)"
```

---

## Task 23: Final cleanup + run tests

- [ ] **Step 1: Delete obsolete imports in shader-lines.tsx**

`components/ui/shader-lines.tsx` is no longer imported by anyone (CanvasRenderer replaced it). Delete it:

```bash
git rm components/ui/shader-lines.tsx
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```
Expected: all presets tests pass.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4: Final visual smoke test**

Start dev server and verify:
- All 4 GLSL shaders work (Lines, Waves, Perlin, Fractal)
- All 10 generative modes render without console errors
- Per-mode params are remembered when switching modes
- Presets: save, load, delete all work
- Output: custom 1080×1080 shows square letterbox
- Output: custom 9:16 shows portrait letterbox
- Output: Full returns to fullscreen canvas

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete generative expansion — 14 modes, adapter pattern, presets, output size"
```

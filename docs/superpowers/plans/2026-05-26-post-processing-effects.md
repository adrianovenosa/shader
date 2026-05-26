# Post-Processing Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 5 efeitos de pós-processamento (grain, chromatic aberration, CRT, halftone, bloom) aplicados sobre qualquer shader via um segundo passe WebGL, com controles no painel existente.

**Architecture:** O `createThreeAdapter` passa a renderizar o shader num `WebGLRenderTarget` (pass 1), depois aplica efeitos num segundo `ShaderMaterial` que lê a textura do render target (pass 2) e exibe na tela. `EffectState` é gerenciado em `page.tsx` e propagado via `CanvasRenderer → adapter.updateEffects()`.

**Tech Stack:** Three.js (WebGLRenderTarget, ShaderMaterial dual-pass), TypeScript, React, Vitest, GLSL.

---

### Pré-requisito: branch

```bash
git checkout main
git pull
git checkout -b feat/post-processing-effects
```

---

### Task 1: `lib/effects.ts` — tipos e persistência (TDD)

**Files:**
- Create: `lib/effects.ts`
- Create: `__tests__/effects.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `__tests__/effects.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import { loadEffects, saveEffects, DEFAULT_EFFECTS } from '@/lib/effects'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('effects persistence', () => {
  it('returns DEFAULT_EFFECTS when nothing saved', () => {
    const e = loadEffects()
    expect(e.grain.enabled).toBe(false)
    expect(e.grain.intensity).toBe(0.15)
    expect(e.bloom.threshold).toBe(0.6)
  })
  it('round-trips effects', () => {
    const custom = { ...DEFAULT_EFFECTS, grain: { enabled: true, intensity: 0.5 } }
    saveEffects(custom)
    const loaded = loadEffects()
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.grain.intensity).toBe(0.5)
  })
  it('preserves defaults for missing keys', () => {
    localStorage.setItem('shader-app-effects', JSON.stringify({ grain: { enabled: true, intensity: 0.3 } }))
    const loaded = loadEffects()
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.bloom.enabled).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx vitest run __tests__/effects.test.ts
```

Esperado: FAIL — `loadEffects` not found.

- [ ] **Step 3: Criar `lib/effects.ts`**

```ts
type BaseEffect = { enabled: boolean; intensity: number }
type HalftoneEffect = BaseEffect & { dotSize: number }
type BloomEffect    = BaseEffect & { threshold: number }

export interface EffectState {
  grain:    BaseEffect
  chrAber:  BaseEffect
  crt:      BaseEffect
  halftone: HalftoneEffect
  bloom:    BloomEffect
}

export const DEFAULT_EFFECTS: EffectState = {
  grain:    { enabled: false, intensity: 0.15 },
  chrAber:  { enabled: false, intensity: 0.005 },
  crt:      { enabled: false, intensity: 0.6 },
  halftone: { enabled: false, intensity: 1.0, dotSize: 3.0 },
  bloom:    { enabled: false, intensity: 0.4, threshold: 0.6 },
}

const KEY = 'shader-app-effects'

export function loadEffects(): EffectState {
  if (typeof window === 'undefined') return DEFAULT_EFFECTS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_EFFECTS
    const parsed = JSON.parse(raw)
    return {
      grain:    { ...DEFAULT_EFFECTS.grain,    ...parsed.grain },
      chrAber:  { ...DEFAULT_EFFECTS.chrAber,  ...parsed.chrAber },
      crt:      { ...DEFAULT_EFFECTS.crt,      ...parsed.crt },
      halftone: { ...DEFAULT_EFFECTS.halftone, ...parsed.halftone },
      bloom:    { ...DEFAULT_EFFECTS.bloom,    ...parsed.bloom },
    }
  } catch { return DEFAULT_EFFECTS }
}

export function saveEffects(effects: EffectState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(effects)) } catch {}
}
```

- [ ] **Step 4: Rodar e confirmar passa**

```bash
npx vitest run __tests__/effects.test.ts
```

Esperado: PASS — 3 tests.

- [ ] **Step 5: Rodar suite completa**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add lib/effects.ts __tests__/effects.test.ts
git commit -m "feat: add EffectState type and localStorage persistence"
```

---

### Task 2: Atualizar interface `RendererAdapter`

**Files:**
- Modify: `lib/renderers/adapter.ts`

- [ ] **Step 1: Adicionar import de `EffectState` e método opcional**

Abrir `lib/renderers/adapter.ts`. Adicionar import no topo:

```ts
import type { EffectState } from '@/lib/effects'
```

Adicionar `updateEffects?` à interface `RendererAdapter` após `dispose()`:

```ts
export interface RendererAdapter {
  mount(container: HTMLElement, params: Record<string, number>): void
  updateParams(params: Record<string, number>): void
  resize(width: number, height: number): void
  dispose(): void
  updateEffects?(effects: EffectState): void
}
```

O arquivo completo ficará:

```ts
import type { EffectState } from '@/lib/effects'

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
  updateEffects?(effects: EffectState): void
}

export function defaultsFromSchema(params: ParamSchema[]): Record<string, number> {
  return Object.fromEntries(params.map(p => [p.key, p.default]))
}
```

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add lib/renderers/adapter.ts
git commit -m "feat: add optional updateEffects to RendererAdapter interface"
```

---

### Task 3: Dual-pass rendering em `three-adapter.ts`

**Files:**
- Modify: `lib/renderers/three-adapter.ts`

> Sem teste unitário (requer WebGL). Verificação visual.

- [ ] **Step 1: Substituir o conteúdo completo de `lib/renderers/three-adapter.ts`**

```ts
import * as THREE from 'three'
import type { RendererAdapter } from './adapter'
import type { EffectState } from '@/lib/effects'

const VERTEX = `void main() { gl_Position = vec4(position, 1.0); }`

const POST_FRAGMENT = `
precision highp float;
uniform sampler2D uInputTexture;
uniform vec2  uResolution;
uniform float uTime;
uniform float uGrainIntensity;
uniform float uChrAberIntensity;
uniform float uCRTIntensity;
uniform float uHalftoneIntensity;
uniform float uHalftoneDotSize;
uniform float uBloomIntensity;
uniform float uBloomThreshold;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;

  // Chromatic aberration (at sample stage)
  vec3 color;
  if (uChrAberIntensity > 0.0) {
    vec2 offs = (uv - 0.5) * uChrAberIntensity;
    color.r = texture2D(uInputTexture, uv + offs).r;
    color.g = texture2D(uInputTexture, uv).g;
    color.b = texture2D(uInputTexture, uv - offs).b;
  } else {
    color = texture2D(uInputTexture, uv).rgb;
  }

  // Bloom (9-tap cross, single pass)
  if (uBloomIntensity > 0.0) {
    vec3 bloom = vec3(0.0);
    float total = 0.0;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 o = vec2(float(x), float(y)) / uResolution;
        vec3 s = texture2D(uInputTexture, uv + o).rgb;
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        float w = max(0.0, lum - uBloomThreshold);
        bloom += s * w;
        total += w;
      }
    }
    if (total > 0.0) color += (bloom / total) * uBloomIntensity;
  }

  // Halftone
  if (uHalftoneIntensity > 0.0) {
    vec2 cellOrigin = floor(gl_FragCoord.xy / uHalftoneDotSize) * uHalftoneDotSize;
    float lum = dot(texture2D(uInputTexture, cellOrigin / uResolution).rgb,
                    vec3(0.299, 0.587, 0.114));
    vec2 p = (mod(gl_FragCoord.xy, uHalftoneDotSize) / uHalftoneDotSize) - 0.5;
    float dot_ = step(length(p), sqrt(lum) * 0.5);
    color = mix(color, vec3(dot_), uHalftoneIntensity);
  }

  // Grain
  if (uGrainIntensity > 0.0) {
    float g = fract(sin(dot(uv + fract(uTime * 0.01),
                             vec2(12.9898, 78.233))) * 43758.5453);
    color += (g * 2.0 - 1.0) * uGrainIntensity;
  }

  // CRT: scanlines + vignette
  if (uCRTIntensity > 0.0) {
    float scan = sin(gl_FragCoord.y * 3.14159265) * 0.5 + 0.5;
    scan = mix(1.0, scan, uCRTIntensity * 0.35);
    vec2 vig = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vig, vig) * uCRTIntensity * 0.28;
    color *= scan * vignette;
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

type MainUniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
  uExpandX:    { value: number }
}

type PostUniforms = {
  uInputTexture:     { value: THREE.Texture | null }
  uResolution:       { value: THREE.Vector2 }
  uTime:             { value: number }
  uGrainIntensity:   { value: number }
  uChrAberIntensity: { value: number }
  uCRTIntensity:     { value: number }
  uHalftoneIntensity:{ value: number }
  uHalftoneDotSize:  { value: number }
  uBloomIntensity:   { value: number }
  uBloomThreshold:   { value: number }
}

export function createThreeAdapter(fragmentShader: string): RendererAdapter {
  let renderer:     THREE.WebGLRenderer | null = null
  let camera:       THREE.Camera | null = null
  let renderTarget: THREE.WebGLRenderTarget | null = null

  // Pass 1 — main shader
  let scene1:    THREE.Scene | null = null
  let uniforms1: MainUniforms | null = null
  let geo1:      THREE.PlaneGeometry | null = null
  let mat1:      THREE.ShaderMaterial | null = null

  // Pass 2 — post-processing
  let scene2:      THREE.Scene | null = null
  let postUniforms: PostUniforms | null = null
  let geo2:        THREE.PlaneGeometry | null = null
  let mat2:        THREE.ShaderMaterial | null = null

  let animId: number | null = null
  let speed = 0.05

  return {
    mount(container, params) {
      if (renderer) return

      camera = new THREE.Camera()
      camera.position.z = 1

      const w = container.clientWidth  || window.innerWidth
      const h = container.clientHeight || window.innerHeight

      renderTarget = new THREE.WebGLRenderTarget(w, h)

      // --- Pass 1 ---
      scene1 = new THREE.Scene()
      uniforms1 = {
        uTime:       { value: 1.0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uLineWidth:  { value: params.lineWidth ?? 0.0008 },
        uMosaic:     { value: params.mosaic    ?? 4.0 },
        uLines:      { value: params.lines     ?? 5 },
        uHue:        { value: ((params.hue ?? 0) * Math.PI) / 180 },
        uExpandX:    { value: params.expandX   ?? 1.0 },
      }
      speed = params.speed ?? 0.05
      geo1 = new THREE.PlaneGeometry(2, 2)
      mat1 = new THREE.ShaderMaterial({ uniforms: uniforms1, vertexShader: VERTEX, fragmentShader })
      scene1.add(new THREE.Mesh(geo1, mat1))

      // --- Pass 2 ---
      scene2 = new THREE.Scene()
      postUniforms = {
        uInputTexture:     { value: renderTarget.texture },
        uResolution:       { value: new THREE.Vector2(w, h) },
        uTime:             { value: 1.0 },
        uGrainIntensity:   { value: 0 },
        uChrAberIntensity: { value: 0 },
        uCRTIntensity:     { value: 0 },
        uHalftoneIntensity:{ value: 0 },
        uHalftoneDotSize:  { value: 3.0 },
        uBloomIntensity:   { value: 0 },
        uBloomThreshold:   { value: 0.6 },
      }
      geo2 = new THREE.PlaneGeometry(2, 2)
      mat2 = new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: VERTEX, fragmentShader: POST_FRAGMENT })
      scene2.add(new THREE.Mesh(geo2, mat2))

      renderer = new THREE.WebGLRenderer()
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(w, h)
      container.appendChild(renderer.domElement)

      const tick = () => {
        animId = requestAnimationFrame(tick)
        uniforms1!.uTime.value += speed
        postUniforms!.uTime.value = uniforms1!.uTime.value
        renderer!.setRenderTarget(renderTarget)
        renderer!.render(scene1!, camera!)
        renderer!.setRenderTarget(null)
        renderer!.render(scene2!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (!uniforms1) return
      if (params.speed     !== undefined) speed = params.speed
      if (params.lineWidth !== undefined) uniforms1.uLineWidth.value = params.lineWidth
      if (params.mosaic    !== undefined) uniforms1.uMosaic.value    = params.mosaic
      if (params.lines     !== undefined) uniforms1.uLines.value     = params.lines
      if (params.hue       !== undefined) uniforms1.uHue.value       = (params.hue * Math.PI) / 180
      if (params.expandX   !== undefined) uniforms1.uExpandX.value   = params.expandX
    },

    updateEffects(effects: EffectState) {
      if (!postUniforms) return
      postUniforms.uGrainIntensity.value    = effects.grain.enabled    ? effects.grain.intensity    : 0
      postUniforms.uChrAberIntensity.value  = effects.chrAber.enabled  ? effects.chrAber.intensity  : 0
      postUniforms.uCRTIntensity.value      = effects.crt.enabled      ? effects.crt.intensity      : 0
      postUniforms.uHalftoneIntensity.value = effects.halftone.enabled ? effects.halftone.intensity : 0
      postUniforms.uHalftoneDotSize.value   = effects.halftone.dotSize
      postUniforms.uBloomIntensity.value    = effects.bloom.enabled    ? effects.bloom.intensity    : 0
      postUniforms.uBloomThreshold.value    = effects.bloom.threshold
    },

    resize(width, height) {
      if (!renderer || !uniforms1 || !postUniforms || !renderTarget) return
      renderer.setSize(width, height)
      renderTarget.setSize(
        renderer.domElement.width,
        renderer.domElement.height
      )
      uniforms1.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      )
      postUniforms.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      )
    },

    dispose() {
      if (animId !== null) cancelAnimationFrame(animId)
      geo1?.dispose(); mat1?.dispose()
      geo2?.dispose(); mat2?.dispose()
      renderTarget?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
      renderer = null; camera = null; renderTarget = null
      scene1 = null; uniforms1 = null; geo1 = null; mat1 = null
      scene2 = null; postUniforms = null; geo2 = null; mat2 = null
      animId = null
    },
  }
}
```

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add lib/renderers/three-adapter.ts
git commit -m "feat: add dual-pass post-processing pipeline to three-adapter"
```

---

### Task 4: Componente `EffectsControls`

**Files:**
- Create: `components/ui/effects-controls.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
'use client'

import type { EffectState } from '@/lib/effects'

interface Props {
  effects: EffectState
  onChange: (effects: EffectState) => void
}

type EffectKey = keyof EffectState

const EFFECT_LABELS: Record<EffectKey, string> = {
  grain:    'Grain',
  chrAber:  'Chromatic Ab.',
  crt:      'CRT',
  halftone: 'Halftone',
  bloom:    'Bloom',
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative w-7 h-4 rounded-full transition-colors shrink-0',
        on ? 'bg-blue-500' : 'bg-white/15',
      ].join(' ')}
    >
      <span className={[
        'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
        on ? 'translate-x-3.5' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

function IntensitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range" min={0} max={1} step={0.01} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
    />
  )
}

export function EffectsControls({ effects, onChange }: Props) {
  const update = (key: EffectKey, patch: object) =>
    onChange({ ...effects, [key]: { ...effects[key], ...patch } })

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Efeitos</p>

      {(Object.keys(EFFECT_LABELS) as EffectKey[]).map(key => {
        const effect = effects[key]
        return (
          <div key={key} className="flex flex-col gap-1.5">
            {/* Row: toggle + label + intensity value */}
            <div className="flex items-center gap-2">
              <Toggle
                on={effect.enabled}
                onToggle={() => update(key, { enabled: !effect.enabled })}
              />
              <span className="text-[11px] text-white/70 flex-1">{EFFECT_LABELS[key]}</span>
              {effect.enabled && (
                <span className="text-[11px] text-white/30">
                  {effect.intensity.toFixed(2)}
                </span>
              )}
            </div>

            {/* Intensity slider */}
            {effect.enabled && (
              <IntensitySlider
                value={effect.intensity}
                onChange={v => update(key, { intensity: v })}
              />
            )}

            {/* Halftone extras */}
            {effect.enabled && key === 'halftone' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/50">Dot size</span>
                  <span className="text-white/30">{effects.halftone.dotSize.toFixed(1)}</span>
                </div>
                <input
                  type="range" min={1} max={8} step={0.5}
                  value={effects.halftone.dotSize}
                  onChange={e => onChange({ ...effects, halftone: { ...effects.halftone, dotSize: parseFloat(e.target.value) } })}
                  className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                />
              </div>
            )}

            {/* Bloom extras */}
            {effect.enabled && key === 'bloom' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/50">Threshold</span>
                  <span className="text-white/30">{effects.bloom.threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={effects.bloom.threshold}
                  onChange={e => onChange({ ...effects, bloom: { ...effects.bloom, threshold: parseFloat(e.target.value) } })}
                  className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add components/ui/effects-controls.tsx
git commit -m "feat: add EffectsControls panel component"
```

---

### Task 5: Propagar efeitos via `CanvasRenderer`

**Files:**
- Modify: `components/ui/canvas-renderer.tsx`

- [ ] **Step 1: Adicionar prop `effects` e chamar `updateEffects`**

Substituir o conteúdo de `components/ui/canvas-renderer.tsx` por:

```tsx
'use client'

import { useEffect, useRef } from 'react'
import type { RendererAdapter } from '@/lib/renderers/adapter'
import type { EffectState } from '@/lib/effects'
import { MODES } from '@/lib/modes'

interface Props {
  modeId:  string
  params:  Record<string, number>
  effects: EffectState
}

export function CanvasRenderer({ modeId, params, effects }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef   = useRef<RendererAdapter | null>(null)
  const paramsRef    = useRef(params)
  const effectsRef   = useRef(effects)

  // Push param updates to live adapter
  useEffect(() => {
    paramsRef.current = params
    adapterRef.current?.updateParams(params)
  }, [params])

  // Push effect updates to live adapter
  useEffect(() => {
    effectsRef.current = effects
    adapterRef.current?.updateEffects?.(effects)
  }, [effects])

  // Swap adapter when mode changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    adapterRef.current?.dispose()
    container.innerHTML = ''

    const mode = MODES.find(m => m.id === modeId) ?? MODES[0]
    const adapter = mode.createAdapter()
    adapter.mount(container, paramsRef.current)
    adapter.updateEffects?.(effectsRef.current)
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

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add components/ui/canvas-renderer.tsx
git commit -m "feat: propagate effects to adapter via CanvasRenderer"
```

---

### Task 6: Wiring em `page.tsx` e `shader-controls.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Atualizar `app/page.tsx`**

Adicionar imports no topo (após os imports existentes):

```ts
import { loadEffects, saveEffects, DEFAULT_EFFECTS, type EffectState } from '@/lib/effects'
```

Adicionar estado `effects` (após o estado `presets`):

```ts
const [effects, setEffects] = useState<EffectState>(DEFAULT_EFFECTS)
```

Adicionar `setEffects(loadEffects())` no `useEffect` de mount existente, **fora** do bloco `if (modeId)`, logo após o bloco (efeitos são globais, não dependem do modo ativo):

```ts
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
  // Fora do if(modeId): efeitos são globais
  setEffects(loadEffects())
}, [])
```

Adicionar handler de mudança de efeitos (após `handleOutputChange`):

```ts
const handleEffectsChange = useCallback((e: EffectState) => {
  setEffects(e)
  saveEffects(e)
}, [])
```

Passar `effects` ao `CanvasRenderer`:

```tsx
<CanvasRenderer modeId={activeModeId} params={params} effects={effects} />
```

Passar `effects` e `onEffectsChange` ao `ShaderControls`:

```tsx
<ShaderControls
  {/* ...props existentes... */}
  effects={effects}
  onEffectsChange={handleEffectsChange}
/>
```

- [ ] **Step 2: Atualizar `components/ui/shader-controls.tsx`**

Adicionar props `effects` e `onEffectsChange` à interface `Props`:

```ts
effects: EffectState
onEffectsChange: (e: EffectState) => void
```

Adicionar import:

```ts
import { type EffectState } from '@/lib/effects'
import { EffectsControls } from '@/components/ui/effects-controls'
```

Adicionar `effects` e `onEffectsChange` à desestruturação de props.

Dentro do JSX, após o `</div>` que fecha a seção de dynamic controls e antes da seção de presets (após o `<div className="h-px bg-white/10" />`), adicionar:

```tsx
<EffectsControls effects={effects} onChange={onEffectsChange} />

<div className="h-px bg-white/10" />
```

- [ ] **Step 3: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/ui/shader-controls.tsx
git commit -m "feat: wire effects state through page and shader controls"
```

---

### Task 7: Verificação visual

- [ ] Iniciar o app

```bash
npm install && npm run dev
```

- [ ] Abrir http://localhost:3000, selecionar modo Lines ou Waves e verificar:
  - Seção "Efeitos" aparece no painel abaixo dos params do shader
  - Ligar **Grain**: textura de filme visível sobre o shader
  - Ligar **Chromatic Ab.**: bordas com separação de canal RGB
  - Ligar **CRT**: scanlines horizontais + vignette radial
  - Ligar **Halftone**: padrão pontilhado tipo impressão
  - Ligar **Bloom**: áreas brilhantes com brilho vazante
  - Halftone com Dot size variando de 1 a 8 muda o tamanho dos pontos
  - Bloom com Threshold variando de 0 a 1 muda quais áreas recebem bloom
  - Trocar de modo (Lines → Waves) mantém os efeitos ativos
  - Recarregar a página restaura os efeitos do localStorage

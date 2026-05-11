# Multi-Shader + Three.js Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Three.js from CDN to npm, add a centralized shader registry with 4 shaders (Lines, Waves, Perlin, Fractal), expose a thumbnail grid selector in the controls panel, and add gear auto-hide + H-key toggle.

**Architecture:** `lib/shaders.ts` holds all GLSL definitions; `ShaderAnimation` initializes Three.js synchronously (no CDN script), swaps materials via `useEffect([shaderId])`; `ShaderControls` adds a thumbnail grid at the top and manages gear visibility with a 3s idle timer + keyboard listener.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Three.js (npm), GLSL ES 1.00

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `three` + `@types/three` |
| `lib/shaders.ts` | Create | Shader registry — 4 complete GLSL definitions + thumbnail metadata |
| `components/ui/shader-lines.tsx` | Modify | Remove CDN, synchronous Three.js init, `shaderId` prop, material-swap effect |
| `components/ui/shader-controls.tsx` | Modify | Thumbnail grid, auto-hide gear (3s timer), H-key toggle |
| `app/page.tsx` | Modify | Add `shaderId` state, pass to both components |

---

## Task 1: Install Three.js npm package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install three
npm install --save-dev @types/three
```

Expected output: `added N packages` with no errors.

- [ ] **Step 2: Verify TypeScript can find types**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no "Cannot find module 'three'" errors (there will be other errors from shader-lines.tsx until Task 3 — that's fine).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add three + @types/three npm packages"
```

---

## Task 2: Create shader registry `lib/shaders.ts`

**Files:**
- Create: `lib/shaders.ts`

All four fragment shaders are self-contained (each includes precision, uniforms, helpers, and `main`). The shared preamble is copied into each string — nothing is prepended at runtime.

- [ ] **Step 1: Create the file**

Create `lib/shaders.ts`:

```ts
export interface ShaderThumbnail {
  bg: string
  accentColor: string
}

export interface ShaderDefinition {
  id: string
  name: string
  fragmentShader: string
  thumbnail: ShaderThumbnail
}

// ─── Shared GLSL helpers (copied into each shader) ───────────────────────────

const PREAMBLE = `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uLineWidth;
uniform float uMosaic;
uniform float uLines;
uniform float uHue;

vec3 hueShift(vec3 color, float angle) {
  const vec3 k = vec3(0.57735);
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}
`

// ─── Lines ────────────────────────────────────────────────────────────────────

const linesFragment = PREAMBLE + `
float random(in float x) {
  return fract(sin(x) * 1e4);
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

  float gridX = 256.0 / uMosaic;
  float gridY = 256.0 / (uMosaic * 0.5);
  uv.x = floor(uv.x * gridX) / gridX;
  uv.y = floor(uv.y * gridY) / gridY;

  float t = uTime * 0.06 + random(uv.x) * 0.4;

  vec3 color = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uLines) break;
      color[j] += uLineWidth * float(i * i)
        / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
    }
  }

  vec3 rgb = hueShift(vec3(color[2], color[1], color[0]), uHue);
  gl_FragColor = vec4(rgb, 1.0);
}
`

// ─── Waves ────────────────────────────────────────────────────────────────────

const wavesFragment = PREAMBLE + `
void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

  float gridX = 256.0 / uMosaic;
  float gridY = 256.0 / (uMosaic * 0.5);
  uv.x = floor(uv.x * gridX) / gridX;
  uv.y = floor(uv.y * gridY) / gridY;

  vec3 color = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uLines) break;
      float wave = sin(uv.x * 3.0 + uTime * 0.04 + float(i) * 0.6 + float(j) * 1.05) * 0.3;
      float dist = abs(uv.y - wave);
      color[j] += uLineWidth * float(i + 1) / (dist + 0.001);
    }
  }

  gl_FragColor = vec4(hueShift(color, uHue), 1.0);
}
`

// ─── Perlin (fBm value noise) ─────────────────────────────────────────────────

const perlinFragment = PREAMBLE + `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv *= uMosaic * 0.5;

  float v = 0.0;
  float amplitude = 0.5;
  vec2 p = uv + vec2(uTime * 0.02, uTime * 0.014);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= uLines) break;
    v += amplitude * vnoise(p);
    p = p * 2.0 + vec2(7.3, 3.1);
    amplitude *= 0.5;
  }

  vec3 color = hueShift(vec3(v * uLineWidth * 1200.0), uHue);
  gl_FragColor = vec4(color, 1.0);
}
`

// ─── Fractal (animated Julia set) ────────────────────────────────────────────

const fractalFragment = PREAMBLE + `
void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv = uv * (2.5 / uMosaic);

  float speed = uTime * 0.02;
  vec2 c = vec2(sin(speed) * 0.4, cos(speed * 0.73) * 0.3);
  vec2 z = uv;
  float iter = 0.0;
  float maxIter = uLines * 8.0;

  for (int i = 0; i < 64; i++) {
    if (float(i) >= maxIter || dot(z, z) > 4.0) {
      iter = float(i);
      break;
    }
    z = vec2(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
  }

  float n = iter / maxIter;
  vec3 color = hueShift(vec3(n) * uLineWidth * 800.0, uHue);
  gl_FragColor = vec4(color, 1.0);
}
`

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SHADERS: ShaderDefinition[] = [
  {
    id: "lines",
    name: "Lines",
    fragmentShader: linesFragment,
    thumbnail: {
      bg: "linear-gradient(160deg, #060d1f 0%, #0d1b3e 100%)",
      accentColor: "rgba(80,160,255,0.9)",
    },
  },
  {
    id: "waves",
    name: "Waves",
    fragmentShader: wavesFragment,
    thumbnail: {
      bg: "linear-gradient(160deg, #080f12 0%, #0a1e14 100%)",
      accentColor: "rgba(60,220,120,0.9)",
    },
  },
  {
    id: "perlin",
    name: "Perlin",
    fragmentShader: perlinFragment,
    thumbnail: {
      bg: "#080608",
      accentColor: "rgba(160,80,255,0.8)",
    },
  },
  {
    id: "fractal",
    name: "Fractal",
    fragmentShader: fractalFragment,
    thumbnail: {
      bg: "radial-gradient(ellipse at 50% 50%, #1a0822 0%, #06020e 70%)",
      accentColor: "rgba(255,100,200,0.7)",
    },
  },
]

export const DEFAULT_SHADER_ID = "lines"
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "lib/shaders"
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add lib/shaders.ts
git commit -m "feat: add shader registry with Lines, Waves, Perlin, Fractal GLSL definitions"
```

---

## Task 3: Refactor ShaderAnimation — remove CDN, add shaderId

**Files:**
- Modify: `components/ui/shader-lines.tsx`

Replaces the async CDN-script pattern with synchronous Three.js import. Splits initialization into two effects: mount (infrastructure) and `[shaderId]` (material swap).

- [ ] **Step 1: Replace the full file**

```tsx
"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { SHADERS, DEFAULT_SHADER_ID } from "@/lib/shaders"

export interface ShaderParams {
  speed: number
  lineWidth: number
  mosaic: number
  lines: number
  hue: number
}

export const defaultParams: ShaderParams = {
  speed: 0.05,
  lineWidth: 0.0008,
  mosaic: 4.0,
  lines: 5,
  hue: 0,
}

interface ShaderAnimationProps {
  params: ShaderParams
  shaderId: string
}

const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

type Uniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
}

type SceneState = {
  camera:     THREE.Camera | null
  scene:      THREE.Scene | null
  renderer:   THREE.WebGLRenderer | null
  uniforms:   Uniforms | null
  geometry:   THREE.BufferGeometry | null
  material:   THREE.ShaderMaterial | null
  animationId: number | null
  speed:      number
}

export function ShaderAnimation({ params, shaderId }: ShaderAnimationProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const onResizeRef   = useRef<(() => void) | null>(null)
  const sceneRef      = useRef<SceneState>({
    camera: null, scene: null, renderer: null, uniforms: null,
    geometry: null, material: null, animationId: null,
    speed: defaultParams.speed,
  })

  // ── Mount: infrastructure (camera, scene, renderer, uniforms, loop) ────────
  useEffect(() => {
    if (!containerRef.current || sceneRef.current.renderer) return
    const container = containerRef.current
    container.innerHTML = ""

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene   = new THREE.Scene()

    const uniforms: Uniforms = {
      uTime:       { value: 1.0 },
      uResolution: { value: new THREE.Vector2() },
      uLineWidth:  { value: params.lineWidth },
      uMosaic:     { value: params.mosaic },
      uLines:      { value: params.lines },
      uHue:        { value: (params.hue * Math.PI) / 180 },
    }

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    sceneRef.current = {
      camera, scene, renderer, uniforms,
      geometry: null, material: null,
      animationId: null, speed: params.speed,
    }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.uResolution.value.x = renderer.domElement.width
      uniforms.uResolution.value.y = renderer.domElement.height
    }
    onResizeRef.current = onResize
    onResize()
    window.addEventListener("resize", onResize, false)

    const animate = () => {
      sceneRef.current.animationId = requestAnimationFrame(animate)
      uniforms.uTime.value += sceneRef.current.speed
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (sceneRef.current.animationId) cancelAnimationFrame(sceneRef.current.animationId)
      if (onResizeRef.current) window.removeEventListener("resize", onResizeRef.current)
      sceneRef.current.geometry?.dispose()
      sceneRef.current.material?.dispose()
      renderer.dispose()
    }
  }, [])

  // ── Shader change: swap material only, keep renderer alive ─────────────────
  useEffect(() => {
    const { scene, uniforms } = sceneRef.current
    if (!scene || !uniforms) return

    const def = SHADERS.find(s => s.id === shaderId) ?? SHADERS[0]

    scene.clear()
    sceneRef.current.geometry?.dispose()
    sceneRef.current.material?.dispose()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: def.fragmentShader,
    })
    scene.add(new THREE.Mesh(geometry, material))
    sceneRef.current.geometry = geometry
    sceneRef.current.material = material
  }, [shaderId])

  // ── Params sync: write directly to uniforms, no scene rebuild ──────────────
  useEffect(() => {
    const { uniforms } = sceneRef.current
    if (!uniforms) return
    sceneRef.current.speed     = params.speed
    uniforms.uLineWidth.value  = params.lineWidth
    uniforms.uMosaic.value     = params.mosaic
    uniforms.uLines.value      = params.lines
    uniforms.uHue.value        = (params.hue * Math.PI) / 180
  }, [params])

  return <div ref={containerRef} className="fixed inset-0 w-full h-full" />
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: TypeScript compiles cleanly. `app/page.tsx` will error (missing `shaderId` prop) — that's expected and fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-lines.tsx
git commit -m "feat: migrate ShaderAnimation to npm Three.js, add shaderId prop and material-swap effect"
```

---

## Task 4: Update ShaderControls — thumbnail grid, auto-hide, H key

**Files:**
- Modify: `components/ui/shader-controls.tsx`

Three additions: a thumbnail grid above the sliders, a 3-second idle timer that fades the gear button, and a keydown listener for `H`.

- [ ] **Step 1: Replace the full file**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { SHADERS } from "@/lib/shaders"
import type { ShaderParams } from "./shader-lines"

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
  const fileRef      = useRef<HTMLInputElement>(null)
  const prevUrlRef   = useRef<string | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gearVisible, setGearVisible] = useState(true)

  // ── Auto-hide gear after 3s of mouse inactivity ───────────────────────────
  useEffect(() => {
    const show = () => {
      setGearVisible(true)
      clearTimeout(hideTimerRef.current!)
      hideTimerRef.current = setTimeout(() => setGearVisible(false), 3000)
    }
    show()
    window.addEventListener("mousemove", show)
    return () => {
      window.removeEventListener("mousemove", show)
      clearTimeout(hideTimerRef.current!)
    }
  }, [])

  // ── H key toggles panel ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") onToggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onToggle])

  const set = (key: keyof ShaderParams) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value)
      onChange({ ...params, [key]: key === "lines" ? Math.round(raw) : raw })
    }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    const url = URL.createObjectURL(file)
    prevUrlRef.current = url
    onImageUpload(url)
    e.target.value = ""
  }

  return (
    <div className="fixed top-3 right-3 z-20">
      {/* Gear toggle — fades after 3s idle */}
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className={[
          "w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md",
          "flex items-center justify-center text-white/60 hover:text-white",
          "transition-opacity duration-500 text-base",
          gearVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        ⚙
      </button>

      {/* Panel */}
      <div
        aria-hidden={!open}
        className={[
          "absolute top-11 right-0 w-56",
          "bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4",
          "flex flex-col gap-3",
          "transition-all duration-200 origin-top-right",
          open ? "opacity-100 scale-100 pointer-events-auto"
               : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        {/* ── Shader selector grid ── */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Shader
        </p>

        <div className="grid grid-cols-4 gap-1.5">
          {SHADERS.map(s => (
            <button
              key={s.id}
              onClick={() => onShaderChange(s.id)}
              title={s.name}
              className={[
                "aspect-square rounded-lg overflow-hidden relative border-2 transition-colors",
                shaderId === s.id ? "border-blue-500" : "border-transparent",
              ].join(" ")}
              style={{ background: s.thumbnail.bg }}
            >
              <ShaderThumbnailArt id={s.id} />
              <span className="absolute bottom-0.5 inset-x-0 text-center text-[7px] font-semibold text-white/70 leading-none">
                {s.name}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-white/10" />

        {/* ── Sliders ── */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Controles
        </p>

        <SliderRow
          label="Velocidade" display={params.speed.toFixed(3)}
          min={0.005} max={0.2} step={0.005} value={params.speed}
          onChange={set("speed")}
        />
        <SliderRow
          label="Espessura" display={params.lineWidth.toFixed(4)}
          min={0.0001} max={0.003} step={0.0001} value={params.lineWidth}
          onChange={set("lineWidth")}
        />
        <SliderRow
          label="Pixelação" display={params.mosaic.toFixed(1)}
          min={1} max={16} step={0.5} value={params.mosaic}
          onChange={set("mosaic")}
        />
        <SliderRow
          label="Linhas" display={String(Math.round(params.lines))}
          min={1} max={8} step={1} value={params.lines}
          onChange={set("lines")}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-white/70">Cor</span>
            <span className="text-white/30">{Math.round(params.hue)}°</span>
          </div>
          <input
            type="range" min={0} max={360} step={1} value={params.hue}
            onChange={set("hue")}
            className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
            style={{ background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* ── PNG upload ── */}
        <input
          ref={fileRef} type="file" accept="image/png"
          className="hidden" onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>
      </div>
    </div>
  )
}

// ── Thumbnail art per shader ─────────────────────────────────────────────────

function ShaderThumbnailArt({ id }: { id: string }) {
  if (id === "lines") return (
    <>
      <div className="absolute left-[10%] w-[80%] h-px"
        style={{ top: "38%", background: "rgba(80,160,255,0.9)", boxShadow: "0 0 6px rgba(80,160,255,1),0 0 14px rgba(80,160,255,0.5)" }} />
      <div className="absolute left-[5%] w-[90%] h-px"
        style={{ top: "52%", background: "rgba(50,200,180,0.6)", boxShadow: "0 0 5px rgba(50,200,180,0.8)" }} />
    </>
  )
  if (id === "waves") return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" preserveAspectRatio="none">
      <defs>
        <filter id="wglow">
          <feGaussianBlur stdDeviation="1" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M0 22 Q10 14 20 22 Q30 30 40 22" fill="none" stroke="rgba(60,220,120,0.9)" strokeWidth="1.5" filter="url(#wglow)"/>
      <path d="M0 28 Q10 20 20 28 Q30 36 40 28" fill="none" stroke="rgba(40,180,100,0.5)" strokeWidth="0.8"/>
      <path d="M0 16 Q10 8 20 16 Q30 24 40 16"  fill="none" stroke="rgba(80,255,150,0.4)" strokeWidth="0.6"/>
    </svg>
  )
  if (id === "perlin") return (
    <>
      <div className="absolute rounded-full" style={{ width:28,height:28,top:2,left:2, background:"radial-gradient(circle,rgba(160,80,255,0.45),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:22,height:22,top:10,left:12,background:"radial-gradient(circle,rgba(80,160,255,0.4),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:18,height:18,top:4,left:16, background:"radial-gradient(circle,rgba(255,80,160,0.35),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:14,height:14,top:16,left:4, background:"radial-gradient(circle,rgba(80,255,200,0.3),transparent 70%)" }}/>
    </>
  )
  if (id === "fractal") return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full"
        style={{ border:"1px solid transparent",borderTopColor:"rgba(255,100,200,0.7)",borderRightColor:"rgba(255,100,200,0.3)" }}/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width:18,height:18,border:"1px solid transparent",borderBottomColor:"rgba(200,100,255,0.6)",borderLeftColor:"rgba(200,100,255,0.25)" }}/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ border:"1px solid rgba(255,150,220,0.7)" }}/>
    </>
  )
  return null
}

// ── SliderRow ────────────────────────────────────────────────────────────────

function SliderRow({ label, display, min, max, step, value, onChange }: {
  label: string; display: string
  min: number; max: number; step: number; value: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/30">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={onChange}
        className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
      />
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: compiles cleanly except for the `app/page.tsx` error about missing `shaderId` and `onShaderChange` props — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add shader thumbnail grid, gear auto-hide (3s), H-key toggle to ShaderControls"
```

---

## Task 5: Update app/page.tsx — add shaderId state

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the full file**

```tsx
"use client"

import { useState } from "react"
import { ShaderAnimation, defaultParams, type ShaderParams } from "@/components/ui/shader-lines"
import { ShaderControls } from "@/components/ui/shader-controls"
import { DEFAULT_SHADER_ID } from "@/lib/shaders"

export default function Page() {
  const [params,   setParams]   = useState<ShaderParams>(defaultParams)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [shaderId, setShaderId] = useState(DEFAULT_SHADER_ID)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <ShaderAnimation params={params} shaderId={shaderId} />

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="fixed inset-0 m-auto max-w-[80vw] max-h-[80vh] object-contain pointer-events-none z-10"
        />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        params={params}
        onChange={setParams}
        onImageUpload={setImageUrl}
        shaderId={shaderId}
        onShaderChange={setShaderId}
      />
    </main>
  )
}
```

- [ ] **Step 2: Build — must be clean**

```bash
npm run build
```

Expected: zero TypeScript errors. Route `/` listed.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add shaderId state and wire multi-shader support in page"
```

---

## Task 6: End-to-end verification

**Files:** none — manual + build check

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Shader switching**

Click ⚙ to open the panel. Click each thumbnail in the grid:

| Thumbnail | Expected effect |
|-----------|----------------|
| Lines | Original pixelated glow lines |
| Waves | Sinusoidal waves scrolling horizontally |
| Perlin | Smooth organic noise evolving slowly |
| Fractal | Julia set morphing as `c` orbits |

Active thumbnail has a blue border. Switch happens without flash (renderer stays alive).

- [ ] **Step 3: Sliders affect active shader**

With each shader active, verify all 5 sliders change the visual in real time.

- [ ] **Step 4: Gear auto-hide**

Move mouse, then stop. After 3 seconds the gear button fades out. Move mouse again — gear reappears.

- [ ] **Step 5: H key**

Press H — panel opens. Press H again — panel closes. Works regardless of gear visibility.

- [ ] **Step 6: Final build**

```bash
npm run build
```

Expected: zero errors, clean output.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: multi-shader feature verified and complete"
```

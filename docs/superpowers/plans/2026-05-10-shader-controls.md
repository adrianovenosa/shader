# Shader Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GLSL shader fullscreen and responsive, expose five shader parameters via a floating controls panel, and allow a PNG to be uploaded as a centered overlay.

**Architecture:** `ShaderAnimation` becomes a pure canvas renderer accepting `ShaderParams` props; `ShaderControls` is a self-contained floating panel with sliders and image upload; `app/page.tsx` holds all state and wires the two together with an optional `<img>` overlay.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Three.js r89 (loaded via CDN script tag), WebGL 1.0 / GLSL ES 1.00

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/ui/shader-lines.tsx` | Modify | Canvas renderer — accepts `ShaderParams` props, fullscreen, all uniforms |
| `components/ui/shader-controls.tsx` | Create | Floating gear button + sliding panel, 5 sliders, PNG upload |
| `app/page.tsx` | Modify | State owner: `params`, `imageUrl`, `panelOpen` |

---

## Task 1: Refactor ShaderAnimation — props, fullscreen, new uniforms

**Files:**
- Modify: `components/ui/shader-lines.tsx`

The shader currently hard-codes all parameters. This task extracts them as props and passes them to the GLSL as uniforms. The fragment shader gains a `hueShift` function. The container becomes `fixed inset-0`.

**GLSL notes for WebGL 1.0 / Three.js r89:**
- Loop bounds must be compile-time constants — use `for (int i = 0; i < 8; i++)` and `break` early via a float comparison with the `uLines` uniform.
- `uniform int` can behave inconsistently across drivers; use `uniform float` for all params.
- The mosaic scale keeps the original 2:1 x/y ratio: `mosaicX = mosaic`, `mosaicY = mosaic * 0.5`.

- [ ] **Step 1: Replace the full file content**

Replace `components/ui/shader-lines.tsx` with:

```tsx
"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window { THREE: any }
}

export interface ShaderParams {
  speed: number      // time increment per frame  [0.005 – 0.2]
  lineWidth: number  // glow width uniform        [0.0001 – 0.003]
  mosaic: number     // pixelation grid scale     [1.0 – 16.0]
  lines: number      // number of line layers     [1 – 8]
  hue: number        // hue rotation in degrees   [0 – 360]
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
}

export function ShaderAnimation({ params }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    camera: any
    scene: any
    renderer: any
    uniforms: any
    animationId: number | null
    speed: number
  }>({
    camera: null,
    scene: null,
    renderer: null,
    uniforms: null,
    animationId: null,
    speed: defaultParams.speed,
  })

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js"
    script.onload = () => {
      if (containerRef.current && window.THREE) initThreeJS()
    }
    document.head.appendChild(script)

    return () => {
      if (sceneRef.current.animationId) cancelAnimationFrame(sceneRef.current.animationId)
      if (sceneRef.current.renderer) sceneRef.current.renderer.dispose()
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  // Sync params → uniforms without rebuilding the scene
  useEffect(() => {
    const { uniforms } = sceneRef.current
    if (!uniforms) return
    sceneRef.current.speed = params.speed
    uniforms.uLineWidth.value = params.lineWidth
    uniforms.uMosaic.value = params.mosaic
    uniforms.uLines.value = params.lines
    uniforms.uHue.value = (params.hue * Math.PI) / 180
  }, [params])

  const initThreeJS = () => {
    if (!containerRef.current || !window.THREE) return
    const THREE = window.THREE
    const container = containerRef.current
    container.innerHTML = ""

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneBufferGeometry(2, 2)

    const uniforms = {
      uTime:      { type: "f",  value: 1.0 },
      uResolution:{ type: "v2", value: new THREE.Vector2() },
      uLineWidth: { type: "f",  value: params.lineWidth },
      uMosaic:    { type: "f",  value: params.mosaic },
      uLines:     { type: "f",  value: params.lines },
      uHue:       { type: "f",  value: 0.0 },
    }

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;

      uniform vec2  uResolution;
      uniform float uTime;
      uniform float uLineWidth;
      uniform float uMosaic;
      uniform float uLines;
      uniform float uHue;

      float random(in float x) {
        return fract(sin(x) * 1e4);
      }

      // Rodrigues rotation around (1,1,1) axis — equivalent to hue rotation
      vec3 hueShift(vec3 color, float angle) {
        const vec3 k = vec3(0.57735);
        float c = cos(angle);
        return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
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

        // Original channel order was BGR; keep it, then apply hue shift
        vec3 rgb = hueShift(vec3(color[2], color[1], color[0]), uHue);
        gl_FragColor = vec4(rgb, 1.0);
      }
    `

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    sceneRef.current = { camera, scene, renderer, uniforms, animationId: null, speed: params.speed }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.uResolution.value.x = renderer.domElement.width
      uniforms.uResolution.value.y = renderer.domElement.height
    }
    onResize()
    window.addEventListener("resize", onResize, false)

    const animate = () => {
      sceneRef.current.animationId = requestAnimationFrame(animate)
      uniforms.uTime.value += sceneRef.current.speed
      renderer.render(scene, camera)
    }
    animate()
  }

  return <div ref={containerRef} className="fixed inset-0 w-full h-full" />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors. The page will be broken temporarily (page.tsx still uses old import) — that's fine until Task 3.

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-lines.tsx
git commit -m "feat: refactor ShaderAnimation to accept ShaderParams props, fullscreen, new uniforms"
```

---

## Task 2: Create ShaderControls component

**Files:**
- Create: `components/ui/shader-controls.tsx`

A fixed gear button in the top-right corner toggles a sliding panel. The panel contains five range sliders and a PNG upload zone. All state lives in the parent — this component is purely presentational.

- [ ] **Step 1: Create the file**

Create `components/ui/shader-controls.tsx`:

```tsx
"use client"

import { useRef } from "react"
import type { ShaderParams } from "./shader-lines"

interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
}

export function ShaderControls({
  open,
  onToggle,
  params,
  onChange,
  onImageUpload,
}: ShaderControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof ShaderParams) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...params, [key]: parseFloat(e.target.value) })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    onImageUpload(URL.createObjectURL(file))
  }

  return (
    <div className="fixed top-3 right-3 z-20">
      {/* Gear toggle */}
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className="w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white transition-colors text-base"
      >
        ⚙
      </button>

      {/* Sliding panel */}
      <div
        className={[
          "absolute top-11 right-0 w-56",
          "bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4",
          "flex flex-col gap-3",
          "transition-all duration-200 origin-top-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Controles
        </p>

        <SliderRow
          label="Velocidade"
          display={params.speed.toFixed(3)}
          min={0.005} max={0.2} step={0.005}
          value={params.speed}
          onChange={set("speed")}
        />
        <SliderRow
          label="Espessura"
          display={params.lineWidth.toFixed(4)}
          min={0.0001} max={0.003} step={0.0001}
          value={params.lineWidth}
          onChange={set("lineWidth")}
        />
        <SliderRow
          label="Pixelação"
          display={params.mosaic.toFixed(1)}
          min={1} max={16} step={0.5}
          value={params.mosaic}
          onChange={set("mosaic")}
        />
        <SliderRow
          label="Linhas"
          display={String(Math.round(params.lines))}
          min={1} max={8} step={1}
          value={params.lines}
          onChange={set("lines")}
        />

        {/* Hue — rainbow gradient track */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-white/70">Cor</span>
            <span className="text-white/30">{Math.round(params.hue)}°</span>
          </div>
          <input
            type="range" min={0} max={360} step={1}
            value={params.hue}
            onChange={set("hue")}
            className="w-full h-1 rounded-full cursor-pointer appearance-none"
            style={{
              background:
                "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
            }}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* PNG upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={handleFile}
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

function SliderRow({
  label, display, min, max, step, value, onChange,
}: {
  label: string
  display: string
  min: number
  max: number
  step: number
  value: number
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/30">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={onChange}
        className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build succeeds. (page.tsx still doesn't import ShaderControls yet — that's fine.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add ShaderControls floating panel with sliders and PNG upload"
```

---

## Task 3: Rewrite app/page.tsx as state owner

**Files:**
- Modify: `app/page.tsx`

The page holds all state, renders the three pieces, and conditionally renders the PNG overlay.

- [ ] **Step 1: Replace page.tsx**

```tsx
"use client"

import { useState } from "react"
import { ShaderAnimation, defaultParams, type ShaderParams } from "@/components/ui/shader-lines"
import { ShaderControls } from "@/components/ui/shader-controls"

export default function Page() {
  const [params, setParams] = useState<ShaderParams>(defaultParams)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <ShaderAnimation params={params} />

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="fixed inset-0 m-auto max-w-[80vw] max-h-[80vh] object-contain pointer-events-none z-10"
        />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        params={params}
        onChange={setParams}
        onImageUpload={setImageUrl}
      />
    </main>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: zero TypeScript errors, route `/` listed as static (or dynamic — either is fine).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire ShaderAnimation, ShaderControls, and PNG overlay in page"
```

---

## Task 4: End-to-end browser verification

**Files:** none — manual check only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Fullscreen check**

Shader canvas fills the entire viewport with no scroll bars. Resize the browser window — canvas should resize instantly without blank areas or scroll.

- [ ] **Step 3: Controls panel**

Click the ⚙ button — panel slides in. Click again — panel hides. Each slider adjusts the shader in real time:

| Slider | Visible effect |
|--------|---------------|
| Velocidade | Lines move faster / slower |
| Espessura | Lines thinner / thicker glow |
| Pixelação | Grid coarser / finer (blocky look changes) |
| Linhas | More or fewer overlapping line layers |
| Cor | Rainbow shift across the whole canvas |

- [ ] **Step 4: PNG upload**

Click "Carregar PNG", pick any PNG with transparency. Image appears centered over the shader. Transparent areas of the PNG show the shader behind.

- [ ] **Step 5: Final build check**

```bash
npm run build
```

Expected: zero errors, clean output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: verify shader controls feature complete"
```

# Multi-Shader + Three.js Migration — Design Spec (Rodada 1)

**Date:** 2026-05-10  
**Status:** Approved

---

## Context

The project currently renders a single hard-coded GLSL shader loaded via a CDN `<script>` tag. This spec covers:

1. **Three.js migration** — replace CDN loading with `npm install three @types/three` for proper TypeScript types and tree-shaking
2. **Shader registry** — centralize 4 shader definitions (Lines, Waves, Perlin, Fractal) in `lib/shaders.ts`
3. **Shader selector** — thumbnail grid at the top of the controls panel; active shader marked with blue border
4. **Auto-hide UI** — gear button fades after 3s of mouse inactivity; `H` key toggles the panel at any time

---

## Architecture

```
lib/shaders.ts                   ← NEW: registry of all shader definitions
components/ui/shader-lines.tsx   ← MODIFY: remove CDN, add shaderId prop, material swap
components/ui/shader-controls.tsx← MODIFY: add thumbnail grid, auto-hide, H key
app/page.tsx                     ← MODIFY: add shaderId state
package.json                     ← ADD: three, @types/three
```

**State flow:**
```
page.tsx
├── shaderId: string              → ShaderAnimation (material swap)
│                                 → ShaderControls  (active thumb highlight)
├── params: ShaderParams          → ShaderAnimation (uniform sync)
│                                 → ShaderControls  (sliders)
├── imageUrl: string | null       → <img> overlay
└── panelOpen: boolean            → ShaderControls
```

---

## File Specifications

### `lib/shaders.ts` — NEW

```ts
export interface ShaderThumbnail {
  bg: string        // CSS background value for the miniature
  accentColor: string
}

export interface ShaderDefinition {
  id: string
  name: string
  fragmentShader: string
  thumbnail: ShaderThumbnail
}

export const SHADERS: ShaderDefinition[]
export const DEFAULT_SHADER_ID = 'lines'
```

Contains all 4 shader definitions. Each `fragmentShader` is a **self-contained, complete** GLSL ES 1.00 fragment shader string — it includes the precision declaration, all uniform declarations, the `hueShift` helper, and the `main()` function. Nothing is prepended by the component at runtime.

**Shared GLSL preamble (copied into every shader string in this file):**
```glsl
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
```

---

#### Shader: Lines (existing)

Pixelated glow lines. Current fragment shader, extracted verbatim. Thumbnail: dark blue gradient with a horizontal glow line.

**Control semantics:** speed=animation pace, lineWidth=glow radius, mosaic=pixel grid, lines=layer count, hue=color rotation.

---

#### Shader: Waves

Sinusoidal wave layers with glow, same pixelation grid as Lines.

**Control semantics:** speed=wave speed, lineWidth=glow thickness per wave, mosaic=pixel grid, lines=number of wave layers, hue=color rotation.

**Core GLSL:**
```glsl
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
```

**Thumbnail:** dark green gradient, SVG sine wave path with glow filter.

---

#### Shader: Perlin

Fractal Brownian Motion (fBm) value noise, smoothstep-interpolated, evolving over time.

**Control semantics:** speed=noise evolution speed, lineWidth=brightness multiplier, mosaic=noise domain scale (zoom), lines=fBm octave count (1–8), hue=color rotation.

**Core GLSL:**
```glsl
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv *= uMosaic * 0.5;

  float t = uTime * 0.02;
  float v = 0.0;
  float amplitude = 0.5;
  vec2 p = uv + vec2(t, t * 0.7);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= uLines) break;
    v += amplitude * vnoise(p);
    p = p * 2.0 + vec2(7.3, 3.1);
    amplitude *= 0.5;
  }

  vec3 color = hueShift(vec3(v * uLineWidth * 1200.0), uHue);
  gl_FragColor = vec4(color, 1.0);
}
```

**Thumbnail:** near-black bg, layered radial gradient blobs in purple/blue/pink.

---

#### Shader: Fractal (Julia Set)

Animated Julia set — the complex parameter `c` orbits slowly, making the fractal morph over time.

**Control semantics:** speed=orbit speed of `c`, lineWidth=edge brightness scale, mosaic=zoom level, lines=max iterations (×8, range 8–64), hue=color rotation.

**Core GLSL:**
```glsl
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
```

**Thumbnail:** deep purple radial gradient, concentric partial rings suggesting fractal self-similarity.

---

### `components/ui/shader-lines.tsx` — MODIFY

**Remove:**
- `declare global { interface Window { THREE: any } }`
- `useEffect` that injects/removes the CDN `<script>` tag
- All `window.THREE` references
- `document.head.contains(script)` cleanup
- `script.onload` async init pattern

**Add:**
```ts
import * as THREE from 'three'
```

**New prop:**
```ts
interface ShaderAnimationProps {
  params: ShaderParams
  shaderId: string          // NEW
}
```

**Material swap on shader change:**
```ts
useEffect(() => {
  const { scene } = sceneRef.current
  if (!scene) return
  const def = SHADERS.find(s => s.id === shaderId)
  if (!def) return

  // remove old mesh
  scene.clear()

  // rebuild geometry + material with new fragment shader
  const geometry = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({
    uniforms: sceneRef.current.uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: def.fragmentShader,
  })
  const mesh = new THREE.Mesh(geometry, material)

  // dispose old geometry/material stored in ref
  sceneRef.current.geometry?.dispose()
  sceneRef.current.material?.dispose()
  sceneRef.current.geometry = geometry
  sceneRef.current.material = material
  scene.add(mesh)
}, [shaderId])
```

`initThreeJS` is simplified: no async loading, runs synchronously on mount. Uses `SHADERS.find(s => s.id === shaderId).fragmentShader` for initial material. Uses `THREE.PlaneGeometry` (non-deprecated).

**`VERTEX_SHADER` constant** — declare at module level in `shader-lines.tsx`:
```ts
const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`
```

**Note:** `PlaneBufferGeometry` → `PlaneGeometry` (the Buffer variant was merged in Three.js r125; the npm version is current).

---

### `components/ui/shader-controls.tsx` — MODIFY

**New props:**
```ts
interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
  shaderId: string                          // NEW
  onShaderChange: (id: string) => void      // NEW
}
```

**Thumbnail grid** — added above the sliders section:
```tsx
<div className="grid grid-cols-4 gap-1.5 pb-1">
  {SHADERS.map(s => (
    <button
      key={s.id}
      onClick={() => onShaderChange(s.id)}
      className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors
        ${shaderId === s.id ? 'border-blue-500' : 'border-transparent'}`}
      style={{ background: s.thumbnail.bg }}
      title={s.name}
    >
      {/* static CSS/SVG art per shader — see lib/shaders.ts thumbnail definitions */}
      <ShaderThumbnailArt shader={s} />
    </button>
  ))}
</div>
```

`ShaderThumbnailArt` is a local component that renders the CSS/SVG decoration based on `s.id`:

| Shader | `thumbnail.bg` | Decoration |
|--------|---------------|------------|
| `lines` | `linear-gradient(160deg, #060d1f, #0d1b3e)` | Two absolute `<div>`s — 1px horizontal bars with blue/teal `box-shadow` glow |
| `waves` | `linear-gradient(160deg, #080f12, #0a1e14)` | Inline SVG `<path>` with sine curve, green stroke + feGaussianBlur glow filter |
| `perlin` | `#080608` | 4 absolute `<div>`s with `border-radius:50%` and `radial-gradient` blobs in purple/blue/pink |
| `fractal` | `radial-gradient(ellipse at 50% 50%, #1a0822, #06020e)` | 3 absolute `<div>`s with `border-radius:50%`, partial `border` in pink/violet, centered via `translate(-50%,-50%)` |

Each decoration `<div>` or `<svg>` uses `position:absolute` inside the `aspect-square` thumbnail button.

**Auto-hide gear — new internal state:**
```ts
const [gearVisible, setGearVisible] = useState(true)
const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
```

Gear button classes: add `transition-opacity duration-500` + `opacity-0 pointer-events-none` when `!gearVisible`.

**H key listener:**
```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "h" || e.key === "H") onToggle()
  }
  window.addEventListener("keydown", onKey)
  return () => window.removeEventListener("keydown", onKey)
}, [onToggle])
```

---

### `app/page.tsx` — MODIFY

Add one state:
```ts
const [shaderId, setShaderId] = useState(DEFAULT_SHADER_ID)
```

Pass to components:
```tsx
<ShaderAnimation params={params} shaderId={shaderId} />
<ShaderControls
  …
  shaderId={shaderId}
  onShaderChange={setShaderId}
/>
```

---

## File Map

| File | Action | Lines (est.) |
|------|--------|-------------|
| `package.json` | Add `three`, `@types/three` | +2 |
| `lib/shaders.ts` | Create — registry + 4 GLSL shaders | ~180 |
| `components/ui/shader-lines.tsx` | Modify — remove CDN, add shaderId, material swap | ~200 |
| `components/ui/shader-controls.tsx` | Modify — thumbnail grid, auto-hide, H key | ~200 |
| `app/page.tsx` | Modify — add shaderId state | ~40 |

---

## Verification

1. `npm run build` — zero TypeScript errors
2. Open `http://localhost:3000`:
   - Shader fills viewport, animates
   - Click ⚙ → panel opens with thumbnail grid at top
   - Click each thumbnail → shader switches in real time, no flash
   - Sliders affect the active shader
3. Mouse still for 3s → gear fades out
4. Move mouse → gear fades back in
5. Press H → panel toggles (with or without gear visible)
6. `npm run build` final — clean

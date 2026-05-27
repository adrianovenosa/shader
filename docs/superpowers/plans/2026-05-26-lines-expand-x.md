# Lines Shader — Expansão Horizontal: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um slider `expandX` ao modo Lines que escala `uv.x` no fragment shader, permitindo esticar ou comprimir o padrão de linhas horizontalmente.

**Architecture:** Novo param `expandX` na definição do modo → novo uniform `uExpandX` declarado no PREAMBLE GLSL compartilhado e aplicado como `uv.x /= uExpandX` no `linesFragment` antes da quantização de grid → Three.js adapter inicializa e atualiza o uniform.

**Tech Stack:** TypeScript, Three.js (`ShaderMaterial` uniforms), GLSL (fragment shader), Vitest.

---

### Task 1: Param no modo Lines (TDD)

**Files:**
- Create: `__tests__/modes.test.ts`
- Modify: `lib/modes/shaders/lines.ts`

- [ ] **Step 1: Escrever o teste que vai falhar**

Criar `__tests__/modes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { linesMode } from '@/lib/modes/shaders/lines'

describe('linesMode params', () => {
  it('includes expandX slider with correct config', () => {
    const expandX = linesMode.params.find(p => p.key === 'expandX')
    expect(expandX).toBeDefined()
    expect(expandX?.type).toBe('slider')
    expect(expandX?.min).toBe(0.25)
    expect(expandX?.max).toBe(4.0)
    expect(expandX?.step).toBe(0.25)
    expect(expandX?.default).toBe(1.0)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run __tests__/modes.test.ts
```

Esperado: FAIL — `expandX` não encontrado.

- [ ] **Step 3: Adicionar o param em `lib/modes/shaders/lines.ts`**

Adicionar à lista `params` (após `lines`, antes de `hue`):

```ts
{ key: 'expandX', label: 'Expansão H', type: 'slider', min: 0.25, max: 4.0, step: 0.25, default: 1.0 },
```

O arquivo completo ficará:

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
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,    step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001, max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,      max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,      max: 8,     step: 1,      default: 5 },
    { key: 'expandX',   label: 'Expansão H', type: 'slider', min: 0.25,   max: 4.0,   step: 0.25,   default: 1.0 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,      max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(linesFragment),
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run __tests__/modes.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Rodar toda a suite para garantir que nada quebrou**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 6: Commit**

```bash
git add __tests__/modes.test.ts lib/modes/shaders/lines.ts
git commit -m "feat: add expandX param to lines mode"
```

---

### Task 2: Uniform GLSL no shader

**Files:**
- Modify: `lib/shaders.ts`

> Nota: não há como unit-testar saída GLSL no ambiente Vitest. A verificação é feita visualmente ao rodar o app.

- [ ] **Step 1: Adicionar `uExpandX` ao PREAMBLE em `lib/shaders.ts`**

Localizar o bloco `const PREAMBLE` e adicionar a linha após `uniform float uHue;`:

```glsl
uniform float uExpandX;
```

O PREAMBLE completo ficará:

```ts
const PREAMBLE = `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uLineWidth;
uniform float uMosaic;
uniform float uLines;
uniform float uHue;
uniform float uExpandX;

vec3 hueShift(vec3 color, float angle) {
  const vec3 k = vec3(0.57735);
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}
`
```

- [ ] **Step 2: Aplicar `uExpandX` no `linesFragment`**

No `linesFragment`, localizar as linhas:

```glsl
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

  float gridX = 256.0 / uMosaic;
```

Inserir `uv.x /= uExpandX;` entre elas:

```glsl
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv.x /= uExpandX;

  float gridX = 256.0 / uMosaic;
```

O `linesFragment` completo ficará:

```ts
export const linesFragment = PREAMBLE + `
float random(in float x) {
  return fract(sin(x) * 1e4);
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv.x /= uExpandX;

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
```

- [ ] **Step 3: Commit**

```bash
git add lib/shaders.ts
git commit -m "feat: add uExpandX uniform to lines fragment shader"
```

---

### Task 3: Wiring do uniform no Three.js adapter

**Files:**
- Modify: `lib/renderers/three-adapter.ts`

> Nota: o adapter requer contexto WebGL, não testável em jsdom. Verificação via smoke visual no app.

- [ ] **Step 1: Adicionar `uExpandX` ao tipo `Uniforms`**

Localizar o tipo `Uniforms` (linha 6) e adicionar a linha após `uHue`:

```ts
type Uniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
  uExpandX:    { value: number }
}
```

- [ ] **Step 2: Inicializar o uniform em `mount()`**

Localizar o bloco `uniforms = {` e adicionar a linha após `uHue`:

```ts
      uniforms = {
        uTime:       { value: 1.0 },
        uResolution: { value: new THREE.Vector2() },
        uLineWidth:  { value: params.lineWidth  ?? 0.0008 },
        uMosaic:     { value: params.mosaic     ?? 4.0 },
        uLines:      { value: params.lines      ?? 5 },
        uHue:        { value: ((params.hue ?? 0) * Math.PI) / 180 },
        uExpandX:    { value: params.expandX    ?? 1.0 },
      }
```

- [ ] **Step 3: Tratar `expandX` em `updateParams()`**

Localizar o bloco `updateParams(params)` e adicionar a linha após o tratamento de `hue`:

```ts
    updateParams(params) {
      if (!uniforms) return
      if (params.speed     !== undefined) speed = params.speed
      if (params.lineWidth !== undefined) uniforms.uLineWidth.value = params.lineWidth
      if (params.mosaic    !== undefined) uniforms.uMosaic.value    = params.mosaic
      if (params.lines     !== undefined) uniforms.uLines.value     = params.lines
      if (params.hue       !== undefined) uniforms.uHue.value       = (params.hue * Math.PI) / 180
      if (params.expandX   !== undefined) uniforms.uExpandX.value   = params.expandX
    },
```

- [ ] **Step 4: Rodar toda a suite**

```bash
npx vitest run
```

Esperado: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add lib/renderers/three-adapter.ts
git commit -m "feat: wire uExpandX uniform in three-adapter"
```

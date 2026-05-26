# Enhanced Controls + Presentation Mode — Design Spec

**Data:** 2026-05-26

## Contexto

O projeto é uma ferramenta de arte generativa com shaders GLSL (Lines, Waves) e modos p5.js (Color Interpolation, Noise Field). O painel de controles atual tem sliders simples. Queremos:

1. Sliders com input numérico editável (estilo shader-lab)
2. Efeitos de pós-processamento empilháveis (grain, chromatic aberration, CRT, halftone, bloom)
3. Modo de apresentação fullscreen com playlist de presets

Estes três sub-projetos devem ser implementados nesta ordem, pois são independentes entre si mas compartilham o painel de controles como ponto de integração.

---

## Sub-projeto 1 — Slider com input editável

### Comportamento

O valor numérico exibido à direita de cada slider (ex: `0.050`) vira um botão clicável. Ao clicar:
- O span do valor se transforma num `<input type="text">` inline com o valor atual pré-selecionado
- Aceita qualquer número digitado, incluindo valores além do `max` ou abaixo do `min` do slider
- **Enter** → confirma, chama `onParamChange` com o novo valor, volta ao modo display
- **Escape** → cancela, restaura o valor anterior, volta ao modo display
- **onBlur** → igual ao Enter

O slider de range continua funcionando dentro do seu range original. Só o input de texto permite valores extremos.

### Arquivos modificados

- `components/ui/shader-controls.tsx` — o bloco de render do slider (default case) ganha o estado `editingKey: string | null` e o componente de input inline

### Estado local necessário

```ts
const [editingKey, setEditingKey] = useState<string | null>(null)
const [draftValue, setDraftValue]  = useState('')
```

### Padrão visual (referência: shader-lab)

```
Label                     0.050
[========>              ]
```

O valor `0.050` é um `<button>` que ao clicar vira `<input>` com underline animado.

---

## Sub-projeto 2 — Efeitos de pós-processamento

### Arquitetura de renderização

O `createThreeAdapter` passa a operar em dois passes:

**Pass 1 — Render pass:**
O shader principal renderiza para um `THREE.WebGLRenderTarget` (framebuffer) em vez de direto na tela.

**Pass 2 — Post-processing pass:**
Um segundo `THREE.Mesh` com `THREE.PlaneGeometry(2,2)` e `THREE.ShaderMaterial` próprio lê o framebuffer como `sampler2D uInputTexture` e aplica os efeitos ativos. Renderiza diretamente na tela.

O post-processing shader recebe uniforms para cada efeito:

```glsl
uniform sampler2D uInputTexture;
uniform vec2      uResolution;
uniform float     uTime;

// Grain
uniform float uGrainIntensity;     // 0.0 = off

// Chromatic Aberration
uniform float uChrAberIntensity;   // 0.0 = off

// CRT
uniform float uCRTIntensity;       // 0.0 = off

// Halftone
uniform float uHalftoneIntensity;  // 0.0 = off
uniform float uHalftoneDotSize;    // 1.0–8.0

// Bloom (single-pass simplified)
uniform float uBloomIntensity;     // 0.0 = off
uniform float uBloomThreshold;     // 0.0–1.0
```

Quando todos os uniforms de intensidade são 0, o pass-through é transparente (sem custo visual).

### Efeitos — implementação GLSL

**Grain:** `fract(sin(dot(uv + uTime * 0.01, vec2(12.9898, 78.233))) * 43758.5) * uGrainIntensity`

**Chromatic aberration:** sample separado de R, G, B com offset radial a partir do centro. Offset ∝ `uChrAberIntensity * distância_ao_centro`.

**CRT:** scanlines horizontais (alternância de escurecimento por linha de pixel) + vignette radial. Intensidade controla profundidade das linhas e do vignette.

**Halftone:** divide o espaço em células de tamanho `uHalftoneDotSize`. Em cada célula, desenha um círculo cujo raio é proporcional à luminância do pixel original. Substitui a cor pelo padrão pontilhado.

**Bloom (single-pass):** amostras em cruz (9 taps) com peso gaussiano ao redor de cada pixel. Apenas pixels acima de `uBloomThreshold` contribuem. Resultado somado ao original.

### Resize handling

O `WebGLRenderTarget` precisa ser redimensionado no método `resize()` do adapter.

### Arquivos modificados

- `lib/renderers/three-adapter.ts` — adiciona render target, segundo pass, uniforms de efeitos, resize do render target
- `lib/renderers/adapter.ts` — adiciona `updateEffects(effects: EffectState): void` à interface `RendererAdapter` (opcional: `updateEffects?` para não forçar implementação em adapters que não suportam efeitos)
- `lib/renderers/p5-adapter.ts` e `lib/renderers/shader-texture-adapter.ts` — não precisam de mudança se `updateEffects` for opcional na interface
- `lib/effects.ts` — novo arquivo: tipo `EffectState`, defaults, funções de load/save no localStorage
- `components/ui/effects-controls.tsx` — novo componente: seção "Efeitos" com toggle + slider por efeito
- `components/ui/shader-controls.tsx` — importa e renderiza `<EffectsControls>` abaixo dos params do shader
- `app/page.tsx` — adiciona estado `effects: EffectState`, passa para adapter via `updateEffects`

### Tipo EffectState

```ts
export interface EffectState {
  grain:       { enabled: boolean; intensity: number }
  chrAber:     { enabled: boolean; intensity: number }
  crt:         { enabled: boolean; intensity: number }
  halftone:    { enabled: boolean; intensity: number; dotSize: number }
  bloom:       { enabled: boolean; intensity: number; threshold: number }
}

export const DEFAULT_EFFECTS: EffectState = {
  grain:    { enabled: false, intensity: 0.15 },
  chrAber:  { enabled: false, intensity: 0.005 },
  crt:      { enabled: false, intensity: 0.6 },
  halftone: { enabled: false, intensity: 1.0, dotSize: 3.0 },
  bloom:    { enabled: false, intensity: 0.4, threshold: 0.6 },
}
```

### Persistência

`EffectState` salvo no localStorage sob a chave `shader-app-effects`. Incluído nos presets (campo `effects?: EffectState` no tipo `Preset`).

### UI dos efeitos

Seção "Efeitos" no painel, abaixo dos params do shader ativo, separada por `<div className="h-px bg-white/10" />`.

Cada linha: `[toggle] Nome do efeito ————— [slider intensidade]`

Efeitos com params extras (halftone: dotSize; bloom: threshold) mostram sliders extras indentados quando habilitados.

---

## Sub-projeto 3 — Modo de apresentação / playlist

### Entrar/sair

| Ação | Trigger |
|------|---------|
| Entrar | Tecla `P` OU botão ▶ no painel ⚙ |
| Sair | Tecla `Esc` OU botão ✕ no overlay |
| Sempre fullscreen | Toggle no painel ⚙ (seção "Apresentação", abaixo de Output). Persistido em localStorage. Se ativo, `useEffect` no mount de `page.tsx` chama `setPresentationActive(true)` automaticamente. |

### Estrutura do overlay

O overlay é um `<div>` fixo sobre o canvas (`z-30`). O shader continua renderizando atrás. A barra de controles aparece ao mover o mouse e desaparece após 3s de inatividade (mesmo padrão do ⚙ atual).

```
┌─────────────────────────────────────────────────────────────┐
│ [canvas shader rodando]                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ◀  ▶/⏸  ▶  │  Nome Preset — Modo  │  10s  │  ↺  ✕ │   │
│  └─────────────────────────────────────────────────────┘   │
│  [barra de progresso da duração]                           │
└─────────────────────────────────────────────────────────────┘
```

### Playlist

- Lista os presets salvos de todos os modos ativos (Lines, Waves, Color Interp, Noise Field)
- Cada entrada: `{ modeId, presetId, duration: number }` (duração em segundos, padrão 10)
- Reordenável via drag (HTML5 drag or pointer events simples)
- Toggle de loop (volta ao início ao terminar)
- Ao avançar: chama `handleModeChange(modeId)` + `handleLoadPreset(preset)` do `page.tsx`

### Estado da playlist

```ts
interface PlaylistEntry {
  modeId:   string
  presetId: string
  duration: number
}

interface PlaylistState {
  entries:     PlaylistEntry[]
  loop:        boolean
  alwaysFullscreen: boolean
}
```

Salvo em localStorage sob `shader-app-playlist`.

### Painel de edição da playlist

Acessível via botão "Playlist" dentro do modo apresentação (ou via ⚙ painel normal). Mostra a lista de entradas com:
- Drag handle para reordenar
- Input de duração por entrada (editável inline)
- Botão de remover entrada
- Botão "Adicionar preset atual" para incluir o preset/modo atual

### Arquivos novos/modificados

- `lib/playlist.ts` — tipo `PlaylistState`, `PlaylistEntry`, load/save localStorage
- `components/ui/presentation-overlay.tsx` — overlay fullscreen com barra de controles e lógica de auto-avanço
- `components/ui/playlist-editor.tsx` — lista editável de entradas da playlist
- `app/page.tsx` — estado `presentationActive`, `playlistState`; `useEffect` para `alwaysFullscreen`; handler de teclado `P`
- `components/ui/shader-controls.tsx` — adiciona botão ▶ para entrar no modo apresentação

---

## Ordem de implementação recomendada

1. Sub-projeto 1 (slider editável) — fundação de UX, rápido
2. Sub-projeto 2 (post-processing) — maior impacto visual, arquitetura central
3. Sub-projeto 3 (apresentação) — depende de presets já existentes, UX de topo

## Fora do escopo desta spec

- Gradientes como fonte de preset na playlist (pode ser adicionado depois)
- Exportação de frame/vídeo
- Editor GLSL ao vivo
- Modos generativos além de Color Interp e Noise Field

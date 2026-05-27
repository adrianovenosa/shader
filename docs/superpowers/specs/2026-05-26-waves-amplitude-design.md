# Waves Shader — Controle de Amplitude

**Data:** 2026-05-26

## Objetivo

Adicionar um parâmetro `amplitude` ao modo *Waves* que permite ao usuário controlar a altura das ondas (amplitude da senoide) via slider no painel de controles.

## Comportamento esperado

- `amplitude = 0.3` (default): comportamento atual preservado.
- `amplitude > 0.3`: ondas com picos mais altos (mais dramáticas).
- `amplitude < 0.3`: ondas mais planas.
- Range: `0.05` a `0.8`, step `0.05`.

## Decisão de design

Substituir o valor hardcoded `* 0.3` na linha de cálculo da wave por `* uAmplitude`. Essa abordagem controla diretamente a amplitude da senoide, sem interação com a quantização de grid (mosaic). O uniform é declarado inline no `wavesFragment` (não no PREAMBLE compartilhado), seguindo o padrão do `uExpandX` no `linesFragment`.

## Arquivos modificados

### 1. `lib/shaders.ts`
- Adicionar `uniform float uAmplitude;` ao `wavesFragment` (antes do `void main`).
- Substituir `* 0.3` por `* uAmplitude` na linha do `float wave = sin(...)`.

### 2. `lib/renderers/three-adapter.ts`
- Adicionar `uAmplitude: { value: number }` ao tipo `MainUniforms`.
- No `mount()`, inicializar: `uAmplitude: { value: params.amplitude ?? 0.3 }`.
- No `updateParams()`, tratar: `if (params.amplitude !== undefined) uniforms1.uAmplitude.value = params.amplitude`.

### 3. `lib/modes/shaders/waves.ts`
- Adicionar ao array `params` (entre `lines` e `hue`):
  ```ts
  { key: 'amplitude', label: 'Amplitude', type: 'slider', min: 0.05, max: 0.8, step: 0.05, default: 0.3 }
  ```

### 4. UI (`components/ui/shader-controls.tsx`)
Nenhuma alteração — o componente já renderiza sliders dinamicamente.

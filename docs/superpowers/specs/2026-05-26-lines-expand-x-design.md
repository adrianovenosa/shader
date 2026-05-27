# Lines Shader — Controle de Expansão Horizontal

**Data:** 2026-05-26

## Objetivo

Adicionar um parâmetro `expandX` ao modo *Lines* que permite ao usuário esticar ou comprimir o padrão de linhas no eixo horizontal, via slider no painel de controles.

## Comportamento esperado

- `expandX = 1.0` (default): sem alteração visual — comportamento atual preservado.
- `expandX > 1.0`: padrão de linhas se expande horizontalmente (linhas parecem mais largas/espalhadas no X).
- `expandX < 1.0`: padrão se comprime horizontalmente (linhas parecem mais densas/estreitas no X).
- Range: `0.25` a `4.0`, step `0.25`.

## Decisão de design

Aplicar `uv.x /= uExpandX` **antes** da quantização de grid (`floor`). Isso escala o espaço UV contínuo, produzindo um efeito suave e previsível. Aplicar após a quantização produziria um efeito "blocky" menos controlável.

## Arquivos a modificar

### 1. `lib/shaders.ts`
- Adicionar `uniform float uExpandX;` ao `PREAMBLE`.
- No `linesFragment`, inserir `uv.x /= uExpandX;` após o cálculo de `uv` e antes de `float gridX = ...`.

### 2. `lib/renderers/three-adapter.ts`
- Adicionar `uExpandX: { value: number }` ao tipo `Uniforms`.
- No `mount()`, inicializar: `uExpandX: { value: params.expandX ?? 1.0 }`.
- No `updateParams()`, tratar: `if (params.expandX !== undefined) uniforms.uExpandX.value = params.expandX`.

### 3. `lib/modes/shaders/lines.ts`
- Adicionar ao array `params`:
  ```ts
  { key: 'expandX', label: 'Expansão H', type: 'slider', min: 0.25, max: 4.0, step: 0.25, default: 1.0 }
  ```

### 4. UI (`components/ui/shader-controls.tsx`)
Nenhuma alteração — o componente já renderiza sliders dinamicamente a partir de `activeMode.params`.

## Escopo fora desta spec

- Outros shaders (waves, perlin, fractal) não usam `uExpandX` mesmo que o uniform seja declarado no PREAMBLE compartilhado — uniforms não referenciados no shader body são ignorados pelo compilador GLSL e não têm custo visual.
- Expansão vertical não está no escopo.

# Editable Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o valor numérico de cada slider num botão clicável que abre um `<input type="text">` inline, permitindo digitar qualquer número — inclusive além do max do slider.

**Architecture:** Extrair `formatParamValue` como função pura testável em `lib/format-param.ts`. Adicionar `editingKey`/`draftValue` como estado local em `ShaderControls`. O range input continua funcionando com seus limites; só o input de texto aceita valores livres.

**Tech Stack:** React (useState, useCallback), TypeScript, Vitest.

---

### Pré-requisito: branch

```bash
git checkout main
git pull
git checkout -b feat/editable-slider
```

---

### Task 1: Extrair `formatParamValue` (TDD)

**Files:**
- Create: `lib/format-param.ts`
- Create: `__tests__/format-param.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `__tests__/format-param.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatParamValue } from '@/lib/format-param'

describe('formatParamValue', () => {
  it('rounds to integer when step === 1', () => {
    expect(formatParamValue(4.7, { step: 1 })).toBe('5')
    expect(formatParamValue(5.0, { step: 1 })).toBe('5')
  })
  it('uses 4 decimal places when step < 0.01', () => {
    expect(formatParamValue(0.0008, { step: 0.0001 })).toBe('0.0008')
  })
  it('uses 3 decimal places for other steps', () => {
    expect(formatParamValue(0.05, { step: 0.005 })).toBe('0.050')
    expect(formatParamValue(4.0, { step: 0.5 })).toBe('4.000')
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx vitest run __tests__/format-param.test.ts
```

Esperado: FAIL — `formatParamValue` not found.

- [ ] **Step 3: Criar `lib/format-param.ts`**

```ts
import type { ParamSchema } from '@/lib/renderers/adapter'

export function formatParamValue(val: number, schema: Pick<ParamSchema, 'step'>): string {
  if (schema.step === 1) return String(Math.round(val))
  return val.toFixed(schema.step && schema.step < 0.01 ? 4 : 3)
}
```

- [ ] **Step 4: Rodar e confirmar passa**

```bash
npx vitest run __tests__/format-param.test.ts
```

Esperado: PASS — 3 tests.

- [ ] **Step 5: Rodar suite completa**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add lib/format-param.ts __tests__/format-param.test.ts
git commit -m "feat: extract formatParamValue helper"
```

---

### Task 2: Slider editável em `ShaderControls`

**Files:**
- Modify: `components/ui/shader-controls.tsx`

> Sem teste unitário para o componente React (sem @testing-library instalado). Verificação visual ao rodar o app.

- [ ] **Step 1: Adicionar import de `formatParamValue`**

No topo de `components/ui/shader-controls.tsx`, adicionar após os imports existentes:

```ts
import { formatParamValue } from '@/lib/format-param'
```

- [ ] **Step 2: Adicionar estado de edição**

Dentro do componente `ShaderControls`, logo após as declarações de estado existentes (`fileRef`, `prevUrlRef`, etc.), adicionar:

```ts
const [editingKey, setEditingKey] = useState<string | null>(null)
const [draftValue, setDraftValue] = useState('')
```

- [ ] **Step 3: Adicionar callback `commitEdit`**

Logo após `handleOutputH` e antes do `return`, adicionar:

```ts
const commitEdit = useCallback((schema: ParamSchema) => {
  const parsed = parseFloat(draftValue)
  if (!isNaN(parsed)) {
    onParamChange({ ...params, [schema.key]: parsed })
  }
  setEditingKey(null)
}, [draftValue, onParamChange, params])
```

- [ ] **Step 4: Substituir o bloco de render do slider default**

Localizar este bloco no componente (está após os `if (schema.type === 'select')` etc., é o bloco `// default: slider`):

```tsx
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
```

Substituir por:

```tsx
              // default: slider
              const display = formatParamValue(val, schema)
              const clampedVal = Math.min(schema.max ?? Infinity, Math.max(schema.min ?? -Infinity, val))
              return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px] items-center">
                    <span className="text-white/70">{schema.label}</span>
                    {editingKey === schema.key ? (
                      <input
                        type="text"
                        value={draftValue}
                        autoFocus
                        onChange={e => setDraftValue(e.target.value)}
                        onBlur={() => commitEdit(schema)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { commitEdit(schema); e.currentTarget.blur() }
                          if (e.key === 'Escape') { setEditingKey(null) }
                        }}
                        className="w-14 text-right text-[11px] bg-transparent border-b border-white/30 text-white/80 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingKey(schema.key); setDraftValue(display) }}
                        className="text-white/30 hover:text-white/60 text-[11px] bg-transparent border-none cursor-pointer"
                      >
                        {display}
                      </button>
                    )}
                  </div>
                  <input
                    type="range" min={schema.min} max={schema.max} step={schema.step}
                    value={clampedVal} onChange={handleSlider(schema)}
                    className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                  />
                </div>
              )
```

- [ ] **Step 5: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add editable value input to sliders"
```

---

### Task 3: Verificação visual (não automatizada)

- [ ] Instalar dependências e iniciar o app

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

- [ ] Verificar comportamentos:
  - Clicar no valor de qualquer slider abre input de texto com valor atual selecionado
  - Digitar um número e pressionar Enter atualiza o shader
  - Digitar um valor maior que o max do slider (ex: `20` no slider Linhas que tem max `8`) é aceito e o shader reage
  - Pressionar Escape restaura o valor anterior sem mudança
  - O slider de range continua funcionando normalmente; thumb fica no limite max quando valor digitado excede o max
  - Clicar fora do input (blur) confirma o valor

# Controls Panel — Accordion Redesign

**Data:** 2026-05-27

## Problema

O painel de controles sofre de dois problemas principais:
1. **Scroll excessivo** — todas as seções (parâmetros, efeitos, presets, output, imagem, apresentação) ficam empilhadas num scroll plano sem hierarquia, obrigando o usuário a rolar muito para chegar na seção desejada.
2. **Baixo contraste** — textos, valores numéricos e controles ficam apagados contra o fundo escuro, tornando a leitura difícil.

## Solução

Seções colapsáveis (accordion) com contraste elevado. Sem nova dependência de componente — implementado com `useState` por seção + transição CSS `grid-rows-[0fr]/[1fr]`.

---

## Estrutura do Accordion

Cada seção do painel vira uma unidade colapsável com:
- **Header clicável** (`<button>`) com label em caps e chevron `›` que rotaciona 90° quando aberto
- **Animação suave** via `grid grid-rows-[0fr]` → `grid-rows-[1fr]` + `overflow-hidden`
- **Estado persistido** em `localStorage` (chave `shader-app-panel-sections`) para lembrar o que estava aberto

### Seções e estados padrão

| Seção | Padrão | Conteúdo |
|---|---|---|
| Parâmetros do modo | **aberta** | sliders dinâmicos do modo ativo |
| Efeitos | fechada | grain, crt, bloom, etc. |
| Presets | fechada | lista + salvar |
| Output | fechada | W×H + presets de aspect ratio |
| Imagem | fechada | upload PNG / remover |
| Apresentação | fechada | switch fullscreen + iniciar + playlist |

A grade de modos e as tabs Shaders/Generativo ficam **fora do accordion** — sempre visíveis no topo.

### Indicador de itens ativos (quando fechado)

- **Efeitos fechado**: mostra contagem de efeitos habilitados — ex: `2 ativos`
- **Presets fechado**: mostra contagem de presets salvos se > 0
- Outros: sem indicador

---

## Contraste e Hierarquia Visual

### Paleta de mudanças

| Elemento | Atual | Novo |
|---|---|---|
| Fundo painel | `bg-black/80` | `bg-black/92` |
| Borda painel | `border-white/10` | `border-white/20` |
| Header de seção | `text-white/30 text-xs uppercase` | `text-white/90 text-xs uppercase` + `hover:bg-white/5` |
| Chevron | ausente | `›` com `transition-transform rotate-90` quando aberto |
| Labels de param | `text-white/85` | `text-white/90` (ajuste fino) |
| Valores numéricos | `text-white/30` | `text-white/55` |
| Separadores `<Separator>` | mantidos entre seções | **removidos** — headers de seção fazem a divisão |
| Track do slider | apagado (tema shadcn) | sem mudança no componente — contraste vem do fundo |
| Texto de preset | `text-white/60` | `text-white/75` |

---

## Arquivos a modificar

### `components/ui/shader-controls.tsx`

1. Adicionar estado das seções:
   ```ts
   const SECTIONS_DEFAULT = { params: true, effects: false, presets: false, output: false, image: false, presentation: false }
   const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
     if (typeof window === 'undefined') return SECTIONS_DEFAULT
     try {
       const raw = localStorage.getItem('shader-app-panel-sections')
       return raw ? { ...SECTIONS_DEFAULT, ...JSON.parse(raw) } : SECTIONS_DEFAULT
     } catch { return SECTIONS_DEFAULT }
   })
   const toggleSection = (key: string) => setOpenSections(prev => {
     const next = { ...prev, [key]: !prev[key] }
     localStorage.setItem('shader-app-panel-sections', JSON.stringify(next))
     return next
   })
   ```

2. Extrair componente `SectionHeader` inline:
   ```tsx
   function SectionHeader({ label, open, onToggle, badge }: {...}) {
     return (
       <button onClick={onToggle} className="flex w-full items-center justify-between h-8 px-1 hover:bg-white/5 rounded-md transition-colors">
         <span className="text-xs font-semibold uppercase tracking-widest text-white/90">{label}</span>
         <div className="flex items-center gap-2">
           {badge && <span className="text-[10px] text-white/40">{badge}</span>}
           <span className={`text-white/40 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
         </div>
       </button>
     )
   }
   ```

3. Envolver cada seção com o padrão de collapse:
   ```tsx
   <SectionHeader label="Efeitos" open={openSections.effects} onToggle={() => toggleSection('effects')} badge={activeEffectsCount > 0 ? `${activeEffectsCount} ativos` : undefined} />
   <div className={`grid transition-all duration-200 ${openSections.effects ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
     <div className="overflow-hidden">
       <div className="pt-2 flex flex-col gap-3">
         <EffectsControls ... />
       </div>
     </div>
   </div>
   ```

4. Atualizar fundo do painel: `bg-black/80` → `bg-black/92`, `border-white/10` → `border-white/20`

5. Remover todos os `<Separator>` — substituídos pelos headers de seção

6. Atualizar valores numéricos: `text-white/30` → `text-white/55` nos displays de parâmetro

### `components/ui/effects-controls.tsx`

- Remover o `<p>` de título próprio (o header da seção no painel pai já cumpre esse papel)
- Nenhuma outra mudança estrutural

---

## Persistência do estado das seções

- Chave localStorage: `shader-app-panel-sections`
- Valor: `Record<string, boolean>` serializado em JSON
- Carregado no `useState` initializer (client-only)
- Gravado a cada toggle

---

## Verificação

1. `vitest run` → todos os testes passando
2. `tsc --noEmit` → sem erros
3. App rodando:
   - Abrir painel → só "Parâmetros" aberto, resto fechado
   - Clicar em "Efeitos" → expande com animação suave, chevron rotaciona
   - Habilitar 2 efeitos → fechar seção → badge "2 ativos" aparece no header
   - Recarregar página → estado das seções preservado
   - Sliders, switches e inputs funcionam normalmente dentro das seções colapsadas/expandidas

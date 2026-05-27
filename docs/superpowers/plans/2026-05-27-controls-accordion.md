# Controls Accordion Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-scroll controls panel with collapsible accordion sections and higher contrast styling.

**Architecture:** Add a `SectionHeader` inline component and `openSections` state (persisted to `localStorage`) inside `ShaderControls`. Each section wraps its content in a CSS `grid-rows` transition. Contrast improvements are applied throughout both files.

**Tech Stack:** React `useState`, Tailwind CSS `grid-rows-[0fr]/[1fr]` animation, `localStorage` persistence, existing shadcn components.

---

## File Map

| File | Change |
|---|---|
| `components/ui/shader-controls.tsx` | Add `SectionHeader`, `openSections` state, wrap each section, update contrast, remove `<Separator>` |
| `components/ui/effects-controls.tsx` | Remove own `<p>` title (parent header replaces it) |

---

### Task 1: Add `openSections` state with localStorage persistence

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Add the constant and state near the top of `ShaderControls` (after the existing refs)**

Insert after `const cancelEditRef = useRef(false)` (line ~72):

```tsx
const SECTIONS_DEFAULT: Record<string, boolean> = {
  params: true, effects: false, presets: false,
  output: false, image: false, presentation: false,
}

const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
  if (typeof window === 'undefined') return SECTIONS_DEFAULT
  try {
    const raw = localStorage.getItem('shader-app-panel-sections')
    return raw ? { ...SECTIONS_DEFAULT, ...JSON.parse(raw) } : SECTIONS_DEFAULT
  } catch { return SECTIONS_DEFAULT }
})

const toggleSection = (key: string) => {
  setOpenSections(prev => {
    const next = { ...prev, [key]: !prev[key] }
    localStorage.setItem('shader-app-panel-sections', JSON.stringify(next))
    return next
  })
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: no errors (state types are inferred).

- [ ] **Step 3: Run tests to confirm nothing broken**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: 23 passed.

- [ ] **Step 4: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add openSections state with localStorage persistence"
```

---

### Task 2: Add `SectionHeader` inline component

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Define `SectionHeader` as a local function just before the `return (` of `ShaderControls`**

Insert just before the `return (` statement:

```tsx
function SectionHeader({
  label, sectionKey, badge,
}: { label: string; sectionKey: string; badge?: string }) {
  return (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex w-full items-center justify-between h-8 px-1 rounded-md hover:bg-white/5 transition-colors"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-white/90">
        {label}
      </span>
      <div className="flex items-center gap-2">
        {badge && (
          <span className="text-[10px] text-white/40">{badge}</span>
        )}
        <span
          className={[
            'text-white/40 text-sm transition-transform duration-200 inline-block',
            openSections[sectionKey] ? 'rotate-90' : '',
          ].join(' ')}
        >
          ›
        </span>
      </div>
    </button>
  )
}
```

Note: `SectionHeader` closes over `openSections` and `toggleSection` from the parent scope, so it must be defined inside `ShaderControls`.

- [ ] **Step 2: Run TypeScript check**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add SectionHeader component inside ShaderControls"
```

---

### Task 3: Update panel container contrast + remove Separators

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Update the panel container classes**

Find:
```tsx
'bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4',
```

Replace with:
```tsx
'bg-black/92 backdrop-blur-md border border-white/20 rounded-2xl p-4',
```

- [ ] **Step 2: Remove all four `<Separator>` instances**

The file currently has these four separators — delete each one:
```tsx
<Separator className="bg-white/10" />
```

There are 4 occurrences: after the mode grid, after EffectsControls, after presets, after output W/H, and before image upload. Remove all of them. Also remove the `Separator` import from the top.

- [ ] **Step 3: Run TypeScript check and tests**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1 && ~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: no errors, 23 passed.

- [ ] **Step 4: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "style: increase panel contrast, remove separators"
```

---

### Task 4: Wrap Parâmetros section in accordion

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Compute the active effects badge count** (needed later, but add now)

Insert after the `tabModes` line:

```tsx
const activeEffectsCount = Object.values(effects).filter(e => e.enabled).length
```

- [ ] **Step 2: Replace the static mode name `<p>` with `SectionHeader` and wrap content**

Find the entire `{activeMode && (...)}` block. Replace the opening:
```tsx
{activeMode && (
  <>
    <p className="text-xs font-semibold uppercase tracking-widest text-white/30">
      {activeMode.name}
    </p>
    {activeMode.params.map(...)}
  </>
)}
```

With:
```tsx
{activeMode && (
  <>
    <SectionHeader label={activeMode.name} sectionKey="params" />
    <div className={`grid transition-all duration-200 ${openSections.params ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
        <div className="flex flex-col gap-3 pt-1">
          {activeMode.params.map(schema => {
            // ... exact same param rendering code, unchanged ...
          })}
        </div>
      </div>
    </div>
  </>
)}
```

Keep all param rendering logic (`hue`, `button`, `select`, default slider) exactly as-is inside.

- [ ] **Step 3: Run TypeScript check and tests**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1 && ~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: no errors, 23 passed.

- [ ] **Step 4: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: wrap params section in accordion"
```

---

### Task 5: Wrap Efeitos section in accordion

**Files:**
- Modify: `components/ui/shader-controls.tsx`
- Modify: `components/ui/effects-controls.tsx`

- [ ] **Step 1: Remove the `<p>` title from `effects-controls.tsx`**

In `components/ui/effects-controls.tsx`, delete:
```tsx
<p className="text-xs font-semibold uppercase tracking-widest text-white/30">Efeitos</p>
```

- [ ] **Step 2: Replace the EffectsControls block in `shader-controls.tsx`**

Find:
```tsx
{activeTab === 'shaders' && (
  <>
    <EffectsControls effects={effects} onChange={onEffectsChange} />
    <Separator className="bg-white/10" />
  </>
)}
```

Replace with (the `<Separator>` was already removed in Task 3, so this will look slightly different — adapt accordingly):
```tsx
{activeTab === 'shaders' && (
  <>
    <SectionHeader
      label="Efeitos"
      sectionKey="effects"
      badge={activeEffectsCount > 0 ? `${activeEffectsCount} ativo${activeEffectsCount > 1 ? 's' : ''}` : undefined}
    />
    <div className={`grid transition-all duration-200 ${openSections.effects ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
        <div className="flex flex-col gap-3 pt-1">
          <EffectsControls effects={effects} onChange={onEffectsChange} />
        </div>
      </div>
    </div>
  </>
)}
```

- [ ] **Step 3: Run TypeScript check and tests**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1 && ~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: no errors, 23 passed.

- [ ] **Step 4: Commit**

```bash
git add components/ui/shader-controls.tsx components/ui/effects-controls.tsx
git commit -m "feat: wrap effects section in accordion with active badge"
```

---

### Task 6: Wrap Presets, Output, Imagem, Apresentação in accordion

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Wrap the Presets section**

Find the static `<p>` and everything until the next `<Separator>` (or next section):
```tsx
{/* Presets */}
<p className="text-xs font-semibold uppercase tracking-widest text-white/30">Presets</p>
{presets.length > 0 && ( ... )}
{savingPreset ? ( ... ) : ( ... )}
```

Replace with:
```tsx
<SectionHeader
  label="Presets"
  sectionKey="presets"
  badge={presets.length > 0 ? `${presets.length}` : undefined}
/>
<div className={`grid transition-all duration-200 ${openSections.presets ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
  <div className="overflow-hidden">
    <div className="flex flex-col gap-3 pt-1">
      {presets.length > 0 && (
        <div className="flex flex-col gap-1">
          {presets.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-white/6 rounded-lg px-2.5 py-1.5">
              <button
                onClick={() => onLoadPreset(p)}
                className="text-xs text-white/75 hover:text-white flex-1 text-left"
              >
                {p.name}
              </button>
              <button
                onClick={() => onDeletePreset(p.id)}
                className="text-[11px] text-white/20 hover:text-red-400 ml-2"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      {savingPreset ? (
        <div className="flex gap-1 items-center">
          <Input
            autoFocus
            value={presetName}
            onChange={e => setPresetName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSavingPreset(false) }}
            placeholder="Nome do preset"
            className="flex-1 h-7 text-xs"
          />
          <button onClick={handleSavePreset} className="text-xs text-blue-400 px-2">OK</button>
        </div>
      ) : (
        <button
          onClick={() => setSavingPreset(true)}
          className="border border-dashed border-indigo-500/40 rounded-lg p-2 text-xs text-indigo-400/70 hover:text-indigo-300 hover:border-indigo-400/60 transition-colors"
        >
          📌 Salvar preset
        </button>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Wrap the Output section**

Find:
```tsx
{/* Output size */}
<p className="text-xs font-semibold uppercase tracking-widest text-white/30">Output</p>
```

Replace through end of output section:
```tsx
<SectionHeader label="Output" sectionKey="output" />
<div className={`grid transition-all duration-200 ${openSections.output ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
  <div className="overflow-hidden">
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-1.5">
        <Label className="sr-only" htmlFor="output-w">Largura</Label>
        <Input id="output-w" type="number" value={outputWidth} onChange={handleOutputW} min={1} className="h-7 text-xs text-center" />
        <span className="text-xs text-white/20">×</span>
        <Label className="sr-only" htmlFor="output-h">Altura</Label>
        <Input id="output-h" type="number" value={outputHeight} onChange={handleOutputH} min={1} className="h-7 text-xs text-center" />
      </div>
      <div className="flex gap-1 flex-wrap">
        {OUTPUT_PRESETS.map(op => {
          const active = op.mode === 'full'
            ? outputMode === 'full'
            : outputMode === 'custom' && outputWidth === op.w && outputHeight === op.h
          return (
            <button
              key={op.label}
              onClick={() => onOutputChange(op.w || outputWidth, op.h || outputHeight, op.mode)}
              className={[
                'text-[10px] px-2 py-0.5 rounded transition-colors',
                active
                  ? 'bg-white/15 text-white/80 border border-white/20'
                  : 'bg-white/6 text-white/35 border border-white/8',
              ].join(' ')}
            >
              {op.label}
            </button>
          )
        })}
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Wrap the Imagem section**

Find the image upload block (the hidden file input through the optional remove button). Replace:
```tsx
{/* Image upload */}
<input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
<button onClick={() => fileRef.current?.click()} ...>...</button>
{imageUrl && ( <button ... /> )}
```

With:
```tsx
{/* Image upload */}
<input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
<SectionHeader label="Imagem" sectionKey="image" />
<div className={`grid transition-all duration-200 ${openSections.image ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
  <div className="overflow-hidden">
    <div className="flex flex-col gap-3 pt-1">
      <button
        onClick={() => fileRef.current?.click()}
        className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors"
      >
        <span className="text-lg leading-none">🖼</span>
        <span className="text-xs">Carregar PNG</span>
      </button>
      {imageUrl && (
        <button
          onClick={() => onImageUpload(null)}
          className="border border-dashed border-red-500/30 rounded-lg p-2.5 flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 transition-colors"
        >
          <span className="text-lg leading-none">🗑</span>
          <span className="text-xs">Remover imagem</span>
        </button>
      )}
    </div>
  </div>
</div>
```

- [ ] **Step 4: Wrap the Apresentação section**

Find:
```tsx
{/* Apresentação */}
<p className="text-xs font-semibold uppercase tracking-widest text-white/30">Apresentação</p>
<div className="flex items-center gap-2">...</div>
<button onClick={onPresentationOpen} ...>...</button>
<PlaylistEditor ... />
```

Replace with:
```tsx
<SectionHeader label="Apresentação" sectionKey="presentation" />
<div className={`grid transition-all duration-200 ${openSections.presentation ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
  <div className="overflow-hidden">
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center gap-2">
        <Switch
          id="always-fullscreen"
          checked={alwaysFullscreen}
          onCheckedChange={onAlwaysFullscreenChange}
        />
        <Label htmlFor="always-fullscreen" className="text-[13px] text-white/60 cursor-pointer font-normal">
          Sempre fullscreen
        </Label>
      </div>
      <button
        onClick={onPresentationOpen}
        className="border border-white/20 rounded-lg p-2 text-xs text-white/50 hover:text-white/80 hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
      >
        <span>▶</span> Iniciar apresentação
      </button>
      <PlaylistEditor
        playlist={playlist}
        onChange={onPlaylistChange}
        currentModeId={activeModeId}
        currentPresets={presets}
      />
    </div>
  </div>
</div>
```

- [ ] **Step 5: Run TypeScript check and tests**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1 && ~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: no errors, 23 passed.

- [ ] **Step 6: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: wrap presets, output, image and presentation in accordion"
```

---

### Task 7: Update contrast on numeric values

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Update the numeric value display color in the slider row**

Find (inside the default slider rendering, the value button):
```tsx
className="text-white/30 hover:text-white/60 text-[13px] bg-transparent border-none cursor-pointer"
```

Replace with:
```tsx
className="text-white/55 hover:text-white/80 text-[13px] bg-transparent border-none cursor-pointer"
```

- [ ] **Step 2: Update the hue value display**

Find:
```tsx
<span className="text-white/30">{Math.round(val)}°</span>
```

Replace with:
```tsx
<span className="text-white/55">{Math.round(val)}°</span>
```

- [ ] **Step 3: Run TypeScript check and tests**

```bash
~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/tsc --noEmit 2>&1 && ~/.nvm/versions/node/v22.22.3/bin/node node_modules/.bin/vitest run 2>&1
```

Expected: no errors, 23 passed.

- [ ] **Step 4: Commit and push**

```bash
git add components/ui/shader-controls.tsx
git commit -m "style: increase contrast on numeric param values"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Collapsible sections with header + chevron
- ✅ CSS `grid-rows` animation (no JS library)
- ✅ `localStorage` persistence with SSR guard
- ✅ Params open by default, rest closed
- ✅ Effects badge with active count
- ✅ Presets badge with count
- ✅ Higher contrast: panel bg, border, values
- ✅ Separators removed
- ✅ Effects title removed from `effects-controls.tsx`

**Placeholder scan:** No TBDs. All code steps are complete.

**Type consistency:** `openSections` is `Record<string, boolean>` throughout. `SectionHeader` props are typed inline. `activeEffectsCount` is `number`. No mismatches.

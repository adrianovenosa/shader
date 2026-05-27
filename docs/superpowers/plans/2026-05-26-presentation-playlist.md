# Presentation / Playlist Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modo de apresentação fullscreen com playlist de presets, auto-avanço configurável, loop toggle e opção de sempre abrir em fullscreen.

**Architecture:** `lib/playlist.ts` gerencia tipos e persistência. `PresentationOverlay` é um overlay fixo sobre o canvas com barra de controles auto-hide. `PlaylistEditor` lista entradas reordenáveis. `page.tsx` gerencia `presentationActive` e delega mudanças de modo/preset ao avançar a playlist.

**Tech Stack:** React (useState, useEffect, useRef, useCallback), TypeScript, Vitest.

---

### Pré-requisito: branch

```bash
git checkout main
git pull
git checkout -b feat/presentation-playlist
```

**Nota:** Este plano assume que `lib/presets.ts` já existe com `loadPresets(modeId)` retornando `Preset[]` (cada preset tem `id`, `name`, `params`, `createdAt`). Não modifica `lib/presets.ts`.

---

### Task 1: `lib/playlist.ts` — tipos e persistência (TDD)

**Files:**
- Create: `lib/playlist.ts`
- Create: `__tests__/playlist.test.ts`

- [ ] **Step 1: Escrever o teste**

Criar `__tests__/playlist.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import {
  loadPlaylist, savePlaylist, DEFAULT_PLAYLIST,
  type PlaylistState,
} from '@/lib/playlist'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('playlist persistence', () => {
  it('returns DEFAULT_PLAYLIST when nothing saved', () => {
    const p = loadPlaylist()
    expect(p.entries).toEqual([])
    expect(p.loop).toBe(true)
    expect(p.alwaysFullscreen).toBe(false)
  })
  it('round-trips playlist state', () => {
    const state: PlaylistState = {
      entries: [{ modeId: 'lines', presetId: 'abc', duration: 8 }],
      loop: false,
      alwaysFullscreen: true,
    }
    savePlaylist(state)
    const loaded = loadPlaylist()
    expect(loaded.entries).toHaveLength(1)
    expect(loaded.entries[0].presetId).toBe('abc')
    expect(loaded.loop).toBe(false)
    expect(loaded.alwaysFullscreen).toBe(true)
  })
  it('returns default on corrupt data', () => {
    localStorage.setItem('shader-app-playlist', 'not-json')
    expect(loadPlaylist()).toEqual(DEFAULT_PLAYLIST)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
npx vitest run __tests__/playlist.test.ts
```

Esperado: FAIL — `loadPlaylist` not found.

- [ ] **Step 3: Criar `lib/playlist.ts`**

```ts
export interface PlaylistEntry {
  modeId:   string
  presetId: string
  duration: number
}

export interface PlaylistState {
  entries:          PlaylistEntry[]
  loop:             boolean
  alwaysFullscreen: boolean
}

export const DEFAULT_PLAYLIST: PlaylistState = {
  entries:          [],
  loop:             true,
  alwaysFullscreen: false,
}

const KEY = 'shader-app-playlist'

export function loadPlaylist(): PlaylistState {
  if (typeof window === 'undefined') return DEFAULT_PLAYLIST
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PLAYLIST
    const parsed = JSON.parse(raw)
    return {
      entries:          Array.isArray(parsed.entries) ? parsed.entries : [],
      loop:             typeof parsed.loop === 'boolean' ? parsed.loop : true,
      alwaysFullscreen: typeof parsed.alwaysFullscreen === 'boolean' ? parsed.alwaysFullscreen : false,
    }
  } catch { return DEFAULT_PLAYLIST }
}

export function savePlaylist(state: PlaylistState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}
```

- [ ] **Step 4: Rodar e confirmar passa**

```bash
npx vitest run __tests__/playlist.test.ts
```

Esperado: PASS — 3 tests.

- [ ] **Step 5: Rodar suite completa**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 6: Commit**

```bash
git add lib/playlist.ts __tests__/playlist.test.ts
git commit -m "feat: add PlaylistState type and localStorage persistence"
```

---

### Task 2: `PlaylistEditor` — lista editável de entradas

**Files:**
- Create: `components/ui/playlist-editor.tsx`

Este componente lista as entradas da playlist com duração editável e botão de remover. Reordenamento via drag-and-drop com HTML5 draggable.

- [ ] **Step 1: Criar `components/ui/playlist-editor.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'
import type { PlaylistEntry, PlaylistState } from '@/lib/playlist'
import type { Preset } from '@/lib/presets'
import { MODES } from '@/lib/modes'
import { loadPresets } from '@/lib/presets'

interface Props {
  playlist:  PlaylistState
  onChange:  (p: PlaylistState) => void
  currentModeId:  string
  currentPresets: Preset[]
}

export function PlaylistEditor({ playlist, onChange, currentModeId, currentPresets }: Props) {
  const dragIndex = useRef<number | null>(null)
  const [durationEditing, setDurationEditing] = useState<number | null>(null)
  const [durationDraft,   setDurationDraft]   = useState('')

  const updateEntries = (entries: PlaylistEntry[]) =>
    onChange({ ...playlist, entries })

  const handleDragStart = (i: number) => { dragIndex.current = i }

  const handleDrop = (i: number) => {
    if (dragIndex.current === null || dragIndex.current === i) return
    const entries = [...playlist.entries]
    const [moved] = entries.splice(dragIndex.current, 1)
    entries.splice(i, 0, moved)
    dragIndex.current = null
    updateEntries(entries)
  }

  const removeEntry = (i: number) =>
    updateEntries(playlist.entries.filter((_, idx) => idx !== i))

  const commitDuration = (i: number) => {
    const v = parseFloat(durationDraft)
    if (!isNaN(v) && v > 0) {
      const entries = [...playlist.entries]
      entries[i] = { ...entries[i], duration: v }
      updateEntries(entries)
    }
    setDurationEditing(null)
  }

  const addCurrentPreset = (preset: Preset) => {
    const entry: PlaylistEntry = { modeId: currentModeId, presetId: preset.id, duration: 10 }
    updateEntries([...playlist.entries, entry])
  }

  const modeName = (modeId: string) =>
    MODES.find(m => m.id === modeId)?.name ?? modeId

  const presetName = (modeId: string, presetId: string): string => {
    const presets = loadPresets(modeId)
    return presets.find(p => p.id === presetId)?.name ?? presetId
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Playlist</p>

      {/* Entries list */}
      {playlist.entries.length === 0 && (
        <p className="text-[10px] text-white/25 text-center py-2">Sem entradas. Adicione presets abaixo.</p>
      )}
      {playlist.entries.map((entry, i) => (
        <div
          key={`${entry.modeId}-${entry.presetId}-${i}`}
          draggable
          onDragStart={() => handleDragStart(i)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(i)}
          className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing"
        >
          <span className="text-white/20 text-[10px]">⠿</span>
          <span className="text-[10px] text-white/60 flex-1 truncate">
            {presetName(entry.modeId, entry.presetId)}
            <span className="text-white/30 ml-1">— {modeName(entry.modeId)}</span>
          </span>
          {durationEditing === i ? (
            <input
              autoFocus
              type="text"
              value={durationDraft}
              onChange={e => setDurationDraft(e.target.value)}
              onBlur={() => commitDuration(i)}
              onKeyDown={e => {
                if (e.key === 'Enter') { commitDuration(i); e.currentTarget.blur() }
                if (e.key === 'Escape') setDurationEditing(null)
              }}
              className="w-10 text-right text-[10px] bg-transparent border-b border-white/30 text-white/70 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setDurationEditing(i); setDurationDraft(String(entry.duration)) }}
              className="text-[10px] text-white/30 hover:text-white/60 bg-transparent border-none cursor-pointer w-10 text-right"
            >
              {entry.duration}s
            </button>
          )}
          <button
            type="button"
            onClick={() => removeEntry(i)}
            className="text-[9px] text-white/20 hover:text-red-400 ml-1 bg-transparent border-none cursor-pointer"
          >✕</button>
        </div>
      ))}

      {/* Add current preset buttons */}
      {currentPresets.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <p className="text-[9px] text-white/25 uppercase tracking-widest">Adicionar preset atual</p>
          {currentPresets.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => addCurrentPreset(preset)}
              className="text-[10px] text-left text-indigo-400/70 hover:text-indigo-300 bg-transparent border border-dashed border-indigo-500/30 hover:border-indigo-400/50 rounded-md px-2 py-1 transition-colors"
            >
              + {preset.name}
            </button>
          ))}
        </div>
      )}

      {/* Loop toggle */}
      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => onChange({ ...playlist, loop: !playlist.loop })}
          className={[
            'relative w-7 h-4 rounded-full transition-colors shrink-0',
            playlist.loop ? 'bg-blue-500' : 'bg-white/15',
          ].join(' ')}
        >
          <span className={[
            'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
            playlist.loop ? 'translate-x-3.5' : 'translate-x-0.5',
          ].join(' ')} />
        </button>
        <span className="text-[11px] text-white/60">Loop</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add components/ui/playlist-editor.tsx
git commit -m "feat: add PlaylistEditor component"
```

---

### Task 3: `PresentationOverlay` — overlay de apresentação

**Files:**
- Create: `components/ui/presentation-overlay.tsx`

- [ ] **Step 1: Criar `components/ui/presentation-overlay.tsx`**

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaylistState } from '@/lib/playlist'
import type { Preset } from '@/lib/presets'
import { loadPresets } from '@/lib/presets'
import { MODES } from '@/lib/modes'

interface Props {
  playlist:       PlaylistState
  onExit:         () => void
  onLoadPreset:   (modeId: string, preset: Preset) => void
}

export function PresentationOverlay({ playlist, onExit, onLoadPreset }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing,      setPlaying]      = useState(true)
  const [elapsed,      setElapsed]      = useState(0)
  const [barVisible,   setBarVisible]   = useState(true)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const entry = playlist.entries[currentIndex] ?? null
  const currentDuration = entry?.duration ?? 10

  // Load and apply the current entry
  const applyEntry = useCallback((index: number) => {
    const e = playlist.entries[index]
    if (!e) return
    const presets = loadPresets(e.modeId)
    const preset  = presets.find(p => p.id === e.presetId)
    if (preset) onLoadPreset(e.modeId, preset)
  }, [playlist.entries, onLoadPreset])

  // Apply on mount and index change
  useEffect(() => { applyEntry(currentIndex) }, [currentIndex, applyEntry])

  // Auto-advance timer
  useEffect(() => {
    if (!playing || playlist.entries.length === 0) return
    intervalRef.current = setInterval(() => {
      setElapsed(prev => {
        if (prev + 1 >= currentDuration) {
          setCurrentIndex(idx => {
            const next = idx + 1
            if (next >= playlist.entries.length) {
              if (!playlist.loop) { setPlaying(false); return idx }
              return 0
            }
            return next
          })
          return 0
        }
        return prev + 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, currentDuration, playlist.entries.length, playlist.loop])

  // Reset elapsed when index changes
  useEffect(() => { setElapsed(0) }, [currentIndex])

  // Bar auto-hide
  const showBar = useCallback(() => {
    setBarVisible(true)
    clearTimeout(hideTimerRef.current!)
    hideTimerRef.current = setTimeout(() => setBarVisible(false), 3000)
  }, [])

  useEffect(() => {
    showBar()
    window.addEventListener('mousemove', showBar)
    return () => { window.removeEventListener('mousemove', showBar); clearTimeout(hideTimerRef.current!) }
  }, [showBar])

  // Keyboard: Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(playlist.entries.length - 1, index))
    setCurrentIndex(clamped)
    setElapsed(0)
  }

  const presetLabel = entry
    ? (() => {
        const presets = loadPresets(entry.modeId)
        const preset  = presets.find(p => p.id === entry.presetId)
        const mode    = MODES.find(m => m.id === entry.modeId)
        return `${preset?.name ?? '—'} — ${mode?.name ?? entry.modeId}`
      })()
    : 'Playlist vazia'

  const progress = currentDuration > 0 ? elapsed / currentDuration : 0

  if (playlist.entries.length === 0) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
        <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 flex flex-col gap-3 items-center">
          <p className="text-white/60 text-sm">Playlist vazia.</p>
          <p className="text-white/30 text-[11px]">Adicione presets no painel ⚙ antes de apresentar.</p>
          <button
            onClick={onExit}
            className="text-[11px] text-white/60 hover:text-white border border-white/20 rounded-lg px-3 py-1.5 mt-1"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30" onMouseMove={showBar}>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className="h-full bg-white/40 transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls bar */}
      <div className={[
        'absolute bottom-2 left-1/2 -translate-x-1/2',
        'flex items-center gap-2 px-3 py-2',
        'bg-black/70 backdrop-blur-md border border-white/10 rounded-full',
        'transition-opacity duration-300',
        barVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}>

        {/* Prev */}
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0 && !playlist.loop}
          className="text-white/50 hover:text-white text-sm w-6 h-6 flex items-center justify-center disabled:opacity-20"
        >◀</button>

        {/* Play/Pause */}
        <button
          onClick={() => setPlaying(p => !p)}
          className="text-white/70 hover:text-white text-sm w-6 h-6 flex items-center justify-center"
        >{playing ? '⏸' : '▶'}</button>

        {/* Next */}
        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === playlist.entries.length - 1 && !playlist.loop}
          className="text-white/50 hover:text-white text-sm w-6 h-6 flex items-center justify-center disabled:opacity-20"
        >▶</button>

        <span className="w-px h-4 bg-white/15 mx-1" />

        {/* Preset label */}
        <span className="text-[10px] text-white/50 max-w-[180px] truncate">{presetLabel}</span>

        <span className="w-px h-4 bg-white/15 mx-1" />

        {/* Duration info */}
        <span className="text-[10px] text-white/30 w-12 text-right">
          {elapsed}s / {currentDuration}s
        </span>

        {/* Exit */}
        <button
          onClick={onExit}
          className="text-white/30 hover:text-white text-xs w-5 h-5 flex items-center justify-center ml-1"
        >✕</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 3: Commit**

```bash
git add components/ui/presentation-overlay.tsx
git commit -m "feat: add PresentationOverlay with auto-advance and controls"
```

---

### Task 4: Wiring em `shader-controls.tsx`

**Files:**
- Modify: `components/ui/shader-controls.tsx`

- [ ] **Step 1: Adicionar props ao `ShaderControls`**

Na interface `Props`, adicionar:

```ts
playlist:         PlaylistState
onPlaylistChange: (p: PlaylistState) => void
onPresentationOpen: () => void
alwaysFullscreen: boolean
onAlwaysFullscreenChange: (v: boolean) => void
```

- [ ] **Step 2: Adicionar imports**

```ts
import { type PlaylistState } from '@/lib/playlist'
import { PlaylistEditor } from '@/components/ui/playlist-editor'
```

- [ ] **Step 3: Adicionar seção "Apresentação" no JSX**

Adicionar após a última `<div className="h-px bg-white/10" />` e antes do fechamento do painel:

```tsx
<div className="h-px bg-white/10" />

{/* Apresentação */}
<p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Apresentação</p>

{/* Always fullscreen toggle */}
<div className="flex items-center gap-2">
  <button
    type="button"
    onClick={() => onAlwaysFullscreenChange(!alwaysFullscreen)}
    className={[
      'relative w-7 h-4 rounded-full transition-colors shrink-0',
      alwaysFullscreen ? 'bg-blue-500' : 'bg-white/15',
    ].join(' ')}
  >
    <span className={[
      'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
      alwaysFullscreen ? 'translate-x-3.5' : 'translate-x-0.5',
    ].join(' ')} />
  </button>
  <span className="text-[11px] text-white/60">Sempre fullscreen</span>
</div>

{/* Start presentation button */}
<button
  onClick={onPresentationOpen}
  className="border border-white/20 rounded-lg p-2 text-[10px] text-white/50 hover:text-white/80 hover:border-white/30 transition-colors flex items-center justify-center gap-1.5"
>
  <span>▶</span> Iniciar apresentação
</button>

<PlaylistEditor
  playlist={playlist}
  onChange={onPlaylistChange}
  currentModeId={activeModeId}
  currentPresets={presets}
/>
```

- [ ] **Step 4: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 5: Commit**

```bash
git add components/ui/shader-controls.tsx
git commit -m "feat: add presentation controls to ShaderControls panel"
```

---

### Task 5: Wiring em `page.tsx`

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Adicionar imports**

```ts
import { loadPlaylist, savePlaylist, DEFAULT_PLAYLIST, type PlaylistState } from '@/lib/playlist'
import { PresentationOverlay } from '@/components/ui/presentation-overlay'
```

- [ ] **Step 2: Adicionar estados**

Após os estados existentes, adicionar:

```ts
const [presentationActive, setPresentationActive] = useState(false)
const [playlist, setPlaylist] = useState<PlaylistState>(DEFAULT_PLAYLIST)
const [alwaysFullscreen, setAlwaysFullscreen] = useState(false)
```

- [ ] **Step 3: Carregar playlist no useEffect de mount**

Dentro do `useEffect` de mount existente, adicionar ao final:

```ts
const pl = loadPlaylist()
setPlaylist(pl)
setAlwaysFullscreen(pl.alwaysFullscreen)
if (pl.alwaysFullscreen) setPresentationActive(true)
```

- [ ] **Step 4: Adicionar keyboard handler para tecla P**

No `useEffect` de teclado existente em `shader-controls.tsx` não está em `page.tsx`. Adicionar em `page.tsx` um `useEffect`:

```ts
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) {
      setPresentationActive(prev => !prev)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])
```

- [ ] **Step 5: Adicionar handlers**

```ts
const handlePlaylistChange = useCallback((p: PlaylistState) => {
  setPlaylist(p)
  savePlaylist(p)
}, [])

const handleAlwaysFullscreenChange = useCallback((v: boolean) => {
  setAlwaysFullscreen(v)
  const updated = { ...playlist, alwaysFullscreen: v }
  setPlaylist(updated)
  savePlaylist(updated)
}, [playlist])

const handlePresentationLoadPreset = useCallback((modeId: string, preset: Preset) => {
  handleModeChange(modeId)
  handleLoadPreset(preset)
}, [handleModeChange, handleLoadPreset])
```

- [ ] **Step 6: Adicionar `PresentationOverlay` no JSX**

Após `<ShaderControls ...>` e antes do fechamento de `<main>`:

```tsx
{presentationActive && (
  <PresentationOverlay
    playlist={playlist}
    onExit={() => setPresentationActive(false)}
    onLoadPreset={handlePresentationLoadPreset}
  />
)}
```

- [ ] **Step 7: Passar novas props ao `ShaderControls`**

```tsx
<ShaderControls
  {/* ...props existentes... */}
  playlist={playlist}
  onPlaylistChange={handlePlaylistChange}
  onPresentationOpen={() => setPresentationActive(true)}
  alwaysFullscreen={alwaysFullscreen}
  onAlwaysFullscreenChange={handleAlwaysFullscreenChange}
/>
```

- [ ] **Step 8: Rodar suite**

```bash
npx vitest run
```

Esperado: todos passando.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire presentation mode and playlist into page"
```

---

### Task 6: Verificação visual

- [ ] Iniciar o app

```bash
npm install && npm run dev
```

- [ ] Verificar:
  - Abrir painel ⚙, seção "Apresentação" visível no final
  - Toggle "Sempre fullscreen" persiste após reload
  - Salvar um preset no modo Lines
  - Adicionar o preset à playlist via botão "+ nome-do-preset"
  - Clicar "Iniciar apresentação" ou pressionar `P` → overlay aparece sobre o canvas
  - Barra de controles visível ao mover o mouse, some após 3s
  - Com 1 preset na playlist: temporizador corre, ao terminar pausa (sem loop) ou recomeça (com loop)
  - Com 2+ presets: auto-avanço troca o shader/preset
  - ◀ / ▶ navegam manualmente
  - ⏸ pausa o timer, ▶ retoma
  - `Esc` ou ✕ fecha o overlay
  - Duração de cada entrada é editável clicando no valor (ex: `10s`)
  - Reordenar entradas via drag-and-drop
  - Recarregar com "sempre fullscreen" ativo → entra automaticamente no modo apresentação

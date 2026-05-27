'use client'

import { useRef, useState } from 'react'
import type { PlaylistEntry, PlaylistState } from '@/lib/playlist'
import type { Preset } from '@/lib/presets'
import { MODES } from '@/lib/modes'
import { loadPresets } from '@/lib/presets'

interface Props {
  playlist:       PlaylistState
  onChange:       (p: PlaylistState) => void
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
                if (e.key === 'Enter') e.currentTarget.blur()
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

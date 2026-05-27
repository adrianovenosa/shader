'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaylistState } from '@/lib/playlist'
import type { Preset } from '@/lib/presets'
import { loadPresets } from '@/lib/presets'
import { MODES } from '@/lib/modes'

interface Props {
  playlist:     PlaylistState
  onExit:       () => void
  onLoadPreset: (modeId: string, preset: Preset) => void
}

export function PresentationOverlay({ playlist, onExit, onLoadPreset }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing,      setPlaying]      = useState(true)
  const [elapsed,      setElapsed]      = useState(0)
  const [barVisible,   setBarVisible]   = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null)

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
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setBarVisible(false), 3000)
  }, [])

  useEffect(() => {
    showBar()
    window.addEventListener('mousemove', showBar)
    return () => {
      window.removeEventListener('mousemove', showBar)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showBar])

  // Keyboard: Esc exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  const goTo = (index: number) => {
    const len = playlist.entries.length
    if (len === 0) return
    const clamped = playlist.loop
      ? ((index % len) + len) % len  // modulo wrap
      : Math.max(0, Math.min(len - 1, index))
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

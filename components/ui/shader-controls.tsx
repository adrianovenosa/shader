'use client'

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MODES } from '@/lib/modes'
import type { Preset } from '@/lib/presets'
import type { ParamSchema } from '@/lib/renderers/adapter'
import { formatParamValue } from '@/lib/format-param'
import { type EffectState } from '@/lib/effects'
import { EffectsControls } from '@/components/ui/effects-controls'
import { type PlaylistState } from '@/lib/playlist'
import { PlaylistEditor } from '@/components/ui/playlist-editor'

interface Props {
  open: boolean
  onToggle: () => void
  activeModeId: string
  activeTab: 'shaders' | 'generative'
  onTabChange: (tab: 'shaders' | 'generative') => void
  onModeChange: (id: string) => void
  params: Record<string, number>
  onParamChange: (p: Record<string, number>) => void
  presets: Preset[]
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onLoadPreset: (p: Preset) => void
  outputWidth: number
  outputHeight: number
  outputMode: 'full' | 'custom'
  onOutputChange: (w: number, h: number, mode: 'full' | 'custom') => void
  onImageUpload: (url: string | null) => void
  imageUrl: string | null
  effects: EffectState
  onEffectsChange: (e: EffectState) => void
  playlist: PlaylistState
  onPlaylistChange: (p: PlaylistState) => void
  onPresentationOpen: () => void
  alwaysFullscreen: boolean
  onAlwaysFullscreenChange: (v: boolean) => void
}

const OUTPUT_PRESETS = [
  { label: 'Full', w: 0, h: 0, mode: 'full' as const },
  { label: '1:1',  w: 1080, h: 1080, mode: 'custom' as const },
  { label: '16:9', w: 1920, h: 1080, mode: 'custom' as const },
  { label: '9:16', w: 1080, h: 1920, mode: 'custom' as const },
  { label: '4:3',  w: 1440, h: 1080, mode: 'custom' as const },
]

export function ShaderControls({
  open, onToggle, activeModeId, activeTab, onTabChange, onModeChange,
  params, onParamChange, presets, onSavePreset, onDeletePreset, onLoadPreset,
  outputWidth, outputHeight, outputMode, onOutputChange,
  onImageUpload, imageUrl,
  effects, onEffectsChange,
  playlist, onPlaylistChange, onPresentationOpen,
  alwaysFullscreen, onAlwaysFullscreenChange,
}: Props) {
  const fileRef       = useRef<HTMLInputElement>(null)
  const prevUrlRef    = useRef<string | null>(null)
  const hideTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gearVisible, setGearVisible] = useState(true)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName]   = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState('')
  const cancelEditRef = useRef(false)

  useEffect(() => {
    const show = () => {
      setGearVisible(true)
      clearTimeout(hideTimerRef.current!)
      hideTimerRef.current = setTimeout(() => setGearVisible(false), 3000)
    }
    show()
    window.addEventListener('mousemove', show)
    return () => { window.removeEventListener('mousemove', show); clearTimeout(hideTimerRef.current!) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key === 'h' || e.key === 'H') onToggle()
      if (e.key === 'f' || e.key === 'F') {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onToggle])

  const activeMode = MODES.find(m => m.id === activeModeId)
  const tabModes   = MODES.filter(m => m.tab === activeTab)

  const handleSlider = (schema: ParamSchema) => (e: ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value)
    onParamChange({ ...params, [schema.key]: schema.step === 1 ? Math.round(raw) : raw })
  }

  const handleButton = (schema: ParamSchema) => () => {
    onParamChange({ ...params, [schema.key]: (params[schema.key] ?? 0) + 1 })
  }

  const handleSelect = (schema: ParamSchema, idx: number) => {
    onParamChange({ ...params, [schema.key]: idx })
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    const url = URL.createObjectURL(file)
    prevUrlRef.current = url
    onImageUpload(url)
    e.target.value = ''
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    onSavePreset(presetName.trim())
    setPresetName('')
    setSavingPreset(false)
  }

  const handleOutputW = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    if (v > 0) onOutputChange(v, outputHeight, 'custom')
  }

  const handleOutputH = (e: ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    if (v > 0) onOutputChange(outputWidth, v, 'custom')
  }

  const commitEdit = useCallback((schema: ParamSchema) => {
    const parsed = parseFloat(draftValue)
    if (!isNaN(parsed)) {
      onParamChange({ ...params, [schema.key]: parsed })
    }
    setEditingKey(null)
  }, [draftValue, onParamChange, params])

  return (
    <div className="fixed top-3 right-3 z-20">
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className={[
          'w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md',
          'flex items-center justify-center text-white/60 hover:text-white',
          'transition-opacity duration-500 text-base',
          gearVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >⚙</button>

      <div
        aria-hidden={!open}
        className={[
          'absolute top-11 right-0 w-64 max-h-[90vh] overflow-y-auto',
          'bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4',
          'flex flex-col gap-3',
          'transition-all duration-200 origin-top-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        ].join(' ')}
      >
        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-lg p-0.5">
          {(['shaders', 'generative'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={[
                'text-[10px] py-1.5 rounded-md font-semibold transition-colors',
                activeTab === tab
                  ? 'bg-white/10 text-white'
                  : 'text-white/35 hover:text-white/60',
              ].join(' ')}
            >
              {tab === 'shaders' ? 'Shaders' : 'Generativo'}
            </button>
          ))}
        </div>

        {/* Mode grid */}
        <div className={`grid gap-1.5 ${activeTab === 'shaders' ? 'grid-cols-4' : 'grid-cols-5'}`}>
          {tabModes.map(m => (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              title={m.name}
              className={[
                'aspect-square rounded-lg overflow-hidden relative border-2 transition-colors',
                activeModeId === m.id ? 'border-blue-500' : 'border-transparent',
              ].join(' ')}
              style={{ background: m.thumbnail.bg }}
            >
              {m.thumbnailArt?.()}
              <span className="absolute bottom-0.5 inset-x-0 text-center text-[6px] font-semibold text-white/70 leading-none">
                {m.name}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-white/10" />

        {/* Dynamic controls */}
        {activeMode && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {activeMode.name}
            </p>
            {activeMode.params.map(schema => {
              const val = params[schema.key] ?? schema.default
              if (schema.type === 'hue') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/70">{schema.label}</span>
                    <span className="text-white/30">{Math.round(val)}°</span>
                  </div>
                  <input
                    type="range" min={0} max={360} step={1} value={val}
                    onChange={handleSlider(schema)}
                    className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                    style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
                  />
                </div>
              )
              if (schema.type === 'button') return (
                <button
                  key={schema.key}
                  onClick={handleButton(schema)}
                  className="border border-white/20 rounded-lg p-2 text-[10px] text-white/50 hover:text-white/80 hover:border-white/30 transition-colors"
                >
                  {schema.label}
                </button>
              )
              if (schema.type === 'select') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <span className="text-[11px] text-white/70">{schema.label}</span>
                  <div className="flex gap-1 flex-wrap">
                    {schema.options?.map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => handleSelect(schema, i)}
                        className={[
                          'text-[9px] px-2 py-1 rounded-md transition-colors',
                          Math.round(val) === i
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            : 'bg-white/8 text-white/40 border border-white/10',
                        ].join(' ')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )
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
                        onBlur={() => {
                          if (cancelEditRef.current) {
                            cancelEditRef.current = false
                            setEditingKey(null)
                          } else {
                            commitEdit(schema)
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.currentTarget.blur() }
                          if (e.key === 'Escape') { cancelEditRef.current = true; e.currentTarget.blur() }
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
            })}
          </>
        )}

        {activeTab === 'shaders' && (
          <>
            <EffectsControls effects={effects} onChange={onEffectsChange} />
            <div className="h-px bg-white/10" />
          </>
        )}

        {/* Presets */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Presets</p>
        {presets.length > 0 && (
          <div className="flex flex-col gap-1">
            {presets.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white/6 rounded-lg px-2.5 py-1.5">
                <button
                  onClick={() => onLoadPreset(p)}
                  className="text-[10px] text-white/60 hover:text-white flex-1 text-left"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => onDeletePreset(p.id)}
                  className="text-[9px] text-white/20 hover:text-red-400 ml-2"
                >✕</button>
              </div>
            ))}
          </div>
        )}
        {savingPreset ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={presetName}
              onChange={e => setPresetName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setSavingPreset(false) }}
              placeholder="Nome do preset"
              className="flex-1 bg-white/8 border border-white/15 rounded-md px-2 py-1 text-[10px] text-white/80 outline-none"
            />
            <button onClick={handleSavePreset} className="text-[10px] text-blue-400 px-2">OK</button>
          </div>
        ) : (
          <button
            onClick={() => setSavingPreset(true)}
            className="border border-dashed border-indigo-500/40 rounded-lg p-2 text-[10px] text-indigo-400/70 hover:text-indigo-300 hover:border-indigo-400/60 transition-colors"
          >
            📌 Salvar preset
          </button>
        )}

        <div className="h-px bg-white/10" />

        {/* Output size */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Output</p>
        <div className="flex items-center gap-1.5">
          <input
            type="number" value={outputWidth} onChange={handleOutputW} min={1}
            className="w-full bg-white/7 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/70 text-center outline-none"
          />
          <span className="text-[10px] text-white/20">×</span>
          <input
            type="number" value={outputHeight} onChange={handleOutputH} min={1}
            className="w-full bg-white/7 border border-white/10 rounded-md px-2 py-1 text-[10px] text-white/70 text-center outline-none"
          />
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
                  'text-[8px] px-2 py-0.5 rounded transition-colors',
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

        <div className="h-px bg-white/10" />

        {/* Image upload */}
        <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>
        {imageUrl && (
          <button
            onClick={() => onImageUpload(null)}
            className="border border-dashed border-red-500/30 rounded-lg p-2.5 flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 transition-colors"
          >
            <span className="text-lg leading-none">🗑</span>
            <span className="text-[10px]">Remover imagem</span>
          </button>
        )}

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
      </div>
    </div>
  )
}

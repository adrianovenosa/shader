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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

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

const SECTIONS_DEFAULT: Record<string, boolean> = {
  params: true, effects: false, presets: false,
  output: false, image: false, presentation: false,
}

function SectionHeader({
  label, open, onToggle, badge,
}: {
  label: string
  open: boolean
  onToggle: () => void
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between h-8 px-1 rounded-md hover:bg-white/5 transition-colors"
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-white/90">{label}</span>
      <div className="flex items-center gap-2">
        {badge && <span className="text-[10px] text-white/40">{badge}</span>}
        <span className={`text-white/40 text-sm transition-transform duration-200 inline-block ${open ? 'rotate-90' : ''}`}>›</span>
      </div>
    </button>
  )
}

function AccordionBody({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
        <div className="flex flex-col gap-3 pt-1 pb-1">
          {children}
        </div>
      </div>
    </div>
  )
}

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
  const activeEffectsCount = Object.values(effects).filter(e => e.enabled).length

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
          'dark',
          'absolute top-11 right-0 w-80 max-h-[90vh] overflow-y-auto',
          'bg-black/92 backdrop-blur-md border border-white/20 rounded-2xl p-4',
          'flex flex-col gap-1',
          'transition-all duration-200 origin-top-right',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        ].join(' ')}
      >
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={v => onTabChange(v as 'shaders' | 'generative')}>
          <TabsList className="w-full bg-white/5 h-8">
            <TabsTrigger value="shaders" className="flex-1 text-xs font-semibold">Shaders</TabsTrigger>
            <TabsTrigger value="generative" className="flex-1 text-xs font-semibold">Generativo</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Mode grid */}
        <div className={`grid gap-1.5 mt-2 ${activeTab === 'shaders' ? 'grid-cols-4' : 'grid-cols-5'}`}>
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
              <span className="absolute bottom-0.5 inset-x-0 text-center text-[8px] font-semibold text-white/70 leading-none">
                {m.name}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-col gap-1">

          {/* Parâmetros section */}
          <SectionHeader
            label={activeMode?.name ?? 'Parâmetros'}
            open={openSections.params}
            onToggle={() => toggleSection('params')}
          />
          <AccordionBody open={openSections.params}>
            {activeMode && activeMode.params.map(schema => {
              const val = params[schema.key] ?? schema.default
              if (schema.type === 'hue') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-white/70">{schema.label}</span>
                    <span className="text-white/55">{Math.round(val)}°</span>
                  </div>
                  <input
                    type="range" min={0} max={360} step={1} value={val}
                    onChange={e => onParamChange({ ...params, [schema.key]: parseFloat(e.target.value) })}
                    className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                    style={{ background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
                  />
                </div>
              )
              if (schema.type === 'button') return (
                <button
                  key={schema.key}
                  onClick={handleButton(schema)}
                  className="border border-white/20 rounded-lg p-2 text-xs text-white/50 hover:text-white/80 hover:border-white/30 transition-colors"
                >
                  {schema.label}
                </button>
              )
              if (schema.type === 'select') return (
                <div key={schema.key} className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-white/70">{schema.label}</span>
                  <div className="flex gap-1 flex-wrap">
                    {schema.options?.map((opt, i) => (
                      <button
                        key={opt}
                        onClick={() => handleSelect(schema, i)}
                        className={[
                          'text-[11px] px-2 py-1 rounded-md transition-colors',
                          Math.round(val) === i
                            ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            : 'bg-white/8 text-white/55 border border-white/10',
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
                  <div className="flex justify-between text-[13px] items-center">
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
                        className="w-14 text-right text-[13px] bg-transparent border-b border-white/30 text-white/80 outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingKey(schema.key); setDraftValue(display) }}
                        className="text-white/55 hover:text-white/75 text-[13px] bg-transparent border-none cursor-pointer"
                      >
                        {display}
                      </button>
                    )}
                  </div>
                  <Slider
                    min={schema.min}
                    max={schema.max}
                    step={schema.step}
                    value={[clampedVal]}
                    onValueChange={values => {
                      const v = typeof values === 'number' ? values : values[0]
                      onParamChange({ ...params, [schema.key]: schema.step === 1 ? Math.round(v) : v })
                    }}
                    className="w-full"
                  />
                </div>
              )
            })}
          </AccordionBody>

          {/* Efeitos section */}
          {activeTab === 'shaders' && (
            <>
              <SectionHeader
                label="Efeitos"
                open={openSections.effects}
                onToggle={() => toggleSection('effects')}
                badge={activeEffectsCount > 0 ? `${activeEffectsCount} ativos` : undefined}
              />
              <AccordionBody open={openSections.effects}>
                <EffectsControls effects={effects} onChange={onEffectsChange} />
              </AccordionBody>
            </>
          )}

          {/* Presets section */}
          <SectionHeader
            label="Presets"
            open={openSections.presets}
            onToggle={() => toggleSection('presets')}
            badge={presets.length > 0 ? `${presets.length} salvos` : undefined}
          />
          <AccordionBody open={openSections.presets}>
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
          </AccordionBody>

          {/* Output section */}
          <SectionHeader
            label="Output"
            open={openSections.output}
            onToggle={() => toggleSection('output')}
          />
          <AccordionBody open={openSections.output}>
            <div className="flex items-center gap-1.5">
              <Label className="sr-only" htmlFor="output-w">Largura</Label>
              <Input
                id="output-w"
                type="number"
                value={outputWidth}
                onChange={handleOutputW}
                min={1}
                className="h-7 text-xs text-center"
              />
              <span className="text-xs text-white/55">×</span>
              <Label className="sr-only" htmlFor="output-h">Altura</Label>
              <Input
                id="output-h"
                type="number"
                value={outputHeight}
                onChange={handleOutputH}
                min={1}
                className="h-7 text-xs text-center"
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
          </AccordionBody>

          {/* Imagem section */}
          <SectionHeader
            label="Imagem"
            open={openSections.image}
            onToggle={() => toggleSection('image')}
          />
          <AccordionBody open={openSections.image}>
            <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={handleFile} />
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
          </AccordionBody>

          {/* Apresentação section */}
          <SectionHeader
            label="Apresentação"
            open={openSections.presentation}
            onToggle={() => toggleSection('presentation')}
          />
          <AccordionBody open={openSections.presentation}>
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
          </AccordionBody>

        </div>
      </div>
    </div>
  )
}

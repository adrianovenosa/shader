'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { MODES, DEFAULT_MODE_ID } from '@/lib/modes'
import { CanvasRenderer } from '@/components/ui/canvas-renderer'
import { OutputFrame } from '@/components/ui/output-frame'
import { ShaderControls } from '@/components/ui/shader-controls'
import { DraggableImage } from '@/components/ui/draggable-image'
import {
  loadModeParams, saveModeParams, loadPresets, addPreset, removePreset,
  loadOutputSize, saveOutputSize, loadLastMode, saveActiveMode,
  loadDefaultImage, saveDefaultImage, clearDefaultImage,
  loadDefaultResolution, saveDefaultResolution,
  loadDefaultImageTransform, saveDefaultImageTransform,
  type Preset,
} from '@/lib/presets'
import { defaultsFromSchema } from '@/lib/renderers/adapter'
import { loadEffects, saveEffects, DEFAULT_EFFECTS, type EffectState } from '@/lib/effects'
import { loadPlaylist, savePlaylist, DEFAULT_PLAYLIST, type PlaylistState } from '@/lib/playlist'
import { PresentationOverlay } from '@/components/ui/presentation-overlay'

const DEBOUNCE_MS = 300

export default function Page() {
  const [activeModeId, setActiveModeId] = useState(DEFAULT_MODE_ID)
  const [activeTab,    setActiveTab]    = useState<'shaders' | 'generative'>('shaders')
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [imageUrl,     setImageUrl]     = useState<string | null>(null)
  const [outputWidth,  setOutputWidth]  = useState(1920)
  const [outputHeight, setOutputHeight] = useState(1080)
  const [outputMode,   setOutputMode]   = useState<'full' | 'custom'>('full')
  const [defaultImageBase64,  setDefaultImageBase64]  = useState<string | null>(null)
  const [imageTransform, setImageTransform] = useState<{ x: number; y: number; scale: number } | null>(null)
  const [defaultResolution,   setDefaultResolution]   = useState<{ width: number; height: number; mode: 'full' | 'custom' } | null>(null)
  const [params,       setParams]       = useState<Record<string, number>>(() => {
    const mode = MODES.find(m => m.id === DEFAULT_MODE_ID) ?? MODES[0]
    return defaultsFromSchema(mode.params)
  })
  const [presets, setPresets] = useState<Preset[]>([])
  const [effects, setEffects] = useState<EffectState>(DEFAULT_EFFECTS)
  const [presentationActive, setPresentationActive] = useState(false)
  const [playlist, setPlaylist]                     = useState<PlaylistState>(DEFAULT_PLAYLIST)
  const [alwaysFullscreen, setAlwaysFullscreen]     = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const effectsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevModeId = useRef(DEFAULT_MODE_ID)

  useEffect(() => {
    const { modeId, tab } = loadLastMode()

    const defRes = loadDefaultResolution()
    setDefaultResolution(defRes)
    const size = defRes ?? loadOutputSize()
    setOutputWidth(size.width)
    setOutputHeight(size.height)
    setOutputMode(size.mode)

    const defImg = loadDefaultImage()
    if (defImg) {
      setImageUrl(defImg)
      setDefaultImageBase64(defImg)
    }
    const defTransform = loadDefaultImageTransform()
    if (defTransform) setImageTransform(defTransform)

    if (modeId) {
      const mode = MODES.find(m => m.id === modeId)
      if (mode) {
        setActiveModeId(modeId)
        setActiveTab(tab)
        prevModeId.current = modeId
        const stored = loadModeParams(modeId)
        setParams(stored ?? defaultsFromSchema(mode.params))
        setPresets(loadPresets(modeId))
      }
    }
    setEffects(loadEffects(modeId ?? DEFAULT_MODE_ID))
    const pl = loadPlaylist()
    setPlaylist(pl)
    setAlwaysFullscreen(pl.alwaysFullscreen)
    if (pl.alwaysFullscreen) setPresentationActive(true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey) {
        setPresentationActive(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleModeChange = useCallback((id: string) => {
    saveModeParams(prevModeId.current, params)
    saveEffects(prevModeId.current, effects)
    prevModeId.current = id

    const mode = MODES.find(m => m.id === id) ?? MODES[0]
    const stored = loadModeParams(id)
    setActiveModeId(id)
    setActiveTab(mode.tab)
    setParams(stored ?? defaultsFromSchema(mode.params))
    setEffects(loadEffects(id))
    setPresets(loadPresets(id))
    saveActiveMode(id, mode.tab)
  }, [params, effects])

  const handleTabChange = useCallback((tab: 'shaders' | 'generative') => {
    setActiveTab(tab)
  }, [])

  const handleParamChange = useCallback((newParams: Record<string, number>) => {
    setParams(newParams)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveModeParams(prevModeId.current, newParams)
    }, DEBOUNCE_MS)
  }, [])

  const handleSavePreset = useCallback((name: string) => {
    const preset = addPreset(activeModeId, name, params)
    setPresets(prev => [...prev, preset])
  }, [activeModeId, params])

  const handleDeletePreset = useCallback((id: string) => {
    removePreset(activeModeId, id)
    setPresets(prev => prev.filter(p => p.id !== id))
  }, [activeModeId])

  const handleLoadPreset = useCallback((preset: Preset) => {
    setParams(preset.params)
  }, [])

  const handleOutputChange = useCallback((w: number, h: number, mode: 'full' | 'custom') => {
    setOutputWidth(w)
    setOutputHeight(h)
    setOutputMode(mode)
    saveOutputSize({ width: w, height: h, mode })
  }, [])

  const handleSetDefaultImage = useCallback((base64: string) => {
    saveDefaultImage(base64)
    if (imageTransform) saveDefaultImageTransform(imageTransform)
    setDefaultImageBase64(base64)
  }, [imageTransform])

  const handleClearDefaultImage = useCallback(() => {
    clearDefaultImage()
    setDefaultImageBase64(null)
    setImageTransform(null)
  }, [])

  const handleSetDefaultResolution = useCallback(() => {
    const size = { width: outputWidth, height: outputHeight, mode: outputMode }
    saveDefaultResolution(size)
    setDefaultResolution(size)
  }, [outputWidth, outputHeight, outputMode])

  const handleResetToDefaultResolution = useCallback(() => {
    if (!defaultResolution) return
    setOutputWidth(defaultResolution.width)
    setOutputHeight(defaultResolution.height)
    setOutputMode(defaultResolution.mode)
    saveOutputSize(defaultResolution)
  }, [defaultResolution])

  const handleImageUpload = useCallback((url: string | null) => {
    setImageUrl(url)
    if (url !== null) setImageTransform(null)
  }, [])

  const handleEffectsChange = useCallback((e: EffectState) => {
    setEffects(e)
    if (effectsSaveTimerRef.current) clearTimeout(effectsSaveTimerRef.current)
    effectsSaveTimerRef.current = setTimeout(() => saveEffects(activeModeId, e), 300)
  }, [activeModeId])

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

  return (
    <main className="fixed inset-0 overflow-hidden">
      <OutputFrame mode={outputMode} width={outputWidth} height={outputHeight}>
        <CanvasRenderer modeId={activeModeId} params={params} effects={effects} />
      </OutputFrame>

      {imageUrl && (
        <DraggableImage
          url={imageUrl}
          onRemove={() => setImageUrl(null)}
          initialTransform={imageTransform ?? undefined}
          onTransformChange={setImageTransform}
        />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        activeModeId={activeModeId}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onModeChange={handleModeChange}
        params={params}
        onParamChange={handleParamChange}
        presets={presets}
        onSavePreset={handleSavePreset}
        onDeletePreset={handleDeletePreset}
        onLoadPreset={handleLoadPreset}
        outputWidth={outputWidth}
        outputHeight={outputHeight}
        outputMode={outputMode}
        onOutputChange={handleOutputChange}
        onImageUpload={handleImageUpload}
        imageUrl={imageUrl}
        defaultImageBase64={defaultImageBase64}
        onSetDefaultImage={handleSetDefaultImage}
        onClearDefaultImage={handleClearDefaultImage}
        defaultResolution={defaultResolution}
        onSetDefaultResolution={handleSetDefaultResolution}
        onResetToDefaultResolution={handleResetToDefaultResolution}
        effects={effects}
        onEffectsChange={handleEffectsChange}
        playlist={playlist}
        onPlaylistChange={handlePlaylistChange}
        onPresentationOpen={() => setPresentationActive(true)}
        alwaysFullscreen={alwaysFullscreen}
        onAlwaysFullscreenChange={handleAlwaysFullscreenChange}
      />

      {presentationActive && (
        <PresentationOverlay
          playlist={playlist}
          onExit={() => setPresentationActive(false)}
          onLoadPreset={handlePresentationLoadPreset}
        />
      )}
    </main>
  )
}

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
  type Preset,
} from '@/lib/presets'
import { defaultsFromSchema } from '@/lib/renderers/adapter'
import { loadEffects, saveEffects, DEFAULT_EFFECTS, type EffectState } from '@/lib/effects'

const DEBOUNCE_MS = 300

export default function Page() {
  const [activeModeId, setActiveModeId] = useState(DEFAULT_MODE_ID)
  const [activeTab,    setActiveTab]    = useState<'shaders' | 'generative'>('shaders')
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [imageUrl,     setImageUrl]     = useState<string | null>(null)
  const [outputWidth,  setOutputWidth]  = useState(1920)
  const [outputHeight, setOutputHeight] = useState(1080)
  const [outputMode,   setOutputMode]   = useState<'full' | 'custom'>('full')
  const [params,       setParams]       = useState<Record<string, number>>(() => {
    const mode = MODES.find(m => m.id === DEFAULT_MODE_ID) ?? MODES[0]
    return defaultsFromSchema(mode.params)
  })
  const [presets, setPresets] = useState<Preset[]>([])
  const [effects, setEffects] = useState<EffectState>(DEFAULT_EFFECTS)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevModeId = useRef(DEFAULT_MODE_ID)

  useEffect(() => {
    const { modeId, tab } = loadLastMode()
    const size = loadOutputSize()
    setOutputWidth(size.width)
    setOutputHeight(size.height)
    setOutputMode(size.mode)
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
    setEffects(loadEffects())
  }, [])

  const handleModeChange = useCallback((id: string) => {
    saveModeParams(prevModeId.current, params)
    prevModeId.current = id

    const mode = MODES.find(m => m.id === id) ?? MODES[0]
    const stored = loadModeParams(id)
    setActiveModeId(id)
    setActiveTab(mode.tab)
    setParams(stored ?? defaultsFromSchema(mode.params))
    setPresets(loadPresets(id))
    saveActiveMode(id, mode.tab)
  }, [params])

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

  const handleEffectsChange = useCallback((e: EffectState) => {
    setEffects(e)
    saveEffects(e)
  }, [])

  return (
    <main className="fixed inset-0 overflow-hidden">
      <OutputFrame mode={outputMode} width={outputWidth} height={outputHeight}>
        <CanvasRenderer modeId={activeModeId} params={params} effects={effects} />
      </OutputFrame>

      {imageUrl && (
        <DraggableImage url={imageUrl} onRemove={() => setImageUrl(null)} />
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
        onImageUpload={setImageUrl}
        imageUrl={imageUrl}
        effects={effects}
        onEffectsChange={handleEffectsChange}
      />
    </main>
  )
}

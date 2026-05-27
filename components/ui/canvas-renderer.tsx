'use client'

import { useEffect, useRef } from 'react'
import type { RendererAdapter } from '@/lib/renderers/adapter'
import type { EffectState } from '@/lib/effects'
import { MODES } from '@/lib/modes'

interface Props {
  modeId:  string
  params:  Record<string, number>
  effects: EffectState
}

export function CanvasRenderer({ modeId, params, effects }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const adapterRef   = useRef<RendererAdapter | null>(null)
  const paramsRef    = useRef(params)
  const effectsRef   = useRef(effects)

  // Push param updates to live adapter
  useEffect(() => {
    paramsRef.current = params
    adapterRef.current?.updateParams(params)
  }, [params])

  // Push effect updates to live adapter
  useEffect(() => {
    effectsRef.current = effects
    adapterRef.current?.updateEffects?.(effects)
  }, [effects])

  // Swap adapter when mode changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    adapterRef.current?.dispose()
    container.innerHTML = ''

    const mode = MODES.find(m => m.id === modeId) ?? MODES[0]
    const adapter = mode.createAdapter()
    adapter.mount(container, paramsRef.current)
    adapter.updateEffects?.(effectsRef.current)
    adapterRef.current = adapter

    return () => {
      adapter.dispose()
      adapterRef.current = null
    }
  }, [modeId])

  // ResizeObserver drives adapter.resize()
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) adapterRef.current?.resize(width, height)
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  return <div ref={containerRef} className="w-full h-full" />
}

// lib/renderers/adapter.ts
import type React from 'react'
import type { EffectState } from '@/lib/effects'

export interface ParamSchema {
  key: string
  label: string
  type: 'slider' | 'hue' | 'select' | 'button'
  min?: number
  max?: number
  step?: number
  default: number
  options?: string[]
}

export interface ThumbnailDef {
  bg: string
  accentColor: string
}

export interface ModeDefinition {
  id: string
  name: string
  tab: 'shaders' | 'generative'
  thumbnail: ThumbnailDef
  thumbnailArt?: () => React.ReactNode
  params: ParamSchema[]
  createAdapter(): RendererAdapter
}

export interface RendererAdapter {
  mount(container: HTMLElement, params: Record<string, number>): void
  updateParams(params: Record<string, number>): void
  resize(width: number, height: number): void
  dispose(): void
  updateEffects?(effects: EffectState): void
}

export function defaultsFromSchema(params: ParamSchema[]): Record<string, number> {
  return Object.fromEntries(params.map(p => [p.key, p.default]))
}

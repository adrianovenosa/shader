import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

import {
  loadModeParams, saveModeParams,
  loadPresets, addPreset, removePreset,
  loadOutputSize, saveOutputSize,
  loadLastMode, saveActiveMode,
} from '@/lib/presets'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('modeParams', () => {
  it('returns null when nothing saved', () => {
    expect(loadModeParams('lines')).toBeNull()
  })
  it('round-trips params', () => {
    saveModeParams('lines', { speed: 0.1, hue: 90 })
    expect(loadModeParams('lines')).toEqual({ speed: 0.1, hue: 90 })
  })
  it('does not overwrite other modes', () => {
    saveModeParams('lines', { speed: 0.1 })
    saveModeParams('waves', { speed: 0.2 })
    expect(loadModeParams('lines')).toEqual({ speed: 0.1 })
  })
})

describe('presets', () => {
  it('returns [] when none saved', () => {
    expect(loadPresets('lines')).toEqual([])
  })
  it('adds and loads preset', () => {
    const p = addPreset('lines', 'My preset', { speed: 0.1 })
    expect(p.name).toBe('My preset')
    expect(p.id).toBe('test-uuid')
    expect(loadPresets('lines')).toHaveLength(1)
  })
  it('removes preset by id', () => {
    addPreset('lines', 'A', { speed: 0.1 })
    removePreset('lines', 'test-uuid')
    expect(loadPresets('lines')).toHaveLength(0)
  })
})

describe('outputSize', () => {
  it('returns defaults when nothing saved', () => {
    expect(loadOutputSize()).toEqual({ width: 1920, height: 1080, mode: 'full' })
  })
  it('round-trips custom size', () => {
    saveOutputSize({ width: 1080, height: 1080, mode: 'custom' })
    expect(loadOutputSize()).toEqual({ width: 1080, height: 1080, mode: 'custom' })
  })
})

describe('activeMode', () => {
  it('returns null tab shaders by default', () => {
    expect(loadLastMode()).toEqual({ modeId: null, tab: 'shaders' })
  })
  it('round-trips mode + tab', () => {
    saveActiveMode('kaleidoscope', 'generative')
    expect(loadLastMode()).toEqual({ modeId: 'kaleidoscope', tab: 'generative' })
  })
})

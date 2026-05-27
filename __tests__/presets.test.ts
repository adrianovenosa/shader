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
  loadDefaultImage, saveDefaultImage, clearDefaultImage,
  loadDefaultResolution, saveDefaultResolution,
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

describe('defaultImage', () => {
  it('returns null when nothing saved', () => {
    expect(loadDefaultImage()).toBeNull()
  })
  it('round-trips a base64 data URL', () => {
    saveDefaultImage('data:image/png;base64,abc123')
    expect(loadDefaultImage()).toBe('data:image/png;base64,abc123')
  })
  it('clear removes the saved image', () => {
    saveDefaultImage('data:image/png;base64,abc123')
    clearDefaultImage()
    expect(loadDefaultImage()).toBeNull()
  })
  it('clearing does not affect other stored values', () => {
    saveModeParams('lines', { speed: 0.5 })
    saveDefaultImage('data:image/png;base64,test')
    clearDefaultImage()
    expect(loadModeParams('lines')).toEqual({ speed: 0.5 })
  })
})

describe('defaultResolution', () => {
  it('returns null when nothing saved', () => {
    expect(loadDefaultResolution()).toBeNull()
  })
  it('round-trips a custom resolution', () => {
    saveDefaultResolution({ width: 1080, height: 1080, mode: 'custom' })
    expect(loadDefaultResolution()).toEqual({ width: 1080, height: 1080, mode: 'custom' })
  })
  it('round-trips full mode resolution', () => {
    saveDefaultResolution({ width: 1920, height: 1080, mode: 'full' })
    expect(loadDefaultResolution()).toEqual({ width: 1920, height: 1080, mode: 'full' })
  })
  it('saving resolution does not affect defaultImage', () => {
    saveDefaultImage('data:image/png;base64,abc123')
    saveDefaultResolution({ width: 1080, height: 1080, mode: 'custom' })
    expect(loadDefaultImage()).toBe('data:image/png;base64,abc123')
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import { loadEffects, saveEffects, DEFAULT_EFFECTS } from '@/lib/effects'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('effects persistence', () => {
  it('returns DEFAULT_EFFECTS when nothing saved', () => {
    const e = loadEffects('waves')
    expect(e.grain.enabled).toBe(false)
    expect(e.grain.intensity).toBe(0.15)
    expect(e.bloom.threshold).toBe(0.6)
  })

  it('round-trips effects for a given mode', () => {
    const custom = { ...DEFAULT_EFFECTS, grain: { enabled: true, intensity: 0.5 } }
    saveEffects('waves', custom)
    const loaded = loadEffects('waves')
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.grain.intensity).toBe(0.5)
  })

  it('preserves defaults for missing keys', () => {
    localStorage.setItem('shader-app-effects-lines', JSON.stringify({ grain: { enabled: true, intensity: 0.3 } }))
    const loaded = loadEffects('lines')
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.bloom.enabled).toBe(false)
  })

  it('isolates effects between modes', () => {
    const wavesEffects = { ...DEFAULT_EFFECTS, grain: { enabled: true, intensity: 0.8 } }
    const linesEffects = { ...DEFAULT_EFFECTS, crt:  { enabled: true, intensity: 0.5 } }
    saveEffects('waves', wavesEffects)
    saveEffects('lines', linesEffects)

    expect(loadEffects('waves').grain.enabled).toBe(true)
    expect(loadEffects('waves').crt.enabled).toBe(false)
    expect(loadEffects('lines').crt.enabled).toBe(true)
    expect(loadEffects('lines').grain.enabled).toBe(false)
  })
})

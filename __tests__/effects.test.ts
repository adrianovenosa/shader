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
    const e = loadEffects()
    expect(e.grain.enabled).toBe(false)
    expect(e.grain.intensity).toBe(0.15)
    expect(e.bloom.threshold).toBe(0.6)
  })
  it('round-trips effects', () => {
    const custom = { ...DEFAULT_EFFECTS, grain: { enabled: true, intensity: 0.5 } }
    saveEffects(custom)
    const loaded = loadEffects()
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.grain.intensity).toBe(0.5)
  })
  it('preserves defaults for missing keys', () => {
    localStorage.setItem('shader-app-effects', JSON.stringify({ grain: { enabled: true, intensity: 0.3 } }))
    const loaded = loadEffects()
    expect(loaded.grain.enabled).toBe(true)
    expect(loaded.bloom.enabled).toBe(false)
  })
})

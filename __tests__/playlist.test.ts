import { describe, it, expect, beforeEach, vi } from 'vitest'

const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v },
  removeItem: (k: string) => { delete store[k] },
})

import {
  loadPlaylist, savePlaylist, DEFAULT_PLAYLIST,
  type PlaylistState,
} from '@/lib/playlist'

beforeEach(() => { Object.keys(store).forEach(k => delete store[k]) })

describe('playlist persistence', () => {
  it('returns DEFAULT_PLAYLIST when nothing saved', () => {
    const p = loadPlaylist()
    expect(p.entries).toEqual([])
    expect(p.loop).toBe(true)
    expect(p.alwaysFullscreen).toBe(false)
  })
  it('round-trips playlist state', () => {
    const state: PlaylistState = {
      entries: [{ modeId: 'lines', presetId: 'abc', duration: 8 }],
      loop: false,
      alwaysFullscreen: true,
    }
    savePlaylist(state)
    const loaded = loadPlaylist()
    expect(loaded.entries).toHaveLength(1)
    expect(loaded.entries[0].presetId).toBe('abc')
    expect(loaded.loop).toBe(false)
    expect(loaded.alwaysFullscreen).toBe(true)
  })
  it('returns default on corrupt data', () => {
    localStorage.setItem('shader-app-playlist', 'not-json')
    expect(loadPlaylist()).toEqual(DEFAULT_PLAYLIST)
  })
})

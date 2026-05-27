export interface PlaylistEntry {
  modeId:   string
  presetId: string
  duration: number
}

export interface PlaylistState {
  entries:          PlaylistEntry[]
  loop:             boolean
  alwaysFullscreen: boolean
}

export const DEFAULT_PLAYLIST: PlaylistState = {
  entries:          [],
  loop:             true,
  alwaysFullscreen: false,
}

const KEY = 'shader-app-playlist'

export function loadPlaylist(): PlaylistState {
  if (typeof window === 'undefined') return DEFAULT_PLAYLIST
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PLAYLIST
    const parsed = JSON.parse(raw)
    return {
      entries:          Array.isArray(parsed.entries) ? parsed.entries : [],
      loop:             typeof parsed.loop === 'boolean' ? parsed.loop : true,
      alwaysFullscreen: typeof parsed.alwaysFullscreen === 'boolean' ? parsed.alwaysFullscreen : false,
    }
  } catch { return DEFAULT_PLAYLIST }
}

export function savePlaylist(state: PlaylistState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {}
}

const KEY = 'shader-app'

export interface Preset {
  id: string
  name: string
  params: Record<string, number>
  createdAt: number
}

interface Store {
  activeMode?: string
  activeTab?: 'shaders' | 'generative'
  modeParams?: Record<string, Record<string, number>>
  presets?: Record<string, Preset[]>
  outputSize?: { width: number; height: number; mode: 'full' | 'custom' }
  defaultImage?: string
  defaultResolution?: { width: number; height: number; mode: 'full' | 'custom' }
}

function load(): Store {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

function save(s: Store) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {}
}

export function loadModeParams(id: string): Record<string, number> | null {
  return load().modeParams?.[id] ?? null
}

export function saveModeParams(id: string, params: Record<string, number>) {
  const s = load()
  save({ ...s, modeParams: { ...s.modeParams, [id]: params } })
}

export function loadPresets(id: string): Preset[] {
  return load().presets?.[id] ?? []
}

export function addPreset(modeId: string, name: string, params: Record<string, number>): Preset {
  const preset: Preset = { id: crypto.randomUUID(), name, params, createdAt: Date.now() }
  const s = load()
  const existing = s.presets?.[modeId] ?? []
  save({ ...s, presets: { ...s.presets, [modeId]: [...existing, preset] } })
  return preset
}

export function removePreset(modeId: string, id: string) {
  const s = load()
  const existing = s.presets?.[modeId] ?? []
  save({ ...s, presets: { ...s.presets, [modeId]: existing.filter(p => p.id !== id) } })
}

export function loadOutputSize(): { width: number; height: number; mode: 'full' | 'custom' } {
  return load().outputSize ?? { width: 1920, height: 1080, mode: 'full' }
}

export function saveOutputSize(size: { width: number; height: number; mode: 'full' | 'custom' }) {
  save({ ...load(), outputSize: size })
}

export function loadLastMode(): { modeId: string | null; tab: 'shaders' | 'generative' } {
  const s = load()
  return { modeId: s.activeMode ?? null, tab: s.activeTab ?? 'shaders' }
}

export function saveActiveMode(modeId: string, tab: 'shaders' | 'generative') {
  save({ ...load(), activeMode: modeId, activeTab: tab })
}

export function loadDefaultImage(): string | null {
  return load().defaultImage ?? null
}

export function saveDefaultImage(base64: string) {
  save({ ...load(), defaultImage: base64 })
}

export function clearDefaultImage() {
  const s = load()
  delete s.defaultImage
  save(s)
}

// Returns null when no default has been set; callers should fall back to loadOutputSize()
export function loadDefaultResolution(): { width: number; height: number; mode: 'full' | 'custom' } | null {
  return load().defaultResolution ?? null
}

export function saveDefaultResolution(size: { width: number; height: number; mode: 'full' | 'custom' }) {
  save({ ...load(), defaultResolution: size })
}

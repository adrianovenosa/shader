type BaseEffect = { enabled: boolean; intensity: number }
type HalftoneEffect = BaseEffect & { dotSize: number }
type BloomEffect    = BaseEffect & { threshold: number }

export interface EffectState {
  grain:    BaseEffect
  chrAber:  BaseEffect
  crt:      BaseEffect
  halftone: HalftoneEffect
  bloom:    BloomEffect
}

export const DEFAULT_EFFECTS: EffectState = {
  grain:    { enabled: false, intensity: 0.15 },
  chrAber:  { enabled: false, intensity: 0.005 },
  crt:      { enabled: false, intensity: 0.6 },
  halftone: { enabled: false, intensity: 1.0, dotSize: 3.0 },
  bloom:    { enabled: false, intensity: 0.4, threshold: 0.6 },
}

const KEY = 'shader-app-effects'

export function loadEffects(): EffectState {
  if (typeof window === 'undefined') return DEFAULT_EFFECTS
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_EFFECTS
    const parsed = JSON.parse(raw)
    return {
      grain:    { ...DEFAULT_EFFECTS.grain,    ...parsed.grain },
      chrAber:  { ...DEFAULT_EFFECTS.chrAber,  ...parsed.chrAber },
      crt:      { ...DEFAULT_EFFECTS.crt,      ...parsed.crt },
      halftone: { ...DEFAULT_EFFECTS.halftone, ...parsed.halftone },
      bloom:    { ...DEFAULT_EFFECTS.bloom,    ...parsed.bloom },
    }
  } catch { return DEFAULT_EFFECTS }
}

export function saveEffects(effects: EffectState) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(effects)) } catch {}
}

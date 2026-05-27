'use client'

import type { EffectState } from '@/lib/effects'

interface Props {
  effects: EffectState
  onChange: (effects: EffectState) => void
}

type EffectKey = keyof EffectState

const EFFECT_LABELS: Record<EffectKey, string> = {
  grain:    'Grain',
  chrAber:  'Chromatic Ab.',
  crt:      'CRT',
  halftone: 'Halftone',
  bloom:    'Bloom',
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'relative w-7 h-4 rounded-full transition-colors shrink-0',
        on ? 'bg-blue-500' : 'bg-white/15',
      ].join(' ')}
    >
      <span className={[
        'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
        on ? 'translate-x-3.5' : 'translate-x-0.5',
      ].join(' ')} />
    </button>
  )
}

function IntensitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range" min={0} max={1} step={0.01} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
    />
  )
}

export function EffectsControls({ effects, onChange }: Props) {
  const update = (key: EffectKey, patch: object) =>
    onChange({ ...effects, [key]: { ...effects[key], ...patch } })

  return (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Efeitos</p>

      {(Object.keys(EFFECT_LABELS) as EffectKey[]).map(key => {
        const effect = effects[key]
        return (
          <div key={key} className="flex flex-col gap-1.5">
            {/* Row: toggle + label + intensity value */}
            <div className="flex items-center gap-2">
              <Toggle
                on={effect.enabled}
                onToggle={() => update(key, { enabled: !effect.enabled })}
              />
              <span className="text-[11px] text-white/70 flex-1">{EFFECT_LABELS[key]}</span>
              {effect.enabled && (
                <span className="text-[11px] text-white/30">
                  {effect.intensity.toFixed(2)}
                </span>
              )}
            </div>

            {/* Intensity slider */}
            {effect.enabled && (
              <IntensitySlider
                value={effect.intensity}
                onChange={v => update(key, { intensity: v })}
              />
            )}

            {/* Halftone extras */}
            {effect.enabled && key === 'halftone' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/50">Dot size</span>
                  <span className="text-white/30">{effects.halftone.dotSize.toFixed(1)}</span>
                </div>
                <input
                  type="range" min={1} max={8} step={0.5}
                  value={effects.halftone.dotSize}
                  onChange={e => onChange({ ...effects, halftone: { ...effects.halftone, dotSize: parseFloat(e.target.value) } })}
                  className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                />
              </div>
            )}

            {/* Bloom extras */}
            {effect.enabled && key === 'bloom' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/50">Threshold</span>
                  <span className="text-white/30">{effects.bloom.threshold.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={effects.bloom.threshold}
                  onChange={e => onChange({ ...effects, bloom: { ...effects.bloom, threshold: parseFloat(e.target.value) } })}
                  className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

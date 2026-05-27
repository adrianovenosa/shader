'use client'

import type { EffectState } from '@/lib/effects'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

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

export function EffectsControls({ effects, onChange }: Props) {
  const update = (key: EffectKey, patch: object) =>
    onChange({ ...effects, [key]: { ...effects[key], ...patch } })

  return (
    <>
      {(Object.keys(EFFECT_LABELS) as EffectKey[]).map(key => {
        const effect = effects[key]
        return (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Switch
                id={`effect-${key}`}
                checked={effect.enabled}
                onCheckedChange={v => update(key, { enabled: v })}
              />
              <Label
                htmlFor={`effect-${key}`}
                className="text-[13px] text-white/70 flex-1 cursor-pointer font-normal"
              >
                {EFFECT_LABELS[key]}
              </Label>
              {effect.enabled && (
                <span className="text-[13px] text-white/30">
                  {effect.intensity.toFixed(2)}
                </span>
              )}
            </div>

            {effect.enabled && (
              <Slider
                min={0} max={1} step={0.01}
                value={[effect.intensity]}
                onValueChange={values => {
                  const v = typeof values === 'number' ? values : values[0]
                  update(key, { intensity: v })
                }}
                className="w-full"
              />
            )}

            {effect.enabled && key === 'halftone' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/50">Dot size</span>
                  <span className="text-white/30">{effects.halftone.dotSize.toFixed(1)}</span>
                </div>
                <Slider
                  min={1} max={8} step={0.5}
                  value={[effects.halftone.dotSize]}
                  onValueChange={values => {
                    const v = typeof values === 'number' ? values : values[0]
                    onChange({ ...effects, halftone: { ...effects.halftone, dotSize: v } })
                  }}
                  className="w-full"
                />
              </div>
            )}

            {effect.enabled && key === 'bloom' && (
              <div className="flex flex-col gap-1 pl-9">
                <div className="flex justify-between text-[13px]">
                  <span className="text-white/50">Threshold</span>
                  <span className="text-white/30">{effects.bloom.threshold.toFixed(2)}</span>
                </div>
                <Slider
                  min={0} max={1} step={0.01}
                  value={[effects.bloom.threshold]}
                  onValueChange={values => {
                    const v = typeof values === 'number' ? values : values[0]
                    onChange({ ...effects, bloom: { ...effects.bloom, threshold: v } })
                  }}
                  className="w-full"
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

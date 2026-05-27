import { describe, it, expect } from 'vitest'
import { linesMode } from '@/lib/modes/shaders/lines'
import { wavesMode } from '@/lib/modes/shaders/waves'

describe('linesMode params', () => {
  it('includes expandX slider with correct config', () => {
    const expandX = linesMode.params.find(p => p.key === 'expandX')
    expect(expandX).toBeDefined()
    expect(expandX?.type).toBe('slider')
    expect(expandX?.min).toBe(0.25)
    expect(expandX?.max).toBe(4.0)
    expect(expandX?.step).toBe(0.25)
    expect(expandX?.default).toBe(1.0)
  })
})

describe('wavesMode params', () => {
  it('includes amplitude slider with correct config', () => {
    const amplitude = wavesMode.params.find(p => p.key === 'amplitude')
    expect(amplitude).toBeDefined()
    expect(amplitude?.type).toBe('slider')
    expect(amplitude?.min).toBe(0.05)
    expect(amplitude?.max).toBe(0.8)
    expect(amplitude?.step).toBe(0.05)
    expect(amplitude?.default).toBe(0.3)
  })

  it('amplitude slider appears before hue', () => {
    const keys = wavesMode.params.map(p => p.key)
    const ampIdx = keys.indexOf('amplitude')
    const hueIdx = keys.indexOf('hue')
    expect(ampIdx).toBeGreaterThan(-1)
    expect(ampIdx).toBeLessThan(hueIdx)
  })
})

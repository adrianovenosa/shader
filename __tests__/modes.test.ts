import { describe, it, expect } from 'vitest'
import { linesMode } from '@/lib/modes/shaders/lines'

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

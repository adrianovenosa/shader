import { describe, it, expect } from 'vitest'
import { formatParamValue } from '@/lib/format-param'

describe('formatParamValue', () => {
  it('rounds to integer when step === 1', () => {
    expect(formatParamValue(4.7, { step: 1 })).toBe('5')
    expect(formatParamValue(5.0, { step: 1 })).toBe('5')
  })
  it('uses 4 decimal places when step < 0.01', () => {
    expect(formatParamValue(0.0008, { step: 0.0001 })).toBe('0.0008')
  })
  it('uses 3 decimal places for other steps', () => {
    expect(formatParamValue(0.05, { step: 0.005 })).toBe('0.050')
    expect(formatParamValue(4.0, { step: 0.5 })).toBe('4.000')
  })
})

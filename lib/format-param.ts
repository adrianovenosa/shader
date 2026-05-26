import type { ParamSchema } from '@/lib/renderers/adapter'

export function formatParamValue(val: number, schema: Pick<ParamSchema, 'step'>): string {
  if (schema.step === 1) return String(Math.round(val))
  return val.toFixed(schema.step && schema.step < 0.01 ? 4 : 3)
}

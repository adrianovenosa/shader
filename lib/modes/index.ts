import { linesMode }   from './shaders/lines'
import { wavesMode }   from './shaders/waves'
import { perlinMode }  from './shaders/perlin'
import { fractalMode } from './shaders/fractal'
import type { ModeDefinition } from '@/lib/renderers/adapter'

export const MODES: ModeDefinition[] = [
  linesMode,
  wavesMode,
  perlinMode,
  fractalMode,
]

export const DEFAULT_MODE_ID = 'lines'

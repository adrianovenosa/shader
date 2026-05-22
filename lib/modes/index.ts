import { linesMode }              from './shaders/lines'
import { wavesMode }              from './shaders/waves'
import { perlinMode }             from './shaders/perlin'
import { fractalMode }            from './shaders/fractal'
import { colorInterpolationMode } from './generative/color-interpolation'
import { kaleidoscopeMode }       from './generative/kaleidoscope'
import { bezierFlowMode }         from './generative/bezier-flow'
import { noiseFieldMode }         from './generative/noise-field'
import { smokeParticlesMode }     from './generative/smoke-particles'
import { gameOfLifeMode }         from './generative/game-of-life'
import { lissajousMode }          from './generative/lissajous'
import { reactionDiffusionMode }  from './generative/reaction-diffusion'
import { truchetTilesMode }       from './generative/truchet-tiles'
import type { ModeDefinition }    from '@/lib/renderers/adapter'

export const MODES: ModeDefinition[] = [
  linesMode, wavesMode, perlinMode, fractalMode,
  colorInterpolationMode, kaleidoscopeMode, bezierFlowMode, noiseFieldMode,
  smokeParticlesMode, gameOfLifeMode, lissajousMode,
  reactionDiffusionMode, truchetTilesMode,
]

export const DEFAULT_MODE_ID = 'lines'

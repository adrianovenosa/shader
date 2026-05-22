import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { wavesFragment } from '@/lib/shaders'

export const wavesMode: ModeDefinition = {
  id: 'waves',
  name: 'Waves',
  tab: 'shaders',
  thumbnail: {
    bg: 'linear-gradient(160deg, #080f12 0%, #0a1e14 100%)',
    accentColor: 'rgba(60,220,120,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,    step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001, max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,      max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,      max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,      max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(wavesFragment),
}

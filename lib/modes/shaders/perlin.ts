import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { perlinFragment } from '@/lib/shaders'

export const perlinMode: ModeDefinition = {
  id: 'perlin',
  name: 'Perlin',
  tab: 'shaders',
  thumbnail: { bg: '#080608', accentColor: 'rgba(160,80,255,0.8)' },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,    step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001, max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,      max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,      max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,      max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(perlinFragment),
}

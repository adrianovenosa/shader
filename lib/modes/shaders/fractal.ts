import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createThreeAdapter } from '@/lib/renderers/three-adapter'
import { fractalFragment } from '@/lib/shaders'

export const fractalMode: ModeDefinition = {
  id: 'fractal',
  name: 'Fractal',
  tab: 'shaders',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 50% 50%, #1a0822 0%, #06020e 70%)',
    accentColor: 'rgba(255,100,200,0.7)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,    step: 0.005,  default: 0.05 },
    { key: 'lineWidth', label: 'Espessura',  type: 'slider', min: 0.0001, max: 0.003, step: 0.0001, default: 0.0008 },
    { key: 'mosaic',    label: 'Pixelação',  type: 'slider', min: 1,      max: 16,    step: 0.5,    default: 4.0 },
    { key: 'lines',     label: 'Linhas',     type: 'slider', min: 1,      max: 8,     step: 1,      default: 5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,      max: 360,   step: 1,      default: 0 },
  ],
  createAdapter: () => createThreeAdapter(fractalFragment),
}

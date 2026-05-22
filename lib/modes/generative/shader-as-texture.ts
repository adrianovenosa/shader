import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createShaderTextureAdapter } from '@/lib/renderers/shader-texture-adapter'
import { SHADERS } from '@/lib/shaders'

export const shaderAsTextureMode: ModeDefinition = {
  id: 'shader-as-texture',
  name: 'Shader 3D',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 50% 40%, #1a1020 0%, #050308 70%)',
    accentColor: 'rgba(255,160,80,0.8)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',    type: 'slider', min: 0.005, max: 0.2,  step: 0.005, default: 0.05 },
    { key: 'forma',       label: 'Forma',         type: 'select', default: 0, options: ['Esfera', 'Cubo', 'Torus'] },
    { key: 'rotX',        label: 'Rotação X',     type: 'slider', min: 0,     max: 0.05, step: 0.001, default: 0.005 },
    { key: 'rotY',        label: 'Rotação Y',     type: 'slider', min: 0,     max: 0.05, step: 0.001, default: 0.01 },
    { key: 'wireframe',   label: 'Wireframe',     type: 'slider', min: 0,     max: 1,    step: 1,     default: 0 },
    { key: 'shaderFonte', label: 'Shader',        type: 'select', default: 0, options: SHADERS.map(s => s.name) },
    { key: 'hue',         label: 'Cor',           type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createShaderTextureAdapter(),
}

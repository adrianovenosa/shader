import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    p.noStroke()
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, nCores = 5, saturacao = 0.8, brilho = 0.9 } = getParams()
    const t = p.frameCount * speed * 0.01
    const cols = 60, rows = 40
    const cw = p.width / cols + 1
    const ch = p.height / rows + 1

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const n = p.noise(i * 0.08, j * 0.08, t)
        const h2 = (hue + n * Math.round(nCores) * (360 / Math.round(nCores))) % 360
        p.fill(h2, saturacao * 100, brilho * 100)
        p.rect(i * (p.width / cols), j * (p.height / rows), cw, ch)
      }
    }
  }
}

export const colorInterpolationMode: ModeDefinition = {
  id: 'color-interpolation',
  name: 'Color Interp',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(135deg, #ff0080 0%, #00ffff 50%, #8000ff 100%)',
    accentColor: 'rgba(255,0,128,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.2,  step: 0.005, default: 0.05 },
    { key: 'nCores',    label: 'Nº cores',   type: 'slider', min: 2,     max: 8,    step: 1,     default: 5 },
    { key: 'saturacao', label: 'Saturação',  type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.8 },
    { key: 'brilho',    label: 'Brilho',     type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.9 },
    { key: 'hue',       label: 'Cor base',   type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

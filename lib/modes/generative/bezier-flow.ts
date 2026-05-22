import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.02, hue = 0, quantidade = 20, espessura = 1, decay = 0.97, opacidade = 0.8 } = getParams()
    const t = p.frameCount * speed * 0.01
    const w = p.width, h = p.height

    p.noStroke()
    p.fill(0, 0, 0, (1 - decay) * 100)
    p.rect(0, 0, w, h)

    p.noFill()
    const n = Math.round(quantidade)
    for (let i = 0; i < n; i++) {
      const fi = i / n
      const x1 = p.noise(fi, 0,  t) * w, y1 = p.noise(fi, 1,  t) * h
      const x2 = p.noise(fi, 2,  t + 1) * w, y2 = p.noise(fi, 3,  t + 1) * h
      const x3 = p.noise(fi, 4,  t + 0.5) * w, y3 = p.noise(fi, 5,  t + 0.5) * h
      const x4 = p.noise(fi, 6,  t) * w, y4 = p.noise(fi, 7,  t) * h
      const h2 = (hue + fi * 120 + t * 20) % 360
      p.stroke(h2, 80, 90, opacidade * 100)
      p.strokeWeight(espessura)
      p.bezier(x1, y1, x2, y2, x3, y3, x4, y4)
    }
  }
}

export const bezierFlowMode: ModeDefinition = {
  id: 'bezier-flow',
  name: 'Bezier Flow',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #001a0d 0%, #0d1a00 100%)',
    accentColor: 'rgba(60,220,120,0.9)',
  },
  params: [
    { key: 'speed',      label: 'Velocidade', type: 'slider', min: 0.005, max: 0.15, step: 0.005, default: 0.02 },
    { key: 'quantidade', label: 'Curvas',     type: 'slider', min: 1,     max: 60,   step: 1,     default: 20 },
    { key: 'espessura',  label: 'Espessura',  type: 'slider', min: 0.5,   max: 5,    step: 0.5,   default: 1 },
    { key: 'decay',      label: 'Rastro',     type: 'slider', min: 0.9,   max: 0.999,step: 0.001, default: 0.97 },
    { key: 'opacidade',  label: 'Opacidade',  type: 'slider', min: 0.1,   max: 1,    step: 0.05,  default: 0.8 },
    { key: 'hue',        label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 120 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

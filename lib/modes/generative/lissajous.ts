import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.02, hue = 200, freqX = 3, freqY = 2, fase = 0, decay = 0.98, espessura = 1.5 } = getParams()
    const t = p.frameCount * speed * 0.03
    const cx = p.width / 2, cy = p.height / 2
    const r = Math.min(p.width, p.height) * 0.42

    p.noStroke()
    p.fill(0, 0, 0, (1 - decay) * 100)
    p.rect(0, 0, p.width, p.height)

    p.noFill()
    p.strokeWeight(espessura)
    const steps = 600
    for (let i = 0; i < steps; i++) {
      const theta = (i / steps) * Math.PI * 2
      const x = cx + r * Math.sin(freqX * theta + fase + t)
      const y = cy + r * Math.sin(freqY * theta)
      p.stroke((hue + (i / steps) * 120) % 360, 80, 90, 80)
      p.point(x, y)
    }
  }
}

export const lissajousMode: ModeDefinition = {
  id: 'lissajous',
  name: 'Lissajous',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #0a0510 0%, #05000f 100%)',
    accentColor: 'rgba(100,100,255,0.9)',
  },
  params: [
    { key: 'speed',     label: 'Velocidade', type: 'slider', min: 0.005, max: 0.1,  step: 0.005, default: 0.02 },
    { key: 'freqX',     label: 'Freq X',     type: 'slider', min: 1,     max: 10,   step: 1,     default: 3 },
    { key: 'freqY',     label: 'Freq Y',     type: 'slider', min: 1,     max: 10,   step: 1,     default: 2 },
    { key: 'fase',      label: 'Fase',       type: 'slider', min: 0,     max: 6.28, step: 0.05,  default: 0 },
    { key: 'decay',     label: 'Rastro',     type: 'slider', min: 0.95,  max: 0.999,step: 0.001, default: 0.98 },
    { key: 'espessura', label: 'Espessura',  type: 'slider', min: 0.5,   max: 4,    step: 0.5,   default: 1.5 },
    { key: 'hue',       label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 200 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

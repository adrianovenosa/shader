import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let pg: any

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    pg = p.createGraphics(size.w, size.h)
    pg.colorMode(pg.HSB, 360, 100, 100, 100)
    pg.noStroke()
  }

  p.draw = () => {
    const { speed = 0.03, hue = 0, fatias = 8, zoom = 1.0 } = getParams()
    const t = p.frameCount * speed * 0.01
    const n = Math.max(2, Math.round(fatias))
    const cx = p.width / 2, cy = p.height / 2

    pg.background(0)
    for (let i = 0; i < 80; i++) {
      const nx = p.noise(i * 0.2, 0, t)
      const ny = p.noise(i * 0.2, 100, t)
      const nh = p.noise(i * 0.2, 200, t)
      const x = (nx - 0.5) * p.width * 0.8 + cx
      const y = (ny - 0.5) * p.height * 0.8 + cy
      pg.fill((hue + nh * 120) % 360, 80, 90, 80)
      pg.ellipse(x, y, 30 + nh * 60, 30 + nh * 60)
    }

    p.background(0)
    const sliceAngle = (Math.PI * 2) / n
    for (let i = 0; i < n; i++) {
      p.push()
      p.translate(cx, cy)
      p.rotate(i * sliceAngle)
      p.scale(zoom, zoom)
      if (i % 2 === 1) p.scale(-1, 1)
      p.image(pg, -cx, -cy)
      p.pop()
    }
  }
}

export const kaleidoscopeMode: ModeDefinition = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(circle at 50% 50%, #2a0a4a 0%, #0a0015 70%)',
    accentColor: 'rgba(180,80,255,0.9)',
  },
  params: [
    { key: 'speed',  label: 'Velocidade', type: 'slider', min: 0.005, max: 0.15, step: 0.005, default: 0.03 },
    { key: 'fatias', label: 'Fatias',     type: 'slider', min: 2,     max: 24,   step: 1,     default: 8 },
    { key: 'zoom',   label: 'Zoom',       type: 'slider', min: 0.5,   max: 2.5,  step: 0.1,   default: 1.0 },
    { key: 'hue',    label: 'Cor',        type: 'hue',    min: 0,     max: 360,  step: 1,     default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

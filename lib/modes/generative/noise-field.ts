import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

interface Particle { x: number; y: number; px: number; py: number }

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let particles: Particle[] = []

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, particulas = 1000, escalaRuido = 0.005, rastro = 80 } = getParams()
    const w = p.width, h = p.height
    const t = p.frameCount * speed * 0.003
    const target = Math.round(particulas)

    while (particles.length < target) particles.push({ x: p.random(w), y: p.random(h), px: 0, py: 0 })
    if (particles.length > target) particles = particles.slice(0, target)

    p.noStroke()
    p.fill(0, 0, 0, (1 / rastro) * 100)
    p.rect(0, 0, w, h)

    p.strokeWeight(1)
    for (const pt of particles) {
      pt.px = pt.x; pt.py = pt.y
      const angle = p.noise(pt.x * escalaRuido, pt.y * escalaRuido, t) * Math.PI * 4
      pt.x += Math.cos(angle) * speed * 15
      pt.y += Math.sin(angle) * speed * 15
      if (pt.x < 0 || pt.x > w || pt.y < 0 || pt.y > h) {
        pt.x = p.random(w); pt.y = p.random(h); pt.px = pt.x; pt.py = pt.y
      }
      const n = p.noise(pt.x * escalaRuido * 2, pt.y * escalaRuido * 2)
      p.stroke((hue + n * 120) % 360, 80, 90, 80)
      p.line(pt.px, pt.py, pt.x, pt.y)
    }
  }
}

export const noiseFieldMode: ModeDefinition = {
  id: 'noise-field',
  name: 'Noise Field',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #050510 0%, #0a0520 100%)',
    accentColor: 'rgba(120,80,255,0.9)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',    type: 'slider', min: 0.01,  max: 0.2,   step: 0.01,    default: 0.05 },
    { key: 'particulas',  label: 'Partículas',    type: 'slider', min: 100,   max: 5000,  step: 100,     default: 1000 },
    { key: 'escalaRuido', label: 'Escala noise',  type: 'slider', min: 0.001, max: 0.02,  step: 0.001,   default: 0.005 },
    { key: 'rastro',      label: 'Rastro',        type: 'slider', min: 10,    max: 200,   step: 5,       default: 80 },
    { key: 'hue',         label: 'Cor',           type: 'hue',    min: 0,     max: 360,   step: 1,       default: 200 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

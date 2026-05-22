import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

interface Smoke { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; r: number; hue: number }

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let particles: Smoke[] = []

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.background(0)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    p.noStroke()
  }

  p.draw = () => {
    const { speed = 0.05, hue = 0, taxaEmissao = 10, lifespan = 120, dispersao = 30, ventoX = 0, ventoY = 0 } = getParams()
    const w = p.width, h = p.height

    p.fill(0, 0, 0, 8)
    p.rect(0, 0, w, h)

    const emit = Math.round(taxaEmissao)
    for (let i = 0; i < emit; i++) {
      particles.push({
        x: w / 2 + p.random(-20, 20), y: h * 0.8,
        vx: p.random(-dispersao * 0.05, dispersao * 0.05) + ventoX * 0.2,
        vy: -p.random(0.5, 2) * speed * 20 + ventoY * 0.5,
        life: lifespan, maxLife: lifespan,
        r: p.random(10, 30),
        hue: (hue + p.random(-20, 20) + 360) % 360,
      })
    }

    particles = particles.filter(pt => pt.life > 0)
    for (const pt of particles) {
      pt.x  += pt.vx
      pt.y  += pt.vy
      pt.vx += (p.noise(pt.x * 0.01, pt.y * 0.01, p.frameCount * 0.01) - 0.5) * 0.3
      pt.life -= speed * 5
      const alpha = (pt.life / pt.maxLife) * 40
      const r = pt.r * (1 + (1 - pt.life / pt.maxLife) * 2)
      p.fill(pt.hue, 20, 95, alpha)
      p.ellipse(pt.x, pt.y, r, r)
    }
  }
}

export const smokeParticlesMode: ModeDefinition = {
  id: 'smoke-particles',
  name: 'Smoke',
  tab: 'generative',
  thumbnail: {
    bg: 'linear-gradient(160deg, #080808 0%, #151515 100%)',
    accentColor: 'rgba(200,200,200,0.6)',
  },
  params: [
    { key: 'speed',       label: 'Velocidade',   type: 'slider', min: 0.01, max: 0.2,   step: 0.01, default: 0.05 },
    { key: 'taxaEmissao', label: 'Emissão',      type: 'slider', min: 1,    max: 50,    step: 1,    default: 10 },
    { key: 'lifespan',    label: 'Duração',      type: 'slider', min: 30,   max: 300,   step: 10,   default: 120 },
    { key: 'dispersao',   label: 'Dispersão',    type: 'slider', min: 1,    max: 100,   step: 1,    default: 30 },
    { key: 'ventoX',      label: 'Vento X',      type: 'slider', min: -2,   max: 2,     step: 0.1,  default: 0 },
    { key: 'ventoY',      label: 'Vento Y',      type: 'slider', min: -2,   max: 2,     step: 0.1,  default: 0 },
    { key: 'hue',         label: 'Cor',          type: 'hue',    min: 0,    max: 360,   step: 1,    default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

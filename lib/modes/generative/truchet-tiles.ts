import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let tiles: boolean[][] = []
  let lastTs = 0, lastTrigger = 0

  function gen(ts: number) {
    const c = Math.ceil(p.width  / ts) + 1
    const r = Math.ceil(p.height / ts) + 1
    tiles = Array.from({ length: c }, () => Array.from({ length: r }, () => p.random() < 0.5))
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.colorMode(p.HSB, 360, 100, 100, 100)
    lastTs = 40
    gen(40)
  }

  p.draw = () => {
    const { tileSize = 40, espessura = 2, hue = 0, animar = 0, regenTrigger = 0 } = getParams()
    const ts = Math.max(10, Math.round(tileSize))

    if (regenTrigger !== lastTrigger) { lastTrigger = regenTrigger; gen(ts) }
    if (ts !== lastTs) { lastTs = ts; gen(ts) }

    p.background(0, 0, 5)
    p.noFill()
    p.strokeWeight(espessura)

    const t = p.frameCount * 0.008
    for (let i = 0; i < tiles.length; i++) {
      for (let j = 0; j < (tiles[i]?.length ?? 0); j++) {
        const hShift = animar > 0.5 ? (Math.sin(t + i * 0.4 + j * 0.6) * 30) : 0
        p.stroke((hue + hShift + 360) % 360, 70, 90)
        p.push()
        p.translate(i * ts, j * ts)
        if (tiles[i][j]) {
          p.arc(0,  0,  ts * 2, ts * 2, 0,         p.HALF_PI)
          p.arc(ts, ts, ts * 2, ts * 2, p.PI,       p.PI + p.HALF_PI)
        } else {
          p.arc(ts, 0,  ts * 2, ts * 2, p.HALF_PI,  p.PI)
          p.arc(0,  ts, ts * 2, ts * 2, -p.HALF_PI, 0)
        }
        p.pop()
      }
    }
  }
}

export const truchetTilesMode: ModeDefinition = {
  id: 'truchet-tiles',
  name: 'Truchet',
  tab: 'generative',
  thumbnail: {
    bg: '#050505',
    accentColor: 'rgba(200,160,80,0.8)',
  },
  params: [
    { key: 'tileSize',     label: 'Tamanho tile', type: 'slider', min: 10,  max: 80,  step: 5,   default: 40 },
    { key: 'espessura',    label: 'Espessura',    type: 'slider', min: 0.5, max: 5,   step: 0.5, default: 2 },
    { key: 'animar',       label: 'Animar cor',   type: 'slider', min: 0,   max: 1,   step: 1,   default: 0 },
    { key: 'hue',          label: 'Cor',          type: 'hue',    min: 0,   max: 360, step: 1,   default: 0 },
    { key: 'regenTrigger', label: 'Regenerar',    type: 'button',                               default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

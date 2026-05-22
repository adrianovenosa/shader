import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let grid: boolean[][] = []
  let cols = 0, rows = 0
  let lastCell = 0, lastSeed = 0
  let fAccum = 0

  function init(cs: number) {
    cols = Math.floor(p.width / cs)
    rows = Math.floor(p.height / cs)
    grid = Array.from({ length: cols }, () =>
      Array.from({ length: rows }, () => p.random() < 0.3)
    )
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.noStroke()
    p.colorMode(p.HSB, 360, 100, 100, 100)
    lastCell = 4
    init(4)
  }

  p.draw = () => {
    const { fps = 10, tamanhoCelula = 4, hue = 120, seedTrigger = 0 } = getParams()
    const cs = Math.max(2, Math.round(tamanhoCelula))

    if (seedTrigger !== lastSeed) { lastSeed = seedTrigger; init(cs); lastCell = cs }
    if (cs !== lastCell) { lastCell = cs; init(cs) }

    fAccum += fps / 60
    if (fAccum < 1) return
    fAccum = 0

    const next = grid.map((col, i) => col.map((_, j) => {
      let alive = 0
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue
          if (grid[(i + di + cols) % cols][(j + dj + rows) % rows]) alive++
        }
      return grid[i][j] ? alive === 2 || alive === 3 : alive === 3
    }))
    grid = next

    p.background(0, 0, 8)
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        if (grid[i][j]) {
          p.fill(hue, 70, 90)
          p.rect(i * cs, j * cs, cs - 1, cs - 1)
        }
  }
}

export const gameOfLifeMode: ModeDefinition = {
  id: 'game-of-life',
  name: 'Game of Life',
  tab: 'generative',
  thumbnail: {
    bg: '#050a05',
    accentColor: 'rgba(60,220,60,0.9)',
  },
  params: [
    { key: 'fps',           label: 'Velocidade (fps)', type: 'slider', min: 1,  max: 30,  step: 1, default: 10 },
    { key: 'tamanhoCelula', label: 'Tamanho célula',   type: 'slider', min: 2,  max: 20,  step: 1, default: 4 },
    { key: 'hue',           label: 'Cor',              type: 'hue',    min: 0,  max: 360, step: 1, default: 120 },
    { key: 'seedTrigger',   label: 'Novo seed',        type: 'button',                             default: 0 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

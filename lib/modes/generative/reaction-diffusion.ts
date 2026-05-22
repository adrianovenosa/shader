import type { ModeDefinition } from '@/lib/renderers/adapter'
import { createP5Adapter, type SizeRef } from '@/lib/renderers/p5-adapter'

function sketch(p: any, getParams: () => Record<string, number>, size: SizeRef) {
  let gridA: Float32Array, gridB: Float32Array
  let nextA: Float32Array, nextB: Float32Array
  let gw: number, gh: number

  function initGrid() {
    gw = Math.floor(p.width  / 2)
    gh = Math.floor(p.height / 2)
    gridA = new Float32Array(gw * gh).fill(1)
    gridB = new Float32Array(gw * gh)
    nextA = new Float32Array(gw * gh)
    nextB = new Float32Array(gw * gh)
    const cx = Math.floor(gw / 2), cy = Math.floor(gh / 2)
    for (let dx = -6; dx <= 6; dx++)
      for (let dy = -6; dy <= 6; dy++) {
        const idx = (cy + dy) * gw + (cx + dx)
        if (idx >= 0 && idx < gw * gh) gridB[idx] = 1
      }
  }

  p.setup = () => {
    p.createCanvas(size.w, size.h)
    p.pixelDensity(1)
    initGrid()
  }

  p.draw = () => {
    const { feed = 0.055, kill = 0.062, difusaoA = 1.0, difusaoB = 0.5, stepsFrame = 3, hue = 120 } = getParams()
    const steps = Math.round(stepsFrame)
    const hr = (hue * Math.PI) / 180

    for (let s = 0; s < steps; s++) {
      for (let y2 = 1; y2 < gh - 1; y2++) {
        for (let x2 = 1; x2 < gw - 1; x2++) {
          const i  = y2 * gw + x2
          const a  = gridA[i], b = gridB[i]
          const la = gridA[i-1] + gridA[i+1] + gridA[i-gw] + gridA[i+gw] - 4 * a
          const lb = gridB[i-1] + gridB[i+1] + gridB[i-gw] + gridB[i+gw] - 4 * b
          const abb = a * b * b
          nextA[i] = Math.max(0, Math.min(1, a + difusaoA * la - abb + feed * (1 - a)))
          nextB[i] = Math.max(0, Math.min(1, b + difusaoB * lb + abb - (kill + feed) * b))
        }
      }
      ;[gridA, nextA] = [nextA, gridA];
      [gridB, nextB] = [nextB, gridB]
    }

    p.loadPixels()
    const pd = p.pixels, pw = p.width, ph = p.height
    for (let y2 = 0; y2 < ph; y2++) {
      for (let x2 = 0; x2 < pw; x2++) {
        const gx  = Math.floor(x2 * gw / pw), gy = Math.floor(y2 * gh / ph)
        const val = Math.max(0, Math.min(1, gridA[gy * gw + gx] - gridB[gy * gw + gx]))
        const idx = (y2 * pw + x2) * 4
        pd[idx]   = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr))          * 255 * val)
        pd[idx+1] = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr + 2.094)) * 255 * val)
        pd[idx+2] = Math.round((0.5 + 0.5 * Math.sin(val * Math.PI * 2 + hr + 4.189)) * 255 * val)
        pd[idx+3] = 255
      }
    }
    p.updatePixels()
  }
}

export const reactionDiffusionMode: ModeDefinition = {
  id: 'reaction-diffusion',
  name: 'Reaction Diff',
  tab: 'generative',
  thumbnail: {
    bg: 'radial-gradient(ellipse at 30% 40%, #0a1a08 0%, #030803 70%)',
    accentColor: 'rgba(80,200,80,0.8)',
  },
  params: [
    { key: 'feed',       label: 'Feed',      type: 'slider', min: 0.01,  max: 0.1,   step: 0.001, default: 0.055 },
    { key: 'kill',       label: 'Kill',      type: 'slider', min: 0.04,  max: 0.07,  step: 0.001, default: 0.062 },
    { key: 'difusaoA',   label: 'Difusão A', type: 'slider', min: 0.5,   max: 1.5,   step: 0.05,  default: 1.0 },
    { key: 'difusaoB',   label: 'Difusão B', type: 'slider', min: 0.1,   max: 0.5,   step: 0.05,  default: 0.5 },
    { key: 'stepsFrame', label: 'Steps',     type: 'slider', min: 1,     max: 10,    step: 1,     default: 3 },
    { key: 'hue',        label: 'Cor',       type: 'hue',    min: 0,     max: 360,   step: 1,     default: 120 },
  ],
  createAdapter: () => createP5Adapter(sketch),
}

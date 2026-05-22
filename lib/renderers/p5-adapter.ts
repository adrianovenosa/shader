import type { RendererAdapter } from './adapter'

export type SizeRef = { w: number; h: number }
export type SketchFactory = (
  p: any,
  getParams: () => Record<string, number>,
  size: SizeRef,
) => void

export function createP5Adapter(sketchFactory: SketchFactory): RendererAdapter {
  let p5Instance: any = null
  let disposed = false
  let currentParams: Record<string, number> = {}
  const size: SizeRef = { w: 0, h: 0 }

  return {
    mount(container, params) {
      currentParams = { ...params }
      disposed = false
      size.w = container.clientWidth  || window.innerWidth
      size.h = container.clientHeight || window.innerHeight

      import('p5').then(({ default: P5 }) => {
        if (disposed) return
        p5Instance = new (P5 as any)((p: any) => {
          sketchFactory(p, () => currentParams, size)
        }, container)
      })
    },

    updateParams(params) {
      currentParams = { ...currentParams, ...params }
    },

    resize(width, height) {
      size.w = width
      size.h = height
      p5Instance?.resizeCanvas(width, height)
    },

    dispose() {
      disposed = true
      p5Instance?.remove()
      p5Instance = null
    },
  }
}

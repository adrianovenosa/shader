import * as THREE from 'three'
import type { RendererAdapter } from './adapter'

const VERTEX = `void main() { gl_Position = vec4(position, 1.0); }`

type Uniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
  uExpandX:    { value: number }
}

export function createThreeAdapter(fragmentShader: string): RendererAdapter {
  let renderer: THREE.WebGLRenderer | null = null
  let scene:    THREE.Scene | null = null
  let camera:   THREE.Camera | null = null
  let uniforms: Uniforms | null = null
  let geo:      THREE.PlaneGeometry | null = null
  let mat:      THREE.ShaderMaterial | null = null
  let animId:   number | null = null
  let speed = 0.05

  return {
    mount(container, params) {
      if (renderer) return   // idempotency guard

      camera = new THREE.Camera()
      camera.position.z = 1
      scene = new THREE.Scene()

      uniforms = {
        uTime:       { value: 1.0 },
        uResolution: { value: new THREE.Vector2() },
        uLineWidth:  { value: params.lineWidth  ?? 0.0008 },
        uMosaic:     { value: params.mosaic     ?? 4.0 },
        uLines:      { value: params.lines      ?? 5 },
        uHue:        { value: ((params.hue ?? 0) * Math.PI) / 180 },
        uExpandX:    { value: params.expandX    ?? 1.0 },
      }
      speed = params.speed ?? 0.05

      renderer = new THREE.WebGLRenderer()
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      const setSize = () => {
        if (!renderer || !uniforms) return
        const w = container.clientWidth  || window.innerWidth
        const h = container.clientHeight || window.innerHeight
        renderer.setSize(w, h)
        uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
      }
      setSize()

      geo = new THREE.PlaneGeometry(2, 2)
      mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERTEX, fragmentShader })
      scene.add(new THREE.Mesh(geo, mat))

      const tick = () => {
        animId = requestAnimationFrame(tick)
        uniforms!.uTime.value += speed
        renderer!.render(scene!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (!uniforms) return
      if (params.speed     !== undefined) speed = params.speed
      if (params.lineWidth !== undefined) uniforms.uLineWidth.value = params.lineWidth
      if (params.mosaic    !== undefined) uniforms.uMosaic.value    = params.mosaic
      if (params.lines     !== undefined) uniforms.uLines.value     = params.lines
      if (params.hue       !== undefined) uniforms.uHue.value       = (params.hue * Math.PI) / 180
      if (params.expandX   !== undefined) uniforms.uExpandX.value   = params.expandX
    },

    resize(width, height) {
      if (!renderer || !uniforms) return
      renderer.setSize(width, height)
      uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
    },

    dispose() {
      if (animId !== null) cancelAnimationFrame(animId)
      geo?.dispose()
      mat?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
      renderer = null; scene = null; camera = null
      uniforms = null; geo = null; mat = null; animId = null
    },
  }
}

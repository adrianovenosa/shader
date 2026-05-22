import * as THREE from 'three'
import type { RendererAdapter } from './adapter'
import { SHADERS } from '@/lib/shaders'

const VERT = `void main() { gl_Position = vec4(position, 1.0); }`

function makeGeometry(shape: number): THREE.BufferGeometry {
  if (shape === 1) return new THREE.BoxGeometry(2, 2, 2)
  if (shape === 2) return new THREE.TorusGeometry(1.2, 0.5, 32, 100)
  return new THREE.SphereGeometry(1.5, 64, 64)
}

export function createShaderTextureAdapter(): RendererAdapter {
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let mesh: THREE.Mesh | null = null
  let animId: number | null = null
  let offRenderer: THREE.WebGLRenderer | null = null
  let offScene: THREE.Scene | null = null
  let offCamera: THREE.Camera | null = null
  let offUniforms: Record<string, { value: unknown }> | null = null
  let rt: THREE.WebGLRenderTarget | null = null
  let currentShape = 0, currentShader = 0
  let rotX = 0.005, rotY = 0.01, speed = 0.05

  return {
    mount(container, params) {
      if (renderer) return
      const w = container.clientWidth  || window.innerWidth
      const h = container.clientHeight || window.innerHeight

      offRenderer = new THREE.WebGLRenderer()
      offRenderer.setSize(512, 512)
      rt = new THREE.WebGLRenderTarget(512, 512)
      offCamera = new THREE.Camera()
      offScene  = new THREE.Scene()
      offUniforms = {
        uTime:       { value: 0 },
        uResolution: { value: new THREE.Vector2(512, 512) },
        uLineWidth:  { value: 0.0008 },
        uMosaic:     { value: 4 },
        uLines:      { value: 5 },
        uHue:        { value: 0 },
      }
      const shaderDef = SHADERS[Math.round(params.shaderFonte ?? 0)] ?? SHADERS[0]
      offScene.add(new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({ uniforms: offUniforms, vertexShader: VERT, fragmentShader: shaderDef.fragmentShader }),
      ))
      currentShader = Math.round(params.shaderFonte ?? 0)

      camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100)
      camera.position.z = 5
      scene    = new THREE.Scene()
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(w, h)
      renderer.setPixelRatio(window.devicePixelRatio)
      container.appendChild(renderer.domElement)

      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const dl = new THREE.DirectionalLight(0xffffff, 1)
      dl.position.set(5, 5, 5)
      scene.add(dl)

      const mat = new THREE.MeshStandardMaterial({ map: rt.texture })
      mesh = new THREE.Mesh(makeGeometry(0), mat)
      scene.add(mesh)

      speed = params.speed ?? 0.05
      rotX  = params.rotX  ?? 0.005
      rotY  = params.rotY  ?? 0.01

      const tick = () => {
        animId = requestAnimationFrame(tick)
        ;(offUniforms!.uTime as { value: number }).value += speed
        offRenderer!.setRenderTarget(rt); offRenderer!.render(offScene!, offCamera!); offRenderer!.setRenderTarget(null)
        if (mesh) { mesh.rotation.x += rotX; mesh.rotation.y += rotY }
        renderer!.render(scene!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (params.speed    !== undefined) speed = params.speed
      if (params.rotX     !== undefined) rotX  = params.rotX
      if (params.rotY     !== undefined) rotY  = params.rotY
      if (params.hue      !== undefined && offUniforms)
        (offUniforms.uHue as { value: number }).value = (params.hue * Math.PI) / 180
      if (params.wireframe !== undefined && mesh)
        (mesh.material as THREE.MeshStandardMaterial).wireframe = params.wireframe > 0.5

      const newShape = Math.round(params.forma ?? 0)
      if (newShape !== currentShape && mesh) {
        mesh.geometry.dispose(); mesh.geometry = makeGeometry(newShape); currentShape = newShape
      }

      const newShader = Math.round(params.shaderFonte ?? 0)
      if (newShader !== currentShader && offScene && offUniforms) {
        const def = SHADERS[newShader] ?? SHADERS[0]
        offScene.clear()
        offScene.add(new THREE.Mesh(
          new THREE.PlaneGeometry(2, 2),
          new THREE.ShaderMaterial({ uniforms: offUniforms, vertexShader: VERT, fragmentShader: def.fragmentShader }),
        ))
        currentShader = newShader
      }
    },

    resize(width, height) {
      if (renderer && camera) {
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
    },

    dispose() {
      if (animId !== null) cancelAnimationFrame(animId)
      renderer?.dispose(); renderer?.domElement.remove()
      offRenderer?.dispose(); rt?.dispose()
      renderer = null; offRenderer = null; rt = null
      scene = null; offScene = null; camera = null; offCamera = null; mesh = null
      animId = null
    },
  }
}

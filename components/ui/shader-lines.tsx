"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { SHADERS, DEFAULT_SHADER_ID } from "@/lib/shaders"

export interface ShaderParams {
  speed: number
  lineWidth: number
  mosaic: number
  lines: number
  hue: number
}

export const defaultParams: ShaderParams = {
  speed: 0.05,
  lineWidth: 0.0008,
  mosaic: 4.0,
  lines: 5,
  hue: 0,
}

interface ShaderAnimationProps {
  params: ShaderParams
  shaderId: string
}

const VERTEX_SHADER = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`

type Uniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
}

type SceneState = {
  camera:      THREE.Camera | null
  scene:       THREE.Scene | null
  renderer:    THREE.WebGLRenderer | null
  uniforms:    Uniforms | null
  geometry:    THREE.BufferGeometry | null
  material:    THREE.ShaderMaterial | null
  animationId: number | null
  speed:       number
}

export function ShaderAnimation({ params, shaderId }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onResizeRef  = useRef<(() => void) | null>(null)
  const sceneRef     = useRef<SceneState>({
    camera: null, scene: null, renderer: null, uniforms: null,
    geometry: null, material: null, animationId: null,
    speed: defaultParams.speed,
  })

  // ── Mount: infrastructure (camera, scene, renderer, uniforms, loop) ────────
  useEffect(() => {
    if (!containerRef.current || sceneRef.current.renderer) return
    const container = containerRef.current
    container.innerHTML = ""

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene = new THREE.Scene()

    const uniforms: Uniforms = {
      uTime:       { value: 1.0 },
      uResolution: { value: new THREE.Vector2() },
      uLineWidth:  { value: params.lineWidth },
      uMosaic:     { value: params.mosaic },
      uLines:      { value: params.lines },
      uHue:        { value: (params.hue * Math.PI) / 180 },
    }

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    sceneRef.current = {
      camera, scene, renderer, uniforms,
      geometry: null, material: null,
      animationId: null, speed: params.speed,
    }

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.uResolution.value.x = renderer.domElement.width
      uniforms.uResolution.value.y = renderer.domElement.height
    }
    onResizeRef.current = onResize
    onResize()
    window.addEventListener("resize", onResize, false)

    const animate = () => {
      sceneRef.current.animationId = requestAnimationFrame(animate)
      uniforms.uTime.value += sceneRef.current.speed
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      if (sceneRef.current.animationId) cancelAnimationFrame(sceneRef.current.animationId)
      if (onResizeRef.current) window.removeEventListener("resize", onResizeRef.current)
      sceneRef.current.geometry?.dispose()
      sceneRef.current.material?.dispose()
      renderer.dispose()
    }
  }, [])

  // ── Shader change: swap material only, keep renderer alive ─────────────────
  useEffect(() => {
    const { scene, uniforms } = sceneRef.current
    if (!scene || !uniforms) return

    const def = SHADERS.find(s => s.id === shaderId) ?? SHADERS[0]

    scene.clear()
    sceneRef.current.geometry?.dispose()
    sceneRef.current.material?.dispose()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: def.fragmentShader,
    })
    scene.add(new THREE.Mesh(geometry, material))
    sceneRef.current.geometry = geometry
    sceneRef.current.material = material
  }, [shaderId])

  // ── Params sync: write directly to uniforms, no scene rebuild ──────────────
  useEffect(() => {
    const { uniforms } = sceneRef.current
    if (!uniforms) return
    sceneRef.current.speed    = params.speed
    uniforms.uLineWidth.value = params.lineWidth
    uniforms.uMosaic.value    = params.mosaic
    uniforms.uLines.value     = params.lines
    uniforms.uHue.value       = (params.hue * Math.PI) / 180
  }, [params])

  return <div ref={containerRef} className="fixed inset-0 w-full h-full" />
}

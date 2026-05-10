"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window { THREE: any }
}

export interface ShaderParams {
  speed: number      // time increment per frame  [0.005 – 0.2]
  lineWidth: number  // glow width uniform        [0.0001 – 0.003]
  mosaic: number     // pixelation grid scale     [1.0 – 16.0]
  lines: number      // number of line layers     [1 – 8]
  hue: number        // hue rotation in degrees   [0 – 360]
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
}

export function ShaderAnimation({ params }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onResizeRef = useRef<(() => void) | null>(null)
  const sceneRef = useRef<{
    camera: any
    scene: any
    renderer: any
    uniforms: any
    animationId: number | null
    speed: number
    geometry: any
    material: any
  }>({
    camera: null,
    scene: null,
    renderer: null,
    uniforms: null,
    animationId: null,
    speed: defaultParams.speed,
    geometry: null,
    material: null,
  })

  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/89/three.min.js"
    script.onload = () => {
      if (containerRef.current && window.THREE && !sceneRef.current.renderer) initThreeJS()
    }
    document.head.appendChild(script)

    return () => {
      if (sceneRef.current.animationId) cancelAnimationFrame(sceneRef.current.animationId)
      if (sceneRef.current.geometry) sceneRef.current.geometry.dispose()
      if (sceneRef.current.material) sceneRef.current.material.dispose()
      if (sceneRef.current.renderer) sceneRef.current.renderer.dispose()
      if (onResizeRef.current) window.removeEventListener("resize", onResizeRef.current)
      if (document.head.contains(script)) document.head.removeChild(script)
    }
  }, [])

  // Sync params → uniforms without rebuilding the scene
  useEffect(() => {
    const { uniforms } = sceneRef.current
    if (!uniforms) return
    sceneRef.current.speed = params.speed
    uniforms.uLineWidth.value = params.lineWidth
    uniforms.uMosaic.value = params.mosaic
    uniforms.uLines.value = params.lines
    uniforms.uHue.value = (params.hue * Math.PI) / 180
  }, [params])

  const initThreeJS = () => {
    if (!containerRef.current || !window.THREE) return
    const THREE = window.THREE
    const container = containerRef.current
    container.innerHTML = ""

    const camera = new THREE.Camera()
    camera.position.z = 1
    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneBufferGeometry(2, 2)

    const uniforms = {
      uTime:      { type: "f",  value: 1.0 },
      uResolution:{ type: "v2", value: new THREE.Vector2() },
      uLineWidth: { type: "f",  value: params.lineWidth },
      uMosaic:    { type: "f",  value: params.mosaic },
      uLines:     { type: "f",  value: params.lines },
      uHue:       { type: "f",  value: (params.hue * Math.PI) / 180 },
    }

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;

      uniform vec2  uResolution;
      uniform float uTime;
      uniform float uLineWidth;
      uniform float uMosaic;
      uniform float uLines;
      uniform float uHue;

      float random(in float x) {
        return fract(sin(x) * 1e4);
      }

      // Rodrigues rotation around (1,1,1) axis — equivalent to hue rotation
      vec3 hueShift(vec3 color, float angle) {
        const vec3 k = vec3(0.57735);
        float c = cos(angle);
        return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
      }

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

        float gridX = 256.0 / uMosaic;
        float gridY = 256.0 / (uMosaic * 0.5);
        uv.x = floor(uv.x * gridX) / gridX;
        uv.y = floor(uv.y * gridY) / gridY;

        float t = uTime * 0.06 + random(uv.x) * 0.4;

        vec3 color = vec3(0.0);
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 8; i++) {
            if (float(i) >= uLines) break;
            color[j] += uLineWidth * float(i * i)
              / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) - length(uv));
          }
        }

        // Original channel order was BGR; keep it, then apply hue shift
        vec3 rgb = hueShift(vec3(color[2], color[1], color[0]), uHue);
        gl_FragColor = vec4(rgb, 1.0);
      }
    `

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderer = new THREE.WebGLRenderer()
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    sceneRef.current = { camera, scene, renderer, uniforms, animationId: null, speed: params.speed, geometry, material }

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
  }

  return <div ref={containerRef} className="fixed inset-0 w-full h-full" />
}

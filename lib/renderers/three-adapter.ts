import * as THREE from 'three'
import type { RendererAdapter } from './adapter'
import type { EffectState } from '@/lib/effects'

const VERTEX = `void main() { gl_Position = vec4(position, 1.0); }`

const POST_FRAGMENT = `
precision highp float;
uniform sampler2D uInputTexture;
uniform vec2  uResolution;
uniform float uTime;
uniform float uGrainIntensity;
uniform float uChrAberIntensity;
uniform float uCRTIntensity;
uniform float uHalftoneIntensity;
uniform float uHalftoneDotSize;
uniform float uBloomIntensity;
uniform float uBloomThreshold;

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;

  // Chromatic aberration (at sample stage)
  vec3 color;
  if (uChrAberIntensity > 0.0) {
    vec2 offs = (uv - 0.5) * uChrAberIntensity;
    color.r = texture2D(uInputTexture, uv + offs).r;
    color.g = texture2D(uInputTexture, uv).g;
    color.b = texture2D(uInputTexture, uv - offs).b;
  } else {
    color = texture2D(uInputTexture, uv).rgb;
  }

  // Bloom (9-tap cross, single pass)
  if (uBloomIntensity > 0.0) {
    vec3 bloom = vec3(0.0);
    float total = 0.0;
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec2 o = vec2(float(x), float(y)) / uResolution;
        vec3 s = texture2D(uInputTexture, uv + o).rgb;
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        float w = max(0.0, lum - uBloomThreshold);
        bloom += s * w;
        total += w;
      }
    }
    if (total > 0.0) color += (bloom / total) * uBloomIntensity;
  }

  // Halftone
  if (uHalftoneIntensity > 0.0) {
    vec2 cellOrigin = floor(gl_FragCoord.xy / uHalftoneDotSize) * uHalftoneDotSize;
    float lum = dot(texture2D(uInputTexture, cellOrigin / uResolution).rgb,
                    vec3(0.299, 0.587, 0.114));
    vec2 p = (mod(gl_FragCoord.xy, uHalftoneDotSize) / uHalftoneDotSize) - 0.5;
    float dot_ = step(length(p), sqrt(lum) * 0.5);
    color = mix(color, vec3(dot_), uHalftoneIntensity);
  }

  // Grain
  if (uGrainIntensity > 0.0) {
    float g = fract(sin(dot(uv + fract(uTime * 0.01),
                             vec2(12.9898, 78.233))) * 43758.5453);
    color += (g * 2.0 - 1.0) * uGrainIntensity;
  }

  // CRT: scanlines + vignette
  if (uCRTIntensity > 0.0) {
    float scan = sin(gl_FragCoord.y * 3.14159265) * 0.5 + 0.5;
    scan = mix(1.0, scan, uCRTIntensity * 0.35);
    vec2 vig = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vig, vig) * uCRTIntensity * 0.28;
    color *= scan * vignette;
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

type MainUniforms = {
  uTime:       { value: number }
  uResolution: { value: THREE.Vector2 }
  uLineWidth:  { value: number }
  uMosaic:     { value: number }
  uLines:      { value: number }
  uHue:        { value: number }
  uExpandX:    { value: number }
  uAmplitude:  { value: number }
}

type PostUniforms = {
  uInputTexture:     { value: THREE.Texture | null }
  uResolution:       { value: THREE.Vector2 }
  uTime:             { value: number }
  uGrainIntensity:   { value: number }
  uChrAberIntensity: { value: number }
  uCRTIntensity:     { value: number }
  uHalftoneIntensity:{ value: number }
  uHalftoneDotSize:  { value: number }
  uBloomIntensity:   { value: number }
  uBloomThreshold:   { value: number }
}

export function createThreeAdapter(fragmentShader: string): RendererAdapter {
  let renderer:     THREE.WebGLRenderer | null = null
  let camera:       THREE.Camera | null = null
  let renderTarget: THREE.WebGLRenderTarget | null = null

  // Pass 1 — main shader
  let scene1:    THREE.Scene | null = null
  let uniforms1: MainUniforms | null = null
  let geo1:      THREE.PlaneGeometry | null = null
  let mat1:      THREE.ShaderMaterial | null = null

  // Pass 2 — post-processing
  let scene2:       THREE.Scene | null = null
  let postUniforms: PostUniforms | null = null
  let geo2:         THREE.PlaneGeometry | null = null
  let mat2:         THREE.ShaderMaterial | null = null

  let animId: number | null = null
  let speed = 0.05

  return {
    mount(container, params) {
      if (renderer) return

      camera = new THREE.Camera()
      camera.position.z = 1

      const w = container.clientWidth  || window.innerWidth
      const h = container.clientHeight || window.innerHeight

      renderTarget = new THREE.WebGLRenderTarget(w, h)

      // --- Pass 1 ---
      scene1 = new THREE.Scene()
      uniforms1 = {
        uTime:       { value: 1.0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uLineWidth:  { value: params.lineWidth ?? 0.0008 },
        uMosaic:     { value: params.mosaic    ?? 4.0 },
        uLines:      { value: params.lines     ?? 5 },
        uHue:        { value: ((params.hue ?? 0) * Math.PI) / 180 },
        uExpandX:    { value: params.expandX   ?? 1.0 },
        uAmplitude:  { value: params.amplitude ?? 0.3 },
      }
      speed = params.speed ?? 0.05
      geo1 = new THREE.PlaneGeometry(2, 2)
      mat1 = new THREE.ShaderMaterial({ uniforms: uniforms1, vertexShader: VERTEX, fragmentShader })
      scene1.add(new THREE.Mesh(geo1, mat1))

      // --- Pass 2 ---
      scene2 = new THREE.Scene()
      postUniforms = {
        uInputTexture:     { value: renderTarget.texture },
        uResolution:       { value: new THREE.Vector2(w, h) },
        uTime:             { value: 1.0 },
        uGrainIntensity:   { value: 0 },
        uChrAberIntensity: { value: 0 },
        uCRTIntensity:     { value: 0 },
        uHalftoneIntensity:{ value: 0 },
        uHalftoneDotSize:  { value: 3.0 },
        uBloomIntensity:   { value: 0 },
        uBloomThreshold:   { value: 0.6 },
      }
      geo2 = new THREE.PlaneGeometry(2, 2)
      mat2 = new THREE.ShaderMaterial({ uniforms: postUniforms, vertexShader: VERTEX, fragmentShader: POST_FRAGMENT })
      scene2.add(new THREE.Mesh(geo2, mat2))

      renderer = new THREE.WebGLRenderer()
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(w, h)
      renderTarget.setSize(renderer.domElement.width, renderer.domElement.height)
      uniforms1!.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
      postUniforms!.uResolution.value.set(renderer.domElement.width, renderer.domElement.height)
      container.appendChild(renderer.domElement)

      const tick = () => {
        animId = requestAnimationFrame(tick)
        uniforms1!.uTime.value += speed
        postUniforms!.uTime.value = uniforms1!.uTime.value
        renderer!.setRenderTarget(renderTarget)
        renderer!.render(scene1!, camera!)
        renderer!.setRenderTarget(null)
        renderer!.render(scene2!, camera!)
      }
      tick()
    },

    updateParams(params) {
      if (!uniforms1) return
      if (params.speed     !== undefined) speed = params.speed
      if (params.lineWidth !== undefined) uniforms1.uLineWidth.value = params.lineWidth
      if (params.mosaic    !== undefined) uniforms1.uMosaic.value    = params.mosaic
      if (params.lines     !== undefined) uniforms1.uLines.value     = params.lines
      if (params.hue       !== undefined) uniforms1.uHue.value       = (params.hue * Math.PI) / 180
      if (params.expandX   !== undefined) uniforms1.uExpandX.value   = params.expandX
      if (params.amplitude !== undefined) uniforms1.uAmplitude.value = params.amplitude
    },

    updateEffects(effects: EffectState) {
      if (!postUniforms) return
      postUniforms.uGrainIntensity.value    = effects.grain.enabled    ? effects.grain.intensity    : 0
      postUniforms.uChrAberIntensity.value  = effects.chrAber.enabled  ? effects.chrAber.intensity  : 0
      postUniforms.uCRTIntensity.value      = effects.crt.enabled      ? effects.crt.intensity      : 0
      postUniforms.uHalftoneIntensity.value = effects.halftone.enabled ? effects.halftone.intensity : 0
      postUniforms.uHalftoneDotSize.value   = effects.halftone.dotSize
      postUniforms.uBloomIntensity.value    = effects.bloom.enabled    ? effects.bloom.intensity    : 0
      postUniforms.uBloomThreshold.value    = effects.bloom.threshold
    },

    resize(width, height) {
      if (!renderer || !uniforms1 || !postUniforms || !renderTarget) return
      renderer.setSize(width, height)
      renderTarget.setSize(
        renderer.domElement.width,
        renderer.domElement.height
      )
      uniforms1.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      )
      postUniforms.uResolution.value.set(
        renderer.domElement.width,
        renderer.domElement.height
      )
    },

    dispose() {
      if (animId !== null) cancelAnimationFrame(animId)
      geo1?.dispose(); mat1?.dispose()
      geo2?.dispose(); mat2?.dispose()
      renderTarget?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
      renderer = null; camera = null; renderTarget = null
      scene1 = null; uniforms1 = null; geo1 = null; mat1 = null
      scene2 = null; postUniforms = null; geo2 = null; mat2 = null
      animId = null
    },
  }
}

export interface ShaderThumbnail {
  bg: string
  accentColor: string
}

export interface ShaderDefinition {
  id: string
  name: string
  fragmentShader: string
  thumbnail: ShaderThumbnail
}

// ─── Shared GLSL helpers (copied into each shader) ───────────────────────────

const PREAMBLE = `
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uLineWidth;
uniform float uMosaic;
uniform float uLines;
uniform float uHue;

vec3 hueShift(vec3 color, float angle) {
  const vec3 k = vec3(0.57735);
  float c = cos(angle);
  return color * c + cross(k, color) * sin(angle) + k * dot(k, color) * (1.0 - c);
}
`

// ─── Lines ────────────────────────────────────────────────────────────────────

export const linesFragment = PREAMBLE + `
float random(in float x) {
  return fract(sin(x) * 1e4);
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

  vec3 rgb = hueShift(vec3(color[2], color[1], color[0]), uHue);
  gl_FragColor = vec4(rgb, 1.0);
}
`

// ─── Waves ────────────────────────────────────────────────────────────────────

export const wavesFragment = PREAMBLE + `
void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);

  float gridX = 256.0 / uMosaic;
  float gridY = 256.0 / (uMosaic * 0.5);
  uv.x = floor(uv.x * gridX) / gridX;
  uv.y = floor(uv.y * gridY) / gridY;

  vec3 color = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 8; i++) {
      if (float(i) >= uLines) break;
      float wave = sin(uv.x * 3.0 + uTime * 0.04 + float(i) * 0.6 + float(j) * 1.05) * 0.3;
      float dist = abs(uv.y - wave);
      color[j] += uLineWidth * float(i + 1) / (dist + 0.001);
    }
  }

  gl_FragColor = vec4(hueShift(color, uHue), 1.0);
}
`

// ─── Perlin (fBm value noise) ─────────────────────────────────────────────────

export const perlinFragment = PREAMBLE + `
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),                hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv *= uMosaic * 0.5;

  float v = 0.0;
  float amplitude = 0.5;
  vec2 p = uv + vec2(uTime * 0.02, uTime * 0.014);

  for (int i = 0; i < 8; i++) {
    if (float(i) >= uLines) break;
    v += amplitude * vnoise(p);
    p = p * 2.0 + vec2(7.3, 3.1);
    amplitude *= 0.5;
  }

  vec3 color = hueShift(vec3(v * uLineWidth * 1200.0), uHue);
  gl_FragColor = vec4(color, 1.0);
}
`

// ─── Fractal (animated Julia set) ────────────────────────────────────────────

export const fractalFragment = PREAMBLE + `
void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / min(uResolution.x, uResolution.y);
  uv = uv * (2.5 / uMosaic);

  float speed = uTime * 0.02;
  vec2 c = vec2(sin(speed) * 0.4, cos(speed * 0.73) * 0.3);
  vec2 z = uv;
  float iter = 0.0;
  float maxIter = uLines * 8.0;

  for (int i = 0; i < 64; i++) {
    if (float(i) >= maxIter || dot(z, z) > 4.0) {
      iter = float(i);
      break;
    }
    z = vec2(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
  }

  float n = iter / maxIter;
  vec3 color = hueShift(vec3(n) * uLineWidth * 800.0, uHue);
  gl_FragColor = vec4(color, 1.0);
}
`

// ─── Registry ─────────────────────────────────────────────────────────────────

export const SHADERS: ShaderDefinition[] = [
  {
    id: "lines",
    name: "Lines",
    fragmentShader: linesFragment,
    thumbnail: {
      bg: "linear-gradient(160deg, #060d1f 0%, #0d1b3e 100%)",
      accentColor: "rgba(80,160,255,0.9)",
    },
  },
  {
    id: "waves",
    name: "Waves",
    fragmentShader: wavesFragment,
    thumbnail: {
      bg: "linear-gradient(160deg, #080f12 0%, #0a1e14 100%)",
      accentColor: "rgba(60,220,120,0.9)",
    },
  },
  {
    id: "perlin",
    name: "Perlin",
    fragmentShader: perlinFragment,
    thumbnail: {
      bg: "#080608",
      accentColor: "rgba(160,80,255,0.8)",
    },
  },
  {
    id: "fractal",
    name: "Fractal",
    fragmentShader: fractalFragment,
    thumbnail: {
      bg: "radial-gradient(ellipse at 50% 50%, #1a0822 0%, #06020e 70%)",
      accentColor: "rgba(255,100,200,0.7)",
    },
  },
]

export const DEFAULT_SHADER_ID = "lines"

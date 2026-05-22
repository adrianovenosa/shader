# Shader

A generative art app with 14 rendering modes — 4 GLSL shaders and 10 p5.js generative modes — with per-mode parameter controls, named presets, and custom output resolution.

## Modes

**Shaders** (GLSL / Three.js)
- Lines, Waves, Perlin, Fractal

**Generativo** (p5.js)
- Color Interpolation, Kaleidoscope, Bezier Flow, Noise Field, Smoke Particles, Game of Life, Lissajous, Reaction Diffusion, Truchet Tiles, Shader 3D

## Controls

| Key | Action |
|-----|--------|
| `H` | Toggle controls panel |
| `F` | Toggle fullscreen |

## Features

- **Per-mode params** — each mode has its own parameter set; values are auto-saved to localStorage and restored when you return to that mode
- **Named presets** — save, load, and delete named param snapshots per mode
- **Custom output resolution** — type any W×H or pick a quick preset (Full, 1:1, 16:9, 9:16, 4:3); letterbox rendering when not fullscreen
- **Image overlay** — load a PNG and drag it anywhere on the canvas

## Stack

- Next.js 16, React 19, TypeScript
- Three.js (GLSL shaders, Shader 3D mode)
- p5.js (generative modes)
- Tailwind CSS v4
- Vitest

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Press `H` to open the controls panel.

## Tests

```bash
npm test
```

"use client"

import { useRef } from "react"
import type { ChangeEvent } from "react"
import type { ShaderParams } from "./shader-lines"

interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
}

export function ShaderControls({
  open,
  onToggle,
  params,
  onChange,
  onImageUpload,
}: ShaderControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const prevUrlRef = useRef<string | null>(null)

  const set = (key: keyof ShaderParams) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value)
      onChange({ ...params, [key]: key === "lines" ? Math.round(raw) : raw })
    }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
    const url = URL.createObjectURL(file)
    prevUrlRef.current = url
    onImageUpload(url)
    e.target.value = ""
  }

  return (
    <div className="fixed top-3 right-3 z-20">
      {/* Gear toggle */}
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className="w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md flex items-center justify-center text-white/60 hover:text-white transition-colors text-base"
      >
        ⚙
      </button>

      {/* Sliding panel */}
      <div
        aria-hidden={!open}
        className={[
          "absolute top-11 right-0 w-56",
          "bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4",
          "flex flex-col gap-3",
          "transition-all duration-200 origin-top-right",
          open
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Controles
        </p>

        <SliderRow
          label="Velocidade"
          display={params.speed.toFixed(3)}
          min={0.005} max={0.2} step={0.005}
          value={params.speed}
          onChange={set("speed")}
        />
        <SliderRow
          label="Espessura"
          display={params.lineWidth.toFixed(4)}
          min={0.0001} max={0.003} step={0.0001}
          value={params.lineWidth}
          onChange={set("lineWidth")}
        />
        <SliderRow
          label="Pixelação"
          display={params.mosaic.toFixed(1)}
          min={1} max={16} step={0.5}
          value={params.mosaic}
          onChange={set("mosaic")}
        />
        <SliderRow
          label="Linhas"
          display={String(Math.round(params.lines))}
          min={1} max={8} step={1}
          value={params.lines}
          onChange={set("lines")}
        />

        {/* Hue — rainbow gradient track */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-white/70">Cor</span>
            <span className="text-white/30">{Math.round(params.hue)}°</span>
          </div>
          <input
            type="range" min={0} max={360} step={1}
            value={params.hue}
            onChange={set("hue")}
            className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
            style={{
              background:
                "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)",
            }}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* PNG upload */}
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>
      </div>
    </div>
  )
}

function SliderRow({
  label, display, min, max, step, value, onChange,
}: {
  label: string
  display: string
  min: number
  max: number
  step: number
  value: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/30">{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={onChange}
        className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
      />
    </div>
  )
}

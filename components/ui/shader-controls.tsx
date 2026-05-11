"use client"

import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { SHADERS } from "@/lib/shaders"
import type { ShaderParams } from "./shader-lines"

interface ShaderControlsProps {
  open: boolean
  onToggle: () => void
  params: ShaderParams
  onChange: (p: ShaderParams) => void
  onImageUpload: (url: string | null) => void
  shaderId: string
  onShaderChange: (id: string) => void
  imageUrl: string | null
}

export function ShaderControls({
  open,
  onToggle,
  params,
  onChange,
  onImageUpload,
  shaderId,
  onShaderChange,
  imageUrl,
}: ShaderControlsProps) {
  const fileRef      = useRef<HTMLInputElement>(null)
  const prevUrlRef   = useRef<string | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gearVisible, setGearVisible] = useState(true)

  // ── Auto-hide gear after 3s of mouse inactivity ───────────────────────────
  useEffect(() => {
    const show = () => {
      setGearVisible(true)
      clearTimeout(hideTimerRef.current!)
      hideTimerRef.current = setTimeout(() => setGearVisible(false), 3000)
    }
    show()
    window.addEventListener("mousemove", show)
    return () => {
      window.removeEventListener("mousemove", show)
      clearTimeout(hideTimerRef.current!)
    }
  }, [])

  // ── H key toggles panel ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") onToggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onToggle])

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
      {/* Gear toggle — fades after 3s idle */}
      <button
        onClick={onToggle}
        aria-label="Toggle controls"
        className={[
          "w-9 h-9 rounded-full bg-black/70 border border-white/10 backdrop-blur-md",
          "flex items-center justify-center text-white/60 hover:text-white",
          "transition-opacity duration-500 text-base",
          gearVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      >
        ⚙
      </button>

      {/* Panel */}
      <div
        aria-hidden={!open}
        className={[
          "absolute top-11 right-0 w-56",
          "bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4",
          "flex flex-col gap-3",
          "transition-all duration-200 origin-top-right",
          open ? "opacity-100 scale-100 pointer-events-auto"
               : "opacity-0 scale-95 pointer-events-none",
        ].join(" ")}
      >
        {/* ── Shader selector grid ── */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Shader
        </p>

        <div className="grid grid-cols-4 gap-1.5">
          {SHADERS.map(s => (
            <button
              key={s.id}
              onClick={() => onShaderChange(s.id)}
              title={s.name}
              className={[
                "aspect-square rounded-lg overflow-hidden relative border-2 transition-colors",
                shaderId === s.id ? "border-blue-500" : "border-transparent",
              ].join(" ")}
              style={{ background: s.thumbnail.bg }}
            >
              <ShaderThumbnailArt id={s.id} />
              <span className="absolute bottom-0.5 inset-x-0 text-center text-[7px] font-semibold text-white/70 leading-none">
                {s.name}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-white/10" />

        {/* ── Sliders ── */}
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 pb-1 border-b border-white/10">
          Controles
        </p>

        <SliderRow
          label="Velocidade" display={params.speed.toFixed(3)}
          min={0.005} max={0.2} step={0.005} value={params.speed}
          onChange={set("speed")}
        />
        <SliderRow
          label="Espessura" display={params.lineWidth.toFixed(4)}
          min={0.0001} max={0.003} step={0.0001} value={params.lineWidth}
          onChange={set("lineWidth")}
        />
        <SliderRow
          label="Pixelação" display={params.mosaic.toFixed(1)}
          min={1} max={16} step={0.5} value={params.mosaic}
          onChange={set("mosaic")}
        />
        <SliderRow
          label="Linhas" display={String(Math.round(params.lines))}
          min={1} max={8} step={1} value={params.lines}
          onChange={set("lines")}
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-white/70">Cor</span>
            <span className="text-white/30">{Math.round(params.hue)}°</span>
          </div>
          <input
            type="range" min={0} max={360} step={1} value={params.hue}
            onChange={set("hue")}
            className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
            style={{ background: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
          />
        </div>

        <div className="h-px bg-white/10" />

        {/* ── PNG upload ── */}
        <input
          ref={fileRef} type="file" accept="image/png"
          className="hidden" onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-white/20 rounded-lg p-2.5 flex flex-col items-center gap-1 text-white/40 hover:text-white/60 hover:border-white/30 transition-colors cursor-pointer"
        >
          <span className="text-lg leading-none">🖼</span>
          <span className="text-[10px]">Carregar PNG</span>
        </button>

        {imageUrl && (
          <button
            onClick={() => onImageUpload(null)}
            className="border border-dashed border-red-500/30 rounded-lg p-2.5 flex flex-col items-center gap-1 text-red-400/60 hover:text-red-400 hover:border-red-500/50 transition-colors cursor-pointer"
          >
            <span className="text-lg leading-none">🗑</span>
            <span className="text-[10px]">Remover imagem</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Thumbnail art per shader ─────────────────────────────────────────────────

function ShaderThumbnailArt({ id }: { id: string }) {
  if (id === "lines") return (
    <>
      <div className="absolute left-[10%] w-[80%] h-px"
        style={{ top: "38%", background: "rgba(80,160,255,0.9)", boxShadow: "0 0 6px rgba(80,160,255,1),0 0 14px rgba(80,160,255,0.5)" }} />
      <div className="absolute left-[5%] w-[90%] h-px"
        style={{ top: "52%", background: "rgba(50,200,180,0.6)", boxShadow: "0 0 5px rgba(50,200,180,0.8)" }} />
    </>
  )
  if (id === "waves") return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" preserveAspectRatio="none">
      <defs>
        <filter id="wglow">
          <feGaussianBlur stdDeviation="1" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="M0 22 Q10 14 20 22 Q30 30 40 22" fill="none" stroke="rgba(60,220,120,0.9)" strokeWidth="1.5" filter="url(#wglow)"/>
      <path d="M0 28 Q10 20 20 28 Q30 36 40 28" fill="none" stroke="rgba(40,180,100,0.5)" strokeWidth="0.8"/>
      <path d="M0 16 Q10 8 20 16 Q30 24 40 16"  fill="none" stroke="rgba(80,255,150,0.4)" strokeWidth="0.6"/>
    </svg>
  )
  if (id === "perlin") return (
    <>
      <div className="absolute rounded-full" style={{ width:28,height:28,top:2,left:2, background:"radial-gradient(circle,rgba(160,80,255,0.45),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:22,height:22,top:10,left:12,background:"radial-gradient(circle,rgba(80,160,255,0.4),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:18,height:18,top:4,left:16, background:"radial-gradient(circle,rgba(255,80,160,0.35),transparent 70%)" }}/>
      <div className="absolute rounded-full" style={{ width:14,height:14,top:16,left:4, background:"radial-gradient(circle,rgba(80,255,200,0.3),transparent 70%)" }}/>
    </>
  )
  if (id === "fractal") return (
    <>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full"
        style={{ border:"1px solid transparent",borderTopColor:"rgba(255,100,200,0.7)",borderRightColor:"rgba(255,100,200,0.3)" }}/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width:18,height:18,border:"1px solid transparent",borderBottomColor:"rgba(200,100,255,0.6)",borderLeftColor:"rgba(200,100,255,0.25)" }}/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{ border:"1px solid rgba(255,150,220,0.7)" }}/>
    </>
  )
  return null
}

// ── SliderRow ────────────────────────────────────────────────────────────────

function SliderRow({ label, display, min, max, step, value, onChange }: {
  label: string; display: string
  min: number; max: number; step: number; value: number
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[11px]">
        <span className="text-white/70">{label}</span>
        <span className="text-white/30">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={onChange}
        className="w-full h-1 rounded-full cursor-pointer accent-blue-400"
      />
    </div>
  )
}

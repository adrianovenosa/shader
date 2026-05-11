"use client"

import { useState } from "react"
import { ShaderAnimation, defaultParams, type ShaderParams } from "@/components/ui/shader-lines"
import { ShaderControls } from "@/components/ui/shader-controls"
import { DEFAULT_SHADER_ID } from "@/lib/shaders"

export default function Page() {
  const [params,    setParams]    = useState<ShaderParams>(defaultParams)
  const [imageUrl,  setImageUrl]  = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [shaderId,  setShaderId]  = useState(DEFAULT_SHADER_ID)

  return (
    <main className="fixed inset-0 overflow-hidden">
      <ShaderAnimation params={params} shaderId={shaderId} />

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="fixed inset-0 m-auto max-w-[80vw] max-h-[80vh] object-contain pointer-events-none z-10"
        />
      )}

      <ShaderControls
        open={panelOpen}
        onToggle={() => setPanelOpen(o => !o)}
        params={params}
        onChange={setParams}
        onImageUpload={setImageUrl}
        shaderId={shaderId}
        onShaderChange={setShaderId}
      />
    </main>
  )
}

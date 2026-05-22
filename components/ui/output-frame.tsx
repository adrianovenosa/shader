'use client'

interface Props {
  mode: 'full' | 'custom'
  width: number
  height: number
  children: React.ReactNode
}

export function OutputFrame({ mode, width, height, children }: Props) {
  if (mode === 'full') {
    return <div className="fixed inset-0">{children}</div>
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/90">
      <div
        style={{
          aspectRatio: `${width} / ${height}`,
          width: `min(${width}px, calc(100vw - 32px))`,
          maxHeight: 'calc(100vh - 32px)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}

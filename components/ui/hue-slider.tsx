import { Slider } from "@base-ui/react/slider"

interface HueSliderProps {
  value: number
  onChange: (value: number) => void
}

export function HueSlider({ value, onChange }: HueSliderProps) {
  return (
    <Slider.Root
      value={[value]}
      min={0}
      max={360}
      step={1}
      onValueChange={values => {
        const v = typeof values === 'number' ? values : values[0]
        onChange(v)
      }}
      className="w-full"
      thumbAlignment="edge"
    >
      <Slider.Control className="relative flex w-full touch-none items-center select-none">
        <Slider.Track
          className="relative grow h-2 rounded-full overflow-hidden"
          style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
        />
        <Slider.Thumb
          className="relative block size-4 shrink-0 rounded-full border-2 border-white shadow-md ring-ring/50 transition-[box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden"
          style={{ background: `hsl(${value}, 100%, 50%)` }}
        />
      </Slider.Control>
    </Slider.Root>
  )
}

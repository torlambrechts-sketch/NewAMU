import { CheckCircle2, ChevronDown, ChevronUp, Circle } from 'lucide-react'

const GRN = '#1a3d32'

export function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (val: boolean) => void
}) {
  const active = { backgroundColor: GRN, color: 'white' }
  const idle = { backgroundColor: 'white', color: '#9ca3af' }

  return (
    <div className="mt-1.5 flex w-full overflow-hidden rounded-md border border-neutral-300">
      <button
        type="button"
        onClick={() => onChange(true)}
        style={value === true ? active : idle}
        className="flex flex-1 items-center justify-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors"
      >
        {value === true
          ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0" />
          : <Circle className="h-[18px] w-[18px] shrink-0" />}
        Ja
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={value === false ? active : idle}
        className="flex flex-1 items-center justify-center gap-2.5 border-l border-neutral-300 px-4 py-3 text-sm font-medium transition-colors"
      >
        {value === false
          ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0" />
          : <Circle className="h-[18px] w-[18px] shrink-0" />}
        Nei
      </button>
    </div>
  )
}

export function NumberSpinner({
  value,
  onChange,
  min = 0,
  max = 9999,
  placeholder,
}: {
  value: number | ''
  onChange: (v: number) => void
  min?: number
  max?: number
  placeholder?: string
}) {
  const num = typeof value === 'number' ? value : min

  return (
    <div className="mt-1.5 flex w-full overflow-hidden rounded-md border border-neutral-300 bg-white">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
        className={[
          'w-full bg-transparent px-3 py-2.5 text-sm text-neutral-900',
          'placeholder:text-neutral-400 outline-none',
          '[appearance:textfield]',
          '[&::-webkit-inner-spin-button]:appearance-none',
          '[&::-webkit-outer-spin-button]:appearance-none',
        ].join(' ')}
      />
      <div className="flex shrink-0 flex-col border-l border-neutral-300">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(Math.min(max, num + 1))}
          className="flex flex-1 items-center justify-center px-2.5 text-neutral-500 transition-colors hover:bg-[#1a3d32] hover:text-white"
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(Math.max(min, num - 1))}
          className="flex flex-1 items-center justify-center border-t border-neutral-300 px-2.5 text-neutral-500 transition-colors hover:bg-[#1a3d32] hover:text-white"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-[#1a3d32]' : 'bg-neutral-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}

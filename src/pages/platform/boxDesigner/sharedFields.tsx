import { hexForPicker, LABEL, PANEL, PANEL_INLINE } from './fieldTokens'

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className={LABEL}>
      {label}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={hexForPicker(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
          aria-label={label}
        />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={PANEL} />
      </div>
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  return (
    <label className={LABEL}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={PANEL} />
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <label className={LABEL}>
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={PANEL}
      />
    </label>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (next: T) => void
  className?: string
}) {
  return (
    <label className={className ?? LABEL}>
      {label ? <span className="block">{label}</span> : null}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className={label ? PANEL : PANEL_INLINE}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, Info, Search } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { RecurrencePicker } from '../../src/components/hse/RecurrencePicker'

// ─── Local style tokens ───────────────────────────────────────────────────────
// White bg + brand-green focus ring — matches Pinpoint HR screenshot style
const GRN = '#1a3d32'

const FIELD_INPUT =
  'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 outline-none transition-colors ' +
  'focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InspeksjonsrunderFormState = {
  title: string
  templateId: string
  locationId: string
  scheduledFor: string
  assignedTo: string
  cronExpression: string
}

type Option = { value: string; label: string }

// ─── SearchableSelect ─────────────────────────────────────────────────────────
// Matches screenshot: white trigger, green border + ring when open, chevron
// rotates, filter input inside popup, plain-text items.

function SearchableSelect({
  value,
  options,
  placeholder = 'Velg …',
  onChange,
}: {
  value: string
  options: Option[]
  placeholder?: string
  onChange: (val: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = filter
    ? options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative mt-1.5">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setFilter('') }}
        className={[
          'flex w-full items-center justify-between border bg-white px-3 py-2.5',
          'text-left text-sm outline-none transition-colors',
          open
            ? 'border-[#1a3d32] ring-1 ring-[#1a3d32]/25'
            : 'border-neutral-300 hover:border-neutral-400',
        ].join(' ')}
      >
        <span className={selected ? 'text-neutral-900' : 'text-neutral-400'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={[
            'h-4 w-4 shrink-0 transition-transform',
            open ? 'rotate-180 text-[#1a3d32]' : 'text-neutral-400',
          ].join(' ')}
        />
      </button>

      {/* Dropdown popup */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border border-neutral-300 bg-white shadow-md">
          {/* Filter */}
          <div className="border-b border-neutral-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter..."
                className="w-full border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-[#1a3d32]/50"
              />
            </div>
          </div>
          {/* Items */}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={[
                  'w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-50',
                  o.value === value
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-800',
                ].join(' ')}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-sm text-neutral-400">Ingen treff</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── YesNoToggle ──────────────────────────────────────────────────────────────
// Matches screenshot: side-by-side Ja/Nei, selected = forest-green bg + white
// CheckCircle2, unselected = white bg + gray Circle, square corners.

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (val: boolean) => void
}) {
  const active = { backgroundColor: GRN, color: 'white' }
  const idle = { backgroundColor: 'white', color: '#9ca3af' }

  return (
    <div className="mt-1.5 flex w-full overflow-hidden border border-neutral-300">
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

// ─── NumberSpinner ────────────────────────────────────────────────────────────
// Matches screenshot HEADCOUNT field: white input + stacked ▲/▼ buttons on
// the right side with a dividing border, no native browser spinners.
// Exported so other modules can reuse it.

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
    <div className="mt-1.5 flex w-full border border-neutral-300 bg-white">
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

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
// Matches screenshot 3 iOS-style on/off pill. Forest-green when ON.
// Exported for reuse in other modules.

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
        'relative inline-flex h-6 w-11 shrink-0 items-center transition-colors',
        checked ? 'bg-[#1a3d32]' : 'bg-neutral-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
}

// ─── InfoBox / WarningBox ─────────────────────────────────────────────────────
// Matches screenshot amber warning boxes. Use InfoBox for informational notes,
// WarningBox for actionable warnings/errors.

export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  )
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <span>{children}</span>
    </div>
  )
}

// ─── InspeksjonsrunderCreateForm ──────────────────────────────────────────────

export function InspeksjonsrunderCreateForm({
  form,
  onChange,
  templates,
  locations,
  users,
}: {
  form: InspeksjonsrunderFormState
  onChange: (f: InspeksjonsrunderFormState) => void
  templates: { id: string; name: string }[]
  locations: { id: string; name: string }[]
  users: { id: string; displayName: string }[]
}) {
  const [recurrenceChoice, setRecurrenceChoice] = useState<boolean | null>(
    form.cronExpression ? true : null,
  )

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  const locationOptions: Option[] = [
    { value: '', label: '(Ingen lokasjon)' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]
  const userOptions: Option[] = [
    { value: '', label: '(Ingen)' },
    ...users.map((u) => ({ value: u.id, label: u.displayName })),
  ]

  function handleRecurrenceToggle(v: boolean) {
    setRecurrenceChoice(v)
    if (!v) onChange({ ...form, cronExpression: '' })
  }

  const optionalTag = (
    <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-400">
      Valgfri
    </span>
  )

  return (
    // Negative margins cancel the panel's own padding so row borders run edge-to-edge
    <div className="-mx-6 -mt-8 sm:-mx-8">

      {/* ── Tittel ─────────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Hva er tittelen på inspeksjonsrunden?
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
          <input
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="F.eks. Q1 vernerunde produksjonshall"
            className={FIELD_INPUT}
            style={{ marginTop: '6px' }}
          />
        </div>
      </div>

      {/* ── Mal ────────────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Velg sjekkliste-mal for runden
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Mal</p>
          <SearchableSelect
            value={form.templateId || templates[0]?.id || ''}
            options={templateOptions}
            placeholder="Please Select"
            onChange={(v) => onChange({ ...form, templateId: v })}
          />
          {templates.length === 0 && (
            <div className="mt-2">
              <WarningBox>
                Ingen maler tilgjengelig. Opprett en mal under Innstillinger → Maler.
              </WarningBox>
            </div>
          )}
        </div>
      </div>

      {/* ── Lokasjon ───────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Hvor gjennomføres inspeksjonsrunden?
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Lokasjon{optionalTag}</p>
          <SearchableSelect
            value={form.locationId}
            options={locationOptions}
            placeholder="Please Select"
            onChange={(v) => onChange({ ...form, locationId: v })}
          />
        </div>
      </div>

      {/* ── Ansvarlig ──────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Hvem er ansvarlig for gjennomføringen?
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig{optionalTag}</p>
          <SearchableSelect
            value={form.assignedTo}
            options={userOptions}
            placeholder="Please Select"
            onChange={(v) => onChange({ ...form, assignedTo: v })}
          />
        </div>
      </div>

      {/* ── Planlagt dato ──────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Planlagt dato og tid for gjennomføringen
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Planlagt dato{optionalTag}</p>
          <input
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(e) => onChange({ ...form, scheduledFor: e.target.value })}
            className={FIELD_INPUT}
            style={{ marginTop: '6px' }}
          />
        </div>
      </div>

      {/* ── Gjentakelse ────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>
          Gjentas runden regelmessig?
        </p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Gjentakelse</p>
          <YesNoToggle value={recurrenceChoice} onChange={handleRecurrenceToggle} />
          {recurrenceChoice === true && (
            <div className="mt-3">
              <RecurrencePicker
                value={form.cronExpression}
                onChange={(cron) => onChange({ ...form, cronExpression: cron })}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Info ───────────────────────────────────────────────────────────── */}
      <div className="border-t border-neutral-200 px-4 py-4 md:px-5">
        <InfoBox>
          Runden lagres som kladd og aktiveres manuelt. Ansvarlig varsles automatisk når
          runden er planlagt og aktivert.
        </InfoBox>
      </div>
    </div>
  )
}

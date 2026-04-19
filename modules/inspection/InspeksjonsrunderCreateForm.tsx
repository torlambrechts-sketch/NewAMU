import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, Circle, Search } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_INPUT,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { RecurrencePicker } from '../../src/components/hse/RecurrencePicker'

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
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setFilter('') }}
        className="flex w-full items-center justify-between border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-left text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
      >
        <span className={selected ? 'text-neutral-900' : 'text-neutral-400'}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 border border-neutral-300 bg-white shadow-lg">
          <div className="border-b border-neutral-200 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrer…"
                className="w-full border border-neutral-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-neutral-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-neutral-50 ${
                  o.value === value ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-700'
                }`}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-neutral-400">Ingen treff</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── YesNoToggle ──────────────────────────────────────────────────────────────

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (val: boolean) => void
}) {
  const GRN = '#1a3d32'
  const activeStyle = { backgroundColor: GRN, color: 'white' }
  const inactiveStyle = { backgroundColor: 'white', color: '#9ca3af' }

  return (
    <div className="flex w-full overflow-hidden border border-neutral-300">
      <button
        type="button"
        onClick={() => onChange(true)}
        className="flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors"
        style={value === true ? activeStyle : inactiveStyle}
      >
        {value === true ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
        Ja
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className="flex flex-1 items-center justify-center gap-2 border-l border-neutral-300 px-4 py-3 text-sm font-medium transition-colors"
        style={value === false ? activeStyle : inactiveStyle}
      >
        {value === false ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
        Nei
      </button>
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

  const optionalLabel = (
    <span className="ml-1 font-normal normal-case tracking-normal text-neutral-400">
      Valgfri
    </span>
  )

  return (
    <div className="-mx-6 -mt-8 sm:-mx-8">

      {/* ── Tittel ─────────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Hva er tittelen på inspeksjonsrunden?</p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
          <input
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            className={WPSTD_FORM_INPUT}
            placeholder="F.eks. Q1 vernerunde produksjonshall"
          />
        </div>
      </div>

      {/* ── Mal ────────────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Velg sjekkliste-mal for runden</p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Mal</p>
          <SearchableSelect
            value={form.templateId || templates[0]?.id || ''}
            options={templateOptions}
            placeholder="Velg mal …"
            onChange={(v) => onChange({ ...form, templateId: v })}
          />
          {templates.length === 0 && (
            <div className="mt-2 flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Ingen maler tilgjengelig. Opprett en mal under Innstillinger → Maler.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Lokasjon ───────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Hvor gjennomføres inspeksjonsrunden?</p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Lokasjon{optionalLabel}</p>
          <SearchableSelect
            value={form.locationId}
            options={locationOptions}
            placeholder="Velg lokasjon …"
            onChange={(v) => onChange({ ...form, locationId: v })}
          />
        </div>
      </div>

      {/* ── Ansvarlig ──────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Hvem er ansvarlig for gjennomføringen?</p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig{optionalLabel}</p>
          <SearchableSelect
            value={form.assignedTo}
            options={userOptions}
            placeholder="Velg ansvarlig …"
            onChange={(v) => onChange({ ...form, assignedTo: v })}
          />
        </div>
      </div>

      {/* ── Planlagt dato ──────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Planlagt dato og tid for gjennomføringen</p>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Planlagt dato{optionalLabel}</p>
          <input
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(e) => onChange({ ...form, scheduledFor: e.target.value })}
            className={WPSTD_FORM_INPUT}
          />
        </div>
      </div>

      {/* ── Gjentakelse ────────────────────────────────────────────────────── */}
      <div className={WPSTD_FORM_ROW_GRID}>
        <p className={WPSTD_FORM_LEAD}>Gjentas runden regelmessig?</p>
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

      {/* ── Info-melding ───────────────────────────────────────────────────── */}
      <div className="border-t border-neutral-200 px-4 py-4 md:px-5">
        <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Runden lagres som kladd og aktiveres manuelt. Ansvarlig varsles automatisk når
            runden er planlagt og aktivert.
          </span>
        </div>
      </div>
    </div>
  )
}

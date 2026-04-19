import { useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Circle, Info } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'

// ─── Local style tokens ───────────────────────────────────────────────────────
const GRN = '#1a3d32'

const FIELD_INPUT =
  'w-full border border-neutral-300 rounded-md bg-white px-3 py-2.5 text-sm text-neutral-900 ' +
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

// ─── YesNoToggle ──────────────────────────────────────────────────────────────
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

// ─── NumberSpinner ────────────────────────────────────────────────────────────
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

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────
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

// ─── InfoBox / WarningBox ─────────────────────────────────────────────────────
export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <span>{children}</span>
    </div>
  )
}

export function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
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
  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }))
  
  const locationOptions: Option[] = [
    { value: '', label: '(Ingen lokasjon)' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ]
  
  const userOptions: Option[] = [
    { value: '', label: '(Ingen)' },
    ...users.map((u) => ({ value: u.id, label: u.displayName })),
  ]

  const frekvensOptions = [
    { value: '', label: 'Engangstilfelle (Ingen gjentakelse)' },
    { value: 'weekly', label: 'Ukentlig' },
    { value: 'monthly', label: 'Månedlig' },
    { value: 'yearly', label: 'Årlig' },
  ]

  const optionalTag = (
    <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-400">
      Valgfri
    </span>
  )

  return (
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
            placeholder="Velg mal"
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
            placeholder="Velg lokasjon"
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
            placeholder="Velg ansvarlig"
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
          <p className={WPSTD_FORM_FIELD_LABEL}>Frekvens</p>
          <SearchableSelect
            value={form.cronExpression || ''}
            options={frekvensOptions}
            placeholder="Velg frekvens"
            onChange={(v) => onChange({ ...form, cronExpression: v })}
          />
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

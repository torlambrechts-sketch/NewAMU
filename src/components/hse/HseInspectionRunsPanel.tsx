import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronDown, ChevronUp } from 'lucide-react'
import { validatePhotoDataUrl } from '../../lib/hseInspectionNormalize'
import { useHse } from '../../hooks/useHse'
import type {
  InspectionFieldAnswer,
  InspectionRun,
  InspectionTemplateField,
} from '../../types/inspectionModule'

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function HseInspectionRunsPanel({ hse }: { hse: ReturnType<typeof useHse> }) {
  const cfg = hse.inspectionModuleConfig
  const [runForm, setRunForm] = useState({
    inspectionTypeId: cfg.inspectionTypes.find((t) => t.active)?.id ?? '',
    title: '',
    conductedBy: '',
    conductedAt: new Date().toISOString().slice(0, 16),
    locationId: '',
    objectLabel: '',
  })

  const locationOptions = useMemo(() => {
    const sorted = [...cfg.locations].sort((a, b) => a.order - b.order)
    return sorted
  }, [cfg.locations])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-950">
        <p>
          <strong>Konfigurerbare inspeksjoner:</strong> typer, maler med felt (ja/nei, tekst, tall, bilde),
          lokasjoner, roller, statusflyt, planer og avviksnivåer.{' '}
          <Link to="/hse/inspection-settings" className="font-medium underline">
            Åpne innstillinger
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={() => hse.generateScheduledInspectionRuns()}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-700 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900"
        >
          <CalendarClock className="size-3.5" />
          Kjør tidsplaner (forfalte)
        </button>
      </div>

      <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">Ny inspeksjonsrunde (malbasert)</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!runForm.title.trim() || !runForm.inspectionTypeId) return
            const at = runForm.conductedAt
              ? new Date(runForm.conductedAt).toISOString()
              : new Date().toISOString()
            hse.createInspectionRun({
              inspectionTypeId: runForm.inspectionTypeId,
              title: runForm.title,
              conductedBy: runForm.conductedBy,
              conductedAt: at,
              locationId: runForm.locationId || undefined,
              objectLabel: runForm.objectLabel || undefined,
            })
            setRunForm((r) => ({ ...r, title: '', objectLabel: '' }))
          }}
        >
          <div>
            <label className="text-xs text-neutral-500">Inspeksjonstype</label>
            <select
              value={runForm.inspectionTypeId}
              onChange={(e) => setRunForm((r) => ({ ...r, inspectionTypeId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              {cfg.inspectionTypes.filter((t) => t.active).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Tittel</label>
            <input
              value={runForm.title}
              onChange={(e) => setRunForm((r) => ({ ...r, title: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Lokasjon / objekt</label>
            <select
              value={runForm.locationId}
              onChange={(e) => setRunForm((r) => ({ ...r, locationId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="">(Ikke valgt)</option>
              {locationOptions.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.kind}: {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Spesifikt utstyr / merknad</label>
            <input
              value={runForm.objectLabel}
              onChange={(e) => setRunForm((r) => ({ ...r, objectLabel: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              placeholder="F.eks. Truck #5"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Utført av</label>
            <input
              value={runForm.conductedBy}
              onChange={(e) => setRunForm((r) => ({ ...r, conductedBy: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Dato/tid</label>
            <input
              type="datetime-local"
              value={runForm.conductedAt}
              onChange={(e) => setRunForm((r) => ({ ...r, conductedAt: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white sm:col-span-2"
          >
            Opprett runde
          </button>
        </form>
      </section>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
          <h2 className="font-semibold text-neutral-900">Inspeksjonskjøringer ({hse.inspectionRuns.length})</h2>
        </div>
        <ul className="divide-y divide-neutral-100">
          {hse.inspectionRuns.map((run) => (
            <InspectionRunRow key={run.id} run={run} hse={hse} />
          ))}
        </ul>
        {hse.inspectionRuns.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen malbaserte runder ennå.</p>
        ) : null}
      </div>
    </div>
  )
}

function InspectionRunRow({ run, hse }: { run: InspectionRun; hse: ReturnType<typeof useHse> }) {
  const [open, setOpen] = useState(false)
  const cfg = hse.inspectionModuleConfig
  const tpl = cfg.templates.find((t) => t.id === run.templateId)
  const type = cfg.inspectionTypes.find((t) => t.id === run.inspectionTypeId)
  const loc = run.locationId ? cfg.locations.find((l) => l.id === run.locationId) : null
  const [devFieldId, setDevFieldId] = useState(tpl?.fields[0]?.id ?? '')
  const [devSev, setDevSev] = useState(cfg.deviationSeverities[0]?.id ?? '')
  const [devNote, setDevNote] = useState('')

  if (!tpl) {
    return (
      <li className="px-4 py-3 text-sm text-amber-800">
        Ukjent mal for «{run.title}» — oppdater innstillinger.
      </li>
    )
  }

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <span className="font-medium text-neutral-900">{run.title}</span>
          <span className="ml-2 text-xs text-neutral-500">{type?.name}</span>
          <p className="text-xs text-neutral-500">
            {formatWhen(run.conductedAt)} · {run.conductedBy}
            {loc ? ` · ${loc.name}` : ''}
            {run.objectLabel ? ` · ${run.objectLabel}` : ''}
          </p>
        </div>
        {open ? <ChevronUp className="size-5 shrink-0" /> : <ChevronDown className="size-5 shrink-0" />}
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="text-xs text-neutral-500">Status</label>
        <select
          value={run.statusId}
          onChange={(e) => hse.updateInspectionRun(run.id, { statusId: e.target.value })}
          className="rounded-full border border-neutral-200 px-2 py-1 text-xs"
        >
          {cfg.statusFlow
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
        </select>
        <span className="text-xs text-neutral-500">
          Avvik: {run.deviations.length}
        </span>
      </div>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-neutral-100 pt-4">
          <FieldAnswerEditor run={run} tpl={tpl} hse={hse} />
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3">
            <h4 className="text-xs font-semibold text-amber-950">Registrer avvik (standard alvorlighet + frist)</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                value={devFieldId}
                onChange={(e) => setDevFieldId(e.target.value)}
                className="rounded border px-2 py-1 text-xs"
              >
                {tpl.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label.slice(0, 40)}
                  </option>
                ))}
              </select>
              <select value={devSev} onChange={(e) => setDevSev(e.target.value)} className="rounded border px-2 py-1 text-xs">
                {cfg.deviationSeverities
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} ({d.defaultDueDays} d)
                    </option>
                  ))}
              </select>
            </div>
            <textarea
              value={devNote}
              onChange={(e) => setDevNote(e.target.value)}
              rows={2}
              placeholder="Beskrivelse"
              className="mt-2 w-full rounded border px-2 py-1 text-xs"
            />
            <button
              type="button"
              className="mt-2 rounded bg-amber-800 px-2 py-1 text-xs text-white"
              onClick={() => {
                const fld = tpl.fields.find((f) => f.id === devFieldId)
                const sev = cfg.deviationSeverities.find((s) => s.id === devSev)
                if (!fld || !sev) return
                const due = new Date()
                due.setDate(due.getDate() + sev.defaultDueDays)
                hse.addInspectionDeviation(run.id, {
                  fieldId: fld.id,
                  fieldLabel: fld.label,
                  severityId: sev.id,
                  note: devNote.trim() || '(uten merknad)',
                  dueAt: due.toISOString(),
                })
                setDevNote('')
              }}
            >
              Legg til avvik
            </button>
          </div>
          {run.deviations.length > 0 ? (
            <ul className="text-xs text-neutral-700">
              {run.deviations.map((d) => (
                <li key={d.id} className="border-l-2 border-amber-400 pl-2">
                  {d.fieldLabel}: {cfg.deviationSeverities.find((s) => s.id === d.severityId)?.label ?? d.severityId} —{' '}
                  {d.note}
                  {d.dueAt ? ` (frist ${formatWhen(d.dueAt)})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <label className="block text-xs text-neutral-500">Notater</label>
          <textarea
            value={run.notes}
            onChange={(e) => hse.updateInspectionRun(run.id, { notes: e.target.value })}
            rows={2}
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>
      ) : null}
    </li>
  )
}

function FieldAnswerEditor({
  run,
  tpl,
  hse,
}: {
  run: InspectionRun
  tpl: { id: string; fields: InspectionTemplateField[] }
  hse: ReturnType<typeof useHse>
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-neutral-900">Sjekkliste</h4>
      {tpl.fields.map((f) => (
        <div key={f.id} className="rounded-lg bg-[#faf8f4] p-3">
          <div className="text-sm font-medium text-neutral-900">
            {f.label}
            {f.required ? <span className="text-red-600"> *</span> : null}
          </div>
          {f.helpText ? <p className="text-xs text-neutral-600">{f.helpText}</p> : null}
          {f.lawRef ? <p className="text-xs text-neutral-500">{f.lawRef}</p> : null}
          <FieldInput runId={run.id} field={f} answer={run.answers[f.id]} hse={hse} />
        </div>
      ))}
    </div>
  )
}

function FieldInput({
  runId,
  field,
  answer,
  hse,
}: {
  runId: string
  field: InspectionTemplateField
  answer: InspectionFieldAnswer | undefined
  hse: ReturnType<typeof useHse>
}) {
  const set = (a: InspectionFieldAnswer) => hse.setInspectionRunAnswer(runId, field.id, a)

  if (field.fieldType === 'yes_no_na') {
    const v = answer?.type === 'yes_no_na' ? answer.value : 'na'
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {(
          [
            ['yes', 'Ja'],
            ['no', 'Nei'],
            ['na', 'N/A'],
          ] as const
        ).map(([val, lab]) => (
          <button
            key={val}
            type="button"
            onClick={() => set({ type: 'yes_no_na', value: val })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              v === val ? 'bg-[#1a3d32] text-white' : 'bg-white ring-1 ring-neutral-200'
            }`}
          >
            {lab}
          </button>
        ))}
      </div>
    )
  }

  if (field.fieldType === 'text') {
    const val = answer?.type === 'text' ? answer.value : ''
    return (
      <textarea
        value={val}
        onChange={(e) => set({ type: 'text', value: e.target.value })}
        rows={2}
        className="mt-2 w-full rounded border px-2 py-1 text-sm"
      />
    )
  }

  if (field.fieldType === 'number') {
    const val = answer?.type === 'number' ? answer.value : null
    return (
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={val ?? ''}
        onChange={(e) =>
          set({
            type: 'number',
            value: e.target.value === '' ? null : Number(e.target.value),
          })
        }
        className="mt-2 w-32 rounded border px-2 py-1 text-sm"
      />
    )
  }

  const isPhoto = field.fieldType === 'photo_required' || field.fieldType === 'photo_optional'
  if (isPhoto) {
    const req = field.fieldType === 'photo_required'
    const dataUrl =
      answer?.type === 'photo_required' || answer?.type === 'photo_optional' ? answer.dataUrl : null
    return (
      <div className="mt-2">
        <input
          type="file"
          accept="image/*"
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              const url = typeof reader.result === 'string' ? reader.result : ''
              const chk = validatePhotoDataUrl(url)
              if (!chk.ok) {
                alert(chk.error)
                return
              }
              set(
                req
                  ? { type: 'photo_required', dataUrl: url, fileName: file.name }
                  : { type: 'photo_optional', dataUrl: url, fileName: file.name },
              )
            }
            reader.readAsDataURL(file)
            e.target.value = ''
          }}
        />
        {dataUrl ? (
          <div className="mt-2">
            <img src={dataUrl} alt="" className="max-h-32 rounded border" />
            <button
              type="button"
              className="mt-1 text-xs text-red-600 underline"
              onClick={() =>
                set(req ? { type: 'photo_required', dataUrl: null } : { type: 'photo_optional', dataUrl: null })
              }
            >
              Fjern bilde
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return null
}

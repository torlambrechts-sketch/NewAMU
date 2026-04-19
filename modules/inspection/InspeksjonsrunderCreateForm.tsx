
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'

export type InspeksjonsrunderFormState = {
  title: string
  templateId: string
  locationId: string
  scheduledFor: string
  assignedTo: string
  cronExpression: string
}

type Option = { value: string; label: string }

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
          <StandardInput
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            placeholder="F.eks. Q1 vernerunde produksjonshall"
            className="mt-1.5"
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
          <StandardInput
            type="datetime-local"
            value={form.scheduledFor}
            onChange={(e) => onChange({ ...form, scheduledFor: e.target.value })}
            className="mt-1.5"
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

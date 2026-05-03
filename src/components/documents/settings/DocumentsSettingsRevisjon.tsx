import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { DocumentsModuleSettings } from '../../../../modules/documents/documentsModuleSettingsSchema'

const INTERVAL_OPTIONS: SelectOption[] = [
  { value: '6', label: '6 måneder' },
  { value: '12', label: '12 måneder (standard)' },
  { value: '24', label: '24 måneder' },
  { value: '36', label: '36 måneder' },
  { value: '60', label: '5 år' },
]

type Props = {
  settings: DocumentsModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<DocumentsModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function DocumentsSettingsRevisjon({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Revisjon og gyldighet</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Internkontrollforskriften §5 nr. 7 krever at prosedyrer holdes oppdatert. Disse innstillingene
          definerer standarder for påminninger og frister.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Standard revisjonsintervall</p>
            <p className="mt-1 text-sm text-neutral-600">
              Settes automatisk på nye dokumenter ved publisering. Kan overstyres per dokument.
              IK-f §5 anbefaler minst hvert andre år for HMS-prosedyrer.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Intervall</span>
            <div className="mt-1.5 max-w-[220px]">
              <SearchableSelect
                value={String(settings.default_revision_interval_months ?? 12)}
                options={INTERVAL_OPTIONS}
                onChange={(v) => setSettings((p) => ({ ...p, default_revision_interval_months: Number(v) }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Advarselsterskel for revisjon</p>
            <p className="mt-1 text-sm text-neutral-600">
              Antall dager <em>før</em> revisjonsfrist å begynne å vise advarselmerket. 0 = vis kun etter fristen.
              30 dager anbefales for å gi tid til gjennomgang.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rev-warn-days">Dager før frist</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="rev-warn-days"
                type="number"
                min={0}
                max={365}
                value={settings.revision_warning_days ?? 30}
                onChange={(e) => setSettings((p) => ({ ...p, revision_warning_days: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">0 = vis bare etter forfallsdato</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Varsle dokumenteier ved forfallsdato</p>
            <p className="mt-1 text-sm text-neutral-600">
              Sender e-post til den som sist publiserte dokumentet når revisjonsfristen nærmer seg.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Varsle eier</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.notify_owner_on_revision_due ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, notify_owner_on_revision_due: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Varsle administratorer ved forfallsdato</p>
            <p className="mt-1 text-sm text-neutral-600">
              Sender en samlerapport til alle organisasjonsadministratorer ved revisjonsforfall.
              Anbefales for å sikre at ingen dokumenter går ubemerket hen.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Varsle administratorer</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.notify_admins_on_revision_due ?? false}
                onChange={(v) => setSettings((p) => ({ ...p, notify_admins_on_revision_due: v }))}
              />
            </div>
          </div>
        </div>

      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre innstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

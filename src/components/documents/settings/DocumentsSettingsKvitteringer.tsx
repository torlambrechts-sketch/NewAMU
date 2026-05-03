import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { DocumentsModuleSettings } from '../../../../modules/documents/documentsModuleSettingsSchema'

const AUDIENCE_OPTIONS: SelectOption[] = [
  { value: 'all_employees', label: 'Alle ansatte' },
  { value: 'leaders_only', label: 'Kun ledere' },
  { value: 'safety_reps_only', label: 'Kun verneombud' },
]

type Props = {
  settings: DocumentsModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<DocumentsModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function DocumentsSettingsKvitteringer({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">«Lest og forstått»-kvitteringer</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Kvitteringsfunksjonen dokumenterer at ansatte har mottatt og lest viktige HMS-dokumenter — relevant
          for opplæringsplikten i AML §3-2 og sikkerhetsinstrukser.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Standard målgruppe</p>
            <p className="mt-1 text-sm text-neutral-600">
              Forhåndsvalgt målgruppe når «Krever kvittering» aktiveres på et nytt dokument.
              Kan overstyres per dokument.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Standardmålgruppe</span>
            <div className="mt-1.5 max-w-[240px]">
              <SearchableSelect
                value={settings.default_ack_audience ?? 'all_employees'}
                options={AUDIENCE_OPTIONS}
                onChange={(v) =>
                  setSettings((p) => ({
                    ...p,
                    default_ack_audience: v as DocumentsModuleSettings['default_ack_audience'],
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Karensdager etter publisering</p>
            <p className="mt-1 text-sm text-neutral-600">
              Antall dager etter at et dokument publiseres før ufullstendige kvitteringer telles i
              samsvarsrapporter. Gir ansatte tid til å lese dokumentet.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ack-grace">Karensdager</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="ack-grace"
                type="number"
                min={0}
                max={90}
                value={settings.ack_grace_period_days ?? 7}
                onChange={(e) => setSettings((p) => ({ ...p, ack_grace_period_days: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">0 = tell umiddelbart</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Dager mellom automatiske påminnelser</p>
            <p className="mt-1 text-sm text-neutral-600">
              Intervall for automatiske e-postpåminnelser til ansatte som ennå ikke har kvittert.
              0 = ingen automatiske påminnelser (bruk manuell «Send påminnelse» på samsvarsiden).
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ack-remind-days">Dager mellom påminnelser</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="ack-remind-days"
                type="number"
                min={0}
                max={365}
                value={settings.ack_reminder_days ?? 7}
                onChange={(e) => setSettings((p) => ({ ...p, ack_reminder_days: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">0 = ingen automatiske påminnelser</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Maks antall påminnelser</p>
            <p className="mt-1 text-sm text-neutral-600">
              Stopp automatiske påminnelser etter dette antallet for å unngå belastning på ansatte.
              0 = ingen grense (ikke anbefalt).
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="ack-max-rem">Maks påminnelser</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="ack-max-rem"
                type="number"
                min={0}
                max={20}
                value={settings.ack_max_reminders ?? 3}
                onChange={(e) => setSettings((p) => ({ ...p, ack_max_reminders: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">0 = ingen grense</p>
          </div>
        </div>

      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4 space-y-3">
        <InfoBox>
          Kvitteringshistorikk er tilgjengelig i <strong>Samsvar</strong>-fanen under Dokumenter. Aktiver
          «Krever kvittering» per dokument i dokumentredigering.
        </InfoBox>
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre innstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

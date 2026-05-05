import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

const MONTH_OPTIONS: SelectOption[] = [
  { value: '1',  label: 'Januar' },
  { value: '2',  label: 'Februar' },
  { value: '3',  label: 'Mars' },
  { value: '4',  label: 'April' },
  { value: '5',  label: 'Mai' },
  { value: '6',  label: 'Juni' },
  { value: '7',  label: 'Juli' },
  { value: '8',  label: 'August' },
  { value: '9',  label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
]

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsAarsrapport({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Årsrapport</h2>
        <p className="mt-0.5 text-sm text-neutral-500">
          Automatisk klargjøring, innhold og signering. Årsrapporten er påkrevd etter AML § 7-2 (5) og skal
          oppsummere virksomhetens HMS-arbeid.
        </p>
      </div>

      <div className="divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Automatisk kladd</p>
            <p className="mt-1 text-sm text-neutral-600">
              Systemet oppretter automatisk en årsrapport-kladd i den valgte måneden. Anbefalt er
              januar (for forrige kalenderår).
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Opprett kladd i</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={String(settings.annual_report_auto_draft_month ?? 1)}
                options={MONTH_OPTIONS}
                onChange={(v) => setSettings((p) => ({ ...p, annual_report_auto_draft_month: Number(v) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Kladden opprettes for forrige kalenderår</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Dobbel signatur</p>
            <p className="mt-1 text-sm text-neutral-600">
              Årsrapporten signeres av både leder og nestleder fra begge parter. Anbefalt for å
              dokumentere partssamarbeidet i tråd med AML §7-5.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Krev leder + nestleder</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.annual_report_dual_signature ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, annual_report_dual_signature: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Innhold i rapporten</p>
            <p className="mt-1 text-sm text-neutral-600">
              Velg hvilke seksjoner som inkluderes automatisk i årsrapporten. Alle seksjoner kan
              redigeres manuelt i ettertid.
            </p>
          </div>
          <div className="space-y-3">
            {([
              { key: 'annual_report_include_sick_leave' as const,      label: 'Sykefraværsstatistikk' },
              { key: 'annual_report_include_deviations' as const,      label: 'Avviksstatistikk (antall, alvorlighetsgrad, status)' },
              { key: 'annual_report_include_whistleblowing' as const,  label: 'Varslingsstatistikk (anonymisert antall)' },
              { key: 'annual_report_include_inspections' as const,     label: 'Vernerunder / Inspeksjonsresultater' },
              { key: 'annual_report_include_surveys' as const,         label: 'Kartlegginger / Undersøkelsesresultater' },
              { key: 'annual_report_include_hms_training' as const,    label: 'HMS-opplæring (FOR § 3-18) — gyldighetsstatus' },
            ]).map(({ key, label }) => (
              <div key={key}>
                <span className={WPSTD_FORM_FIELD_LABEL}>{label}</span>
                <div className="mt-2">
                  <YesNoToggle
                    value={settings[key] ?? true}
                    onChange={(v) => setSettings((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Signeringsfrist</p>
            <p className="mt-1 text-sm text-neutral-600">
              Måneden årsrapporten senest skal være signert. Brukes til varsling og dashboard-status.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Frist innen utløpet av</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={String(settings.annual_report_signing_deadline_month ?? 3)}
                options={MONTH_OPTIONS}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, annual_report_signing_deadline_month: Number(v) }))
                }
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Anbefalt: mars (Q1)</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div />
          <div>
            <InfoBox>
              Årsrapporten lagres i <strong>Årsrapport</strong>-fanen i AMU-modulen og kan eksporteres
              som PDF. Signerte rapporter arkiveres automatisk og er søkbare under{' '}
              <strong>Dokumenter</strong>.
            </InfoBox>
          </div>
        </div>

      </div>

      <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre årsrapportinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

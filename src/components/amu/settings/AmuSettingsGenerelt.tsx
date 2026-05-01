import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { InfoBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsGenerelt({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Generelle innstillinger</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Grunnleggende konfigurasjon for AMU-utvalget — lovkrav, sammensetning og mandatperiode.
      </p>

      <div className="mt-6 space-y-0 divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Visningsnavn</p>
            <p className="mt-1 text-sm text-neutral-600">
              Erstatter «Arbeidsmiljøutvalg» i overskrifter og e-poster. La stå tomt for standard.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-display-name">Utvalgets navn</label>
            <StandardInput
              id="gen-display-name"
              value={settings.committee_display_name ?? ''}
              onChange={(e) => setSettings((p) => ({ ...p, committee_display_name: e.target.value }))}
              placeholder="Arbeidsmiljøutvalg"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Minimum møter per år</p>
            <p className="mt-1 text-sm text-neutral-600">
              Lovkrav er minst 4 møter per år (AML §7-2). Systemet varsler om manglende møter.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-min-meetings">Antall møter</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="gen-min-meetings"
                type="number"
                min={1}
                max={52}
                value={settings.min_meetings_per_year ?? 4}
                onChange={(e) => setSettings((p) => ({ ...p, min_meetings_per_year: Number(e.target.value) }))}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-500">Lovpålagt minimum: 4</p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Paritet — minimumsmedlemmer</p>
            <p className="mt-1 text-sm text-neutral-600">
              Utvalget skal ha like mange fra arbeidsgiver- og arbeidstakersiden (AML §7-1).
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-min-employer">Min. arbeidsgiverside</label>
              <div className="mt-1.5 max-w-[120px]">
                <StandardInput
                  id="gen-min-employer"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.min_employer_members ?? 2}
                  onChange={(e) => setSettings((p) => ({ ...p, min_employer_members: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-min-employee">Min. arbeidstakersside</label>
              <div className="mt-1.5 max-w-[120px]">
                <StandardInput
                  id="gen-min-employee"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.min_employee_members ?? 2}
                  onChange={(e) => setSettings((p) => ({ ...p, min_employee_members: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Mandatperiode</p>
            <p className="mt-1 text-sm text-neutral-600">
              Vanlig mandatperiode er 2 år (24 måneder). Systemet varsler om utløp.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-term">Varighet (måneder)</label>
            <div className="mt-1.5 max-w-[120px]">
              <StandardInput
                id="gen-term"
                type="number"
                min={1}
                max={48}
                value={settings.term_length_months ?? 24}
                onChange={(e) => setSettings((p) => ({ ...p, term_length_months: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Spor møtelederrotasjon</p>
            <p className="mt-1 text-sm text-neutral-600">
              AML §7-5 krever at ledervervet veksler mellom partene hvert år. Aktivér for å få varsler om rotasjonsplikten.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Rotasjonssporing</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.chair_rotation_tracking ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, chair_rotation_tracking: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Bedriftshelsetjeneste (BHT)</p>
            <p className="mt-1 text-sm text-neutral-600">
              BHT skal delta på møter der HMS-relaterte saker behandles (AML §3-3). Aktiver for å spore oppmøte.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Krev BHT-tilstedeværelse</span>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={settings.bht_required ?? false}
                  onChange={(v) => setSettings((p) => ({ ...p, bht_required: v }))}
                />
              </div>
            </div>
            {settings.bht_required && (
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="gen-bht-name">BHT-leverandør (navn)</label>
                <StandardInput
                  id="gen-bht-name"
                  value={settings.bht_provider_name ?? ''}
                  onChange={(e) => setSettings((p) => ({ ...p, bht_provider_name: e.target.value }))}
                  placeholder="Navn på BHT-leverandør"
                />
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="mt-6">
        <InfoBox>
          Endringer her gjelder for hele virksomheten. Individuelle møte- og medlemsinnstillinger
          håndteres direkte i møtevisningen.
        </InfoBox>
      </div>

      <div className="mt-4">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre innstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

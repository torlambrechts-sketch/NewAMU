import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { AmuModuleSettings } from '../../../../modules/amu/amuModuleSettingsSchema'

const VOTING_DISPLAY_OPTIONS: SelectOption[] = [
  { value: 'inline',  label: 'Inline — stemmetall vises direkte på hvert vedtak' },
  { value: 'summary', label: 'Oppsummering — samlet stemmeoversikt nederst i sak' },
  { value: 'hidden',  label: 'Skjult — stemmer registreres men vises ikke i referat' },
]

type Props = {
  settings: AmuModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<AmuModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function AmuSettingsMoete({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <h2 className="text-lg font-semibold text-neutral-900">Møte- og voteringsinnstillinger</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Konfigurer hvordan møter gjennomføres, votering vises og agenda settes opp automatisk.
      </p>

      <div className="mt-6 space-y-0 divide-y divide-neutral-100">

        {/* ── Voting ───────────────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Visning av stemmer</p>
            <p className="mt-1 text-sm text-neutral-600">
              Velg hvordan stemmetall vises i møtereferater og vedtaksoversikten.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Voteringsvisning</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={settings.voting_display ?? 'inline'}
                options={VOTING_DISPLAY_OPTIONS}
                onChange={(v) => setSettings((p) => ({ ...p, voting_display: v as AmuModuleSettings['voting_display'] }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Kvorumsregel</p>
            <p className="mt-1 text-sm text-neutral-600">
              Krev at et minimumsantall stemmeberettigede medlemmer er til stede før vedtak kan fattes.
              Anbefalt terskel er 50 % + 1 (vanlig flertall).
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <span className={WPSTD_FORM_FIELD_LABEL}>Krev kvorum</span>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={settings.require_quorum ?? false}
                  onChange={(v) => setSettings((p) => ({ ...p, require_quorum: v }))}
                />
              </div>
            </div>
            {settings.require_quorum && (
              <div>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="moete-quorum">Kvorumterskel (%)</label>
                <div className="mt-1.5 max-w-[120px]">
                  <StandardInput
                    id="moete-quorum"
                    type="number"
                    min={1}
                    max={100}
                    value={settings.quorum_threshold_pct ?? 51}
                    onChange={(e) => setSettings((p) => ({ ...p, quorum_threshold_pct: Number(e.target.value) }))}
                  />
                </div>
                <p className="mt-1 text-xs text-neutral-500">Andel av stemmeberettigede som må være til stede</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Meeting format ───────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Hybridmøter</p>
            <p className="mt-1 text-sm text-neutral-600">
              Tillat at møter holdes med deltakere både fysisk og digitalt (f.eks. Teams, Zoom).
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Tillat hybridmøter</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.allow_hybrid ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, allow_hybrid: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Standard møtevarighet</p>
            <p className="mt-1 text-sm text-neutral-600">
              Forhåndsutfylles ved opprettelse av nytt møte.
            </p>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="moete-duration">Varighet (minutter)</label>
            <div className="mt-1.5 max-w-[140px]">
              <StandardInput
                id="moete-duration"
                type="number"
                min={15}
                max={480}
                step={15}
                value={settings.default_meeting_duration_minutes ?? 120}
                onChange={(e) => setSettings((p) => ({ ...p, default_meeting_duration_minutes: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>

        {/* ── Agenda auto-include ──────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Automatisk saksliste</p>
            <p className="mt-1 text-sm text-neutral-600">
              Velg hvilke moduler som automatisk foreslår saker til nye AMU-møter. Gir et godt utgangspunkt
              for dagsorden uten manuelt arbeid.
            </p>
          </div>
          <div className="space-y-3">
            {([
              { key: 'agenda_auto_include_deviations' as const,    label: 'Avvik — åpne saker med høy risikoscore' },
              { key: 'agenda_auto_include_sick_leave' as const,    label: 'Sykefravær — statistikk fra forrige periode' },
              { key: 'agenda_auto_include_whistleblowing' as const, label: 'Varsling — anonymisert antall åpne saker' },
              { key: 'agenda_auto_include_inspections' as const,   label: 'Vernerunder / Inspeksjoner — åpne funn' },
            ]).map(({ key, label }) => (
              <div key={key}>
                <span className={WPSTD_FORM_FIELD_LABEL}>{label}</span>
                <div className="mt-2">
                  <YesNoToggle
                    value={settings[key] ?? false}
                    onChange={(v) => setSettings((p) => ({ ...p, [key]: v }))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Juridiske referanser i sakslisten</p>
            <p className="mt-1 text-sm text-neutral-600">
              Viser AML-/IK-forskriften-paragrafer på agendapunkter. Nyttig for opplæring og
              dokumentasjon av lovpålagte saker.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Vis lovhenvisninger</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.agenda_show_legal_refs ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, agenda_show_legal_refs: v }))}
              />
            </div>
          </div>
        </div>

      </div>

      <div className="mt-6">
        <Button type="button" variant="primary" disabled={saving} onClick={onSave}>
          {saving ? 'Lagrer…' : 'Lagre møteinnstillinger'}
        </Button>
      </div>
    </ModuleSectionCard>
  )
}

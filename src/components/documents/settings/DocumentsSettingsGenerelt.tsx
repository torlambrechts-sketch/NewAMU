import { ModuleSectionCard } from '../../module'
import { Button } from '../../ui/Button'
import { YesNoToggle } from '../../ui/FormToggles'
import { SearchableSelect, type SelectOption } from '../../ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL, WPSTD_FORM_ROW_GRID } from '../../layout/WorkplaceStandardFormPanel'
import type { DocumentsModuleSettings } from '../../../../modules/documents/documentsModuleSettingsSchema'

const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'no', label: 'Norsk (bokmål)' },
  { value: 'en', label: 'Engelsk' },
]

type Props = {
  settings: DocumentsModuleSettings
  setSettings: React.Dispatch<React.SetStateAction<DocumentsModuleSettings>>
  saving: boolean
  onSave: () => void
}

export function DocumentsSettingsGenerelt({ settings, setSettings, saving, onSave }: Props) {
  return (
    <ModuleSectionCard className="overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-4">
        <h2 className="text-base font-semibold text-neutral-900">Generelle innstillinger</h2>
        <p className="mt-0.5 text-sm text-neutral-500">Modulomfattende standarder — gjelder for hele organisasjonen.</p>
      </div>

      <div className="divide-y divide-neutral-100">

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Standardspråk for nye dokumenter</p>
            <p className="mt-1 text-sm text-neutral-600">
              Angis på dokumentet ved oppretting — kan overstyres per dokument. Brukes ved PDF-eksport og maler.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Språk</span>
            <div className="mt-1.5 max-w-[200px]">
              <SearchableSelect
                value={settings.default_language ?? 'no'}
                options={LANGUAGE_OPTIONS}
                onChange={(v) => setSettings((p) => ({ ...p, default_language: v as 'no' | 'en' }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Krev lovhenvisning ved publisering</p>
            <p className="mt-1 text-sm text-neutral-600">
              Blokkerer publisering av dokumenter som mangler minst én lovhenvisning (f.eks. «IK-f §5 nr. 7»).
              Sikrer sporbarhet mot internkontrollforskriften.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Krav om lovhenvisning</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.require_legal_ref_on_publish ?? false}
                onChange={(v) => setSettings((p) => ({ ...p, require_legal_ref_on_publish: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Vis revisjonsstatus-merke i dokumentlisten</p>
            <p className="mt-1 text-sm text-neutral-600">
              Fargekodet indikator (grønn/gul/rød) per rad i dokumentoversikten basert på revisjonsfrist.
              Gir umiddelbar oversikt uten å åpne hvert dokument.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Revisjonsstatus-merke</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.show_revision_badge ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, show_revision_badge: v }))}
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Opprett årsgjennomgang automatisk</p>
            <p className="mt-1 text-sm text-neutral-600">
              Genererer årsgjennomgang for inneværende år første gang siden besøkes etter 1. februar
              (IK-f §5 nr. 5). Deaktiver om dere starter gjennomgangen manuelt.
            </p>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Auto-opprett årsgjennomgang</span>
            <div className="mt-2 max-w-xs">
              <YesNoToggle
                value={settings.auto_create_annual_review ?? true}
                onChange={(v) => setSettings((p) => ({ ...p, auto_create_annual_review: v }))}
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

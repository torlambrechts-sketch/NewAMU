// SurveyPackEditorPanel — slide-panel editor for a single survey pack's
// display fields. Mirrors modules/compliance/admin/PackEditorPanel but
// drops severity_labels (not applicable to surveys) and adds the survey-
// specific behaviour columns: requires_publish_snapshot, default_anonymous,
// default_anonymity_threshold.
//
// Per Q2 of the GLOBAL_SURVEY_PLAN: customers can re-skin display + tweak
// behaviour but cannot create or remove a pack — that's platform-admin.

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { SurveyPackRow } from '../types'
import type { UpdateSurveyPackInput } from '../useSurveyPacks'

type Props = {
  pack: SurveyPackRow
  onClose: () => void
  onSave: (input: UpdateSurveyPackInput) => Promise<void>
}

export function SurveyPackEditorPanel({ pack, onClose, onSave }: Props) {
  const [shortName, setShortName] = useState(pack.short_name)
  const [pluralLabel, setPluralLabel] = useState(pack.plural_label)
  const [ctaLabel, setCtaLabel] = useState(pack.cta_label)
  const [description, setDescription] = useState(pack.description)
  const [kpiOpen, setKpiOpen] = useState(pack.kpi_labels.open)
  const [kpiCritical, setKpiCritical] = useState(pack.kpi_labels.critical)
  const [kpiYtd, setKpiYtd] = useState(pack.kpi_labels.ytd)
  const [refs, setRefs] = useState(pack.legal_references.map((r) => ({ ...r })))
  const [requiresSnapshot, setRequiresSnapshot] = useState(pack.requires_publish_snapshot)
  const [defaultAnonymous, setDefaultAnonymous] = useState(pack.default_anonymous)
  const [anonymityThreshold, setAnonymityThreshold] = useState(
    String(pack.default_anonymity_threshold),
  )
  const [position, setPosition] = useState(String(pack.position))
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const canSubmit =
    !submitting &&
    shortName.trim().length > 0 &&
    pluralLabel.trim().length > 0 &&
    ctaLabel.trim().length > 0

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setLocalError(null)
    try {
      const thresholdNum = Number(anonymityThreshold)
      const positionNum = Number(position)
      await onSave({
        slug: pack.slug,
        shortName: shortName.trim(),
        pluralLabel: pluralLabel.trim(),
        ctaLabel: ctaLabel.trim(),
        description: description.trim(),
        legalReferences: refs.filter((r) => r.code.trim() && r.text.trim()),
        kpiLabels: {
          open: kpiOpen.trim() || pack.kpi_labels.open,
          critical: kpiCritical.trim() || pack.kpi_labels.critical,
          ytd: kpiYtd.trim() || pack.kpi_labels.ytd,
        },
        requiresPublishSnapshot: requiresSnapshot,
        defaultAnonymous,
        defaultAnonymityThreshold:
          Number.isFinite(thresholdNum) && thresholdNum > 0
            ? Math.floor(thresholdNum)
            : pack.default_anonymity_threshold,
        position: Number.isFinite(positionNum) ? Math.floor(positionNum) : pack.position,
      })
      onClose()
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Kunne ikke lagre.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      titleId="form-edit-survey-pack"
      title={`Rediger ${pack.short_name}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!canSubmit}
          >
            Lagre
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        {localError ? (
          <div className="px-4 pt-4 md:px-5">
            <WarningBox>{localError}</WarningBox>
          </div>
        ) : null}

        {/* Identity / terminology */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Kort merkenavn brukt i topbar og badges.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Kortnavn</p>
            <StandardInput
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Flertallsetikett brukt som sidetittel.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Flertall</p>
            <StandardInput
              value={pluralLabel}
              onChange={(e) => setPluralLabel(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Tekst på primærknappen i listevisning.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>CTA-tekst</p>
            <StandardInput
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Beskrivelse — vises under sidetittelen.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <StandardTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Sortering i topbar-dropdown og lister.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Posisjon</p>
            <StandardInput
              type="number"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Behaviour defaults */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">Atferds-standarder</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Definerer hvordan undersøkelser i denne pakken oppfører seg by default.
            Per-mal-overstyring kan settes på catalog-rader.
          </p>
          <div className="mt-3 space-y-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <ToggleSwitch
                checked={requiresSnapshot}
                onChange={setRequiresSnapshot}
                label="Lås spørsmål ved publisering"
              />
              <span>Lås spørsmål ved publisering (compliance / leverandør)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <ToggleSwitch
                checked={defaultAnonymous}
                onChange={setDefaultAnonymous}
                label="Anonym som standard"
              />
              <span>Anonym som standard</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-[280px_1fr] sm:items-start">
              <p className={WPSTD_FORM_FIELD_LABEL}>K-anonymitetsterskel (default)</p>
              <StandardInput
                type="number"
                value={anonymityThreshold}
                onChange={(e) => setAnonymityThreshold(e.target.value)}
                className="mt-1.5 max-w-[120px]"
              />
            </div>
          </div>
        </div>

        {/* KPI labels */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">KPI-merker</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Etiketter på de tre KPI-flisene øverst på listesiden for denne pakken.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Åpne</p>
              <StandardInput
                value={kpiOpen}
                onChange={(e) => setKpiOpen(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Kritisk</p>
              <StandardInput
                value={kpiCritical}
                onChange={(e) => setKpiCritical(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>I år (YTD)</p>
              <StandardInput
                value={kpiYtd}
                onChange={(e) => setKpiYtd(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* Legal references */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">Bannerreferanser</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Lov-/standardparagrafer som vises i ModuleLegalBanner øverst på
            listesiden for denne pakken.
          </p>
          <ul className="mt-3 space-y-2">
            {refs.map((r, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-md border border-neutral-200/80 bg-white p-3"
              >
                <div className="grid flex-1 gap-2 sm:grid-cols-[180px_1fr]">
                  <StandardInput
                    value={r.code}
                    onChange={(e) =>
                      setRefs((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, code: e.target.value } : x)),
                      )
                    }
                    placeholder="AML §3-1"
                    className="font-mono text-sm"
                  />
                  <StandardInput
                    value={r.text}
                    onChange={(e) =>
                      setRefs((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, text: e.target.value } : x)),
                      )
                    }
                    placeholder="Beskrivelse av lovparagrafen …"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setRefs((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Slett referanse"
                >
                  <span className="sr-only">Slett</span>
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setRefs((prev) => [...prev, { code: '', text: '' }])}
            >
              Legg til referanse
            </Button>
          </div>
        </div>
      </div>
    </FormModal>
  )
}

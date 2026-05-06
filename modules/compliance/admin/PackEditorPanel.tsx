// PackEditorPanel — edit the display fields of one compliance pack.
//
// Per Q2 A: customers can re-skin a pack but cannot create or remove
// one. Slug + is_active are not editable here; they belong to platform
// admin via SQL.

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { usePackAdmin } from '../../../src/context/packContextValue'
import type {
  CompliancePack,
  PackKpiLabels,
  PackLegalReference,
  PackSeverityLabels,
} from '../../../src/lib/compliance/packs'

type Props = {
  pack: CompliancePack
  onClose: () => void
  onSaved: () => void
}

export function PackEditorPanel({ pack, onClose, onSaved }: Props) {
  const { updatePack, refreshPacks } = usePackAdmin()

  const [shortName, setShortName] = useState(pack.shortName)
  const [pluralLabel, setPluralLabel] = useState(pack.pluralLabel)
  const [ctaLabel, setCtaLabel] = useState(pack.ctaLabel)
  const [description, setDescription] = useState(pack.description)
  const [kpi, setKpi] = useState<PackKpiLabels>({ ...pack.kpiLabels })
  const [severity, setSeverity] = useState<PackSeverityLabels>({
    ...pack.severityLabels,
  })
  const [refs, setRefs] = useState<PackLegalReference[]>([
    ...pack.legalReferences,
  ])
  const [position, setPosition] = useState<string>(String(pack.position))
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
      const positionNum = Number(position)
      await updatePack({
        slug: pack.slug,
        shortName: shortName.trim(),
        pluralLabel: pluralLabel.trim(),
        ctaLabel: ctaLabel.trim(),
        description: description.trim(),
        legalReferences: refs.filter(
          (r) => r.code.trim() && r.text.trim(),
        ),
        kpiLabels: {
          open: kpi.open.trim() || pack.kpiLabels.open,
          critical: kpi.critical.trim() || pack.kpiLabels.critical,
          ytd: kpi.ytd.trim() || pack.kpiLabels.ytd,
        },
        severityLabels: {
          critical: severity.critical.trim() || pack.severityLabels.critical,
          high: severity.high.trim() || pack.severityLabels.high,
          medium: severity.medium.trim() || pack.severityLabels.medium,
          low: severity.low.trim() || pack.severityLabels.low,
        },
        position: Number.isFinite(positionNum) ? positionNum : pack.position,
      })
      await refreshPacks()
      onSaved()
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
      titleId="form-edit-pack"
      title={`Rediger ${pack.shortName}`}
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

        {/* ── Identity / terminology ─────────────────────────────────── */}
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
              placeholder="Vernerunder"
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
              placeholder="Ny vernerunde"
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

        {/* ── KPI labels ─────────────────────────────────────────────── */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">KPI-merker</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Etiketter på de tre KPI-flisene øverst på listesiden.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Åpne</p>
              <StandardInput
                value={kpi.open}
                onChange={(e) => setKpi({ ...kpi, open: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Kritiske</p>
              <StandardInput
                value={kpi.critical}
                onChange={(e) => setKpi({ ...kpi, critical: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>I år (YTD)</p>
              <StandardInput
                value={kpi.ytd}
                onChange={(e) => setKpi({ ...kpi, ytd: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* ── Severity labels ─────────────────────────────────────────── */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Alvorlighetsetiketter
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Hvordan de fire alvorlighetsnivåene leses for revisor — for ISO
            kollapses ofte critical og high til «Major NC».
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Kritisk</p>
              <StandardInput
                value={severity.critical}
                onChange={(e) =>
                  setSeverity({ ...severity, critical: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Høy</p>
              <StandardInput
                value={severity.high}
                onChange={(e) =>
                  setSeverity({ ...severity, high: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Middels</p>
              <StandardInput
                value={severity.medium}
                onChange={(e) =>
                  setSeverity({ ...severity, medium: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Lav</p>
              <StandardInput
                value={severity.low}
                onChange={(e) =>
                  setSeverity({ ...severity, low: e.target.value })
                }
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        {/* ── Legal references ────────────────────────────────────────── */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Bannerreferanser
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Lov-/standardparagrafer som vises i ModuleLegalBanner øverst på
            listesiden. Kuratert utvalg — for full taksonomi, se Krav-fanen.
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
                        prev.map((x, i) =>
                          i === idx ? { ...x, code: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="AML §3-1"
                    className="font-mono text-sm"
                  />
                  <StandardInput
                    value={r.text}
                    onChange={(e) =>
                      setRefs((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Krav til systematisk HMS-arbeid …"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() =>
                    setRefs((prev) => prev.filter((_, i) => i !== idx))
                  }
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

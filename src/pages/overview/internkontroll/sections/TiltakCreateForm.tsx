// TiltakCreateForm — right-side slide-over for creating a new tiltak.
//
// Replaces the inline composer that previously lived inside TiltakSection.
// Mirrors the Sjekklister `Ny gjennomføring` pattern (ComplianceCreateForm)
// so create flows feel like the same product across modules.

import { useEffect, useMemo, useRef, useState } from 'react'
import { FormModal } from '../../../../template'
import { Button } from '../../../../components/ui/Button'
import { StandardInput } from '../../../../components/ui/Input'
import { StandardTextarea } from '../../../../components/ui/Textarea'
import { SearchableSelect } from '../../../../components/ui/SearchableSelect'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_OPTIONAL,
  WPSTD_FORM_ROW_GRID,
} from '../../../../components/layout/WorkplaceStandardFormPanel'
import {
  FRAMEWORK_IDS,
  FRAMEWORKS,
  type FrameworkId,
} from '../frameworkParagraphs'
import type { IkData } from '../useInternkontrollPageData'

export type TiltakCreatePayload = {
  title: string
  description: string
  lawRef: string
  framework: FrameworkId
  dueAt: string | null
  projectId: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  /** Available task_projects rows (id + label) for the optional picker. */
  projectOptions: IkData['prosjekter']
  /** Pre-fills the paragraph + framework when the dialog opens from a
   *  drill-down on a krav row. Optional. */
  initialLawRef?: string
  initialFramework?: FrameworkId
  /** Returns true on a successful save (form clears + closes), false on
   *  failure (form stays open with the user's typed input intact + an
   *  inline error banner so they can retry). Throwing is also failure. */
  onCreate: (payload: TiltakCreatePayload) => Promise<boolean>
}

type FormState = {
  title: string
  description: string
  lawRef: string
  framework: FrameworkId
  dueAt: string
  projectId: string
}

const EMPTY: FormState = {
  title: '',
  description: '',
  lawRef: '',
  framework: 'aml',
  dueAt: '',
  projectId: '',
}

// Hoisted to module scope: framework options never change at runtime,
// so we'd otherwise be rebuilding the same array on every render and
// invalidating SearchableSelect's identity-based effects.
const FRAMEWORK_OPTIONS = FRAMEWORK_IDS.map((id) => ({
  value: id,
  label: `${FRAMEWORKS[id].shortLabel} — ${FRAMEWORKS[id].fullLabel}`,
}))

// Defence in depth against the inline `as FrameworkId` cast smell:
// the SearchableSelect can only emit strings, so we narrow at the
// boundary against the known-good set instead of laundering the cast.
function isFrameworkId(v: string): v is FrameworkId {
  return (FRAMEWORK_IDS as readonly string[]).includes(v)
}

export function TiltakCreateForm({
  open,
  onClose,
  projectOptions,
  initialLawRef,
  initialFramework,
  onCreate,
}: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Track open transitions so we only reset on false→true edge — a
  // parent re-render that changes `initialLawRef` while the panel is
  // already open must NOT blow away the user's in-progress edits.
  const wasOpenRef = useRef(false)

  // On every false→true open: clear "what the last entry was" (title /
  // description / lawRef / dueAt) but PRESERVE framework + projectId
  // so bulk-entry workflows ("create 12 tiltak under the same ISO 45001
  // project") don't force a re-pick on every open. Mirrors the old
  // inline composer's Avbryt handler which only cleared the text
  // fields. Pre-fill from `initialLawRef` / `initialFramework` when
  // the caller drills down from a krav row.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        lawRef: initialLawRef ?? '',
        framework: initialFramework ?? prev.framework,
        dueAt: '',
      }))
      setSubmitError(null)
    }
    wasOpenRef.current = open
  }, [open, initialLawRef, initialFramework])

  // useMemo'd because options identity-change re-fires downstream
  // SearchableSelect effects. The list only changes when the parent
  // hook refetches task_projects.
  const projectSelectOptions = useMemo(
    () => [
      { value: '', label: 'Ingen prosjekt' },
      ...projectOptions
        .filter((p) => p.projectId !== null)
        .map((p) => ({ value: p.projectId as string, label: p.name })),
    ],
    [projectOptions],
  )

  const canSubmit =
    !submitting && form.title.trim().length > 0 && form.lawRef.trim().length > 0

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const ok = await onCreate({
        title: form.title.trim(),
        description: form.description.trim(),
        lawRef: form.lawRef.trim(),
        framework: form.framework,
        dueAt: form.dueAt || null,
        projectId: form.projectId || null,
      })
      if (ok) {
        onClose()
      } else {
        // Keep the form open with the user's typed input intact so they
        // can retry. Inline error makes the failure visible.
        setSubmitError(
          'Kunne ikke lagre tiltaket. Sjekk at prosjekt og lovreferanse er gyldige, eller prøv igjen.',
        )
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `Kunne ikke lagre tiltaket: ${err.message}`
          : 'Kunne ikke lagre tiltaket. Ukjent feil.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      titleId="form-create-tiltak"
      title="Nytt tiltak"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {submitting ? 'Lagrer…' : 'Opprett tiltak'}
          </Button>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        {submitError ? (
          <div
            role="alert"
            className="mx-6 mb-3 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800 sm:mx-8"
          >
            {submitError}
          </div>
        ) : null}

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hva skal gjøres for å lukke gapet?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tittel</p>
            <StandardInput
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Eks. Etabler 24/72-timers meldeprosedyre"
              className="mt-1.5"
              autoFocus
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Mer detalj om tiltaket?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse {WPSTD_FORM_OPTIONAL}</p>
            <StandardTextarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              placeholder="Hva må gjøres, og hva er sluttilstanden?"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hvilken paragraf lukkes?</p>
          <div className="space-y-3">
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Paragraf (law_ref)</p>
              <StandardInput
                value={form.lawRef}
                onChange={(e) => setForm((prev) => ({ ...prev, lawRef: e.target.value }))}
                placeholder="Eks. AML § 4-3"
                className="mt-1.5"
              />
            </div>
            <div>
              <p className={WPSTD_FORM_FIELD_LABEL}>Rammeverk</p>
              <SearchableSelect
                value={form.framework}
                onChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    framework: isFrameworkId(v) ? v : prev.framework,
                  }))
                }
                options={FRAMEWORK_OPTIONS}
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Når skal det være ferdig?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Frist {WPSTD_FORM_OPTIONAL}</p>
            <StandardInput
              type="date"
              value={form.dueAt}
              onChange={(e) => setForm((prev) => ({ ...prev, dueAt: e.target.value }))}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Skal tiltaket inngå i et prosjekt?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Prosjekt {WPSTD_FORM_OPTIONAL}</p>
            <SearchableSelect
              value={form.projectId}
              onChange={(v) => setForm((prev) => ({ ...prev, projectId: v }))}
              options={projectSelectOptions}
              className="mt-1.5"
            />
          </div>
        </div>
      </div>
    </FormModal>
  )
}

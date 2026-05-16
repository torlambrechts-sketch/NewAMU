// TaskProjectCreateForm — slide panel to create a new task_project.
// Methodology choice (PDCA / Kanban) drives which board layout is used.

import { useState } from 'react'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import type { CreateProjectInput } from './useTaskProjects'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (input: CreateProjectInput) => Promise<string | null>
}

const EMPTY: CreateProjectInput = {
  title: '',
  description: '',
  methodology: 'pdca',
  startDate: '',
  endDate: '',
  lawRefs: [],
}

const METHODOLOGY_OPTIONS: Array<{
  value: 'pdca' | 'kanban'
  label: string
  description: string
}> = [
  {
    value: 'pdca',
    label: 'PDCA',
    description: 'Planlegg → Gjennomfør → Kontroller → Forbedre (ISO 45001 § 10)',
  },
  {
    value: 'kanban',
    label: 'Kanban',
    description: 'Oppgavetavle med statuskolonner — fleksibel flyt',
  },
]

export function TaskProjectCreateForm({ open, onClose, onCreate }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [lawRefsRaw, setLawRefsRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof CreateProjectInput>(k: K, v: CreateProjectInput[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }))

  const canSubmit = !submitting && form.title.trim().length > 0

  const handleClose = () => {
    setForm(EMPTY)
    setLawRefsRaw('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const lawRefs = lawRefsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const id = await onCreate({
        ...form,
        title: form.title.trim(),
        description: form.description?.trim() || '',
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        lawRefs,
      })
      if (id) {
        handleClose()
      } else {
        setError('Kunne ikke opprette prosjekt. Prøv igjen.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={handleClose}
      titleId="project-create-title"
      title="Nytt prosjekt"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">Prosjekter samler oppgaver under én tavle</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {submitting ? 'Oppretter…' : 'Opprett prosjekt'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="divide-y divide-neutral-200/60">
        {/* Title */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Prosjektnavn *</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Kort, beskrivende navn</p>
          </div>
          <div>
            <StandardInput
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="F.eks. Risikovurdering Q3 2026…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) void handleSubmit()
              }}
            />
          </div>
        </div>

        {/* Methodology */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tavletype</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Bestemmer kolonnestrukturen</p>
          </div>
          <div className="space-y-2">
            {METHODOLOGY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="secondary"
                onClick={() => set('methodology', opt.value)}
                aria-pressed={form.methodology === opt.value}
                className={`flex w-full items-start justify-start gap-3 rounded-lg border p-3 text-left font-normal transition ${
                  form.methodology === opt.value
                    ? 'border-[#c2410c] bg-orange-50/40 hover:bg-orange-50/40'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    form.methodology === opt.value
                      ? 'border-[#c2410c] bg-[#c2410c]'
                      : 'border-neutral-300 bg-white'
                  }`}
                >
                  {form.methodology === opt.value && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium text-neutral-900">{opt.label}</span>
                  <span className="mt-0.5 block text-xs font-normal text-neutral-500">{opt.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Mål og omfang</p>
          </div>
          <div>
            <StandardTextarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Beskriv formålet med prosjektet…"
              className="focus:border-[#c2410c] focus:ring-[#c2410c]/20"
            />
          </div>
        </div>

        {/* Dates */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Periode</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Start- og sluttdato</p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="mb-1 text-xs text-neutral-500">Start</p>
              <StandardInput
                type="date"
                value={form.startDate ?? ''}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-xs text-neutral-500">Slutt</p>
              <StandardInput
                type="date"
                value={form.endDate ?? ''}
                onChange={(e) => set('endDate', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Law refs */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Lovhenvisninger</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Kommaseparert, f.eks. «AML § 3-1, IK-f § 5»</p>
          </div>
          <div>
            <StandardInput
              value={lawRefsRaw}
              onChange={(e) => setLawRefsRaw(e.target.value)}
              placeholder="AML § 3-1, IK-f § 5 nr. 6…"
            />
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 md:px-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

// TaskCreateForm — slide panel for creating a new task item.
// Renders core fields (title, priority, due date, assignee) plus any
// metadata_schema fields defined on the template.

import { useEffect, useState } from 'react'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import type { TaskTemplateRow } from './useTaskTemplates'
import type { CreateTaskItemInput } from './useTaskItemsData'
import type { TaskItemPriority } from '../../src/types/task'
import { TASK_PRIORITY_LABEL } from './components/TaskPriorityBadge'

type Props = {
  open: boolean
  onClose: () => void
  template: TaskTemplateRow
  onCreate: (input: CreateTaskItemInput) => Promise<string | null>
}

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium' as TaskItemPriority,
  assigneeName: '',
  ownerName: '',
  dueDate: '',
}

export function TaskCreateForm({ open, onClose, template, onCreate }: Props) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [metaValues, setMetaValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill title on template change
  useEffect(() => {
    if (!open) return
    setForm((prev) => ({ ...EMPTY_FORM, title: prev.title || '' }))
    setMetaValues({})
    setError(null)
  }, [open, template.id])

  const set = (key: keyof typeof EMPTY_FORM, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const canSubmit = !submitting && form.title.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const id = await onCreate({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        templateSlug: template.slug,
        templateKind: template.templateKind,
        assigneeName: form.assigneeName.trim() || undefined,
        ownerName: form.ownerName.trim() || undefined,
        dueDate: form.dueDate || undefined,
      })
      if (id) {
        onClose()
      } else {
        setError('Kunne ikke opprette oppgave. Prøv igjen.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const fields = template.metadataSchema?.fields ?? []

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="task-create-title"
      title={`Ny ${template.name.toLowerCase()}`}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">{template.name}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              {submitting ? 'Oppretter…' : 'Opprett'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="divide-y divide-neutral-200/60">
        {/* Title */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tittel *</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Kort beskrivelse av oppgaven</p>
          </div>
          <div>
            <StandardInput
              autoFocus
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={`Tittel på ${template.name.toLowerCase()}…`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSubmit) void handleSubmit()
              }}
            />
          </div>
        </div>

        {/* Priority */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Prioritet</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Hastegrad for oppgaven</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['low', 'medium', 'high', 'critical'] as TaskItemPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => set('priority', p)}
                className={`rounded border px-3 py-1.5 text-sm transition ${
                  form.priority === p
                    ? 'border-[#c2410c] bg-[#c2410c] text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-[#c2410c]/40'
                }`}
              >
                {TASK_PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Frist</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Ønsket ferdigstillelsesdato</p>
          </div>
          <div>
            <StandardInput
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </div>
        </div>

        {/* Owner */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Oppgaveeier</p>
          </div>
          <div>
            <StandardInput
              value={form.ownerName}
              onChange={(e) => set('ownerName', e.target.value)}
              placeholder="Navn på ansvarlig…"
            />
          </div>
        </div>

        {/* Assignee */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Tildelt</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Utfører av oppgaven</p>
          </div>
          <div>
            <StandardInput
              value={form.assigneeName}
              onChange={(e) => set('assigneeName', e.target.value)}
              placeholder="Navn på utfører…"
            />
          </div>
        </div>

        {/* Description */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <p className={`${WPSTD_FORM_LEAD} mt-1`}>Utfyllende detaljer</p>
          </div>
          <div>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="Legg til beskrivelse…"
              className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
            />
          </div>
        </div>

        {/* Template-specific metadata fields */}
        {fields.length > 0 && (
          <>
            <div className="px-4 py-3 md:px-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                {template.name} — tilleggsfelt
              </p>
            </div>
            {fields.map((field) => (
              <div key={field.id} className={WPSTD_FORM_ROW_GRID}>
                <div>
                  <p className={WPSTD_FORM_FIELD_LABEL}>
                    {field.label}
                    {field.required && <span className="ml-1 text-red-500">*</span>}
                  </p>
                </div>
                <div>
                  {field.kind === 'textarea' ? (
                    <textarea
                      value={metaValues[field.id] ?? ''}
                      onChange={(e) =>
                        setMetaValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      rows={3}
                      placeholder={field.label}
                      className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
                    />
                  ) : field.kind === 'select' ? (
                    <select
                      value={metaValues[field.id] ?? ''}
                      onChange={(e) =>
                        setMetaValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      className="w-full rounded border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
                    >
                      <option value="">Velg…</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.kind === 'boolean' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={metaValues[field.id] === 'true'}
                        onChange={(e) =>
                          setMetaValues((prev) => ({
                            ...prev,
                            [field.id]: e.target.checked ? 'true' : 'false',
                          }))
                        }
                        className="h-4 w-4 rounded border-neutral-300 text-[#c2410c] focus:ring-[#c2410c]/20"
                      />
                      <span className="text-sm text-neutral-700">{field.label}</span>
                    </label>
                  ) : (
                    <StandardInput
                      type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'}
                      value={metaValues[field.id] ?? ''}
                      onChange={(e) =>
                        setMetaValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                      }
                      placeholder={field.label}
                    />
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {error && (
          <div className="px-4 py-3 md:px-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

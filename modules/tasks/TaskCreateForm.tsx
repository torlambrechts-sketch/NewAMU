// TaskCreateForm — slide panel for creating a new task item.
// Renders core fields (title, priority, due date, assignee) plus any
// metadata_schema fields defined on the template.

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { TaskMetadataField } from '../../src/types/task'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { ToggleSwitch } from '../../src/components/ui/FormToggles'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { fetchAssignableUsers, type AssignableUser } from '../../src/hooks/useAssignableUsers'
import type { TaskTemplateRow } from './useTaskTemplates'
import type { CreateTaskItemInput } from './useTaskItemsData'
import type { TaskItemPriority } from '../../src/types/task'
import { TASK_PRIORITY_LABEL } from './components/TaskPriorityBadge'
import { RiskMatrix } from './components/RiskMatrix'
import { PersonSelect } from './components/PersonSelect'
import { LocationSelect } from './components/LocationSelect'

// Group a flat fields array into sections using 'section' sentinel fields.
type FieldGroup = { label: string | null; fields: TaskMetadataField[] }

function groupFields(fields: TaskMetadataField[]): FieldGroup[] {
  const groups: FieldGroup[] = []
  let current: FieldGroup = { label: null, fields: [] }
  for (const f of fields) {
    if (f.kind === 'section') {
      if (current.fields.length > 0) groups.push(current)
      current = { label: f.label, fields: [] }
    } else {
      current.fields.push(f)
    }
  }
  if (current.fields.length > 0) groups.push(current)
  return groups
}

function CollapsibleSection({ label, children, defaultOpen = true }: {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <Button
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full justify-start gap-2 rounded-none border-b border-neutral-200 bg-neutral-50/80 px-4 py-2.5 text-left font-normal hover:bg-neutral-100/60 md:px-5"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#c2410c]/60 transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">{label}</span>
      </Button>
      {open && <div>{children}</div>}
    </div>
  )
}

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
  const { supabase, organization, locations } = useOrgSetupContext()
  const [form, setForm] = useState(EMPTY_FORM)
  const [metaValues, setMetaValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgUsers, setOrgUsers] = useState<AssignableUser[]>([])

  // Load org members once when form opens
  useEffect(() => {
    if (!open || !supabase) return
    void fetchAssignableUsers(supabase, organization?.id).then(setOrgUsers)
  }, [open, supabase, organization?.id])

  const locationOptions = locations.map((l) => l.name)

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
              <Button
                key={p}
                size="sm"
                variant={form.priority === p ? 'primary' : 'secondary'}
                onClick={() => set('priority', p)}
                className={form.priority === p ? 'bg-[#c2410c] hover:bg-[#a33609]' : 'hover:border-[#c2410c]/40'}
              >
                {TASK_PRIORITY_LABEL[p]}
              </Button>
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
            <StandardTextarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="Legg til beskrivelse…"
              className="focus:border-[#c2410c] focus:ring-[#c2410c]/20"
            />
          </div>
        </div>

        {/* Template-specific metadata fields — grouped into collapsible sections */}
        {fields.length > 0 && (() => {
          const groups = groupFields(fields)
          const hasSections = groups.some((g) => g.label !== null)
          return (
            <>
              {!hasSections && (
                <div className="px-4 py-3 md:px-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    {template.name} — tilleggsfelt
                  </p>
                </div>
              )}
              {groups.map((group, gi) => {
                const content = group.fields.map((field) => (
                  <div
                    key={field.id}
                    className={field.kind === 'risk_matrix' ? 'px-4 py-3 md:px-5' : WPSTD_FORM_ROW_GRID}
                  >
                    {field.kind !== 'risk_matrix' && (
                      <div>
                        <p className={WPSTD_FORM_FIELD_LABEL}>
                          {field.label}
                          {field.required && <span className="ml-1 text-red-500">*</span>}
                        </p>
                      </div>
                    )}
                    <div>
                      {field.kind === 'risk_matrix' ? (
                        (() => {
                          const probId = field.options?.find((o) => o.startsWith('prob:'))?.slice(5) ?? ''
                          const consId = field.options?.find((o) => o.startsWith('cons:'))?.slice(5) ?? ''
                          const p = metaValues[probId] ? Number(metaValues[probId]) : null
                          const c = metaValues[consId] ? Number(metaValues[consId]) : null
                          return <RiskMatrix probability={p} consequence={c} />
                        })()
                      ) : field.kind === 'person' ? (
                        <PersonSelect
                          users={orgUsers}
                          value={metaValues[field.id] ?? ''}
                          onChange={(v) => setMetaValues((prev) => ({ ...prev, [field.id]: v }))}
                          placeholder={`Velg ${field.label.toLowerCase()}…`}
                        />
                      ) : field.kind === 'location' ? (
                        <LocationSelect
                          locationNames={locationOptions}
                          value={metaValues[field.id] ?? ''}
                          onChange={(v) => setMetaValues((prev) => ({ ...prev, [field.id]: v }))}
                        />
                      ) : field.kind === 'textarea' ? (
                        <StandardTextarea
                          value={metaValues[field.id] ?? ''}
                          onChange={(e) => setMetaValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          rows={3}
                          placeholder={field.label}
                          className="focus:border-[#c2410c] focus:ring-[#c2410c]/20"
                        />
                      ) : field.kind === 'select' ? (
                        <SearchableSelect
                          value={metaValues[field.id] ?? ''}
                          options={[
                            { value: '', label: 'Velg…' },
                            ...((field.options ?? []).map((opt) => ({ value: opt, label: opt }))),
                          ]}
                          onChange={(v) => setMetaValues((prev) => ({ ...prev, [field.id]: v }))}
                        />
                      ) : field.kind === 'boolean' ? (
                        <div className="flex items-center gap-2">
                          <ToggleSwitch
                            checked={metaValues[field.id] === 'true'}
                            onChange={(v) =>
                              setMetaValues((prev) => ({
                                ...prev,
                                [field.id]: v ? 'true' : 'false',
                              }))
                            }
                            label={field.label}
                          />
                          <span className="text-sm text-neutral-700">{field.label}</span>
                        </div>
                      ) : (
                        <StandardInput
                          type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'}
                          value={metaValues[field.id] ?? ''}
                          onChange={(e) => setMetaValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={field.label}
                        />
                      )}
                    </div>
                  </div>
                ))

                if (group.label) {
                  return (
                    <CollapsibleSection key={`section-${gi}`} label={group.label}>
                      {content}
                    </CollapsibleSection>
                  )
                }
                return <div key={`group-${gi}`}>{content}</div>
              })}
            </>
          )
        })()}

        {error && (
          <div className="px-4 py-3 md:px-5">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

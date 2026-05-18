// Plan-items section rendered inside the paragraph inspector slide-over.
//
// Lists existing plan items for the paragraph and exposes an inline
// "+ Legg til tiltak" form. Status flips fire updates immediately;
// when status moves to 'in_progress' the parent hook also creates a
// bridging task_items row (handled in useCompliancePlanItems, not here).
//
// The section is intentionally compact — full plan-management lives on
// the Phase 3+ /internkontroll/plan timeline page (deferred).

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'

export type CompliancePlanItem = {
  id: string
  organization_id: string
  law_ref: string
  framework_id: string
  title: string
  description: string | null
  owner_user_id: string | null
  status: 'planned' | 'in_progress' | 'blocked' | 'done'
  due_at: string | null
  task_id: string | null
  created_at: string
  updated_at: string
}

const STATUS_LABEL: Record<CompliancePlanItem['status'], string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  blocked: 'Blokkert',
  done: 'Fullført',
}

const STATUS_CLS: Record<CompliancePlanItem['status'], string> = {
  planned: 'bg-neutral-100 text-neutral-800 ring-neutral-200',
  in_progress: 'bg-blue-50 text-blue-900 ring-blue-200',
  blocked: 'bg-amber-50 text-amber-900 ring-amber-200',
  done: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

const STATUSES: CompliancePlanItem['status'][] = ['planned', 'in_progress', 'blocked', 'done']

export function PlanItemsSection({
  items,
  onCreate,
  onUpdate,
  onDelete,
}: {
  items: CompliancePlanItem[]
  onCreate: (input: {
    title: string
    description: string
    status: CompliancePlanItem['status']
    dueAt: string | null
  }) => Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<Pick<CompliancePlanItem, 'title' | 'description' | 'status' | 'due_at'>>,
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftDue, setDraftDue] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setDraftTitle('')
    setDraftDescription('')
    setDraftDue('')
    setAddOpen(false)
  }

  const submit = async () => {
    if (!draftTitle.trim() || submitting) return
    setSubmitting(true)
    await onCreate({
      title: draftTitle.trim(),
      description: draftDescription.trim(),
      status: 'planned',
      dueAt: draftDue || null,
    })
    setSubmitting(false)
    reset()
  }

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
          Planlagte tiltak ({items.length})
        </p>
        {!addOpen ? (
          <Button
            variant="ghost"
            onClick={() => setAddOpen(true)}
            className="-mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#7F1D1D] hover:bg-[#7F1D1D]/5"
          >
            <Plus className="size-3.5" aria-hidden />
            Legg til tiltak
          </Button>
        ) : null}
      </div>

      {addOpen ? (
        <div className="mt-3 rounded-md border border-neutral-200 bg-white p-4">
          <label className="block text-[11px] font-semibold text-neutral-700">
            Tittel
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Eks. Oppdater rutine for risikovurdering"
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-[#7F1D1D] focus:outline-none focus:ring-1 focus:ring-[#7F1D1D]"
              autoFocus
            />
          </label>
          <label className="mt-3 block text-[11px] font-semibold text-neutral-700">
            Beskrivelse (valgfri)
            <textarea
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
              rows={2}
              placeholder="Konkret hva må gjøres for å lukke gapet."
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-[#7F1D1D] focus:outline-none focus:ring-1 focus:ring-[#7F1D1D]"
            />
          </label>
          <label className="mt-3 block text-[11px] font-semibold text-neutral-700">
            Frist (valgfri)
            <input
              type="date"
              value={draftDue}
              onChange={(e) => setDraftDue(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900 focus:border-[#7F1D1D] focus:outline-none focus:ring-1 focus:ring-[#7F1D1D]"
            />
          </label>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={reset}
              disabled={submitting}
              className="rounded-md px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-100"
            >
              Avbryt
            </Button>
            <Button
              variant="ghost"
              onClick={submit}
              disabled={submitting || !draftTitle.trim()}
              className="rounded-md bg-[#7F1D1D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5b1414] disabled:opacity-60"
            >
              {submitting ? 'Lagrer…' : 'Lagre tiltak'}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !addOpen ? (
        <p className="mt-3 rounded-md border border-dashed border-neutral-200 bg-white/50 px-4 py-3 text-xs text-neutral-500">
          Ingen tiltak planlagt for denne paragrafen ennå.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="overflow-hidden rounded-md border border-neutral-200 bg-white"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {it.title}
                  </p>
                  {it.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">
                      {it.description}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                    {it.due_at ? (
                      <span className="text-neutral-500">
                        Frist: {it.due_at}
                      </span>
                    ) : null}
                    {it.task_id ? (
                      <a
                        href={`/tasks/management/alle?task=${it.task_id}`}
                        className="text-[#7F1D1D] underline-offset-2 hover:underline"
                      >
                        Åpen oppgave →
                      </a>
                    ) : null}
                  </div>
                </div>
                <select
                  value={it.status}
                  onChange={(e) =>
                    void onUpdate(it.id, {
                      status: e.target.value as CompliancePlanItem['status'],
                    })
                  }
                  className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${STATUS_CLS[it.status]}`}
                  aria-label="Status"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm(`Fjerne tiltaket «${it.title}»?`)) {
                      void onDelete(it.id)
                    }
                  }}
                  aria-label={`Fjern tiltak ${it.title}`}
                  className="h-auto w-auto shrink-0 rounded-md p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

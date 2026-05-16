// CreateTaskFromItemPanel — inline form for spawning a task_items row from
// a single checklist item in the AML walkthrough. The task is bridged back
// to the checklist via source_category='compliance_checklist_item' +
// source_id=<execution_id> + source_item_key=<item.key>.

import { useState } from 'react'
import { ListPlus, X } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { ChecklistItem, ComplianceAssignableUser } from '../types'

type Priority = 'low' | 'medium' | 'high' | 'critical'

const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

function parseLawRefs(lawRef: string | undefined): string[] {
  if (!lawRef) return []
  return lawRef
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function defaultDueDate(daysAhead = 30): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  return d.toISOString().slice(0, 10)
}

export function CreateTaskFromItemPanel({
  item,
  executionId,
  pack,
  assignableUsers,
  suggestedAssigneeId,
  onClose,
  onCreated,
}: {
  item: ChecklistItem
  executionId: string
  pack: 'aml-amu' | 'iso-45001'
  assignableUsers: ComplianceAssignableUser[]
  suggestedAssigneeId?: string
  onClose: () => void
  onCreated?: (taskId: string) => void
}) {
  const { supabase, organization } = useOrgSetupContext()

  const tpl = item.task_template
  const initialTitle =
    tpl?.title ?? `${item.law_ref ? item.law_ref + ' — ' : ''}${item.prompt}`.slice(0, 200)

  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(
    tpl?.description ??
      `Følges opp etter AML-fullgjennomgang. Kildekrav: ${item.law_ref ?? '(uten paragraf)'}.\n\n${item.help ?? ''}`.trim(),
  )
  const initialPriority: Priority =
    tpl?.priority ?? (item.severity_default === 'critical' ? 'critical' : 'medium')
  const [priority, setPriority] = useState<Priority>(initialPriority)
  const [dueDate, setDueDate] = useState(defaultDueDate(30))
  const [assigneeId, setAssigneeId] = useState(suggestedAssigneeId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!supabase || !organization?.id) {
      setError('Mangler organisasjon — last siden på nytt.')
      return
    }
    setSaving(true)
    setError(null)

    const assignee = assignableUsers.find((u) => u.id === assigneeId)
    const lawRefs = parseLawRefs(item.law_ref)

    const { data, error: insErr } = await supabase
      .from('task_items')
      .insert({
        organization_id: organization.id,
        pack,
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'todo',
        law_refs: lawRefs,
        due_date: dueDate || null,
        assignee_user_id: assignee?.id ?? null,
        assignee_name: assignee?.displayName ?? null,
        // Bridge to compliance checklist:
        source_category: 'compliance_checklist_item',
        source_type: 'compliance_checklist_item',
        source_id: executionId,
        source_item_key: item.key,
      })
      .select('id')
      .single()

    setSaving(false)
    if (insErr || !data) {
      setError(insErr?.message ?? 'Kunne ikke opprette oppgave.')
      return
    }
    onCreated?.(String(data.id))
    onClose()
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <ListPlus className="h-4 w-4" />
          Opprett oppgave for {item.law_ref ?? 'denne posten'}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-amber-700 hover:bg-amber-100"
          aria-label="Lukk"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-amber-900">
          Tittel
          <StandardInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Kort, handlingsorientert tittel"
            className="mt-1"
          />
        </label>

        <label className="block text-xs font-medium text-amber-900">
          Beskrivelse
          <StandardTextarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block text-xs font-medium text-amber-900">
            Prioritet
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="mt-1 w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-sm"
            >
              {(['low', 'medium', 'high', 'critical'] as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-amber-900">
            Frist
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-amber-900">
            Ansvarlig
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="mt-1 w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— Ingen valgt —</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={saving || !title.trim()}
          >
            {saving ? 'Lagrer…' : 'Opprett oppgave'}
          </Button>
        </div>
      </div>
    </div>
  )
}

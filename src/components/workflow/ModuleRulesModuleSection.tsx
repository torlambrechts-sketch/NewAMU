import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ListTodo, Loader2, Mail, Plus, Save, Zap } from 'lucide-react'
import { useModuleTemplate } from '../../hooks/useModuleTemplate'
import type { WorkflowRule } from '../../types/moduleTemplate'
import { ModuleTemplateWorkflowRulesEditor } from './ModuleTemplateWorkflowRulesEditor'
import { createNewWorkflowRule } from './workflowRuleFactory'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'

function triggerLabel(rule: WorkflowRule): string {
  const t = rule.trigger
  switch (t.type) {
    case 'on_create':
      return 'Ved opprettelse'
    case 'on_status_change':
      return `Statusendring → ${t.toStatus}`
    case 'on_finding_added':
      return t.severity ? `Avvik registrert (${t.severity})` : 'Avvik registrert'
    case 'on_overdue':
      return `Forfalt med ${t.daysOverdue} dag${t.daysOverdue === 1 ? '' : 'er'}`
    case 'on_field_value':
      return `Felt ${t.field} ${t.operator} ${t.value}`
    default:
      return (t as { type: string }).type
  }
}

function ActionChip({ action }: { action: WorkflowRule['actions'][number] }) {
  const type = (action as { type: string }).type
  const Icon = type === 'create_task' ? ListTodo : type === 'send_email' ? Mail : Zap
  let label: string = type
  if (type === 'create_task') {
    const a = action as Extract<typeof action, { type: 'create_task' }>
    label = `Opprett oppgave → ${a.assigneeRole} (${a.dueDays}d)`
  } else if (type === 'send_email') {
    const a = action as Extract<typeof action, { type: 'send_email' }>
    label = `Send e-post → ${a.toRole}`
  } else if (type === 'notify_role') {
    const a = action as Extract<typeof action, { type: 'notify_role' }>
    label = `Varsle ${a.role}`
  } else if (type === 'set_status') {
    const a = action as Extract<typeof action, { type: 'set_status' }>
    label = `Sett status: ${a.status}`
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700">
      <Icon className="size-3.5 shrink-0 text-[#1a3d32]" />
      {label}
    </span>
  )
}

export type ModuleRulesModuleSectionProps = {
  moduleKey: string
  label: string
  icon: LucideIcon
  path: string
  canManage: boolean
  activityFilter?: 'all' | 'active' | 'inactive'
}

export function ModuleRulesModuleSection({
  moduleKey,
  label,
  icon: Icon,
  path,
  canManage,
  activityFilter = 'all',
}: ModuleRulesModuleSectionProps) {
  const { template, loading, error, save, publish, unpublish, refresh } = useModuleTemplate(moduleKey)
  const [editing, setEditing] = useState(false)
  const [draftRules, setDraftRules] = useState<WorkflowRule[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const rules = template.workflowRules ?? []

  const filteredForCards =
    activityFilter === 'active'
      ? rules.filter((r) => r.active)
      : activityFilter === 'inactive'
        ? rules.filter((r) => !r.active)
        : rules

  const startEdit = useCallback(() => {
    setDraftRules(rules)
    setEditing(true)
    setLocalErr(null)
  }, [rules])

  const cancelEdit = useCallback(() => {
    setDraftRules(null)
    setEditing(false)
    setLocalErr(null)
  }, [])

  /** Opens editor and appends a blank rule (works from list view or inside editor). */
  const addNewRule = useCallback(() => {
    setLocalErr(null)
    setEditing(true)
    setDraftRules((prev) => {
      const current = prev ?? rules
      return [...current, createNewWorkflowRule(current.length)]
    })
  }, [rules])

  async function handleSave() {
    if (!draftRules) return
    setSaving(true)
    setLocalErr(null)
    try {
      await save({ workflowRules: draftRules })
      await refresh()
      setEditing(false)
      setDraftRules(null)
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Lagring feilet')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setSaving(true)
    setLocalErr(null)
    try {
      await publish()
      await refresh()
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Publisering feilet')
    } finally {
      setSaving(false)
    }
  }

  async function handleUnpublish() {
    setSaving(true)
    setLocalErr(null)
    try {
      await unpublish()
      await refresh()
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Avpublisering feilet')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ModuleSectionCard className="flex items-center gap-2 p-5 text-sm text-neutral-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Laster {label}…
      </ModuleSectionCard>
    )
  }

  const errMsg = localErr || error

  return (
    <ModuleSectionCard clip="visible" className="space-y-4 p-5 md:p-6">
      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32]/10">
            <Icon className="size-4 text-[#1a3d32]" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{label}</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {rules.length} regel{rules.length === 1 ? '' : 'er'}
            </p>
          </div>
          <Badge variant={template.published ? 'success' : 'draft'} className="mt-0.5">
            {template.published ? 'Publisert' : 'Utkast'}
          </Badge>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" variant="primary" onClick={addNewRule} disabled={saving}>
              <Plus className="size-3.5" strokeWidth={2.5} />
              Ny regel
            </Button>
            {!editing ? (
              <Button size="sm" variant="secondary" onClick={startEdit}>
                Rediger alle
              </Button>
            ) : (
              <>
                <Button size="sm" variant="primary" disabled={saving} onClick={() => void handleSave()}>
                  <Save className="size-3.5" />
                  {saving ? 'Lagrer…' : 'Lagre'}
                </Button>
                {template.published ? (
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => void handleUnpublish()}>
                    Avpubliser
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={saving} onClick={() => void handlePublish()}>
                    Publiser
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={saving} onClick={cancelEdit}>
                  Avbryt
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Editor panel */}
      {editing && canManage && draftRules && (
        <div className="border-t border-neutral-200 pt-4">
          {errMsg && (
            <div className="mb-3">
              <WarningBox>{errMsg}</WarningBox>
            </div>
          )}
          <p className="mb-3 text-xs text-neutral-600">
            Lagre endringene, deretter <strong>publiser</strong> slik at alle i organisasjonen får oppdatert modulmal.
          </p>
          <ModuleTemplateWorkflowRulesEditor rules={draftRules} onChange={setDraftRules} disabled={saving} />
        </div>
      )}

      {/* Rule cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredForCards.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-lg border p-4 shadow-sm transition ${
              rule.active
                ? 'border-neutral-200 bg-white hover:border-neutral-300'
                : 'border-neutral-100 bg-white/90 opacity-80'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{rule.name}</p>
                <p className="text-[11px] text-neutral-400">{label}</p>
              </div>
              <Badge variant={rule.active ? 'success' : 'neutral'}>
                {rule.active ? 'Aktiv' : 'Inaktiv'}
              </Badge>
            </div>
            <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50/90 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Utløser</p>
              <p className="mt-0.5 text-xs font-medium text-neutral-700">{triggerLabel(rule)}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {rule.actions.map((a, i) => (
                <ActionChip key={i} action={a} />
              ))}
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-2">
              <Link to={path} className="text-[11px] text-[#1a3d32] hover:underline">
                Åpne {label} i appen →
              </Link>
            </div>
          </div>
        ))}
        {filteredForCards.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-200 bg-neutral-50/90 p-8 text-center text-sm text-neutral-500 sm:col-span-2 lg:col-span-3">
            <p>Ingen regler i dette filteret for {label}.</p>
            {canManage && (
              <Button size="sm" variant="primary" onClick={addNewRule} disabled={saving}>
                <Plus className="size-3.5" strokeWidth={2.5} />
                Opprett første regel
              </Button>
            )}
          </div>
        )}
      </div>
    </ModuleSectionCard>
  )
}

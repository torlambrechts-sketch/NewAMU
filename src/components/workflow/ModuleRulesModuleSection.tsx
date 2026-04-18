import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListTodo, Loader2, Mail, Save, Zap } from 'lucide-react'
import { useModuleTemplate } from '../../hooks/useModuleTemplate'
import type { WorkflowRule } from '../../types/moduleTemplate'
import { ModuleTemplateWorkflowRulesEditor } from './ModuleTemplateWorkflowRulesEditor'

const BTN_PRI =
  'inline-flex items-center gap-1.5 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-3 py-2 text-xs font-semibold text-white hover:bg-[#142e26] disabled:opacity-50'
const BTN_SEC =
  'inline-flex items-center gap-1.5 rounded-none border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50'

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
  color: string
  path: string
  canManage: boolean
  activityFilter: 'all' | 'active' | 'inactive'
}

export function ModuleRulesModuleSection({
  moduleKey,
  label,
  color,
  path,
  canManage,
  activityFilter,
}: ModuleRulesModuleSectionProps) {
  const { template, loading, error, save, publish, unpublish, refresh } = useModuleTemplate(moduleKey)
  const [editing, setEditing] = useState(false)
  const [draftRules, setDraftRules] = useState<WorkflowRule[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  const rules = template.workflowRules ?? []

  const filteredForCards =
    activityFilter === 'active' ? rules.filter((r) => r.active) : activityFilter === 'inactive' ? rules.filter((r) => !r.active) : rules

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
      <div className="col-span-full flex items-center gap-2 text-sm text-neutral-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Laster {label}…
      </div>
    )
  }

  const errMsg = localErr || error

  return (
    <div className="col-span-full space-y-4">
      <div className="rounded-none border border-neutral-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}18` }}
            >
              <Zap className="size-4" style={{ color }} aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold text-neutral-900">{label}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {rules.length} regel{rules.length === 1 ? '' : 'er'}
                {template.published ? ' · Publisert' : ' · Utkast'}
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <button type="button" onClick={startEdit} className={BTN_PRI}>
                  Rediger regler
                </button>
              ) : (
                <>
                  <button type="button" className={BTN_PRI} disabled={saving} onClick={() => void handleSave()}>
                    <Save className="size-3.5" />
                    {saving ? 'Lagrer…' : 'Lagre'}
                  </button>
                  {template.published ? (
                    <button type="button" className={BTN_SEC} disabled={saving} onClick={() => void handleUnpublish()}>
                      Avpubliser
                    </button>
                  ) : (
                    <button type="button" className={BTN_SEC} disabled={saving} onClick={() => void handlePublish()}>
                      Publiser
                    </button>
                  )}
                  <button type="button" className={BTN_SEC} disabled={saving} onClick={cancelEdit}>
                    Avbryt
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {editing && canManage && draftRules && (
          <div className="mt-4 border-t border-neutral-200/80 pt-4">
            {errMsg && (
              <p className="mb-3 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errMsg}</p>
            )}
            <p className="mb-3 text-xs text-neutral-600">
              Lagre endringene, deretter <strong>publiser</strong> slik at alle i organisasjonen får oppdatert modulmal.
            </p>
            <ModuleTemplateWorkflowRulesEditor rules={draftRules} onChange={setDraftRules} disabled={saving} />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredForCards.map((rule) => (
          <div
            key={rule.id}
            className={`rounded-none border bg-white p-4 shadow-sm ${
              rule.active ? 'border-neutral-200/80' : 'border-neutral-100 opacity-70'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{rule.name}</p>
                <p className="text-[11px] text-neutral-400">{label}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  rule.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {rule.active ? 'Aktiv' : 'Inaktiv'}
              </span>
            </div>
            <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2">
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
          <div className="rounded-none border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-400 sm:col-span-2 lg:col-span-3">
            Ingen regler i dette filteret for {label}.
            {canManage && !editing && (
              <>
                {' '}
                <button type="button" className="font-medium text-[#1a3d32] underline" onClick={startEdit}>
                  Opprett regler
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

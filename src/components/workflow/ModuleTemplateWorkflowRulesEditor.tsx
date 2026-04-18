/**
 * Edits `workflowRules` on org module templates (same shape as platform-admin).
 * Used from Arbeidsflyt → Modul-regler so org users need not use platform-admin.
 */

import { Plus, Trash2 } from 'lucide-react'
import type { WorkflowAction, WorkflowRule, WorkflowTrigger } from '../../types/moduleTemplate'
import { createNewWorkflowRule } from './workflowRuleFactory'
import { WMR_BTN_CTA_FOREST, wmrCtaForestStyle } from './workflowModuleRulesLayoutKit'

export type ModuleTemplateWorkflowRulesEditorVariant = 'workplace' | 'platformAdmin'

const THEME: Record<
  ModuleTemplateWorkflowRulesEditorVariant,
  {
    input: string
    btnGhost: string
    btnDanger: string
    actionCard: string
    ruleCard: string
    labelUpper: string
    labelUpperSm: string
    checkboxLabel: string
    emptyState: string
  }
> = {
  workplace: {
    input:
      'w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:ring-2 focus:ring-[#1a3d32]/25',
    btnGhost:
      'inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50',
    btnDanger:
      'inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-red-600 hover:bg-red-50',
    actionCard: 'rounded-lg border border-neutral-200/90 bg-neutral-50/80 p-3',
    ruleCard: 'rounded-lg border border-neutral-200/90 bg-white p-4 shadow-sm',
    labelUpper: 'mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500',
    labelUpperSm: 'text-[10px] font-semibold uppercase tracking-wide text-neutral-500',
    checkboxLabel: 'flex shrink-0 items-center gap-1.5 text-xs text-neutral-600',
    emptyState:
      'rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500',
  },
  platformAdmin: {
    input:
      'w-full rounded-lg border border-white/10 bg-slate-700 px-2 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-amber-500/30',
    btnGhost:
      'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/10',
    btnDanger:
      'inline-flex items-center justify-center rounded-lg border border-transparent p-1.5 text-red-400 hover:bg-red-500/10',
    actionCard: 'rounded-lg border border-white/10 bg-slate-700/50 p-3',
    ruleCard: 'rounded-xl border border-white/10 bg-slate-800/60 p-4',
    labelUpper: 'mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500',
    labelUpperSm: 'text-[11px] font-semibold uppercase tracking-wider text-neutral-500',
    checkboxLabel: 'flex shrink-0 items-center gap-1 text-xs text-neutral-400',
    emptyState:
      'rounded-xl border border-dashed border-white/10 bg-slate-800/40 px-4 py-6 text-center text-sm text-neutral-400',
  },
}

function defaultActionForType(t: WorkflowAction['type']): WorkflowAction {
  switch (t) {
    case 'create_task':
      return {
        type: 'create_task',
        titleTemplate: 'Oppfølging',
        assigneeRole: 'admin',
        dueDays: 7,
        priority: 'medium',
      }
    case 'send_email':
      return {
        type: 'send_email',
        toRole: 'admin',
        subjectTemplate: 'Varsel',
        bodyTemplate: '',
      }
    case 'notify_role':
      return {
        type: 'notify_role',
        role: 'admin',
        messageTemplate: '{{module.title}} — hendelse',
      }
    case 'set_status':
      return { type: 'set_status', status: '' }
    case 'set_field':
      return { type: 'set_field', field: '', value: '' }
    default:
      return { type: 'notify_role', role: 'admin', messageTemplate: '' }
  }
}

function ActionEditor({
  action,
  onChange,
  onRemove,
  disabled,
  theme,
}: {
  action: WorkflowAction
  onChange: (a: WorkflowAction) => void
  onRemove: () => void
  disabled?: boolean
  theme: (typeof THEME)[ModuleTemplateWorkflowRulesEditorVariant]
}) {
  const type = action.type
  const { input: INPUT, btnDanger: BTN_DANGER, actionCard, labelUpper } = theme
  return (
    <div className={actionCard}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <p className={labelUpper}>Type</p>
          <select
            value={type}
            disabled={disabled}
            onChange={(e) => onChange(defaultActionForType(e.target.value as WorkflowAction['type']))}
            className={INPUT}
          >
            <option value="notify_role">Varsle rolle</option>
            <option value="create_task">Opprett oppgave</option>
            <option value="send_email">Send e-post</option>
            <option value="set_status">Sett status</option>
            <option value="set_field">Sett felt</option>
          </select>
        </div>
        <button type="button" disabled={disabled} className={BTN_DANGER} onClick={onRemove} aria-label="Fjern handling">
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {action.type === 'notify_role' && (
          <>
            <div>
              <p className={labelUpper}>Rolle</p>
              <input
                type="text"
                disabled={disabled}
                value={action.role}
                onChange={(e) => onChange({ ...action, role: e.target.value })}
                className={INPUT}
                placeholder="admin"
              />
            </div>
            <div className="sm:col-span-2">
              <p className={labelUpper}>Melding</p>
              <textarea
                rows={2}
                disabled={disabled}
                value={action.messageTemplate}
                onChange={(e) => onChange({ ...action, messageTemplate: e.target.value })}
                className={`${INPUT} resize-y`}
              />
            </div>
          </>
        )}
        {action.type === 'create_task' && (
          <>
            <div className="sm:col-span-2">
              <p className={labelUpper}>Tittel (mal)</p>
              <input
                type="text"
                disabled={disabled}
                value={action.titleTemplate}
                onChange={(e) => onChange({ ...action, titleTemplate: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <p className={labelUpper}>Ansvarlig rolle</p>
              <input
                type="text"
                disabled={disabled}
                value={action.assigneeRole}
                onChange={(e) => onChange({ ...action, assigneeRole: e.target.value })}
                className={INPUT}
              />
            </div>
            <div>
              <p className={labelUpper}>Frist (dager)</p>
              <input
                type="number"
                min={1}
                disabled={disabled}
                value={action.dueDays}
                onChange={(e) => onChange({ ...action, dueDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className={INPUT}
              />
            </div>
            <div>
              <p className={labelUpper}>Prioritet</p>
              <select
                disabled={disabled}
                value={action.priority}
                onChange={(e) =>
                  onChange({ ...action, priority: e.target.value as 'low' | 'medium' | 'high' })
                }
                className={INPUT}
              >
                <option value="low">Lav</option>
                <option value="medium">Middels</option>
                <option value="high">Høy</option>
              </select>
            </div>
          </>
        )}
        {action.type === 'send_email' && (
          <>
            <div>
              <p className={labelUpper}>Til rolle</p>
              <input
                type="text"
                disabled={disabled}
                value={action.toRole}
                onChange={(e) => onChange({ ...action, toRole: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <p className={labelUpper}>Emne</p>
              <input
                type="text"
                disabled={disabled}
                value={action.subjectTemplate}
                onChange={(e) => onChange({ ...action, subjectTemplate: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="sm:col-span-2">
              <p className={labelUpper}>Brødtekst</p>
              <textarea
                rows={3}
                disabled={disabled}
                value={action.bodyTemplate}
                onChange={(e) => onChange({ ...action, bodyTemplate: e.target.value })}
                className={`${INPUT} resize-y`}
              />
            </div>
          </>
        )}
        {action.type === 'set_status' && (
          <div className="sm:col-span-2">
            <p className={labelUpper}>Status (nøkkel)</p>
            <input
              type="text"
              disabled={disabled}
              value={action.status}
              onChange={(e) => onChange({ ...action, status: e.target.value })}
              className={`${INPUT} font-mono text-xs`}
            />
          </div>
        )}
        {action.type === 'set_field' && (
          <>
            <div>
              <p className={labelUpper}>Felt</p>
              <input
                type="text"
                disabled={disabled}
                value={action.field}
                onChange={(e) => onChange({ ...action, field: e.target.value })}
                className={`${INPUT} font-mono text-xs`}
              />
            </div>
            <div>
              <p className={labelUpper}>Verdi</p>
              <input
                type="text"
                disabled={disabled}
                value={action.value}
                onChange={(e) => onChange({ ...action, value: e.target.value })}
                className={INPUT}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export type ModuleTemplateWorkflowRulesEditorProps = {
  rules: WorkflowRule[]
  onChange: (next: WorkflowRule[]) => void
  disabled?: boolean
  /** Default matches workplace (/workflow Modul-regler). */
  variant?: ModuleTemplateWorkflowRulesEditorVariant
  /** Hide top row (e.g. when platform-admin SectionH has its own «Legg til»). */
  hideToolbar?: boolean
}

export function ModuleTemplateWorkflowRulesEditor({
  rules,
  onChange,
  disabled,
  variant = 'workplace',
  hideToolbar = false,
}: ModuleTemplateWorkflowRulesEditorProps) {
  const theme = THEME[variant]
  const { input: INPUT, btnGhost: BTN_GHOST, btnDanger: BTN_DANGER, ruleCard, labelUpper, labelUpperSm, checkboxLabel, emptyState } =
    theme
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)

  function patchRule(indexInSorted: number, patch: Partial<WorkflowRule>) {
    const id = sorted[indexInSorted].id
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function patchTrigger(indexInSorted: number, trigger: WorkflowTrigger) {
    const id = sorted[indexInSorted].id
    onChange(rules.map((r) => (r.id === id ? { ...r, trigger } : r)))
  }

  function patchActions(indexInSorted: number, actions: WorkflowAction[]) {
    const id = sorted[indexInSorted].id
    onChange(rules.map((r) => (r.id === id ? { ...r, actions } : r)))
  }

  return (
    <div className="space-y-3">
      {!hideToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Regler for denne modulen</p>
          <button
            type="button"
            disabled={disabled}
            className={
              variant === 'workplace'
                ? `${WMR_BTN_CTA_FOREST} disabled:opacity-50`
                : `${BTN_GHOST} disabled:opacity-50`
            }
            style={variant === 'workplace' ? wmrCtaForestStyle() : undefined}
            onClick={() => onChange([...rules, createNewWorkflowRule(rules.length)])}
          >
            <Plus className="size-3.5" strokeWidth={variant === 'workplace' ? 2.5 : 2} />
            Legg til regel
          </button>
        </div>
      )}

      {sorted.map((rule, i) => (
        <div key={rule.id} className={ruleCard}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  disabled={disabled}
                  value={rule.name}
                  onChange={(e) => patchRule(i, { name: e.target.value })}
                  className={`${INPUT} min-w-[12rem] flex-1 font-semibold`}
                />
                <label className={checkboxLabel}>
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={rule.active}
                    onChange={(e) => patchRule(i, { active: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  Aktiv
                </label>
              </div>

              <div>
                <p className={labelUpper}>Utløser</p>
                <select
                  disabled={disabled}
                  value={rule.trigger.type}
                  onChange={(e) => {
                    const t = e.target.value as WorkflowTrigger['type']
                    const base: WorkflowTrigger =
                      t === 'on_create'
                        ? { type: 'on_create' }
                        : t === 'on_status_change'
                          ? { type: 'on_status_change', toStatus: '' }
                          : t === 'on_overdue'
                            ? { type: 'on_overdue', daysOverdue: 3 }
                            : t === 'on_finding_added'
                              ? { type: 'on_finding_added' }
                              : { type: 'on_field_value', field: '', operator: 'eq', value: '' }
                    patchTrigger(i, base)
                  }}
                  className={INPUT}
                >
                  <option value="on_create">Ved opprettelse</option>
                  <option value="on_status_change">Ved statusendring</option>
                  <option value="on_finding_added">Ved avvik registrert</option>
                  <option value="on_overdue">Ved forfall</option>
                  <option value="on_field_value">Feltverdi-sjekk</option>
                </select>
                {'toStatus' in rule.trigger && (
                  <input
                    type="text"
                    disabled={disabled}
                    value={rule.trigger.toStatus}
                    placeholder="status-nøkkel"
                    onChange={(e) =>
                      patchTrigger(i, { ...rule.trigger, toStatus: e.target.value } as WorkflowTrigger)
                    }
                    className={`${INPUT} mt-1 font-mono text-xs`}
                  />
                )}
                {'daysOverdue' in rule.trigger && (
                  <div className="mt-1">
                    <p className={labelUpperSm}>Dager over frist</p>
                    <input
                      type="number"
                      min={1}
                      disabled={disabled}
                      value={rule.trigger.daysOverdue}
                      onChange={(e) =>
                        patchTrigger(i, {
                          ...rule.trigger,
                          daysOverdue: Math.max(1, parseInt(e.target.value, 10) || 1),
                        } as WorkflowTrigger)
                      }
                      className={INPUT}
                    />
                  </div>
                )}
                {'severity' in rule.trigger && (
                  <input
                    type="text"
                    disabled={disabled}
                    value={rule.trigger.severity ?? ''}
                    placeholder="Valgfri alvorlighetsfilter (tom = alle)"
                    onChange={(e) =>
                      patchTrigger(i, {
                        ...rule.trigger,
                        severity: e.target.value || undefined,
                      } as WorkflowTrigger)
                    }
                    className={`${INPUT} mt-1 text-xs`}
                  />
                )}
                {rule.trigger.type === 'on_field_value' && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      disabled={disabled}
                      value={rule.trigger.field}
                      placeholder="felt"
                      onChange={(e) =>
                        patchTrigger(i, {
                          ...rule.trigger,
                          field: e.target.value,
                        } as WorkflowTrigger)
                      }
                      className={`${INPUT} font-mono text-xs`}
                    />
                    <select
                      disabled={disabled}
                      value={rule.trigger.operator}
                      onChange={(e) =>
                        patchTrigger(i, {
                          ...rule.trigger,
                          operator: e.target.value as 'eq' | 'gte' | 'lte' | 'contains',
                        } as WorkflowTrigger)
                      }
                      className={INPUT}
                    >
                      <option value="eq">=</option>
                      <option value="gte">≥</option>
                      <option value="lte">≤</option>
                      <option value="contains">inneholder</option>
                    </select>
                    <input
                      type="text"
                      disabled={disabled}
                      value={String(rule.trigger.value)}
                      onChange={(e) =>
                        patchTrigger(i, {
                          ...rule.trigger,
                          value: e.target.value,
                        } as WorkflowTrigger)
                      }
                      className={INPUT}
                    />
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className={labelUpperSm}>Handlinger</p>
                  <button
                    type="button"
                    disabled={disabled}
                    className={`${BTN_GHOST} py-1 text-[11px]`}
                    onClick={() => patchActions(i, [...rule.actions, defaultActionForType('notify_role')])}
                  >
                    <Plus className="size-3" />
                    Legg til handling
                  </button>
                </div>
                <div className="space-y-2">
                  {rule.actions.map((a, ai) => (
                    <ActionEditor
                      key={ai}
                      action={a}
                      disabled={disabled}
                      theme={theme}
                      onChange={(next) => {
                        const nextActs = rule.actions.map((x, j) => (j === ai ? next : x))
                        patchActions(i, nextActs)
                      }}
                      onRemove={() => {
                        const nextActs = rule.actions.filter((_, j) => j !== ai)
                        patchActions(i, nextActs.length ? nextActs : [defaultActionForType('notify_role')])
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={disabled}
              className={`${BTN_DANGER} shrink-0 disabled:opacity-50`}
              onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
              aria-label="Slett regel"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <p className={emptyState}>
          Ingen regler ennå. Legg til en regel, lagre og publiser slik at modulen bruker den.
        </p>
      )}
    </div>
  )
}

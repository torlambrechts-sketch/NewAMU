// LibraryPreviewPanel — read-only slide-over preview of a catalog row's
// compiled actions_json. Lets the user inspect "dette skjer når regelen
// utløses" before committing to install. Uses the same SlidePanel shell
// as the rest of the app so chrome (header + footer band) stays
// consistent with the Tasks / Registers editors.
//
// We render the flattened action list (XOR branches are merged) as a
// vertical numbered timeline with Norwegian action labels. This is
// intentionally lighter than the full WorkflowFlowBuilder canvas — the
// canvas is for authoring, the preview is for understanding intent.

import { useMemo } from 'react'
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Loader2,
  Mail,
  Package,
  Plus,
  Scale,
  Send,
  Shield,
  ShieldAlert,
  Webhook,
  Workflow,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { SlidePanel } from '../../layout/SlidePanel'
import { Button } from '../../ui/Button'
import { getWorkflowScope } from '../../../lib/workflows/workflowRegistry'
import {
  isGovernmentActionType,
  type WorkflowAction,
  type WorkflowRuleCatalogRow,
  type WorkflowXorActionsEnvelope,
} from '../../../types/workflow'
import { ACTION_TYPE_LABELS, detectRegulators } from './LibraryPanel'
import type { RowInstallState } from './LibraryPanel'

const REGULATOR_LABEL: Record<string, string> = {
  arbeidstilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  nav: 'NAV',
  ldo: 'LDO',
  none: 'Intern',
}

function flattenForPreview(
  actions: WorkflowAction[] | WorkflowXorActionsEnvelope | unknown,
): WorkflowAction[] {
  if (Array.isArray(actions)) return actions as WorkflowAction[]
  if (actions && typeof actions === 'object' && 'mode' in (actions as Record<string, unknown>)) {
    const env = actions as WorkflowXorActionsEnvelope
    if (env.mode === 'xor_branches') return env.branches.flatMap((b) => b.actions)
  }
  return []
}

function actionIcon(type: string): ReactNode {
  if (isGovernmentActionType(type)) return <ShieldAlert className="h-3.5 w-3.5 text-red-700" />
  if (type === 'send_email') return <Mail className="h-3.5 w-3.5 text-neutral-600" />
  if (type === 'send_notification') return <Bell className="h-3.5 w-3.5 text-neutral-600" />
  if (type === 'call_webhook') return <Webhook className="h-3.5 w-3.5 text-neutral-600" />
  if (type === 'request_approval' || type === 'request_signature')
    return <Check className="h-3.5 w-3.5 text-emerald-700" />
  return <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
}

function actionSummary(action: WorkflowAction): string | null {
  const a = action as Record<string, unknown>
  if (a.type === 'create_task' || a.type === 'create_task_item') {
    return typeof a.title === 'string' ? a.title : null
  }
  if (a.type === 'send_email') {
    return typeof a.subject === 'string' ? `«${a.subject}»` : null
  }
  if (a.type === 'send_notification') {
    return typeof a.title === 'string' ? a.title : null
  }
  if (a.type === 'add_amu_agenda_item') {
    return typeof a.agendaItem === 'string' ? a.agendaItem : null
  }
  if (a.type === 'request_approval') {
    return typeof a.approverRole === 'string' ? `→ ${a.approverRole}` : null
  }
  if (a.type === 'escalate') {
    return typeof a.toRole === 'string' ? `→ ${a.toRole}` : null
  }
  if (a.type === 'wait_delay' || a.type === 'wait_until') {
    const delay = a.delay as { amount?: number; unit?: string } | undefined
    if (delay?.amount && delay.unit) return `${delay.amount} ${delay.unit}`
    if (typeof a.at === 'string') return a.at
    return null
  }
  if (a.type === 'create_ros_draft') {
    return typeof a.template === 'string' ? `mal: ${a.template}` : null
  }
  return null
}

type LibraryPreviewPanelProps = {
  row: WorkflowRuleCatalogRow | null
  onClose: () => void
  onInstall: () => void
  installState: RowInstallState
  installedRuleId: string | null
  canCompose: boolean
}

export function LibraryPreviewPanel({
  row,
  onClose,
  onInstall,
  installState,
  installedRuleId,
  canCompose,
}: LibraryPreviewPanelProps) {
  const open = row !== null

  const actions = useMemo(() => (row ? flattenForPreview(row.actions_json) : []), [row])

  const summary = useMemo(() => {
    if (!row) return { emails: 0, notifications: 0, govSubmissions: 0, channels: new Set<string>() }
    const channels = new Set<string>()
    let emails = 0
    let notifications = 0
    let govSubmissions = 0
    actions.forEach((a) => {
      const type = (a as { type: string }).type
      if (type === 'send_email') emails += 1
      if (type === 'send_notification') {
        notifications += 1
        const ch = (a as { channels?: string[] }).channels
        if (Array.isArray(ch)) ch.forEach((c) => channels.add(c))
      }
      if (isGovernmentActionType(type)) govSubmissions += 1
    })
    return { emails, notifications, govSubmissions, channels }
  }, [row, actions])

  if (!row) {
    return (
      <SlidePanel
        open={open}
        onClose={onClose}
        titleId="library-preview-empty"
        title=""
        footer={null}
      >
        <div />
      </SlidePanel>
    )
  }

  const scope = getWorkflowScope(row.scope_id)
  const regulators = detectRegulators(row).filter((r) => r !== 'none')
  const desc = (row.description_i18n as { nb?: string } | null)?.nb

  const installed = installState.kind === 'installed' || installState.kind === 'exists' || !!installedRuleId
  const installButtonLabel =
    installState.kind === 'installing'
      ? 'Installerer …'
      : installState.kind === 'error'
        ? 'Prøv igjen'
        : installed
          ? 'Installert ✓'
          : 'Installer'

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="library-preview-title"
      title={row.name_i18n?.nb ?? row.slug}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            Forhåndsvisningen kjører ingen handlinger — kun lesing av katalog-raden.
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Lukk
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={
                installState.kind === 'installing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : installed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )
              }
              disabled={!canCompose || installState.kind === 'installing' || installed}
              onClick={onInstall}
            >
              {installButtonLabel}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style={{ borderColor: scope?.accent ?? '#d4d4d4', color: scope?.accent ?? '#525252' }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: scope?.accent ?? '#a3a3a3' }}
            />
            {scope?.label ?? row.scope_id}
          </span>
          {row.pack && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
              {row.pack}
            </span>
          )}
          {row.contains_gov_action ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-900">
              <ShieldAlert className="h-3 w-3" /> Statlig melding
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
              <Shield className="h-3 w-3" /> Intern
            </span>
          )}
        </div>

        {desc && (
          <p className="text-sm leading-relaxed text-neutral-700">{desc}</p>
        )}

        {/* Trigger */}
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">Trigger</h3>
          <p className="mt-1.5 text-sm text-neutral-800">
            {row.trigger_event_name ? (
              <>
                Hendelse{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
                  {row.trigger_event_name}
                </code>
              </>
            ) : row.schedule_cron ? (
              <>
                Planlagt{' '}
                <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{row.schedule_cron}</code>
              </>
            ) : (
              <>Data­endring ({row.trigger_on})</>
            )}
          </p>
        </section>

        {/* Headline + impact summary */}
        <section className="rounded-md border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            Dette skjer når regelen utløses
          </h3>
          <ul className="mt-2 grid grid-cols-1 gap-2 text-xs text-neutral-700 sm:grid-cols-3">
            <li className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5">
              <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                E-poster
              </span>
              <span className="text-sm font-semibold text-neutral-900">{summary.emails}</span>
            </li>
            <li className="rounded border border-neutral-100 bg-neutral-50 px-2 py-1.5">
              <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                Varslinger
              </span>
              <span className="text-sm font-semibold text-neutral-900">{summary.notifications}</span>
            </li>
            <li
              className={`rounded border px-2 py-1.5 ${
                summary.govSubmissions > 0
                  ? 'border-red-200 bg-red-50'
                  : 'border-neutral-100 bg-neutral-50'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-wider text-neutral-500">
                Statlige meldinger
              </span>
              <span
                className={`text-sm font-semibold ${
                  summary.govSubmissions > 0 ? 'text-red-900' : 'text-neutral-900'
                }`}
              >
                {summary.govSubmissions}
              </span>
            </li>
          </ul>
          {summary.channels.size > 0 && (
            <p className="mt-2 text-xs text-neutral-600">
              <Send className="mr-1 inline h-3 w-3" />
              Varselkanaler: {[...summary.channels].join(', ')}
            </p>
          )}
          {regulators.length > 0 && (
            <p className="mt-2 text-xs text-red-900">
              <ShieldAlert className="mr-1 inline h-3 w-3" />
              Krever innsending til {regulators.map((r) => REGULATOR_LABEL[r] ?? r).join(', ')}.
            </p>
          )}
        </section>

        {/* Action list */}
        <section>
          <h3 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <Workflow className="h-4 w-4 text-neutral-500" />
            Steg ({actions.length})
          </h3>
          {actions.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500">
              Ingen handlinger definert.
            </p>
          ) : (
            <ol className="space-y-2">
              {actions.map((action, idx) => {
                const type = (action as { type: string }).type
                const label = ACTION_TYPE_LABELS[type] ?? type
                const summary = actionSummary(action)
                const isGov = isGovernmentActionType(type)
                return (
                  <li
                    key={idx}
                    className={`flex items-start gap-3 rounded-md border p-3 ${
                      isGov ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        isGov
                          ? 'bg-red-100 text-red-900'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {actionIcon(type)}
                        <span className="text-sm font-medium text-neutral-900">{label}</span>
                      </div>
                      {summary && (
                        <p className="mt-0.5 truncate text-xs text-neutral-600">{summary}</p>
                      )}
                      <code className="mt-1 inline-block rounded bg-neutral-100 px-1 py-0.5 text-[10px] text-neutral-600">
                        {type}
                      </code>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        {/* Law refs */}
        {row.law_refs.length > 0 && (
          <section className="rounded-md border border-neutral-200 bg-white p-4">
            <h3 className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              <Scale className="h-3 w-3" /> Lov-referanser
            </h3>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {row.law_refs.map((ref) => (
                <li
                  key={ref}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700"
                >
                  {ref}
                </li>
              ))}
            </ul>
          </section>
        )}

        {installState.kind === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Installasjonen feilet: {installState.message}</span>
          </div>
        )}
        {(installState.kind === 'installed' || installState.kind === 'exists') && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {installState.kind === 'installed'
                ? 'Regelen er installert som inaktiv. Aktiver den i Mine arbeidsflyter når den er klar.'
                : 'Regelen er allerede installert i denne organisasjonen.'}
            </span>
          </div>
        )}
      </div>
    </SlidePanel>
  )
}

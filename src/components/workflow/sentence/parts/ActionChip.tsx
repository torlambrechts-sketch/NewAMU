// ActionChip — pick an action type + edit its key fields inline.
//
// The popover shows a SearchableSelect of all actions registered for the
// scope (`listWorkflowActions(scopeId)`) plus the cross-cutting timing
// actions (wait / approval / escalate / log). On select, it inserts the
// default payload (from the action descriptor's `defaults()`). The form
// area below the selector renders a minimal set of fields per action
// type — title/owner for tasks, message for notifications, deadlineHours
// for the gov actions, etc. For deeper editing the user can switch to
// Avansert flyt.

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type {
  WorkflowAction,
  WorkflowActionDatatilsynetBreach,
  WorkflowActionArbeidstilsynetReport,
  WorkflowActionCreateTask,
  WorkflowActionRequestApproval,
  WorkflowActionSendNotification,
  WorkflowSourceModule,
} from '../../../../types/workflow'
import { listWorkflowActions, findActionDescriptor } from '../../../../lib/workflows/workflowRegistry'
import {
  defaultEscalateAction,
  defaultLogOnlyAction,
  defaultNotificationAction,
  defaultRequestApprovalAction,
  defaultTaskAction,
  defaultWaitUntilAction,
  summarizeAction,
} from '../../workflowActionDefaults'
import { Chip } from './Chip'
import { ChipPopover } from './ChipPopover'
import { StandardInput } from '../../../ui/Input'
import { StandardTextarea } from '../../../ui/Textarea'
import { SearchableSelect } from '../../../ui/SearchableSelect'

const APPROVER_ROLE_OPTIONS = [
  { value: 'hms_leder', label: 'HMS-leder' },
  { value: 'amu_leder', label: 'AMU-leder' },
  { value: 'daglig_leder', label: 'Daglig leder' },
  { value: 'verneombud', label: 'Verneombud' },
  { value: 'personvernombud', label: 'Personvernombud' },
]

const FIELD_LABEL = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-neutral-500'

// ─── action-type catalog ────────────────────────────────────────────────────
// Cross-cutting actions that don't belong to any one scope.
const CROSS_ACTIONS: { type: string; label: string; defaults: () => WorkflowAction }[] = [
  { type: 'create_task', label: 'Opprett oppgave', defaults: defaultTaskAction },
  { type: 'send_notification', label: 'Send varsling', defaults: defaultNotificationAction },
  { type: 'request_approval', label: 'Be om godkjenning', defaults: defaultRequestApprovalAction },
  { type: 'escalate', label: 'Eskaler til rolle', defaults: defaultEscalateAction },
  { type: 'wait_until', label: 'Vent til (timer/dager)', defaults: defaultWaitUntilAction },
  { type: 'log_only', label: 'Kun logg', defaults: defaultLogOnlyAction },
]

function ActionFields({
  action,
  onPatch,
}: {
  action: WorkflowAction
  onPatch: (a: WorkflowAction) => void
}) {
  if (action.type === 'create_task') {
    const t = action as WorkflowActionCreateTask
    return (
      <div className="space-y-3 text-sm">
        <div>
          <label className={FIELD_LABEL}>Tittel</label>
          <StandardInput value={t.title} onChange={(e) => onPatch({ ...t, title: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Tildelt rolle</label>
          <StandardInput
            value={t.ownerRole ?? ''}
            onChange={(e) => onPatch({ ...t, ownerRole: e.target.value || undefined })}
            placeholder="f.eks. verneombud"
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Frist (dager)</label>
          <StandardInput
            type="number"
            min={1}
            value={t.dueInDays ?? 7}
            onChange={(e) => onPatch({ ...t, dueInDays: Number(e.target.value) || 7 })}
          />
        </div>
      </div>
    )
  }
  if (action.type === 'send_notification') {
    const n = action as WorkflowActionSendNotification
    return (
      <div className="space-y-3 text-sm">
        <div>
          <label className={FIELD_LABEL}>Tittel</label>
          <StandardInput value={n.title} onChange={(e) => onPatch({ ...n, title: e.target.value })} />
        </div>
        <div>
          <label className={FIELD_LABEL}>Mottaker (rolle/kategori)</label>
          <StandardInput
            value={n.category ?? ''}
            onChange={(e) => onPatch({ ...n, category: e.target.value })}
            placeholder="f.eks. hms_leder"
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Melding</label>
          <StandardTextarea
            value={n.body}
            onChange={(e) => onPatch({ ...n, body: e.target.value })}
            rows={3}
          />
        </div>
      </div>
    )
  }
  if (action.type === 'request_approval') {
    const r = action as WorkflowActionRequestApproval
    return (
      <div className="space-y-3 text-sm">
        <div>
          <label className={FIELD_LABEL}>Godkjenner</label>
          <SearchableSelect
            value={r.approverRole ?? ''}
            options={APPROVER_ROLE_OPTIONS}
            onChange={(v) =>
              onPatch({ ...r, approverRole: v as WorkflowActionRequestApproval['approverRole'] })
            }
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Melding</label>
          <StandardTextarea
            value={r.message ?? ''}
            onChange={(e) => onPatch({ ...r, message: e.target.value })}
            rows={2}
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Eskaler etter (timer)</label>
          <StandardInput
            type="number"
            min={1}
            value={r.escalateAfterHours ?? 24}
            onChange={(e) =>
              onPatch({ ...r, escalateAfterHours: Number(e.target.value) || 24 })
            }
          />
        </div>
      </div>
    )
  }
  if (action.type === 'meld_personvernbrudd_datatilsynet') {
    const d = action as WorkflowActionDatatilsynetBreach
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          GDPR Art. 33 — 72 timer fra du ble klar over bruddet.
        </p>
        <div>
          <label className={FIELD_LABEL}>Type brudd</label>
          <StandardInput
            value={d.natureOfBreach ?? ''}
            onChange={(e) => onPatch({ ...d, natureOfBreach: e.target.value })}
            placeholder="kort beskrivelse"
          />
        </div>
        <div>
          <label className={FIELD_LABEL}>Påminnelser før frist (timer, kommaseparert)</label>
          <StandardInput
            value={(d.reminderHoursBeforeDeadline ?? [24, 4, 1]).join(', ')}
            onChange={(e) =>
              onPatch({
                ...d,
                reminderHoursBeforeDeadline: e.target.value
                  .split(',')
                  .map((x) => Number(x.trim()))
                  .filter((x) => Number.isFinite(x) && x > 0),
              })
            }
          />
        </div>
      </div>
    )
  }
  if (action.type === 'rapporter_alvorlig_skade_arbeidstilsynet') {
    const a = action as WorkflowActionArbeidstilsynetReport
    return (
      <div className="space-y-3 text-sm">
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          AML § 5-2 — 24 timer fra hendelsen.
        </p>
        <div>
          <label className={FIELD_LABEL}>Melder-rolle</label>
          <SearchableSelect
            value={a.melderRolle}
            options={[
              { value: 'arbeidsgiver', label: 'Arbeidsgiver' },
              { value: 'verneombud', label: 'Verneombud' },
              { value: 'lege', label: 'Lege' },
            ]}
            onChange={(v) =>
              onPatch({ ...a, melderRolle: v as WorkflowActionArbeidstilsynetReport['melderRolle'] })
            }
          />
        </div>
      </div>
    )
  }
  return (
    <p className="text-xs text-neutral-500">
      Denne handlingstypen har ikke en innebygd hurtigredigerer i Setning-modus. Bruk «Avansert flyt» for å redigere alle felt.
    </p>
  )
}

export function ActionChip({
  action,
  sourceModule,
  disabled,
  onChange,
  onRemove,
  placeholder = 'velg handling',
  accent = '#1a3d32',
}: {
  action: WorkflowAction | null
  sourceModule: WorkflowSourceModule
  disabled?: boolean
  onChange: (a: WorkflowAction) => void
  onRemove?: () => void
  placeholder?: string
  accent?: string
}) {
  const [open, setOpen] = useState(false)

  const scopeActions = useMemo(() => listWorkflowActions(sourceModule), [sourceModule])
  const actionOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [
      ...scopeActions.map(({ scope, action: a }) => ({
        value: a.type,
        label: `${a.label} (${scope.label})`,
      })),
      ...CROSS_ACTIONS.map((c) => ({ value: c.type, label: c.label })),
    ]
    // De-duplicate by type — scope actions win.
    const seen = new Set<string>()
    return out.filter((o) => {
      if (seen.has(o.value)) return false
      seen.add(o.value)
      return true
    })
  }, [scopeActions])

  function pickType(type: string) {
    if (!type) return
    const fromScope = scopeActions.find(({ action: a }) => a.type === type)
    if (fromScope) {
      onChange(fromScope.action.defaults())
      return
    }
    const fromCross = CROSS_ACTIONS.find((c) => c.type === type)
    if (fromCross) onChange(fromCross.defaults())
  }

  const label = action ? summarizeAction(action) : placeholder
  const descriptorLabel = action ? (findActionDescriptor(action.type)?.label ?? action.type) : ''

  return (
    <span className="relative inline-block">
      <Chip
        icon={action ? undefined : <Plus className="size-3.5" aria-hidden />}
        label={label}
        filled={Boolean(action)}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        ariaLabel={`Endre handling — nåværende: ${action ? descriptorLabel : 'ikke valgt'}`}
        accent={accent}
      />
      <ChipPopover
        open={open}
        title="Velg handling"
        onClose={() => setOpen(false)}
        width="w-[min(30rem,92vw)]"
      >
        <div className="space-y-3">
          <div>
            <label className={FIELD_LABEL}>Type</label>
            <SearchableSelect
              value={action?.type ?? ''}
              options={[{ value: '', label: 'Velg…' }, ...actionOptions]}
              onChange={pickType}
            />
          </div>
          {action ? <ActionFields action={action} onPatch={onChange} /> : null}
          <div className="flex justify-between gap-2 pt-1">
            {onRemove ? (
              <button
                type="button"
                onClick={() => {
                  onRemove()
                  setOpen(false)
                }}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Fjern handling
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
            >
              Ferdig
            </button>
          </div>
        </div>
      </ChipPopover>
    </span>
  )
}

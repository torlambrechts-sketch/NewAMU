// Left-panel trigger selector for the workflow template Studio editor.
// Lets the author pick which module + event fires the template.

import { getWorkflowTriggerEventsForModule } from '../../../src/components/workflow/workflowTriggerRegistry'
import type { WorkflowTriggerType } from '../../../src/types/workflow'

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'compliance_checklist', label: 'Sjekkliste' },
  { value: 'survey',               label: 'Undersøkelse' },
  { value: 'meetings',             label: 'Møter' },
  { value: 'tasks',                label: 'Oppgaver' },
  { value: 'documents',            label: 'Dokumenter' },
  { value: 'registers',            label: 'Register' },
  { value: 'learning',             label: 'Læring' },
  { value: 'vernerunder',          label: 'Vernerunde' },
  { value: 'inspection',           label: 'HMS-inspeksjon' },
  { value: 'ros',                  label: 'Risikovurdering' },
  { value: 'action_plan',          label: 'Handlingsplan' },
  { value: 'internkontroll',       label: 'Internkontroll' },
]

type Props = {
  sourceModule: string
  triggerEventName: string | null
  triggerType: WorkflowTriggerType
  triggerOn: 'insert' | 'update' | 'both'
  onChangeModule: (m: string) => void
  onChangeEvent: (e: string | null) => void
  onChangeTriggerType: (t: WorkflowTriggerType) => void
  onChangeTriggerOn: (v: 'insert' | 'update' | 'both') => void
  disabled?: boolean
}

export function StudioWorkflowTriggerSelector({
  sourceModule,
  triggerEventName,
  triggerType,
  triggerOn,
  onChangeModule,
  onChangeEvent,
  onChangeTriggerType,
  onChangeTriggerOn,
  disabled = false,
}: Props) {
  const events = getWorkflowTriggerEventsForModule(sourceModule)
  const isSchedule = triggerType === 'schedule'
  const isWebhook = triggerType === 'webhook_in'

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-neutral-200 bg-[#fafaf9] p-4">
      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
          Utløser
        </p>
        <p className="text-[11px] text-neutral-400">
          Velg hvilken modul og hendelse som starter malen.
        </p>
      </div>

      {/* Trigger type */}
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-neutral-500">Hendelsestype</span>
        <select
          value={triggerType}
          disabled={disabled}
          onChange={(e) => onChangeTriggerType(e.target.value as WorkflowTriggerType)}
          className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50"
        >
          <option value="db_event">DB-hendelse</option>
          <option value="payload_change">Nyttelastandring</option>
          <option value="manual">Manuell</option>
          <option value="schedule" disabled>Tidsplan (kommer snart)</option>
          <option value="webhook_in" disabled>Webhook inn (kommer snart)</option>
        </select>
      </label>

      {/* Source module */}
      {!isSchedule && !isWebhook && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Modul</span>
          <select
            value={sourceModule}
            disabled={disabled}
            onChange={(e) => onChangeModule(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50"
          >
            {MODULE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Trigger event */}
      {triggerType === 'db_event' && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Hendelse</span>
          {events.length === 0 ? (
            <p className="text-[11px] italic text-neutral-400">Ingen hendelser for denne modulen.</p>
          ) : (
            <select
              value={triggerEventName ?? ''}
              disabled={disabled}
              onChange={(e) => onChangeEvent(e.target.value || null)}
              className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50"
            >
              <option value="">Velg hendelse…</option>
              {events.map((ev) => (
                <option key={ev.value} value={ev.value}>
                  {ev.label}
                </option>
              ))}
            </select>
          )}
        </label>
      )}

      {/* Trigger on */}
      {triggerType !== 'manual' && !isSchedule && !isWebhook && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-neutral-500">Kjør ved</span>
          <select
            value={triggerOn}
            disabled={disabled}
            onChange={(e) => onChangeTriggerOn(e.target.value as 'insert' | 'update' | 'both')}
            className="rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30 disabled:bg-neutral-50"
          >
            <option value="both">Opprett eller oppdater</option>
            <option value="insert">Kun opprettelse</option>
            <option value="update">Kun oppdatering</option>
          </select>
        </label>
      )}

      {/* Schedule placeholder */}
      {isSchedule && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          Tidsplan-utløser er ikke tilgjengelig i Studio ennå. Bruk Arbeidsflyt-modulen for cron-regler.
        </div>
      )}
    </aside>
  )
}

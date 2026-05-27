// StateTransitionMenu — dropdown of valid to-states for the caller's role.
// Calls the alerts-execute-workflow edge function which proxies to the
// RPC. Prompts for justification / coi / assignee when required.

import { useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type AlertState,
  ALERT_STATE_LABELS_NB,
  ALERT_STATE_LABELS_EN,
  allowedTransitions,
  type WorkflowTransitionRule,
} from '../../state/stateMachine'

type Props = {
  supabase: SupabaseClient
  caseId: string
  currentState: AlertState
  callerRoles: string[]
  customRules?: WorkflowTransitionRule[]
  onTransitioned: () => void
  lang: 'nb' | 'en'
}

export function StateTransitionMenu({
  supabase,
  caseId,
  currentState,
  callerRoles,
  customRules,
  onTransitioned,
  lang,
}: Props) {
  const allowed = useMemo(
    () => allowedTransitions(currentState, callerRoles, customRules),
    [currentState, callerRoles, customRules],
  )
  const [selected, setSelected] = useState<WorkflowTransitionRule | null>(null)
  const [justification, setJustification] = useState('')
  const [coiId, setCoiId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labels = lang === 'nb' ? ALERT_STATE_LABELS_NB : ALERT_STATE_LABELS_EN

  if (allowed.length === 0) {
    return (
      <p className="text-xs italic text-neutral-500">
        {lang === 'nb'
          ? 'Ingen tillatte overganger fra denne tilstanden.'
          : 'No permitted transitions from this state.'}
      </p>
    )
  }

  async function execute() {
    if (!selected) return
    setBusy(true)
    setError(null)
    const { data, error: invokeError } = await supabase.functions.invoke('alerts-execute-workflow', {
      body: {
        caseId,
        toState: selected.toState,
        justification: justification || null,
        coiDeclarationId: coiId || null,
        assignedHandlerId: assignee || null,
      },
    })
    setBusy(false)
    if (invokeError) {
      setError(invokeError.message)
      return
    }
    if (data && typeof data === 'object' && 'error' in data) {
      setError((data as { error: string }).error)
      return
    }
    setSelected(null)
    setJustification('')
    setCoiId('')
    setAssignee('')
    onTransitioned()
  }

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Endre tilstand' : 'Change state'}</h3>
      <div className="flex flex-wrap gap-2">
        {allowed.map((r) => (
          <button
            key={`${r.fromState}->${r.toState}`}
            type="button"
            onClick={() => setSelected(r)}
            className={`rounded border px-3 py-1.5 text-xs ${
              selected?.toState === r.toState
                ? 'border-red-700 bg-red-50 text-red-900'
                : 'border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            → {labels[r.toState]}
          </button>
        ))}
      </div>
      {selected && (
        <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
          {(selected.preconditions.requiresJustification as boolean) && (
            <label className="block text-xs">
              <span className="font-semibold">{lang === 'nb' ? 'Begrunnelse (påkrevd)' : 'Justification (required)'}</span>
              <textarea
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>
          )}
          {(selected.preconditions.requiresCoiDeclaration as boolean) && (
            <label className="block text-xs">
              <span className="font-semibold">{lang === 'nb' ? 'COI-erklæring (id)' : 'COI declaration (id)'}</span>
              <input
                type="text"
                value={coiId}
                onChange={(e) => setCoiId(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>
          )}
          {(selected.preconditions.requiresAssignedHandler as boolean) && (
            <label className="block text-xs">
              <span className="font-semibold">{lang === 'nb' ? 'Tildelt saksbehandler (user id)' : 'Assigned handler (user id)'}</span>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1"
              />
            </label>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void execute()}
              disabled={busy}
              className="rounded bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {busy
                ? lang === 'nb' ? 'Utfører…' : 'Executing…'
                : lang === 'nb' ? `Bekreft overgang → ${labels[selected.toState]}` : `Confirm → ${labels[selected.toState]}`}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs"
            >
              {lang === 'nb' ? 'Avbryt' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

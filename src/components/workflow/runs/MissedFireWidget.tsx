// MissedFireWidget — fallback surface for the "Skulle ha kjørt"-revisor.
//
// Reads workflow_missed_fire_log (migration _20260907127900) for the last
// 7 days, surfacing rules the nightly revisor flagged as "should have
// fired but didn't". Users with workflows.activate can triage each row
// from a SlidePanel that shows the original dispatch event payload + the
// rule's condition trace.
//
// This is the *fallback* home — the spec calls for a 4th widget on a M3
// Helsesjekk page once that lands; until then we host it under the
// /admin/workflow → Kjøringer tab so the signal isn't invisible.

import { useId, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Clock, ShieldAlert } from 'lucide-react'
import { Button } from '../../ui/Button'
import { SlidePanel } from '../../layout/SlidePanel'
import { StandardTextarea } from '../../ui/Textarea'
import {
  useWorkflowDispatchEvent,
  useWorkflowMissedFires,
} from '../../../hooks/useWorkflowMissedFires'
import type {
  WorkflowMissedFireLogRow,
  WorkflowMissedFireSeverity,
} from '../../../types/workflow'

const severityTint: Record<WorkflowMissedFireSeverity, { bg: string; fg: string }> = {
  critical: { bg: '#fef2f2', fg: '#991b1b' },
  high: { bg: '#fff7ed', fg: '#9a3412' },
  medium: { bg: '#fefce8', fg: '#854d0e' },
  low: { bg: '#f5f5f4', fg: '#525252' },
}

const REASON_LABEL: Record<string, string> = {
  condition_should_match: 'Betingelse matcher payload, men ingen workflow_runs',
  cron_missed: 'Planlagt cron fyrte ikke til avtalt tid',
  no_run_recorded: 'Ingen tilsvarende workflow_runs registrert',
}

export function MissedFireWidget() {
  const { rows, loading, error, canTriage, setTriage } = useWorkflowMissedFires()
  const [selected, setSelected] = useState<WorkflowMissedFireLogRow | null>(null)

  const open = useMemo(() => rows.filter((r) => r.triage_status === 'open'), [rows])

  if (loading && rows.length === 0) {
    return null
  }
  if (error) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mr-1 inline h-4 w-4" />
        Missed-fire revisor kunne ikke lastes: {error}
      </div>
    )
  }
  if (open.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <ShieldAlert className="mr-1 inline h-4 w-4" />
        Missed-fire revisor: ingen åpne avvik siste 7 dager. Reglene som skulle ha fyrt, fyrte.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-red-300 bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-red-700" />
        <h3 className="text-sm font-semibold text-neutral-900">Missed-fire siste 7 dager</h3>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          {open.length} åpne
        </span>
      </div>
      <p className="text-xs text-neutral-600">
        Nattlig revisor fant disse hendelsene der en regel skulle ha fyrt, men ingen kjøring
        ble registrert. Hver rad må enten merkes som korrekt (false-positive fra revisoren)
        eller følges opp som feil i regelsettet eller infrastrukturen.
      </p>
      <div className="overflow-hidden rounded-lg border border-neutral-200">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Skulle ha fyrt</th>
              <th className="px-3 py-2 text-left">Regel</th>
              <th className="px-3 py-2 text-left">Hendelse</th>
              <th className="px-3 py-2 text-left">Årsak</th>
              <th className="px-3 py-2 text-left">Alvorlighet</th>
              <th className="px-3 py-2 text-right">Triage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {open.map((row) => {
              const tint = severityTint[row.severity] ?? severityTint.high
              const ruleLabel = row.rule_id
                ? `Regel ${row.rule_id.slice(0, 8)}`
                : row.system_rule_slug ?? '(system-regel)'
              return (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-xs text-neutral-700">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {row.expected_fire_at
                      ? new Date(row.expected_fire_at).toLocaleString('nb-NO')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{ruleLabel}</td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium text-neutral-900">{row.source_module ?? '—'}</div>
                    <div className="text-neutral-500">{row.event_name ?? '—'}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {REASON_LABEL[row.reason] ?? row.reason}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={<ChevronRight className="h-3.5 w-3.5" />}
                      onClick={() => setSelected(row)}
                    >
                      Undersøk
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <MissedFireDetail
          row={selected}
          canTriage={canTriage}
          onClose={() => setSelected(null)}
          onTriage={async (status, note) => {
            const result = await setTriage(selected.id, status, note)
            if (result.ok) setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function MissedFireDetail({
  row,
  canTriage,
  onClose,
  onTriage,
}: {
  row: WorkflowMissedFireLogRow
  canTriage: boolean
  onClose: () => void
  onTriage: (status: 'accepted_as_correct' | 'resolved', note: string) => Promise<void>
}) {
  const titleId = useId()
  const { event, loading } = useWorkflowDispatchEvent(row.event_id)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (status: 'accepted_as_correct' | 'resolved') => {
    setSubmitting(true)
    try {
      await onTriage(status, note)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open
      onClose={onClose}
      titleId={titleId}
      title={<>Missed-fire — {row.event_name ?? 'ukjent hendelse'}</>}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Lukk
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!canTriage || submitting}
            onClick={() => void submit('accepted_as_correct')}
            title={canTriage ? '' : 'Krever workflows.activate eller admin'}
          >
            Marker som korrekt
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canTriage || submitting}
            onClick={() => void submit('resolved')}
            title={canTriage ? '' : 'Krever workflows.activate eller admin'}
          >
            Følges opp som feil
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-6 py-5">
        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tidspunkt
          </h3>
          <p className="text-sm text-neutral-800">
            Skulle ha fyrt{' '}
            <strong>
              {row.expected_fire_at
                ? new Date(row.expected_fire_at).toLocaleString('nb-NO')
                : '—'}
            </strong>{' '}
            — oppdaget{' '}
            <strong>{new Date(row.detected_at).toLocaleString('nb-NO')}</strong>
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Regel
          </h3>
          <p className="text-sm text-neutral-800">
            {row.rule_id ? (
              <>Per-org regel <code className="text-xs">{row.rule_id}</code></>
            ) : (
              <>System-regel <code className="text-xs">{row.system_rule_slug}</code></>
            )}
          </p>
          <p className="text-sm text-neutral-600">
            {REASON_LABEL[row.reason] ?? row.reason}
          </p>
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Original payload
          </h3>
          {loading ? (
            <p className="text-xs text-neutral-500">Laster …</p>
          ) : event ? (
            <pre className="overflow-x-auto rounded-lg bg-neutral-50 p-3 text-[11px] text-neutral-800">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-neutral-500">
              Ingen dispatch-event tilknyttet (kan være cron_missed).
            </p>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Betingelse-trace
          </h3>
          <p className="text-xs text-neutral-600">
            Revisoren re-evaluerte regelens <code>condition_json</code> mot payload over og
            fant <strong>match</strong>, men ingen kjøring i workflow_runs innen ±1t av
            forventet tidspunkt. Sjekk om regelen var aktiv på det tidspunktet, om
            dispatch-funksjonen kastet en uventet feil, og om pg_cron-jobbene har kjørt.
          </p>
        </section>

        <section className="space-y-2">
          <label
            htmlFor={`${titleId}-note`}
            className="text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            Notat (valgfritt)
          </label>
          <StandardTextarea
            id={`${titleId}-note`}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Hva fant du? Hva ble gjort?"
            disabled={!canTriage}
          />
        </section>
      </div>
    </SlidePanel>
  )
}

export default MissedFireWidget

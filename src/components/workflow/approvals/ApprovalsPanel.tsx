// ApprovalsPanel — human-in-the-loop inbox for workflow_approvals.
//
// Shows pending approvals (and an archive of decided ones) with one-click
// approve / reject. Hooked into workflow_decide_approval RPC which flips
// both the approval row and its paused queue row. The activation guard
// from migration _20260905120900 means rules with government-reporting
// actions REQUIRE a request_approval step before they reach the
// regulator — this panel is where that approval happens.

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Clock, FileWarning, X } from 'lucide-react'
import { useWorkflowApprovals } from '../../../hooks/useWorkflowApprovals'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { Button } from '../../ui/Button'
import { StandardTextarea } from '../../ui/Textarea'

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending: 'venter',
  approved: 'godkjent',
  rejected: 'avvist',
  expired: 'utløpt',
  cancelled: 'avbrutt',
}

export function ApprovalsPanel() {
  const { approvals, loading, error, decide } = useWorkflowApprovals()
  const { rules } = useWorkflows()
  const [statusTab, setStatusTab] = useState<'pending' | 'decided'>('pending')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const ruleById = useMemo(() => Object.fromEntries(rules.map((r) => [r.id, r])), [rules])

  const filtered = useMemo(() => {
    return approvals.filter((a) => {
      if (statusTab === 'pending') return a.status === 'pending'
      return a.status !== 'pending'
    })
  }, [approvals, statusTab])

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    await decide(id, decision, note || undefined)
    setActiveId(null)
    setNote('')
  }

  if (loading && approvals.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster godkjenninger …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste godkjenninger: {error}</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Godkjenninger</h2>
        <span className="flex-1" />
        <div role="tablist" className="flex rounded-md bg-neutral-100 p-0.5">
          <Button
            variant="ghost"
            role="tab"
            aria-selected={statusTab === 'pending'}
            onClick={() => setStatusTab('pending')}
            className={`rounded px-3 py-1 text-xs font-medium ${
              statusTab === 'pending'
                ? 'bg-white text-neutral-900 shadow-sm hover:bg-white hover:text-neutral-900'
                : 'text-neutral-600 hover:bg-transparent'
            }`}
          >
            Venter ({approvals.filter((a) => a.status === 'pending').length})
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={statusTab === 'decided'}
            onClick={() => setStatusTab('decided')}
            className={`rounded px-3 py-1 text-xs font-medium ${
              statusTab === 'decided'
                ? 'bg-white text-neutral-900 shadow-sm hover:bg-white hover:text-neutral-900'
                : 'text-neutral-600 hover:bg-transparent'
            }`}
          >
            Besluttet ({approvals.filter((a) => a.status !== 'pending').length})
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          {statusTab === 'pending'
            ? 'Ingen godkjenninger venter på deg. Regelutløsere som krever menneskelig godkjenning (typisk statlige meldinger) dukker opp her.'
            : 'Ingen besluttede godkjenninger ennå.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const rule = ruleById[a.rule_id]
            const isExpanded = activeId === a.id
            const metadata = (a.metadata ?? {}) as { message?: string; escalateToRole?: string }
            const isGovRule = rule?.actions_json &&
              JSON.stringify(rule.actions_json).match(
                /(rapporter_alvorlig_skade_arbeidstilsynet|meld_personvernbrudd_datatilsynet|altinn_send_melding|nav_sykefravar_oppfolging|varsel_ldo_export)/,
              )
            return (
              <li
                key={a.id}
                className={`rounded-xl border bg-white ${
                  a.status === 'pending'
                    ? isGovRule
                      ? 'border-rose-200'
                      : 'border-neutral-200'
                    : 'border-neutral-100 opacity-90'
                }`}
              >
                <Button
                  variant="ghost"
                  aria-expanded={isExpanded}
                  onClick={() => {
                    setActiveId(isExpanded ? null : a.id)
                    setNote('')
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-none px-4 py-3 text-left font-normal hover:bg-transparent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900">
                        {rule?.name ?? '(slettet regel)'}
                      </span>
                      {isGovRule && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                          <FileWarning className="h-3 w-3" /> Statlig melding
                        </span>
                      )}
                    </div>
                    {metadata.message && (
                      <p className="mt-0.5 truncate text-xs text-neutral-600">{metadata.message}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                    <Clock className="h-3 w-3" />
                    {new Date(a.requested_at).toLocaleString('nb-NO')}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        a.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : a.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {APPROVAL_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </Button>
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <span className="text-neutral-500">Godkjenner-rolle</span>
                      <span>{a.approver_role ?? '—'}</span>
                      <span className="text-neutral-500">Kø-rad</span>
                      <code className="text-[10px] text-neutral-600">{a.queue_id?.slice(0, 8) ?? '—'}</code>
                      {metadata.escalateToRole && (
                        <>
                          <span className="text-neutral-500">Eskaleres til</span>
                          <span>{metadata.escalateToRole}</span>
                        </>
                      )}
                      {a.escalated_at && (
                        <>
                          <span className="text-neutral-500">Eskalert</span>
                          <span>{new Date(a.escalated_at).toLocaleString('nb-NO')}</span>
                        </>
                      )}
                      {a.decided_at && (
                        <>
                          <span className="text-neutral-500">Besluttet</span>
                          <span>{new Date(a.decided_at).toLocaleString('nb-NO')}</span>
                        </>
                      )}
                      {a.decision_note && (
                        <>
                          <span className="text-neutral-500">Notat</span>
                          <span>{a.decision_note}</span>
                        </>
                      )}
                    </div>
                    {a.status === 'pending' && (
                      <div className="mt-3 space-y-2">
                        {isGovRule && (
                          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                            <AlertTriangle className="mr-1 inline h-3 w-3" />
                            Denne regelen sender en juridisk bindende melding til statlig myndighet.
                            Forsikre deg om at innholdet er korrekt før godkjenning.
                          </div>
                        )}
                        <StandardTextarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Begrunnelse (valgfritt, men anbefalt for revisjonsspor)"
                          rows={2}
                          className="text-xs"
                          aria-label="Begrunnelse for beslutning"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            icon={<Check className="h-3.5 w-3.5" />}
                            onClick={() => handleDecide(a.id, 'approved')}
                          >
                            Godkjenn
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            icon={<X className="h-3.5 w-3.5" />}
                            onClick={() => handleDecide(a.id, 'rejected')}
                          >
                            Avvis
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-neutral-500">
        Godkjenninger er kø-pauseringer — å trykke «Godkjenn» frigjør kø-raden og lar handlingen
        kjøre videre via workflow-queue-worker. Avslag avbryter handlingen og logger begrunnelsen
        i workflow_runs (gjennom queue.last_error).
      </p>
    </div>
  )
}

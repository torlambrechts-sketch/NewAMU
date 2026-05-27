// MeetingReportingObligationsPanel — statutoriske rapporteringsplikter per møte.
//
// Norske møter utløser ofte rapporteringsplikt til eksterne myndigheter:
//   * NAV-melding ved masseoppsigelse (AML § 15-2 (3)).
//   * AMU årsrapport til styrende organer (AML § 7-2 (6)).
//   * Foretaksregisteret-melding ved aksjelov-vedtak (§ 4-26 m.fl.).
//   * Tvisteløsningsnemnda ved drøftingsplikt-tvist (AML § 17-2).
// Denne panelen lister plikter materialisert fra template-definisjonen
// (`meeting_reporting_obligations`-tabellen), viser forfallsdato, og lar
// brukere med `meetings.manage_reporting_obligations` markere fullført med
// evidence-URL + notater.

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileText, RotateCcw } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { Badge } from '../../../src/components/ui/Badge'
import { formatDate } from '../../../src/lib/i18n/format'
import type { MeetingReportingObligationRow } from '../types'

export type MeetingReportingObligationsPanelProps = {
  obligations: MeetingReportingObligationRow[]
  /** Whether the current user can mark obligations fulfilled. */
  canManage: boolean
  onMarkFulfilled: (
    obligationId: string,
    input?: { evidenceUrl?: string | null; notes?: string | null },
  ) => Promise<boolean>
  onUnmarkFulfilled: (obligationId: string) => Promise<boolean>
}

type RowState = 'overdue' | 'due_soon' | 'open' | 'fulfilled'

function classify(o: MeetingReportingObligationRow): RowState {
  if (o.fulfilled_at) return 'fulfilled'
  if (!o.due_at) return 'open'
  const dueMs = new Date(o.due_at).getTime()
  const nowMs = Date.now()
  if (dueMs < nowMs) return 'overdue'
  if (dueMs - nowMs < 7 * 24 * 60 * 60 * 1000) return 'due_soon'
  return 'open'
}

function RecipientBadge({ recipient }: { recipient: string }) {
  const variant = (() => {
    switch (recipient) {
      case 'NAV':
      case 'Arbeidstilsynet':
        return 'critical' as const
      case 'Foretaksregisteret':
        return 'info' as const
      case 'Tvisteløsningsnemnda':
      case 'Hovedavtaleutvalget':
        return 'warning' as const
      default:
        return 'neutral' as const
    }
  })()
  return <Badge variant={variant}>{recipient}</Badge>
}

function StatusChip({ state }: { state: RowState }) {
  switch (state) {
    case 'fulfilled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800 border border-green-200">
          <CheckCircle2 className="size-3.5" aria-hidden /> Fullført
        </span>
      )
    case 'overdue':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800 border border-red-200">
          <AlertTriangle className="size-3.5" aria-hidden /> Forfalt
        </span>
      )
    case 'due_soon':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 border border-amber-200">
          <Clock className="size-3.5" aria-hidden /> Snart forfall
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-700 border border-neutral-200">
          <Clock className="size-3.5" aria-hidden /> Åpen
        </span>
      )
  }
}

function FulfillForm({
  obligation,
  onSubmit,
  onCancel,
}: {
  obligation: MeetingReportingObligationRow
  onSubmit: (input: { evidenceUrl?: string | null; notes?: string | null }) => Promise<void>
  onCancel: () => void
}) {
  const [evidenceUrl, setEvidenceUrl] = useState<string>(obligation.evidence_url ?? '')
  const [notes, setNotes] = useState<string>(obligation.notes ?? '')
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 space-y-2">
      <div>
        <label className="text-xs font-medium text-neutral-700">Evidence URL (innsendingsbekreftelse)</label>
        <StandardInput
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://altinn.no/skjema/…"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-neutral-700">Notater</label>
        <StandardTextarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Eks: sendt via Altinn, ref 2026/12345"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
          Avbryt
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await onSubmit({
                evidenceUrl: evidenceUrl.trim() || null,
                notes: notes.trim() || null,
              })
            } finally {
              setSubmitting(false)
            }
          }}
        >
          Marker fullført
        </Button>
      </div>
    </div>
  )
}

export function MeetingReportingObligationsPanel({
  obligations,
  canManage,
  onMarkFulfilled,
  onUnmarkFulfilled,
}: MeetingReportingObligationsPanelProps) {
  const [openFormId, setOpenFormId] = useState<string | null>(null)

  if (obligations.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        Ingen statutoriske rapporteringsplikter på dette møtet.
      </div>
    )
  }

  // Sort: fulfilled last; then overdue first, then due_soon, then open
  const sorted = [...obligations].sort((a, b) => {
    const stateOrder: Record<RowState, number> = { overdue: 0, due_soon: 1, open: 2, fulfilled: 3 }
    const sa = stateOrder[classify(a)]
    const sb = stateOrder[classify(b)]
    if (sa !== sb) return sa - sb
    const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
    const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
    return da - db
  })

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-sm text-neutral-700">
        <FileText className="size-4 mt-0.5 text-cyan-700" aria-hidden />
        <p>
          Lovpålagte rapporteringsplikter knyttet til møtet. Merk hver som fullført etter innsending —
          forfalt plikt vises som rødt varsel i analyse-dashboardet og varsler ledelse.
        </p>
      </div>

      <ul className="space-y-2">
        {sorted.map((o) => {
          const state = classify(o)
          const isFormOpen = openFormId === o.id
          return (
            <li
              key={o.id}
              className="rounded-md border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-neutral-900">{o.obligation_label}</h4>
                    <RecipientBadge recipient={o.recipient} />
                    <StatusChip state={state} />
                  </div>
                  {o.law_ref && (
                    <p className="text-xs text-neutral-600">
                      <span className="font-medium">Lovgrunnlag:</span> {o.law_ref}
                    </p>
                  )}
                  <p className="text-xs text-neutral-600">
                    {o.due_at ? (
                      <>
                        <span className="font-medium">Forfall:</span> {formatDate(o.due_at)}
                        {o.due_offset_days != null && ` (${o.due_offset_days} dager etter møtet)`}
                      </>
                    ) : (
                      <span className="italic">Ingen forfallsdato satt</span>
                    )}
                  </p>
                  {o.fulfilled_at && (
                    <p className="text-xs text-green-800">
                      <span className="font-medium">Fullført:</span> {formatDate(o.fulfilled_at)}
                      {o.evidence_url && (
                        <>
                          {' · '}
                          <a
                            href={o.evidence_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-green-900 underline"
                          >
                            Evidence <ExternalLink className="size-3" aria-hidden />
                          </a>
                        </>
                      )}
                    </p>
                  )}
                  {o.notes && (
                    <p className="text-xs text-neutral-700 italic">{o.notes}</p>
                  )}
                </div>

                {canManage && !o.fulfilled_at && !isFormOpen && (
                  <Button variant="primary" size="sm" onClick={() => setOpenFormId(o.id)}>
                    Marker fullført
                  </Button>
                )}
                {canManage && o.fulfilled_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await onUnmarkFulfilled(o.id)
                    }}
                    title="Sett tilbake til åpen (f.eks. ved avvist innsending)"
                  >
                    <RotateCcw className="size-3.5 mr-1" aria-hidden />
                    Reåpne
                  </Button>
                )}
              </div>

              {isFormOpen && (
                <FulfillForm
                  obligation={o}
                  onCancel={() => setOpenFormId(null)}
                  onSubmit={async (input) => {
                    const ok = await onMarkFulfilled(o.id, input)
                    if (ok) setOpenFormId(null)
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

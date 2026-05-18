// Habilitet (COI) declarations per agenda item. Renders the current
// declared conflicts + an edit form where the chair adds (member, reason)
// pairs. AML § 2A-7 (5) for varslingsutvalg + good forvaltningsskikk
// for AMU; the data lives on meeting_agenda_items.conflict_of_interest
// jsonb (one shape across all meeting types).

import { useState } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import { Button } from '../../../src/components/ui/Button'
import { Badge } from '../../../src/components/ui/Badge'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'

export type CoiEntry = { member_id: string; reason: string }

export function CoiDeclarePanel({
  agendaItemId,
  current,
  members,
  locked,
  onSave,
}: {
  agendaItemId: string
  current: CoiEntry[] | null
  members: Array<{ id: string; name: string }>
  locked: boolean
  onSave: (next: CoiEntry[]) => Promise<boolean>
}) {
  const [entries, setEntries] = useState<CoiEntry[]>(current ?? [])
  const [memberId, setMemberId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const memberById = new Map(members.map((m) => [m.id, m.name]))

  async function add() {
    if (locked || busy) return
    if (!memberId || reason.trim().length < 4) return
    const next = [...entries.filter((e) => e.member_id !== memberId), { member_id: memberId, reason: reason.trim() }]
    setBusy(true)
    try {
      const ok = await onSave(next)
      if (ok) {
        setEntries(next)
        setMemberId('')
        setReason('')
        setSavedAt(Date.now())
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (locked || busy) return
    const next = entries.filter((e) => e.member_id !== id)
    setBusy(true)
    try {
      const ok = await onSave(next)
      if (ok) {
        setEntries(next)
        setSavedAt(Date.now())
      }
    } finally {
      setBusy(false)
    }
  }

  const availableMembers = members.filter(
    (m) => !entries.some((e) => e.member_id === m.id),
  )

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden />
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
            Habilitet — interessekonflikt
          </p>
        </div>
        {savedAt ? <Badge variant="signed">Lagret</Badge> : null}
      </div>
      <p className="mt-1 text-[11px] text-amber-800">
        Forskriftskrav: medlemmer med tilknytning til sakens innhold skal erklære habilitet og avstå fra
        stemmegivning.
      </p>

      {entries.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.member_id}
              className="flex items-start gap-2 rounded border border-amber-200 bg-white px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-neutral-900">
                  {memberById.get(e.member_id) ?? `${e.member_id.slice(0, 8)}…`}
                </p>
                <p className="text-[11px] text-neutral-600">{e.reason}</p>
              </div>
              {!locked ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(e.member_id)}
                  disabled={busy}
                  aria-label={`Fjern habilitetserklæring for ${memberById.get(e.member_id) ?? 'medlem'}`}
                  className="text-amber-800 hover:bg-amber-100"
                >
                  <X className="h-3 w-3" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] italic text-amber-800/80">
          Ingen habilitetserklæringer registrert for denne saken.
        </p>
      )}

      {!locked ? (
        <div className="mt-3 space-y-2 border-t border-amber-200/60 pt-3">
          <label className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>Medlem</span>
            <SearchableSelect
              value={memberId}
              onChange={setMemberId}
              options={availableMembers.map((m) => ({ value: m.id, label: m.name }))}
              placeholder={
                availableMembers.length === 0
                  ? 'Alle medlemmer har allerede en erklæring'
                  : 'Velg medlem'
              }
              disabled={availableMembers.length === 0}
              className="mt-1.5"
            />
          </label>
          <label className="block">
            <span className={WPSTD_FORM_FIELD_LABEL}>Begrunnelse</span>
            <StandardTextarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvilken tilknytning utgjør risiko for habilitet? (synlig i protokoll)"
              className="mt-1.5"
            />
          </label>
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3 w-3" />}
              onClick={() => void add()}
              disabled={busy || !memberId || reason.trim().length < 4}
            >
              Registrer habilitet
            </Button>
          </div>
        </div>
      ) : null}
      {/* agendaItemId binds the panel to the surrounding form context; not
       *  user-editable. Stored in a data attribute rather than a hidden
       *  input so we don't trip the design-system raw-<input> rule. */}
      <div data-agenda-item-id={agendaItemId} className="hidden" />
    </div>
  )
}

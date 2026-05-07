// Editable metadata for a single checklist execution.
//
// Renders title / summary / attendees / scheduled date / assigned-to as
// inline editors. Edits commit on field blur (debounced effectively to
// "when the field loses focus") so the user can type without latency,
// and also flush on Enter for the title and the attendee tag input.
//
// Crucially, the underlying mutation `updateExecutionMetadata` is allowed
// even when the execution is signed — the BEFORE UPDATE trigger only
// locks definition_snapshot, signed_at, signed_by, sign_checksum and the
// status flag. Title/summary/attendees/assignment/schedule are amendable
// post-sign so AMU corrections (typo in name, late-added attendee) don't
// require unsigning the row.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { ComplianceAssignableUser, ComplianceExecutionRow } from '../types'

type SavePayload = {
  title?: string
  summary?: string | null
  attendees?: string[]
  assignedTo?: string | null
  scheduledFor?: string | null
}

export function ExecutionMetadataPanel({
  execution,
  assignableUsers,
  onSave,
}: {
  execution: ComplianceExecutionRow
  assignableUsers: ComplianceAssignableUser[]
  onSave: (payload: SavePayload) => Promise<void> | void
}) {
  const [title, setTitle] = useState(execution.title)
  const [summary, setSummary] = useState(execution.summary ?? '')
  const [attendees, setAttendees] = useState<string[]>(execution.attendees ?? [])
  const [attendeeDraft, setAttendeeDraft] = useState('')
  const [scheduledFor, setScheduledFor] = useState(
    execution.scheduled_for ? execution.scheduled_for.slice(0, 10) : '',
  )
  const [assignedTo, setAssignedTo] = useState<string>(execution.assigned_to ?? '')

  // Reset local form state when the route switches to a different execution.
  // (Re-syncing on every save would clobber whatever the user is typing —
  // local state is intentionally the source of truth between flushes.)
  // Using setState-during-render is the React-recommended way to resync on
  // a prop change without an effect.
  const [lastId, setLastId] = useState(execution.id)
  if (lastId !== execution.id) {
    setLastId(execution.id)
    setTitle(execution.title)
    setSummary(execution.summary ?? '')
    setAttendees(execution.attendees ?? [])
    setScheduledFor(execution.scheduled_for ? execution.scheduled_for.slice(0, 10) : '')
    setAssignedTo(execution.assigned_to ?? '')
  }

  const isSigned = execution.status === 'signed'

  const flushTitle = () => {
    const next = title.trim()
    if (next.length > 0 && next !== execution.title) {
      void onSave({ title: next })
    } else if (next.length === 0) {
      setTitle(execution.title)
    }
  }
  const flushSummary = () => {
    const next = summary.trim()
    const current = execution.summary ?? ''
    if (next !== current) {
      void onSave({ summary: next.length > 0 ? next : null })
    }
  }
  const flushScheduled = () => {
    const next = scheduledFor || null
    const current = execution.scheduled_for ? execution.scheduled_for.slice(0, 10) : null
    if (next !== current) {
      void onSave({ scheduledFor: next })
    }
  }
  const flushAssigned = (value: string) => {
    setAssignedTo(value)
    const next = value || null
    if (next !== (execution.assigned_to ?? null)) {
      void onSave({ assignedTo: next })
    }
  }

  const addAttendee = () => {
    const name = attendeeDraft.trim()
    if (name.length === 0) return
    if (attendees.includes(name)) {
      setAttendeeDraft('')
      return
    }
    const next = [...attendees, name]
    setAttendees(next)
    setAttendeeDraft('')
    void onSave({ attendees: next })
  }
  const removeAttendee = (name: string) => {
    const next = attendees.filter((a) => a !== name)
    setAttendees(next)
    void onSave({ attendees: next })
  }

  const userOptions = [
    { value: '', label: 'Ikke tildelt' },
    ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
  ]

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Hoveddata</h2>
        {isSigned ? (
          <Badge variant="signed">Etterredigerbar etter signering</Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Tittel, sammendrag og deltakerliste kan endres når som helst — også etter at
        sjekklisten er signert. Selve svarene og malen forblir låst.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="exec-title">
            Tittel
          </label>
          <StandardInput
            id="exec-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={flushTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
          />
        </div>

        <div className="md:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="exec-summary">
            Sammendrag / beskrivelse
          </label>
          <StandardTextarea
            id="exec-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={flushSummary}
            rows={3}
            placeholder="Kort beskrivelse av runden, kontekst eller observasjoner i sammendrag."
          />
        </div>

        <div className="md:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL}>Deltakere</label>
          <p className="mb-2 text-xs text-neutral-500">
            Legg til navnet på alle som deltok. Lagres automatisk.
          </p>
          {attendees.length > 0 ? (
            <ul className="mb-2 flex flex-wrap gap-1.5">
              {attendees.map((name) => (
                <li
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-800"
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttendee(name)}
                    aria-label={`Fjern ${name}`}
                    className="text-neutral-400 hover:text-neutral-700"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap items-stretch gap-2">
            <StandardInput
              value={attendeeDraft}
              onChange={(e) => setAttendeeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAttendee()
                }
              }}
              placeholder="Skriv et navn og trykk Enter"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={addAttendee}
              disabled={attendeeDraft.trim().length === 0}
            >
              Legg til
            </Button>
          </div>
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="exec-scheduled">
            Planlagt
          </label>
          <StandardInput
            id="exec-scheduled"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            onBlur={flushScheduled}
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Tildelt</label>
          <SearchableSelect
            value={assignedTo}
            options={userOptions}
            onChange={flushAssigned}
          />
        </div>
      </div>
    </ModuleSectionCard>
  )
}

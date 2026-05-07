// Editable metadata for a single checklist execution.
//
// The panel always renders the universal fields (title, summary,
// scheduled, assigned). Template-declared metadata fields render in
// addition — the template decides which org-context (location /
// department / team / participants) and free-form (text / number /
// select) fields apply via its `metadata_schema`.
//
// All fields commit on field blur (or chip add/remove). The underlying
// mutation `updateExecutionMetadata` is allowed even when the execution
// is signed — the BEFORE UPDATE trigger only locks the canonical sign-
// state fields.

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type {
  DepartmentRow,
  LocationRow,
  OrganizationMemberRow,
  TeamRow,
} from '../../../src/types/organization'
import type {
  ComplianceAssignableUser,
  ComplianceExecutionRow,
  TemplateMetadataField,
  TemplateMetadataSchema,
} from '../types'

type SavePayload = {
  title?: string
  summary?: string | null
  attendees?: string[]
  assignedTo?: string | null
  scheduledFor?: string | null
  locationId?: string | null
  departmentId?: string | null
  teamId?: string | null
  participantMemberIds?: string[]
  metadata?: Record<string, unknown>
}

type Props = {
  execution: ComplianceExecutionRow
  /** Template's metadata_schema (drives the dynamic fields). */
  templateMetadataSchema: TemplateMetadataSchema | null
  assignableUsers: ComplianceAssignableUser[]
  locations: LocationRow[]
  departments: DepartmentRow[]
  teams: TeamRow[]
  members: OrganizationMemberRow[]
  onSave: (payload: SavePayload) => Promise<void> | void
}

const DEFAULT_LABELS: Record<TemplateMetadataField['kind'], string> = {
  location: 'Lokasjon',
  department: 'Avdeling',
  team: 'Team',
  participants: 'Deltakere',
  text: 'Tekst',
  number: 'Tall',
  select: 'Valg',
}

export function ExecutionMetadataPanel({
  execution,
  templateMetadataSchema,
  assignableUsers,
  locations,
  departments,
  teams,
  members,
  onSave,
}: Props) {
  const [title, setTitle] = useState(execution.title)
  const [summary, setSummary] = useState(execution.summary ?? '')
  const [attendees, setAttendees] = useState<string[]>(execution.attendees ?? [])
  const [attendeeDraft, setAttendeeDraft] = useState('')
  const [scheduledFor, setScheduledFor] = useState(
    execution.scheduled_for ? execution.scheduled_for.slice(0, 10) : '',
  )
  const [assignedTo, setAssignedTo] = useState<string>(execution.assigned_to ?? '')

  // Template-driven values — single state bag mirroring the row shape.
  const [locationId, setLocationId] = useState<string>(execution.location_id ?? '')
  const [departmentId, setDepartmentId] = useState<string>(execution.department_id ?? '')
  const [teamId, setTeamId] = useState<string>(execution.team_id ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(
    execution.participant_member_ids ?? [],
  )
  const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(
    execution.metadata ?? {},
  )

  // Reset local form state when the route switches to a different execution.
  const [lastId, setLastId] = useState(execution.id)
  if (lastId !== execution.id) {
    setLastId(execution.id)
    setTitle(execution.title)
    setSummary(execution.summary ?? '')
    setAttendees(execution.attendees ?? [])
    setScheduledFor(execution.scheduled_for ? execution.scheduled_for.slice(0, 10) : '')
    setAssignedTo(execution.assigned_to ?? '')
    setLocationId(execution.location_id ?? '')
    setDepartmentId(execution.department_id ?? '')
    setTeamId(execution.team_id ?? '')
    setParticipantIds(execution.participant_member_ids ?? [])
    setMetadataValues(execution.metadata ?? {})
  }

  const isSigned = execution.status === 'signed'

  // ── Universal field flushes ──────────────────────────────────────────────

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

  // ── Schema-driven field flushes ──────────────────────────────────────────

  const flushLocation = (value: string) => {
    setLocationId(value)
    const next = value || null
    if (next !== (execution.location_id ?? null)) void onSave({ locationId: next })
  }
  const flushDepartment = (value: string) => {
    setDepartmentId(value)
    const next = value || null
    if (next !== (execution.department_id ?? null)) void onSave({ departmentId: next })
  }
  const flushTeam = (value: string) => {
    setTeamId(value)
    const next = value || null
    if (next !== (execution.team_id ?? null)) void onSave({ teamId: next })
  }

  const toggleParticipant = (memberId: string, checked: boolean) => {
    const next = checked
      ? participantIds.includes(memberId)
        ? participantIds
        : [...participantIds, memberId]
      : participantIds.filter((id) => id !== memberId)
    setParticipantIds(next)
    void onSave({ participantMemberIds: next })
  }

  const flushMetadata = (key: string, value: unknown) => {
    const next = { ...metadataValues, [key]: value }
    setMetadataValues(next)
    void onSave({ metadata: next })
  }

  // ── Options ──────────────────────────────────────────────────────────────

  const userOptions = useMemo(
    () => [
      { value: '', label: 'Ikke tildelt' },
      ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
    ],
    [assignableUsers],
  )

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'Velg lokasjon …' },
      ...locations.map((l) => ({ value: l.id, label: l.name })),
    ],
    [locations],
  )
  const departmentOptions = useMemo(
    () => [
      { value: '', label: 'Velg avdeling …' },
      ...departments.map((d) => ({ value: d.id, label: d.name })),
    ],
    [departments],
  )
  const teamOptions = useMemo(
    () => [
      { value: '', label: 'Velg team …' },
      ...teams.map((t) => ({ value: t.id, label: t.name })),
    ],
    [teams],
  )

  const fields = templateMetadataSchema?.fields ?? []
  const memberById = useMemo(() => {
    const m = new Map<string, OrganizationMemberRow>()
    for (const x of members) m.set(x.id, x)
    return m
  }, [members])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">Hoveddata</h2>
        {isSigned ? (
          <Badge variant="signed">Etterredigerbar etter signering</Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Tittel, sammendrag og kontekst (lokasjon, deltakere mm.) kan endres når som
        helst — også etter at sjekklisten er signert. Selve svarene og malen forblir
        låst.
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

        {/* ── Schema-driven fields ────────────────────────────────────── */}
        {fields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          const id = `exec-md-${f.key}`

          if (f.kind === 'location') {
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <SearchableSelect
                  value={locationId}
                  options={locationOptions}
                  onChange={flushLocation}
                />
              </div>
            )
          }
          if (f.kind === 'department') {
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <SearchableSelect
                  value={departmentId}
                  options={departmentOptions}
                  onChange={flushDepartment}
                />
              </div>
            )
          }
          if (f.kind === 'team') {
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <SearchableSelect
                  value={teamId}
                  options={teamOptions}
                  onChange={flushTeam}
                />
              </div>
            )
          }
          if (f.kind === 'participants') {
            const sorted = [...members].sort((a, b) =>
              a.display_name.localeCompare(b.display_name, 'nb'),
            )
            return (
              <div key={f.key} className="md:col-span-2">
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? (
                  <p className="mb-1 text-xs text-neutral-500">{f.help}</p>
                ) : (
                  <p className="mb-1 text-xs text-neutral-500">
                    Velg organisasjonsmedlemmer som deltok. Eksterne deltakere kan legges
                    til som fritekst lengre ned.
                  </p>
                )}
                {participantIds.length > 0 ? (
                  <ul className="mb-2 flex flex-wrap gap-1.5">
                    {participantIds.map((mid) => {
                      const m = memberById.get(mid)
                      return (
                        <li
                          key={mid}
                          className="inline-flex items-center gap-1 rounded-full border border-[#1a3d32]/20 bg-[#1a3d32]/5 px-2.5 py-1 text-xs font-medium text-[#1a3d32]"
                        >
                          <span>{m?.display_name ?? '(ukjent)'}</span>
                          <button
                            type="button"
                            onClick={() => toggleParticipant(mid, false)}
                            aria-label={`Fjern ${m?.display_name ?? mid}`}
                            className="text-[#1a3d32]/70 hover:text-[#1a3d32]"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                <details className="rounded-md border border-neutral-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-neutral-700">
                    Legg til deltakere
                  </summary>
                  <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-neutral-100 p-2">
                    {sorted.length === 0 ? (
                      <li className="px-2 py-1 text-xs text-neutral-500">
                        Ingen organisasjonsmedlemmer registrert ennå.
                      </li>
                    ) : (
                      sorted.map((m) => {
                        const checked = participantIds.includes(m.id)
                        return (
                          <li key={m.id}>
                            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-neutral-50">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleParticipant(m.id, e.target.checked)}
                              />
                              <span>{m.display_name}</span>
                              {m.email ? (
                                <span className="text-xs text-neutral-500">· {m.email}</span>
                              ) : null}
                            </label>
                          </li>
                        )
                      })
                    )}
                  </ul>
                </details>
              </div>
            )
          }

          // Free-form kinds. Persist into the metadata jsonb under `key`.
          const value = metadataValues[f.key]
          if (f.kind === 'text') {
            return (
              <div key={f.key} className="md:col-span-2">
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={id}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <StandardInput
                  id={id}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) =>
                    setMetadataValues({ ...metadataValues, [f.key]: e.target.value })
                  }
                  onBlur={(e) => flushMetadata(f.key, e.target.value)}
                />
              </div>
            )
          }
          if (f.kind === 'number') {
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={id}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <StandardInput
                  id={id}
                  type="number"
                  value={typeof value === 'number' ? String(value) : ''}
                  onChange={(e) =>
                    setMetadataValues({
                      ...metadataValues,
                      [f.key]: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    flushMetadata(f.key, v)
                  }}
                />
              </div>
            )
          }
          if (f.kind === 'select') {
            const options = [
              { value: '', label: '—' },
              ...(f.options ?? []).map((o) => ({ value: o.id, label: o.label })),
            ]
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <SearchableSelect
                  value={typeof value === 'string' ? value : ''}
                  options={options}
                  onChange={(v) => flushMetadata(f.key, v || null)}
                />
              </div>
            )
          }
          return null
        })}

        {/* ── Free-form attendees (always available) ──────────────────── */}
        <div className="md:col-span-2">
          <label className={WPSTD_FORM_FIELD_LABEL}>Eksterne deltakere (fritekst)</label>
          <p className="mb-2 text-xs text-neutral-500">
            Bruk denne for personer som ikke er registrert som
            organisasjonsmedlemmer (besøkende revisor, ekstern verneombud osv.).
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
      </div>
    </ModuleSectionCard>
  )
}

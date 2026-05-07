// SurveyMetadataPanel — schema-driven metadata editor for a survey
// instance. Mirrors compliance/components/ExecutionMetadataPanel.tsx
// but adapted to the survey domain:
//   - "lock" event is publish/close, not sign — and the surveys row
//     itself stays mutable post-publish, so we don't need to gate
//     edits on status.
//   - is_anonymous suppresses the participants picker (recording
//     attendees on an anonymous survey defeats anonymity).
//
// Reads template?.metadataSchema.fields and renders the matching
// kind controls. Edits flush on field blur via the supplied onSave
// callback (typically wired to useSurvey.updateSurvey).

import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
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
  SurveyRow,
  TemplateMetadataField,
  TemplateMetadataSchema,
} from '../types'

type SavePayload = {
  title?: string
  description?: string | null
  location_id?: string | null
  department_id?: string | null
  team_id?: string | null
  participant_member_ids?: string[]
  metadata?: Record<string, unknown>
}

type Props = {
  survey: SurveyRow
  templateMetadataSchema: TemplateMetadataSchema | null
  locations: LocationRow[]
  departments: DepartmentRow[]
  teams: TeamRow[]
  members: OrganizationMemberRow[]
  onSave: (payload: SavePayload) => Promise<void> | void
  /**
   * Skip rendering title + description (host page already has them).
   * Defaults to false; SurveyDetailView passes true to avoid duplicate
   * editors for the same DB columns.
   */
  hideUniversalFields?: boolean
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

export function SurveyMetadataPanel({
  survey,
  templateMetadataSchema,
  locations,
  departments,
  teams,
  members,
  onSave,
  hideUniversalFields = false,
}: Props) {
  const [title, setTitle] = useState(survey.title)
  const [description, setDescription] = useState(survey.description ?? '')
  const [locationId, setLocationId] = useState<string>(survey.location_id ?? '')
  const [departmentId, setDepartmentId] = useState<string>(survey.department_id ?? '')
  const [teamId, setTeamId] = useState<string>(survey.team_id ?? '')
  const [participantIds, setParticipantIds] = useState<string[]>(
    survey.participant_member_ids ?? [],
  )
  const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(
    survey.metadata ?? {},
  )

  // Reset on survey id change.
  const [lastId, setLastId] = useState(survey.id)
  if (lastId !== survey.id) {
    setLastId(survey.id)
    setTitle(survey.title)
    setDescription(survey.description ?? '')
    setLocationId(survey.location_id ?? '')
    setDepartmentId(survey.department_id ?? '')
    setTeamId(survey.team_id ?? '')
    setParticipantIds(survey.participant_member_ids ?? [])
    setMetadataValues(survey.metadata ?? {})
  }

  const isClosed = survey.status === 'closed' || survey.status === 'archived'

  const flushTitle = () => {
    const next = title.trim()
    if (next.length > 0 && next !== survey.title) {
      void onSave({ title: next })
    } else if (next.length === 0) {
      setTitle(survey.title)
    }
  }
  const flushDescription = () => {
    const next = description.trim()
    const current = survey.description ?? ''
    if (next !== current) {
      void onSave({ description: next.length > 0 ? next : null })
    }
  }
  const flushLocation = (value: string) => {
    setLocationId(value)
    const next = value || null
    if (next !== (survey.location_id ?? null)) void onSave({ location_id: next })
  }
  const flushDepartment = (value: string) => {
    setDepartmentId(value)
    const next = value || null
    if (next !== (survey.department_id ?? null)) void onSave({ department_id: next })
  }
  const flushTeam = (value: string) => {
    setTeamId(value)
    const next = value || null
    if (next !== (survey.team_id ?? null)) void onSave({ team_id: next })
  }
  const toggleParticipant = (memberId: string, checked: boolean) => {
    const next = checked
      ? participantIds.includes(memberId)
        ? participantIds
        : [...participantIds, memberId]
      : participantIds.filter((id) => id !== memberId)
    setParticipantIds(next)
    void onSave({ participant_member_ids: next })
  }
  const flushMetadata = (key: string, value: unknown) => {
    const next = { ...metadataValues, [key]: value }
    setMetadataValues(next)
    void onSave({ metadata: next })
  }

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
        {isClosed ? (
          <Badge variant="signed">Etterredigerbar etter lukking</Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Tittel, beskrivelse og kontekst (lokasjon, deltakere mm.) kan endres når som
        helst — også etter at undersøkelsen er publisert eller lukket. Selve
        spørsmålene låses ved publisering for compliance- og leverandørpakker.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {!hideUniversalFields ? (
          <>
            <div className="md:col-span-2">
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-title">
                Tittel
              </label>
              <StandardInput
                id="survey-title"
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
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="survey-description">
                Beskrivelse
              </label>
              <StandardTextarea
                id="survey-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={flushDescription}
                rows={3}
                placeholder="Kort introduksjon til undersøkelsen, kontekst eller bakgrunn."
              />
            </div>
          </>
        ) : null}

        {/* ── Schema-driven fields ────────────────────────────────────── */}
        {fields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          const id = `survey-md-${f.key}`

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
            // Anonymous surveys deliberately suppress the participants
            // picker — even if the template asks for it, recording
            // attendees would defeat the anonymity guarantee.
            if (survey.is_anonymous) {
              return (
                <div key={f.key} className="md:col-span-2">
                  <label className={WPSTD_FORM_FIELD_LABEL}>
                    {label} <Badge variant="warning">Skjult — anonym undersøkelse</Badge>
                  </label>
                  <p className="mt-1 text-xs text-neutral-500">
                    Malen ber om deltakere, men undersøkelsen er anonym.
                    Slå av anonymitet hvis du må registrere deltakerne.
                  </p>
                </div>
              )
            }
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
                    Velg organisasjonsmedlemmer som deltar i undersøkelsen.
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

          // Free-form kinds — persist into surveys.metadata under `key`.
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
      </div>
    </ModuleSectionCard>
  )
}


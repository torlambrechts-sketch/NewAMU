import { useMemo, useState } from 'react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import type { AmuMeeting } from '../types'
import type { AmuHook } from './types'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

function StatusBadge({ status, isNext }: { status: AmuMeeting['status']; isNext: boolean }) {
  if (status === 'signed') return <Badge variant="success">Signert</Badge>
  if (status === 'completed') return <Badge variant="neutral">Fullført</Badge>
  if (status === 'in_progress') return <Badge variant="warning">Pågår nå</Badge>
  if (isNext) return <Badge variant="info">Neste</Badge>
  return <Badge variant="neutral">Berammet</Badge>
}

function missingQ4(meetings: AmuMeeting[]): boolean {
  return !meetings.some((m) => {
    const d = new Date(m.scheduled_at)
    return d.getMonth() >= 9
  })
}

export function ScheduleTab({ amu }: { amu: AmuHook }) {
  const currentYear = new Date().getFullYear()
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false)
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [proposalText, setProposalText] = useState('')
  const [targetMeetingId, setTargetMeetingId] = useState('')

  const yearMeetings = useMemo(
    () => amu.meetings.filter((m) => m.year === currentYear).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [amu.meetings, currentYear],
  )

  const pastMeetings = useMemo(
    () => amu.meetings.filter((m) => m.status === 'signed').sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)),
    [amu.meetings],
  )

  const upcomingMeetings = useMemo(
    () => yearMeetings.filter((m) => m.status === 'scheduled' || m.status === 'draft'),
    [yearMeetings],
  )

  const handleSchedule = async () => {
    const iso = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString()
    await amu.scheduleMeeting({
      title: title.trim() || 'AMU-møte',
      scheduled_at: iso,
      location: location.trim() || '',
      committee_id: amu.committee?.id,
    })
    setShowNewMeetingForm(false)
    setTitle('')
    setScheduledAt('')
    setLocation('')
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      <ModuleSectionCard className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">Møteplan {currentYear}</h2>
          {amu.canManage ? (
            <Button variant="primary" size="sm" type="button" onClick={() => setShowNewMeetingForm(true)}>
              Beram møte
            </Button>
          ) : null}
        </div>

        {showNewMeetingForm && amu.canManage ? (
          <div className="mb-4 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-600">Tittel</p>
              <StandardInput value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-600">Dato og tid</p>
              <StandardInput type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-600">Sted</p>
              <StandardInput value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setShowNewMeetingForm(false)}>
                Avbryt
              </Button>
              <Button variant="primary" type="button" onClick={() => void handleSchedule()}>
                Beram
              </Button>
            </div>
          </div>
        ) : null}

        {yearMeetings.length < (amu.committee?.min_meetings_per_year ?? 4) ? (
          <div className="mb-4 flex flex-wrap items-center gap-4 rounded border-l-4 border-l-red-500 bg-red-50/30 py-3 pl-3">
            <Badge variant="danger">Lovkrav</Badge>
            <span className="flex-1 text-sm text-neutral-800">
              Mangler {(amu.committee?.min_meetings_per_year ?? 4) - yearMeetings.length} møte(r) for å oppfylle AML §
              7-2
            </span>
            {amu.canManage ? (
              <Button variant="primary" size="sm" type="button" onClick={() => setShowNewMeetingForm(true)}>
                Beram nå
              </Button>
            ) : null}
          </div>
        ) : null}

        {yearMeetings.map((m, i) => {
          const isNext =
            (m.status === 'scheduled' || m.status === 'draft') &&
            !yearMeetings.slice(0, i).some((prev) => prev.status === 'scheduled' || prev.status === 'draft')
          const q4miss = missingQ4(yearMeetings) && m === yearMeetings[yearMeetings.length - 1]
          return (
            <div
              key={m.id}
              className={`flex flex-wrap items-start gap-4 border-b border-neutral-100 py-3 last:border-0 ${
                q4miss ? 'border-l-4 border-l-red-500 pl-3' : ''
              }`}
            >
              <div
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  isNext ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700'
                }`}
              >
                {formatDate(m.scheduled_at)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-neutral-900">{m.title}</span>
                  <StatusBadge status={m.status} isNext={isNext} />
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {m.location ?? '—'} {m.is_hybrid ? '· Hybrid' : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" type="button">
                {m.status === 'signed' ? 'Se referat' : 'Åpne'}
              </Button>
            </div>
          )
        })}
      </ModuleSectionCard>

      <div className="space-y-4">
        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Tidligere møter</h2>
          {pastMeetings.length === 0 ? (
            <p className="text-sm text-neutral-500">Ingen signerte møter ennå.</p>
          ) : (
            pastMeetings.map((m) => (
              <div key={m.id} className="flex items-center gap-2 border-b border-neutral-100 py-2 last:border-0">
                <span className="flex-1 text-sm text-neutral-800">{m.title}</span>
                <span className="text-xs text-neutral-400">{formatDate(m.scheduled_at)}</span>
                <Button variant="ghost" size="sm" type="button">
                  Se →
                </Button>
              </div>
            ))
          )}
        </ModuleSectionCard>

        <ModuleSectionCard className="p-5">
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Foreslå sak til neste møte</h2>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-neutral-600">Beskrivelse av saken</p>
            <StandardTextarea rows={3} value={proposalText} onChange={(e) => setProposalText(e.target.value)} />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold text-neutral-600">Målmøte (valgfritt)</p>
            <SearchableSelect
              value={targetMeetingId}
              options={[
                { value: '', label: 'Ingen målmøte' },
                ...upcomingMeetings.map((m) => ({ value: m.id, label: m.title })),
              ]}
              onChange={setTargetMeetingId}
              placeholder="Velg møte…"
            />
          </div>
          <Button
            variant="primary"
            className="mt-3 w-full"
            type="button"
            disabled={!proposalText.trim()}
            onClick={() => void amu.proposeTopic(proposalText, targetMeetingId || undefined).then(() => {
              setProposalText('')
              setTargetMeetingId('')
            })}
          >
            Send forslag
          </Button>
        </ModuleSectionCard>
      </div>
    </div>
  )
}

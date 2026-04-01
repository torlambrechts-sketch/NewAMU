import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Gavel,
  Plus,
  Users,
  Vote,
} from 'lucide-react'
import { useCouncil } from '../hooks/useCouncil'
import type { BoardRole, CouncilMeeting, Election } from '../types/council'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: ClipboardList },
  { id: 'board' as const, label: 'Styre og valg', icon: Users },
  { id: 'meetings' as const, label: 'Møter', icon: Calendar },
  { id: 'compliance' as const, label: 'Arbeidsrett og sjekkliste', icon: Gavel },
]

function roleLabel(r: BoardRole) {
  switch (r) {
    case 'leader':
      return 'Leder'
    case 'deputy':
      return 'Nestleder'
    default:
      return 'Medlem'
  }
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function CouncilModule() {
  const council = useCouncil()
  const [tab, setTab] = useState<(typeof tabs)[number]['id']>('overview')
  const [newElectionTitle, setNewElectionTitle] = useState('')
  const [candidateInputs, setCandidateInputs] = useState<Record<string, string>>({})
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    startsAt: '',
    location: '',
    agenda: '',
  })
  const [customItem, setCustomItem] = useState({ title: '', description: '', lawRef: '' })

  const complianceProgress = useMemo(() => {
    const total = council.compliance.length
    const done = council.compliance.filter((c) => c.done).length
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [council.compliance])

  const upcomingMeetings = useMemo(() => {
    return [...council.meetings]
      .filter((m) => m.status === 'planned')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }, [council.meetings])

  function handleNewElection(e: React.FormEvent) {
    e.preventDefault()
    if (!newElectionTitle.trim()) return
    council.addElection(newElectionTitle.trim())
    setNewElectionTitle('')
  }

  function handleAddMeeting(e: React.FormEvent) {
    e.preventDefault()
    if (!meetingForm.title.trim() || !meetingForm.startsAt) return
    council.addMeeting({
      title: meetingForm.title.trim(),
      startsAt: new Date(meetingForm.startsAt).toISOString(),
      location: meetingForm.location.trim() || 'TBD',
      agenda: meetingForm.agenda.trim() || '—',
    })
    setMeetingForm({ title: '', startsAt: '', location: '', agenda: '' })
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <span>
          <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
            Prosjekter
          </Link>
          <span className="mx-2 text-neutral-400">→</span>
          <span className="font-medium text-neutral-800">Arbeidsmiljøråd</span>
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div className="min-w-0">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Arbeidsmiljøråd
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Styre, valg, møter og sjekkliste med utgangspunkt i tema fra norsk arbeidsmiljølovgivning.
            Dette er et arbeidsverktøy — verifiser alltid mot gjeldende regelverk og avtaler.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#1a3d32] text-white shadow-sm'
                    : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Status</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{council.board.length}</div>
                <div className="text-sm text-neutral-600">Styremedlemmer</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">
                  {council.elections.filter((e) => e.status === 'open').length}
                </div>
                <div className="text-sm text-neutral-600">Åpne valg</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{complianceProgress.pct}%</div>
                <div className="text-sm text-neutral-600">Sjekkliste fullført</div>
              </div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full bg-[#c9a227] transition-all"
                style={{ width: `${complianceProgress.pct}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              {complianceProgress.done} av {complianceProgress.total} punkter i samsvarssjekken er markert som
              oppfylt.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Neste møte</h2>
            {upcomingMeetings[0] ? (
              <div className="mt-3 text-sm">
                <div className="font-medium text-neutral-900">{upcomingMeetings[0].title}</div>
                <div className="mt-1 text-neutral-600">{formatWhen(upcomingMeetings[0].startsAt)}</div>
                <div className="mt-1 text-neutral-500">{upcomingMeetings[0].location}</div>
                <button
                  type="button"
                  onClick={() => setTab('meetings')}
                  className="mt-4 text-sm font-medium text-[#1a3d32] underline-offset-2 hover:underline"
                >
                  Se alle møter
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Ingen planlagte møter. Legg til under «Møter».</p>
            )}
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Valgt styre</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Ved avsluttet valg oppdateres styret med de tre kandidatene med flest stemmer (leder, nestleder,
              medlem).
            </p>
            <ul className="mt-4 divide-y divide-neutral-100">
              {council.board.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#1a3d32] text-sm font-semibold text-white">
                    {m.name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-neutral-900">{m.name}</div>
                    <div className="text-xs text-neutral-500">
                      {roleLabel(m.role)}
                      {m.termUntil ? ` · Periode til ${m.termUntil}` : ''}
                    </div>
                  </div>
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Nytt valg</h2>
            <form onSubmit={handleNewElection} className="mt-4 flex flex-wrap gap-2">
              <input
                value={newElectionTitle}
                onChange={(e) => setNewElectionTitle(e.target.value)}
                placeholder="Valg tittel"
                className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                <Plus className="size-4" />
                Opprett
              </button>
            </form>

            <div className="mt-8 space-y-6">
              {council.elections.map((el) => (
                <ElectionCard
                  key={el.id}
                  election={el}
                  candidateDraft={candidateInputs[el.id] ?? ''}
                  setCandidateDraft={(v) => setCandidateInputs((s) => ({ ...s, [el.id]: v }))}
                  onAddCandidate={() => {
                    const name = (candidateInputs[el.id] ?? '').trim()
                    if (!name) return
                    council.addCandidate(el.id, name)
                    setCandidateInputs((s) => ({ ...s, [el.id]: '' }))
                  }}
                  onVote={(cid) => council.vote(el.id, cid)}
                  onClose={() => council.closeElection(el.id)}
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'meetings' && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
          <form
            onSubmit={handleAddMeeting}
            className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold text-neutral-900">Planlegg møte</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-500">Tittel</label>
                <input
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm((s) => ({ ...s, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Starttid</label>
                <input
                  type="datetime-local"
                  value={meetingForm.startsAt}
                  onChange={(e) => setMeetingForm((s) => ({ ...s, startsAt: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Sted / lenke</label>
                <input
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm((s) => ({ ...s, location: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Agenda</label>
                <textarea
                  value={meetingForm.agenda}
                  onChange={(e) => setMeetingForm((s) => ({ ...s, agenda: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              <Calendar className="size-4" />
              Legg til møte
            </button>
          </form>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Møteoversikt</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {council.meetings.map((m) => (
                <MeetingRow key={m.id} meeting={m} onUpdate={council.updateMeeting} />
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            <strong>Merk:</strong> Sjekklisten er et strukturert utgangspunkt knyttet til typiske krav i norsk
            arbeidsliv. Den erstatter ikke juridisk bistand — kontroller alltid mot{' '}
            <a
              href="https://lovdata.no"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#1a3d32] underline"
            >
              lovdata.no
            </a>{' '}
            og gjeldende tariff- og bedriftsavtaler.
          </div>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Egne punkter</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                council.addComplianceItem(customItem.title, customItem.description, customItem.lawRef)
                setCustomItem({ title: '', description: '', lawRef: '' })
              }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                placeholder="Tittel"
                value={customItem.title}
                onChange={(e) => setCustomItem((s) => ({ ...s, title: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
                required
              />
              <input
                placeholder="Henvisning (lov / avtale)"
                value={customItem.lawRef}
                onChange={(e) => setCustomItem((s) => ({ ...s, lawRef: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                placeholder="Beskrivelse"
                value={customItem.description}
                onChange={(e) => setCustomItem((s) => ({ ...s, description: e.target.value }))}
                rows={2}
                className="resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] sm:col-span-2 sm:justify-self-start"
              >
                Legg til punkt
              </button>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50/80 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Krav og oppgaver</h2>
            </div>
            <ul className="divide-y divide-neutral-100">
              {council.compliance.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
                  <label className="flex cursor-pointer items-start gap-3 sm:min-w-0 sm:flex-1">
                    <input
                      type="checkbox"
                      checked={c.done}
                      onChange={() => council.toggleCompliance(c.id)}
                      className="mt-1 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                    />
                    <span className="min-w-0">
                      <span className="font-medium text-neutral-900">{c.title}</span>
                      {c.isCustom ? (
                        <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                          Egendefinert
                        </span>
                      ) : null}
                      <span className="mt-1 block text-sm text-neutral-600">{c.description}</span>
                      <span className="mt-1 block text-xs text-[#1a3d32]/90">{c.lawRef}</span>
                    </span>
                  </label>
                  <textarea
                    placeholder="Notater (bevis, referat, ansvarlig …)"
                    value={c.notes ?? ''}
                    onChange={(e) => council.setComplianceNotes(c.id, e.target.value)}
                    rows={2}
                    className="w-full min-w-[200px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm sm:max-w-md"
                  />
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (confirm('Tilbakestill alle rådsdata til demo?')) council.resetToDemoData()
              }}
              className="text-sm text-neutral-500 underline-offset-2 hover:text-neutral-800 hover:underline"
            >
              Tilbakestill demodata
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ElectionCard({
  election,
  candidateDraft,
  setCandidateDraft,
  onAddCandidate,
  onVote,
  onClose,
}: {
  election: Election
  candidateDraft: string
  setCandidateDraft: (v: string) => void
  onAddCandidate: () => void
  onVote: (candidateId: string) => void
  onClose: () => void
}) {
  const open = election.status === 'open'
  return (
    <div className="rounded-xl border border-neutral-200 bg-[#faf8f4] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{election.title}</h3>
          <p className="text-xs text-neutral-500">
            {open ? 'Åpent valg' : 'Avsluttet'}
            {election.closedAt ? ` · ${formatWhen(election.closedAt)}` : ''}
          </p>
        </div>
        {open ? (
          <button
            type="button"
            onClick={onClose}
            disabled={election.candidates.length === 0}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
          >
            <Vote className="size-3.5" />
            Avslutt og oppdater styre
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={candidateDraft}
            onChange={(e) => setCandidateDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddCandidate())}
            placeholder="Ny kandidat"
            className="min-w-[160px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={onAddCandidate}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-neutral-200 hover:bg-neutral-50"
          >
            Legg til
          </button>
        </div>
      ) : null}
      <ul className="mt-3 space-y-2">
        {election.candidates.length === 0 ? (
          <li className="text-sm text-neutral-500">Ingen kandidater ennå.</li>
        ) : (
          election.candidates
            .slice()
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-neutral-100"
              >
                <span className="font-medium text-neutral-900">{c.name}</span>
                <span className="text-neutral-600">{c.voteCount} stemmer</span>
                {open ? (
                  <button
                    type="button"
                    onClick={() => onVote(c.id)}
                    className="shrink-0 rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26]"
                  >
                    Stem
                  </button>
                ) : election.winnerCandidateId === c.id ? (
                  <span className="text-xs font-medium text-emerald-700">Vinner</span>
                ) : null}
              </li>
            ))
        )}
      </ul>
    </div>
  )
}

function MeetingRow({
  meeting,
  onUpdate,
}: {
  meeting: CouncilMeeting
  onUpdate: (id: string, patch: Partial<CouncilMeeting>) => void
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-neutral-900">{meeting.title}</div>
          <div className="text-sm text-neutral-600">{formatWhen(meeting.startsAt)}</div>
          <div className="text-sm text-neutral-500">{meeting.location}</div>
        </div>
        <select
          value={meeting.status}
          onChange={(e) =>
            onUpdate(meeting.id, { status: e.target.value as CouncilMeeting['status'] })
          }
          className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium"
        >
          <option value="planned">Planlagt</option>
          <option value="completed">Gjennomført</option>
          <option value="cancelled">Avlyst</option>
        </select>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{meeting.agenda}</p>
      <label className="mt-2 block text-xs font-medium text-neutral-500">Protokoll / notater</label>
      <textarea
        value={meeting.minutes ?? ''}
        onChange={(e) => onUpdate(meeting.id, { minutes: e.target.value })}
        rows={2}
        className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        placeholder="Skriv referat etter møtet …"
      />
    </div>
  )
}

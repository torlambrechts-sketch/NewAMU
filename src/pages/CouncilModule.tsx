import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  Link2,
  ListOrdered,
  MoreHorizontal,
  Plus,
  Scale,
  ScrollText,
  Users,
  Vote,
} from 'lucide-react'
import { ModulePageIcon } from '../components/ModulePageIcon'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { GovernanceWheel } from '../components/council/GovernanceWheel'
import { MEETINGS_PER_YEAR, suggestedAgendaItems } from '../data/meetingGovernance'
import { useCouncil } from '../hooks/useCouncil'
import { avatarUrlFromSeed } from '../lib/avatarUrl'
import type {
  AgendaItem,
  AuditEntryKind,
  BoardRole,
  CouncilMeeting,
  Election,
  QuarterSlot,
} from '../types/council'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: ClipboardList },
  { id: 'board' as const, label: 'Styre og valg', icon: Users },
  { id: 'meetings' as const, label: 'Møter og årshjul', icon: Calendar },
  { id: 'preparation' as const, label: 'Møteforberedelse', icon: FileText },
  { id: 'compliance' as const, label: 'Arbeidsrett og sjekkliste', icon: Gavel },
]

const tabBlurbs: Record<(typeof tabs)[number]['id'], { kicker: string; description: string }> = {
  overview: {
    kicker: 'Status og fremdrift',
    description:
      'Oversikt over styret, åpne valg og samsvar. Bruk fanene over eller sekundærmenyen for detaljer.',
  },
  board: {
    kicker: 'Styre og valg',
    description: 'Valgt arbeidsmiljøråd og interne valg til roller. Oppdateres når et valg avsluttes.',
  },
  meetings: {
    kicker: 'Årshjul og møter',
    description: 'Planlegg ordinære møter, agenda og protokoll — knyttet til kvartal og AML-forventninger.',
  },
  preparation: {
    kicker: 'Forberedelse',
    description: 'Sjekkliste og notater før neste møte — samme innhold som når møtet er valgt under «Møter».',
  },
  compliance: {
    kicker: 'Samsvar og oppgaver',
    description: 'Strukturert sjekkliste med henvisninger; legg til egne punkter og send oppfølging til oppgaver.',
  },
}

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
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  type TabId = (typeof tabs)[number]['id']
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'

  const setTab = (id: TabId) => {
    setSearchParams({ tab: id }, { replace: true })
  }
  const [wheelYear, setWheelYear] = useState(() => new Date().getFullYear())
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [prepMeetingId, setPrepMeetingId] = useState<string | null>(null)
  const [newElectionTitle, setNewElectionTitle] = useState('')
  const [candidateInputs, setCandidateInputs] = useState<Record<string, string>>({})
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    startsAt: '',
    location: '',
    governanceYear: new Date().getFullYear(),
    quarterSlot: 1 as QuarterSlot,
    applySuggestedAgenda: true,
    agendaText: '',
  })
  const [customItem, setCustomItem] = useState({ title: '', description: '', lawRef: '' })
  const [auditDraft, setAuditDraft] = useState({ kind: 'note' as AuditEntryKind, text: '', author: '' })

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

  const meetingsThisYear = useMemo(() => {
    return council.meetings.filter(
      (m) => m.governanceYear === wheelYear && m.status !== 'cancelled',
    ).length
  }, [council.meetings, wheelYear])

  const prepMeeting = useMemo(() => {
    const list = council.meetings.filter((m) => m.status === 'planned')
    const byId = prepMeetingId ? list.find((m) => m.id === prepMeetingId) : null
    if (byId) return byId
    const next = [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    return next ?? null
  }, [council.meetings, prepMeetingId])

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
      governanceYear: meetingForm.governanceYear,
      quarterSlot: meetingForm.quarterSlot,
      applySuggestedAgenda: meetingForm.applySuggestedAgenda,
      agendaText: meetingForm.applySuggestedAgenda ? undefined : meetingForm.agendaText,
    })
    setMeetingForm((s) => ({
      ...s,
      title: '',
      startsAt: '',
      location: '',
      agendaText: '',
    }))
  }

  const selectedMeeting = selectedMeetingId
    ? council.meetings.find((m) => m.id === selectedMeetingId)
    : null

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

      <div className="flex flex-wrap items-start gap-4 border-b border-neutral-200/80 pb-6">
        <ModulePageIcon className="bg-gradient-to-br from-[#1a3d32] to-[#0f241d] text-[#c9a227] shadow-md ring-2 ring-[#c9a227]/30">
          <Scale className="size-10 md:size-11" strokeWidth={1.5} aria-hidden />
        </ModulePageIcon>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-2xl font-semibold text-neutral-900 md:text-3xl"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Arbeidsmiljøråd
            </h1>
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden />
            <button type="button" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100">
              <Link2 className="size-5" />
            </button>
            <button type="button" className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100">
              <MoreHorizontal className="size-5" />
            </button>
          </div>
          <p className="mt-1 text-sm font-medium text-[#1a3d32]/90">{tabBlurbs[tab].kicker}</p>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">
            Styre, valg, årshjul med {MEETINGS_PER_YEAR} ordinære møter per år, agenda, forberedelse og revisjonslogg.{' '}
            {tabBlurbs[tab].description} Verktøyet erstatter ikke juridisk rådgivning.
          </p>
          {council.board.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Styre / team</p>
              <div className="mt-2 flex flex-wrap gap-4">
                {council.board.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <img
                      src={avatarUrlFromSeed(m.id + m.name, 40)}
                      alt=""
                      className="size-10 rounded-full ring-2 ring-white shadow-sm"
                    />
                    <span className="text-sm font-medium text-neutral-800">{m.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
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
            <p className="mt-4 text-sm text-neutral-600">
              Registrerte ordinære møter i {wheelYear}: <strong>{meetingsThisYear}</strong> / {MEETINGS_PER_YEAR}{' '}
              (justér år under «Møter og årshjul»).
            </p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-200">
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
                  onClick={() => {
                    setTab('meetings')
                    setSelectedMeetingId(upcomingMeetings[0].id)
                  }}
                  className="mt-4 text-sm font-medium text-[#1a3d32] underline-offset-2 hover:underline"
                >
                  Åpne detaljer
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Ingen planlagte møter.</p>
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
            <ul className="mt-4 divide-y divide-emerald-100/80">
              {council.board.map((m, i) => (
                <li
                  key={m.id}
                  className={`flex items-center gap-3 py-3 first:pt-0 ${i % 2 === 0 ? 'bg-emerald-50/40' : 'bg-white'}`}
                >
                  <img
                    src={avatarUrlFromSeed(m.id + m.name, 88)}
                    alt=""
                    className="size-11 shrink-0 rounded-full ring-2 ring-[#1a3d32]/15 object-cover"
                  />
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
        <div className="mt-8 space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-neutral-600">
                År for årshjul
                <input
                  type="number"
                  value={wheelYear}
                  onChange={(e) => setWheelYear(Number(e.target.value) || new Date().getFullYear())}
                  className="ml-2 w-24 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
                />
              </label>
            </div>
          </div>

          <GovernanceWheel
            year={wheelYear}
            meetings={council.meetings}
            onQuarterClick={(q) => setMeetingForm((s) => ({ ...s, quarterSlot: q }))}
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
            <form
              onSubmit={handleAddMeeting}
              className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-neutral-900">Nytt møte</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Knytt møtet til et kvartal i årshjulet og velg foreslått agenda (kan redigeres etterpå).
              </p>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Kalenderår</label>
                    <input
                      type="number"
                      value={meetingForm.governanceYear}
                      onChange={(e) =>
                        setMeetingForm((s) => ({
                          ...s,
                          governanceYear: Number(e.target.value) || wheelYear,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Kvartal</label>
                    <select
                      value={meetingForm.quarterSlot}
                      onChange={(e) =>
                        setMeetingForm((s) => ({
                          ...s,
                          quarterSlot: Number(e.target.value) as QuarterSlot,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                    >
                      <option value={1}>Q1</option>
                      <option value={2}>Q2</option>
                      <option value={3}>Q3</option>
                      <option value={4}>Q4</option>
                    </select>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                  <input
                    type="checkbox"
                    checked={meetingForm.applySuggestedAgenda}
                    onChange={(e) =>
                      setMeetingForm((s) => ({ ...s, applySuggestedAgenda: e.target.checked }))
                    }
                    className="rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                  />
                  Bruk foreslått agenda for valgt kvartal
                </label>
                {!meetingForm.applySuggestedAgenda ? (
                  <div>
                    <label className="text-xs font-medium text-neutral-500">Agenda (én linje per punkt)</label>
                    <textarea
                      value={meetingForm.agendaText}
                      onChange={(e) => setMeetingForm((s) => ({ ...s, agendaText: e.target.value }))}
                      rows={4}
                      className="mt-1 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      placeholder="1. Åpning&#10;2. …"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#faf8f4] p-3 text-xs text-neutral-700">
                    <strong>Forslag for Q{meetingForm.quarterSlot}:</strong>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {suggestedAgendaItems(meetingForm.quarterSlot).map((s) => (
                        <li key={s.title}>{s.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1a3d32] py-2.5 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                <Calendar className="size-4" />
                Legg til møte
              </button>
            </form>

            <div className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-[#1a3d32]/15 bg-white shadow-sm">
                <div className="border-b border-[#1a3d32]/20 bg-gradient-to-r from-[#1a3d32] to-[#234d42] px-4 py-3">
                  <h2 className="font-semibold text-white">Alle møter</h2>
                </div>
                <div className="overflow-x-auto">
                  {council.meetings.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen møter ennå.</p>
                  ) : (
                    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-amber-200/60 bg-amber-50/90 text-xs font-semibold uppercase tracking-wide text-[#1a3d32]/90">
                          <th className="px-4 py-2.5">Møte</th>
                          <th className="px-4 py-2.5">Tid</th>
                          <th className="px-4 py-2.5">År / kv.</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {council.meetings.map((m, rowIdx) => {
                          const sel = selectedMeetingId === m.id
                          const statusStyle =
                            m.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-900'
                              : m.status === 'cancelled'
                                ? 'bg-neutral-200 text-neutral-700'
                                : 'bg-sky-100 text-sky-900'
                          return (
                            <tr
                              key={m.id}
                              className={`border-b border-neutral-100 transition-colors hover:bg-emerald-50/70 ${
                                sel ? 'bg-[#c9a227]/12' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-[#faf8f4]/90'
                              }`}
                            >
                              <td className="px-4 py-2 align-top">
                                <button
                                  type="button"
                                  onClick={() => setSelectedMeetingId((id) => (id === m.id ? null : m.id))}
                                  className="text-left font-medium text-[#1a3d32] underline-offset-2 hover:underline"
                                >
                                  {m.title}
                                </button>
                              </td>
                              <td className="px-4 py-2 align-top text-neutral-700">{formatWhen(m.startsAt)}</td>
                              <td className="px-4 py-2 align-top text-neutral-600">
                                {m.governanceYear ?? '—'} · {m.quarterSlot ? `Q${m.quarterSlot}` : '—'}
                              </td>
                              <td className="px-4 py-2 align-top">
                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                                  {m.status === 'planned'
                                    ? 'Planlagt'
                                    : m.status === 'completed'
                                      ? 'Gjennomført'
                                      : 'Avlyst'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {selectedMeeting ? (
                <MeetingDetailPanel
                  meeting={selectedMeeting}
                  council={council}
                  auditDraft={auditDraft}
                  setAuditDraft={setAuditDraft}
                />
              ) : (
                <p className="text-sm text-neutral-500">Velg et møte for å se agenda, forberedelse og revisjonslogg.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'preparation' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Møteforberedelse</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Forbered saksgrunnlag, sjekkliste og notater før møtet. Samme data finnes under «Møter og årshjul» når
              møtet er valgt.
            </p>
            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-500">Velg møte (planlagte først)</label>
              <select
                value={prepMeeting?.id ?? ''}
                onChange={(e) => setPrepMeetingId(e.target.value || null)}
                className="mt-1 w-full max-w-md rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Neste planlagte (standard)</option>
                {council.meetings
                  .slice()
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} — {formatWhen(m.startsAt)} ({m.status})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {prepMeeting ? (
            <PreparationPanel meeting={prepMeeting} council={council} />
          ) : (
            <p className="text-sm text-neutral-500">Opprett et møte under «Møter og årshjul».</p>
          )}
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

          <section className="overflow-hidden rounded-2xl border border-[#1a3d32]/15 bg-white shadow-sm">
            <div className="border-b border-[#1a3d32]/15 bg-gradient-to-r from-[#faf6ed] via-white to-emerald-50/50 px-4 py-3">
              <h2 className="font-semibold text-[#1a3d32]">Krav og oppgaver</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-emerald-200/70 bg-emerald-50/95 text-xs font-semibold uppercase tracking-wide text-[#1a3d32]/85">
                    <th className="w-10 px-3 py-2.5">OK</th>
                    <th className="min-w-[200px] px-3 py-2.5">Krav</th>
                    <th className="min-w-[180px] px-3 py-2.5">Notater</th>
                    <th className="px-3 py-2.5">Oppfølging</th>
                  </tr>
                </thead>
                <tbody>
                  {council.compliance.map((c, rowIdx) => (
                    <tr
                      key={c.id}
                      className={`border-b border-neutral-100 ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/35'} ${
                        c.done ? 'opacity-90' : ''
                      }`}
                    >
                      <td className="align-top px-3 py-3">
                        <input
                          type="checkbox"
                          checked={c.done}
                          onChange={() => council.toggleCompliance(c.id)}
                          className="mt-1 size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                        />
                      </td>
                      <td className="align-top px-3 py-3">
                        <span className="font-medium text-neutral-900">{c.title}</span>
                        {c.isCustom ? (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Egendefinert
                          </span>
                        ) : null}
                        <p className="mt-1 text-neutral-600">{c.description}</p>
                        <p className="mt-1 text-xs font-medium text-[#1a3d32]/90">{c.lawRef}</p>
                      </td>
                      <td className="align-top px-3 py-3">
                        <textarea
                          placeholder="Notater…"
                          value={c.notes ?? ''}
                          onChange={(e) => council.setComplianceNotes(c.id, e.target.value)}
                          rows={2}
                          className="w-full min-w-[160px] rounded-lg border border-neutral-200 bg-white/90 px-2 py-1.5 text-xs"
                        />
                      </td>
                      <td className="align-top px-3 py-3">
                        {!c.done ? (
                          <AddTaskLink
                            title={`Oppfølging: ${c.title.slice(0, 80)}`}
                            description={c.lawRef}
                            module="council"
                            sourceType="council_compliance"
                            sourceId={c.id}
                            sourceLabel={c.title}
                            ownerRole="HMS / råd"
                            requiresManagementSignOff={false}
                          />
                        ) : (
                          <span className="text-xs text-emerald-700">Fullført</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

function PreparationPanel({
  meeting,
  council,
}: {
  meeting: CouncilMeeting
  council: ReturnType<typeof useCouncil>
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-neutral-900">{meeting.title}</h3>
        <p className="text-sm text-neutral-600">{formatWhen(meeting.startsAt)} · {meeting.location}</p>
      </div>
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900">Forberedende notater</h3>
        <textarea
          value={meeting.preparationNotes}
          onChange={(e) => council.setPreparationNotes(meeting.id, e.target.value)}
          rows={5}
          className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          placeholder="Saksliste, lenker til dokumenter, spørsmål til ledelsen …"
        />
      </div>
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-neutral-900">Sjekkliste før møtet</h3>
        <ul className="mt-3 space-y-2">
          {meeting.preparationChecklist.map((p) => (
            <li key={p.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={p.done}
                onChange={() => council.togglePrepChecklist(meeting.id, p.id)}
                className="mt-1 size-4 rounded border-neutral-300 text-[#1a3d32]"
              />
              <span className={`text-sm ${p.done ? 'text-neutral-500 line-through' : 'text-neutral-800'}`}>
                {p.label}
              </span>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const label = String(fd.get('extra') ?? '').trim()
            if (!label) return
            council.addPrepChecklistItem(meeting.id, label)
            e.currentTarget.reset()
          }}
          className="mt-4 flex flex-wrap gap-2"
        >
          <input
            name="extra"
            placeholder="Nytt sjekkpunkt"
            className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#142e26]"
          >
            Legg til
          </button>
        </form>
      </div>
      <div className="rounded-2xl border border-neutral-200/90 bg-[#faf8f4] p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Agenda (oversikt)</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-neutral-700">
          {meeting.agendaItems.length === 0 ? (
            <li>Ingen punkter — rediger under «Møter og årshjul».</li>
          ) : (
            meeting.agendaItems
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((a) => <li key={a.id}>{a.title}</li>)
          )}
        </ol>
      </div>
    </div>
  )
}

function MeetingDetailPanel({
  meeting,
  council,
  auditDraft,
  setAuditDraft,
}: {
  meeting: CouncilMeeting
  council: ReturnType<typeof useCouncil>
  auditDraft: { kind: AuditEntryKind; text: string; author: string }
  setAuditDraft: React.Dispatch<
    React.SetStateAction<{ kind: AuditEntryKind; text: string; author: string }>
  >
}) {
  const [protoName, setProtoName] = useState('')
  const [protoRole, setProtoRole] = useState<'chair' | 'secretary' | 'management'>('chair')
  function updateAgendaItem(itemId: string, patch: Partial<AgendaItem>) {
    const next = meeting.agendaItems.map((a) => (a.id === itemId ? { ...a, ...patch } : a))
    council.setAgendaItems(meeting.id, next)
  }

  function removeAgendaItem(itemId: string) {
    council.setAgendaItems(
      meeting.id,
      meeting.agendaItems.filter((a) => a.id !== itemId).map((a, i) => ({ ...a, order: i })),
    )
  }

  function addAgendaItem() {
    council.setAgendaItems(meeting.id, [
      ...meeting.agendaItems,
      {
        id: crypto.randomUUID(),
        title: 'Nytt punkt',
        notes: '',
        order: meeting.agendaItems.length,
      },
    ])
  }

  const sortedAudit = useMemo(
    () => [...meeting.auditTrail].sort((a, b) => a.at.localeCompare(b.at)),
    [meeting.auditTrail],
  )

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{meeting.title}</h2>
            <p className="text-sm text-neutral-600">{formatWhen(meeting.startsAt)}</p>
            <p className="text-sm text-neutral-500">{meeting.location}</p>
          </div>
          <select
            value={meeting.status}
            onChange={(e) =>
              council.updateMeeting(meeting.id, {
                status: e.target.value as CouncilMeeting['status'],
              })
            }
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium"
          >
            <option value="planned">Planlagt</option>
            <option value="completed">Gjennomført</option>
            <option value="cancelled">Avlyst</option>
          </select>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <ListOrdered className="size-4" />
              Agenda
            </h3>
            {meeting.quarterSlot ? (
              <button
                type="button"
                onClick={() => council.applySuggestedAgenda(meeting.id, meeting.quarterSlot!)}
                className="text-xs font-medium text-[#1a3d32] underline-offset-2 hover:underline"
              >
                Last inn forslag for Q{meeting.quarterSlot} på nytt
              </button>
            ) : null}
          </div>
          <ul className="mt-3 space-y-3">
            {meeting.agendaItems.length === 0 ? (
              <li className="text-sm text-neutral-500">Ingen agendapunkter.</li>
            ) : (
              meeting.agendaItems
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((item) => (
                  <li key={item.id} className="rounded-xl border border-neutral-100 bg-[#faf8f4] p-3">
                    <input
                      value={item.title}
                      onChange={(e) => updateAgendaItem(item.id, { title: e.target.value })}
                      className="w-full border-0 bg-transparent font-medium text-neutral-900 outline-none focus:ring-0"
                    />
                    <textarea
                      value={item.notes}
                      onChange={(e) => updateAgendaItem(item.id, { notes: e.target.value })}
                      rows={2}
                      className="mt-1 w-full resize-y rounded-lg border border-neutral-200/80 bg-white px-2 py-1 text-xs text-neutral-600"
                      placeholder="Merknader til punktet"
                    />
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(item.id)}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      Fjern punkt
                    </button>
                  </li>
                ))
            )}
          </ul>
          <button
            type="button"
            onClick={addAgendaItem}
            className="mt-3 text-sm font-medium text-[#1a3d32] hover:underline"
          >
            + Legg til punkt
          </button>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Forberedelse</h3>
          <textarea
            value={meeting.preparationNotes}
            onChange={(e) => council.setPreparationNotes(meeting.id, e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Notater før møtet …"
          />
          <ul className="mt-3 space-y-2">
            {meeting.preparationChecklist.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.done}
                  onChange={() => council.togglePrepChecklist(meeting.id, p.id)}
                  className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32]"
                />
                <span className={p.done ? 'text-neutral-500 line-through' : ''}>{p.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ScrollText className="size-4" />
            Protokoll (referat)
          </h3>
          <textarea
            value={meeting.minutes ?? ''}
            onChange={(e) => council.updateMeeting(meeting.id, { minutes: e.target.value })}
            rows={4}
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Hovedinnhold i protokoll …"
          />
          <div className="mt-4 rounded-xl border border-neutral-200 bg-[#faf8f4] p-4">
            <h4 className="text-sm font-semibold text-neutral-900">Digital signatur på protokoll</h4>
            <p className="mt-1 text-xs text-neutral-600">
              Registrerer navn og tid (demonstrasjon). Juridisk signatur krever eSignatur.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-neutral-700">
              {(meeting.protocolSignatures ?? []).map((s, i) => (
                <li key={`${s.signedAt}-${i}`}>
                  {s.role === 'chair'
                    ? 'Møteleder'
                    : s.role === 'secretary'
                      ? 'Referent'
                      : 'Ledelse'}
                  : {s.signerName} — {formatWhen(s.signedAt)}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={protoRole}
                onChange={(e) =>
                  setProtoRole(e.target.value as 'chair' | 'secretary' | 'management')
                }
                className="rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              >
                <option value="chair">Møteleder</option>
                <option value="secretary">Referent</option>
                <option value="management">Ledelse</option>
              </select>
              <input
                value={protoName}
                onChange={(e) => setProtoName(e.target.value)}
                placeholder="Fullt navn"
                className="min-w-[160px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (council.signMeetingProtocol(meeting.id, protoName, protoRole)) setProtoName('')
                }}
                className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white"
              >
                Signer
              </button>
            </div>
          </div>
          <div className="mt-3">
            <AddTaskLink
              title={`Oppfølging etter møte: ${meeting.title.slice(0, 60)}`}
              description={meeting.minutes?.slice(0, 300)}
              module="council"
              sourceType="council_meeting"
              sourceId={meeting.id}
              sourceLabel={meeting.title}
              ownerRole="Saksbehandler"
            />
          </div>
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-4">
          <h3 className="text-sm font-semibold text-neutral-900">Revisjonslogg (diskusjon, notater, vedtak)</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Kronologisk spor — nye oppføringer legges til nederst. Bruk vedtak for formelle beslutninger.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              council.appendAuditEntry(meeting.id, auditDraft.kind, auditDraft.text, auditDraft.author)
              setAuditDraft((s) => ({ ...s, text: '' }))
            }}
            className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          >
            <select
              value={auditDraft.kind}
              onChange={(e) =>
                setAuditDraft((s) => ({ ...s, kind: e.target.value as AuditEntryKind }))
              }
              className="rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            >
              <option value="discussion">Diskusjon</option>
              <option value="note">Notat</option>
              <option value="decision">Vedtak</option>
            </select>
            <input
              value={auditDraft.author}
              onChange={(e) => setAuditDraft((s) => ({ ...s, author: e.target.value }))}
              placeholder="Navn (valgfritt)"
              className="min-w-[120px] flex-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
            />
            <input
              value={auditDraft.text}
              onChange={(e) => setAuditDraft((s) => ({ ...s, text: e.target.value }))}
              placeholder="Tekst"
              className="min-w-[200px] flex-[2] rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-[#1a3d32] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              Legg til
            </button>
          </form>
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-3 text-sm">
            {sortedAudit.map((a) => (
              <li key={a.id} className="border-l-2 border-[#c9a227] pl-3">
                <div className="text-xs text-neutral-500">
                  {formatWhen(a.at)}
                  {a.author ? ` · ${a.author}` : ''} ·{' '}
                  <span className="font-medium text-neutral-700">
                    {a.kind === 'decision' ? 'Vedtak' : a.kind === 'discussion' ? 'Diskusjon' : 'Notat'}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-neutral-800">{a.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
            .map((c, idx) => (
              <li
                key={c.id}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-[#1a3d32]/10 ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-amber-50/50'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <img
                    src={avatarUrlFromSeed(c.id + c.name, 64)}
                    alt=""
                    className="size-9 shrink-0 rounded-full ring-2 ring-white object-cover"
                  />
                  <span className="font-medium text-neutral-900">{c.name}</span>
                </span>
                <span className="shrink-0 text-neutral-600">{c.voteCount} stemmer</span>
                {open ? (
                  <button
                    type="button"
                    onClick={() => onVote(c.id)}
                    className="shrink-0 rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26]"
                  >
                    Stem
                  </button>
                ) : election.winnerCandidateId === c.id ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-700">Vinner</span>
                ) : null}
              </li>
            ))
        )}
      </ul>
    </div>
  )
}

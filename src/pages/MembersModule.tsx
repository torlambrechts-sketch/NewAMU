import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ListChecks,
  Shield,
  Users,
  Vote,
} from 'lucide-react'
import { AddTaskLink } from '../components/tasks/AddTaskLink'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { REPRESENTATIVE_ROLE_REQUIREMENTS, requirementsForRole } from '../data/representativeRules'
import { useRepresentatives } from '../hooks/useRepresentatives'
import type { RepElection, RepresentativeMember, RepresentativeOfficeRole } from '../types/representatives'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: Users },
  { id: 'election' as const, label: 'Valg', icon: Vote },
  { id: 'board' as const, label: 'AMU og sammensetting', icon: Shield },
  { id: 'requirements' as const, label: 'Krav og opplæring', icon: ListChecks },
  { id: 'periods' as const, label: 'Perioder', icon: ClipboardList },
]

function officeLabel(role: RepresentativeOfficeRole): string {
  const map: Record<RepresentativeOfficeRole, string> = {
    employee_chair: 'Leder (AT)',
    employee_deputy: 'Nestleder (AT)',
    employee_member: 'Medlem (AT)',
    leadership_chair: 'Leder (AG)',
    leadership_deputy: 'Nestleder (AG)',
    leadership_member: 'Medlem (AG)',
  }
  return map[role]
}

function candidateDisplayName(
  election: RepElection,
  candidateIndex: number,
  realName: string,
  electionClosed: boolean,
): string {
  if (!election.anonymous || electionClosed) return realName
  return `Kandidat ${String.fromCharCode(65 + candidateIndex)}`
}

function candidateLetterIndex(election: RepElection, candidateId: string): number {
  return Math.max(0, election.candidates.findIndex((c) => c.id === candidateId))
}

export function MembersModule() {
  const rep = useRepresentatives()
  const [searchParams, setSearchParams] = useSearchParams()
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const navigate = useNavigate()

  useEffect(() => {
    if (tabParam === 'audit') {
      queueMicrotask(() => navigate('/workspace/revisjonslogg?source=representatives', { replace: true }))
    }
  }, [tabParam, navigate])

  const setTab = useCallback((id: TabId) => setSearchParams({ tab: id }, { replace: true }), [setSearchParams])
  const tabLabel = tabs.find((t) => t.id === tab)?.label ?? 'Medlemmer'
  const membersHubItems = useMemo((): HubMenu1Item[] => {
    return tabs.map(({ id, label, icon }) => ({
      key: id,
      label,
      icon,
      active: tab === id,
      onClick: () => setTab(id),
    }))
  }, [tab, setTab])
  const [electionForm, setElectionForm] = useState({
    title: '',
    description: '',
    anonymous: true,
    seats: rep.settings.seatsPerSide,
    periodId: '' as string,
  })
  const [candInput, setCandInput] = useState<Record<string, string>>({})
  const [periodForm, setPeriodForm] = useState({ label: '', start: '', end: '' })

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Medlemmer og representasjon' }, { label: tabLabel }]}
        title="Medlemmer"
        description={
          <>
            Valg av arbeidstakerrepresentanter (valgfritt anonymt), kontroll av 50/50-sammensetting og roller,
            opplæringskrav og revisjonslogg. Verifiser mot tariff og{' '}
            <a href="https://lovdata.no" className="text-[#1a3d32] underline" target="_blank" rel="noreferrer">
              lovdata.no
            </a>{' '}
            — ikke juridisk rådgivning.
          </>
        }
        menu={<HubMenu1Bar ariaLabel="Medlemmer — faner" items={membersHubItems} />}
      />

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Sammensetting</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {rep.validation.ok ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-900">
                  <CheckCircle2 className="size-4" />
                  Krav oppfylt (etter gjeldende innstillinger)
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-950">
                  <AlertTriangle className="size-4" />
                  {rep.validation.issues.length} avvik
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl bg-[#faf8f4] p-3">
                <dt className="text-neutral-500">Seter per side (mål)</dt>
                <dd className="text-lg font-semibold text-[#1a3d32]">{rep.validation.seatsPerSide}</dd>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-3">
                <dt className="text-neutral-500">Registrerte perioder</dt>
                <dd className="text-lg font-semibold text-[#1a3d32]">{rep.periodCount}</dd>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-3">
                <dt className="text-neutral-500">Arbeidstakerrepresentanter</dt>
                <dd className="font-medium text-neutral-900">{rep.validation.empCount}</dd>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-3">
                <dt className="text-neutral-500">Arbeidsgiverrepresentanter</dt>
                <dd className="font-medium text-neutral-900">{rep.validation.leadCount}</dd>
              </div>
            </dl>
            {!rep.validation.ok && (
              <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-amber-900">
                {rep.validation.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Snarveier</h2>
            <button
              type="button"
              onClick={() => setTab('election')}
              className="mt-4 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Gå til valg
            </button>
            <button
              type="button"
              onClick={() => setTab('requirements')}
              className="mt-2 w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
            >
              Krav per rolle
            </button>
            <div className="mt-3 flex justify-center">
              <AddTaskLink
                title="Oppfølging representasjon / AMU"
                module="members"
                sourceType="representatives"
                ownerRole="Tillitsvalgt"
                requiresManagementSignOff
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'election' && (
        <div className="mt-8 space-y-8">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Nytt valg (arbeidstakerrepresentanter)</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Legg til kandidater, åpne for stemmer, avslutt for å tildele roller (leder, nestleder, medlem) etter
              stemmetall. Ved anonymt valg vises ikke navn før valget er lukket.
            </p>
            <form
              className="mt-4 grid gap-3 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!electionForm.title.trim()) return
                rep.createElection(
                  electionForm.title,
                  electionForm.description,
                  electionForm.anonymous,
                  electionForm.seats,
                  electionForm.periodId || undefined,
                )
                setElectionForm((s) => ({
                  ...s,
                  title: '',
                  description: '',
                }))
              }}
            >
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Tittel</label>
                <input
                  value={electionForm.title}
                  onChange={(e) => setElectionForm((s) => ({ ...s, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-neutral-500">Beskrivelse</label>
                <textarea
                  value={electionForm.description}
                  onChange={(e) => setElectionForm((s) => ({ ...s, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Antall seter (AT)</label>
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={electionForm.seats}
                  onChange={(e) =>
                    setElectionForm((s) => ({ ...s, seats: Number(e.target.value) || 1 }))
                  }
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-500">Knytt til periode (valgfritt)</label>
                <select
                  value={electionForm.periodId}
                  onChange={(e) => setElectionForm((s) => ({ ...s, periodId: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {rep.periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 md:col-span-2">
                <input
                  type="checkbox"
                  checked={electionForm.anonymous}
                  onChange={(e) => setElectionForm((s) => ({ ...s, anonymous: e.target.checked }))}
                  className="rounded border-neutral-300 text-[#1a3d32]"
                />
                <span className="text-sm text-neutral-800">Anonym stemmegivning (navn skjult til valg er lukket)</span>
              </label>
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26] md:col-span-2"
              >
                Opprett valg
              </button>
            </form>
          </section>

          <div className="space-y-6">
            {rep.elections.map((el) => (
              <ElectionCard
                key={el.id}
                election={el}
                candDraft={candInput[el.id] ?? ''}
                setCandDraft={(v) => setCandInput((s) => ({ ...s, [el.id]: v }))}
                onAddCandidate={() => {
                  const name = (candInput[el.id] ?? '').trim()
                  if (!name) return
                  rep.addCandidate(el.id, name)
                  setCandInput((s) => ({ ...s, [el.id]: '' }))
                }}
                onOpen={() => rep.openElection(el.id)}
                onVote={(cid) => rep.vote(el.id, cid)}
                onClose={() => rep.closeElectionAndSync(el.id)}
              />
            ))}
            {rep.elections.length === 0 ? (
              <p className="text-sm text-neutral-500">Ingen valg ennå — opprett over.</p>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Innstillinger for sammensetting</h2>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="text-sm">
                Seter per side (50/50)
                <input
                  type="number"
                  min={1}
                  max={9}
                  value={rep.settings.seatsPerSide}
                  onChange={(e) =>
                    rep.updateSettings({ seatsPerSide: Number(e.target.value) || 1 })
                  }
                  className="ml-2 w-16 rounded-lg border border-neutral-200 px-2 py-1"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rep.settings.requireChairAndDeputy}
                  onChange={(e) => rep.updateSettings({ requireChairAndDeputy: e.target.checked })}
                  className="rounded border-neutral-300 text-[#1a3d32]"
                />
                Krever leder og nestleder på begge sider
              </label>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <MemberColumn
              title="Arbeidstakere (valgt)"
              members={rep.members.filter((m) => m.side === 'employee')}
              onUpdate={rep.updateMember}
            />
            <MemberColumn
              title="Arbeidsgiver (oppnevnt)"
              members={rep.members.filter((m) => m.side === 'leadership')}
              onUpdate={rep.updateMember}
              onAdd={rep.addLeadershipPlaceholder}
            />
          </div>
        </div>
      )}

      {tab === 'requirements' && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            Kravene nedenfor er <strong>illustrative</strong> og knyttet til typiske plikter under AML kap. 7.
            Tilpass til bedriftens størrelse og avtaler.
          </div>
          <section className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Matrise: roller og krav</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-neutral-600">
                    <th className="px-4 py-3 font-medium">Rolle</th>
                    <th className="px-4 py-3 font-medium">Krav / opplæring</th>
                    <th className="px-4 py-3 font-medium">Henvisning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {REPRESENTATIVE_ROLE_REQUIREMENTS.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 align-top text-xs text-neutral-500">
                        {r.roleKeys.map((k) => officeLabel(k as RepresentativeOfficeRole)).join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-neutral-900">{r.title}</div>
                        <div className="mt-1 text-neutral-600">{r.description}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-[#1a3d32]/90">{r.lawRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Oppfølging per representant</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Kryss av når kravet er dokumentert gjennomført (internt spor, ikke juridisk bevis).
            </p>
            <ul className="mt-4 space-y-6">
              {rep.members.map((m) => (
                <li key={m.id} className="rounded-xl border border-neutral-100 bg-[#faf8f4] p-4">
                  <div className="font-medium text-neutral-900">
                    {m.name} · {officeLabel(m.officeRole)}
                  </div>
                  <ul className="mt-2 space-y-2">
                    {requirementsForRole(m.officeRole).map((req) => (
                      <li key={req.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={m.trainingChecklist[req.id] ?? false}
                          onChange={() => rep.toggleTraining(m.id, req.id)}
                          className="mt-0.5 size-4 rounded border-neutral-300 text-[#1a3d32]"
                        />
                        <span>
                          <span className="font-medium text-neutral-800">{req.title}</span>
                          <span className="block text-xs text-neutral-600">{req.description}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'periods' && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Valgperioder</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Registrer perioder for å knytte valg til mandat (typisk 2 år — juster etter avtale).
            </p>
            <form
              className="mt-4 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!periodForm.label.trim() || !periodForm.start || !periodForm.end) return
                rep.addPeriod(periodForm.label, periodForm.start, periodForm.end)
                setPeriodForm({ label: '', start: '', end: '' })
              }}
            >
              <input
                placeholder="Navn (f.eks. 2026–2028)"
                value={periodForm.label}
                onChange={(e) => setPeriodForm((s) => ({ ...s, label: e.target.value }))}
                className="min-w-[180px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="date"
                value={periodForm.start}
                onChange={(e) => setPeriodForm((s) => ({ ...s, start: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="date"
                value={periodForm.end}
                onChange={(e) => setPeriodForm((s) => ({ ...s, end: e.target.value }))}
                className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                Legg til periode
              </button>
            </form>
            <ul className="mt-4 divide-y divide-neutral-100">
              {rep.periods.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="font-medium text-neutral-900">{p.label}</span>
                  <span className="text-neutral-600">
                    {p.startDate} — {p.endDate}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-neutral-500">
              Antall registrerte perioder: <strong>{rep.periodCount}</strong>
            </p>
          </section>
        </div>
      )}

    </div>
  )
}

function MemberColumn({
  title,
  members,
  onUpdate,
  onAdd,
}: {
  title: string
  members: RepresentativeMember[]
  onUpdate: ReturnType<typeof useRepresentatives>['updateMember']
  onAdd?: () => void
}) {
  const roles: RepresentativeOfficeRole[] =
    title.includes('Arbeidsgiver')
      ? ['leadership_chair', 'leadership_deputy', 'leadership_member']
      : ['employee_chair', 'employee_deputy', 'employee_member']

  return (
    <section className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="text-sm font-medium text-[#1a3d32] hover:underline"
          >
            + Legg til
          </button>
        ) : null}
      </div>
      <ul className="mt-4 space-y-4">
        {members.map((m) => (
          <li key={m.id} className="rounded-xl border border-neutral-100 p-3">
            <input
              value={m.name}
              onChange={(e) => onUpdate(m.id, { name: e.target.value })}
              className="w-full border-0 bg-transparent font-medium text-neutral-900 outline-none focus:ring-0"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                value={m.officeRole}
                onChange={(e) =>
                  onUpdate(m.id, { officeRole: e.target.value as RepresentativeOfficeRole })
                }
                className="rounded-lg border border-neutral-200 px-2 py-1 text-xs"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {officeLabel(r)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-neutral-500">
                {m.source === 'election' ? 'Valgt' : 'Oppnevnt'}
              </span>
            </div>
            <label className="mt-2 block text-xs text-neutral-500">Periode slutt (valgfritt)</label>
            <input
              type="date"
              value={m.termUntil ?? ''}
              onChange={(e) => onUpdate(m.id, { termUntil: e.target.value || undefined })}
              className="mt-1 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
            />
          </li>
        ))}
      </ul>
      {members.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Ingen — kjør valg eller legg til representanter.</p>
      ) : null}
    </section>
  )
}

function ElectionCard({
  election,
  candDraft,
  setCandDraft,
  onAddCandidate,
  onOpen,
  onVote,
  onClose,
}: {
  election: RepElection
  candDraft: string
  setCandDraft: (v: string) => void
  onAddCandidate: () => void
  onOpen: () => void
  onVote: (candidateId: string) => void
  onClose: () => void
}) {
  const closed = election.status === 'closed'
  const open = election.status === 'open'
  const draft = election.status === 'draft'
  const sorted = [...election.candidates].sort((a, b) => b.voteCount - a.voteCount)

  return (
    <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-neutral-900">{election.title}</h3>
          <p className="text-sm text-neutral-600">{election.description}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {election.anonymous ? 'Anonym stemmegivning' : 'Åpne navn'} · {election.seatsToFill} seter ·{' '}
            {election.votesCastTotal} stemmer totalt
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <button
              type="button"
              onClick={onOpen}
              disabled={election.candidates.length === 0}
              className="rounded-full bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              Åpne for stemmer
            </button>
          ) : null}
          {open ? (
            <button
              type="button"
              onClick={onClose}
              disabled={election.candidates.length === 0}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Avslutt og oppdater styre
            </button>
          ) : null}
          {closed ? (
            <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700">
              Avsluttet
            </span>
          ) : null}
        </div>
      </div>

      {(draft || open) && (
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            value={candDraft}
            onChange={(e) => setCandDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddCandidate())}
            placeholder="Kandidatnavn"
            className="min-w-[200px] flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onAddCandidate}
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Legg til
          </button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {sorted.map((c) => {
          const letterIdx = candidateLetterIndex(election, c.id)
          const display = candidateDisplayName(election, letterIdx, c.name, closed)
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#faf8f4] px-3 py-2 text-sm"
            >
              <span className="font-medium text-neutral-900">{display}</span>
              <span className="text-neutral-600">{c.voteCount} stemmer</span>
              {open ? (
                <button
                  type="button"
                  onClick={() => onVote(c.id)}
                  className="rounded-full bg-[#1a3d32] px-3 py-1 text-xs font-medium text-white hover:bg-[#142e26]"
                >
                  Stem
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {election.anonymous && open ? (
        <p className="mt-3 text-xs text-neutral-500">
          Stemmer vises aggregert; kandidater vises som Kandidat A, B, … til valget lukkes.
        </p>
      ) : null}
    </div>
  )
}

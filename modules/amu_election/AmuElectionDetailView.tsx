import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  UserPlus,
  Vote,
} from 'lucide-react'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { InfoBox } from '../../src/components/ui/AlertBox'
import type { AmuElectionRow } from './types'
import { useAmuElection } from './useAmuElection'

const TH = `${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`

const STATUS_LABEL: Record<AmuElectionRow['status'], string> = {
  draft: 'Kladd',
  nomination: 'Nominasjon',
  voting: 'Stemmegivning',
  closed: 'Avsluttet',
}

function statusBadgeVariant(s: AmuElectionRow['status']): BadgeVariant {
  switch (s) {
    case 'draft':
      return 'neutral'
    case 'nomination':
      return 'info'
    case 'voting':
      return 'warning'
    case 'closed':
      return 'success'
    default:
      return 'neutral'
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

type DetailTab = 'oversikt' | 'nominasjon' | 'valglokale' | 'resultater'

export function AmuElectionDetailView({
  supabase,
  electionId,
}: {
  supabase: SupabaseClient | null
  electionId: string
}) {
  const nav = useNavigate()
  const {
    loadElectionDetail,
    loadAssignableUsersList,
    addCandidate,
    setCandidateStatus,
    castVote,
    setError,
    elections,
    candidatesByElection,
    votersByElection,
    voteTotalsByElection,
    assignableUsers,
    canManage,
    currentUserId,
    loading,
    error,
  } = useAmuElection({ supabase })
  const [tab, setTab] = useState<DetailTab>('oversikt')
  const [nominateOpen, setNominateOpen] = useState(false)
  const [nomUserId, setNomUserId] = useState<string>('')
  const [nomManifesto, setNomManifesto] = useState('')
  const [nomSaving, setNomSaving] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [casting, setCasting] = useState(false)

  useEffect(() => {
    void loadElectionDetail(electionId)
  }, [electionId, loadElectionDetail])

  const election = useMemo(
    () => elections.find((e) => e.id === electionId) ?? null,
    [elections, electionId],
  )

  const candidates = useMemo(() => candidatesByElection[electionId] ?? [], [candidatesByElection, electionId])
  const voters = useMemo(() => votersByElection[electionId] ?? [], [electionId, votersByElection])
  const voteTotals = useMemo(() => voteTotalsByElection[electionId] ?? [], [electionId, voteTotalsByElection])

  const myVoter = useMemo(() => {
    if (!currentUserId) return undefined
    return voters.find((v) => v.user_id === currentUserId)
  }, [currentUserId, voters])

  const approvedCandidates = useMemo(
    () => candidates.filter((c) => c.status === 'approved'),
    [candidates],
  )

  const nameByUserId = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of assignableUsers) m.set(u.id, u.displayName)
    return m
  }, [assignableUsers])

  const tabItems = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [{ id: 'oversikt', label: 'Oversikt', icon: ClipboardList }]
    if (election?.status === 'nomination') {
      items.push({ id: 'nominasjon', label: 'Nominasjon', icon: UserPlus })
    }
    if (election?.status === 'voting') {
      items.push({ id: 'valglokale', label: 'Valglokale', icon: Vote })
    }
    if (election?.status === 'closed') {
      items.push({ id: 'resultater', label: 'Resultater', icon: BarChart2 })
    }
    return items
  }, [election?.status])

  const validTabIds = useMemo(() => new Set(tabItems.map((t) => t.id)), [tabItems])
  const activeTab: DetailTab = validTabIds.has(tab) ? tab : 'oversikt'

  const openNominatePanel = useCallback(() => {
    setNomUserId('')
    setNomManifesto('')
    setNominateOpen(true)
    void loadAssignableUsersList()
  }, [loadAssignableUsersList])

  const submitNomination = useCallback(async () => {
    if (!nomUserId.trim()) {
      setError('Velg kandidat.')
      return
    }
    setNomSaving(true)
    setError(null)
    const row = await addCandidate({
      electionId,
      userId: nomUserId.trim(),
      manifesto: nomManifesto,
      status: 'nominated',
    })
    setNomSaving(false)
    if (row) {
      setNominateOpen(false)
      void loadElectionDetail(electionId)
    }
  }, [addCandidate, electionId, loadElectionDetail, nomManifesto, nomUserId, setError])

  const onCastVote = useCallback(async () => {
    if (!selectedCandidateId) {
      setError('Velg en kandidat før du stemmer.')
      return
    }
    setCasting(true)
    const res = await castVote(electionId, selectedCandidateId)
    setCasting(false)
    if (res.ok) setSelectedCandidateId(null)
  }, [castVote, electionId, selectedCandidateId, setError])

  const maxVotes = useMemo(() => {
    if (voteTotals.length === 0) return 0
    return Math.max(...voteTotals.map((t) => t.vote_count), 0)
  }, [voteTotals])

  if (!election && loading) {
    return (
      <div className={`${WORKPLACE_MODULE_CARD} flex items-center justify-center gap-2 p-12 text-sm text-neutral-500`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Laster valg…
      </div>
    )
  }

  if (!election && !loading) {
    return (
      <div className={`${WORKPLACE_MODULE_CARD} p-8 text-center text-sm text-neutral-600`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <p>Fant ikke valget.</p>
        <Button type="button" variant="secondary" className="mt-4" onClick={() => nav('/internkontroll/amu-valg')}>
          Tilbake til oversikt
        </Button>
      </div>
    )
  }

  if (!election) return null

  return (
    <div className="flex flex-col space-y-6">
      <ComplianceBanner title="Forskrift om organisering, ledelse og medvirkning Kap. 3 — Valg av representanter">
        Hemmelig valg: stemmegivning skjer i tråd med regelverket. Stemmer lagres uten kobling til deg som person i
        stemmetabellen.
      </ComplianceBanner>

      {error ? <WarningBox>{error}</WarningBox> : null}

      <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 mb-2 text-neutral-600"
              onClick={() => nav('/internkontroll/amu-valg')}
            >
              <ArrowLeft className="mr-1 size-4" aria-hidden />
              Tilbake
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-neutral-900">{election.title}</h2>
              <Badge variant={statusBadgeVariant(election.status)}>{STATUS_LABEL[election.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Start {formatDate(election.start_date)} — Slutt {formatDate(election.end_date)}
            </p>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <Tabs items={tabItems} activeId={activeTab} onChange={(id) => setTab(id as DetailTab)} />
        </div>

        {activeTab === 'oversikt' && (
          <div className="space-y-6 px-5 py-6">
            <InfoBox>
              Regler: Alle stemmeberettigede skal kunne avgi stemme uten urettmessig påvirkning. Nominasjonsperioden
              følger tidslinjen nedenfor. Valgkomitéen organiserer gjennomføringen i virksomheten.
            </InfoBox>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Regler (oversikt)</p>
              <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                Ingen lokale tilleggsregler registrert for dette valget.
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tidslinje</p>
              <div className="rounded-md border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-800">
                <p>
                  <span className="font-semibold">Nominasjon / forberedelse:</span> frem til valget åpner for
                  stemmegivning (status styres av administrator).
                </p>
                <p className="mt-2">
                  <span className="font-semibold">Planlagt start:</span> {formatDate(election.start_date)}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Planlagt slutt:</span> {formatDate(election.end_date)}
                </p>
              </div>
            </div>
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Valgkomité</p>
              <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                Ingen valgkomité registrert i systemet ennå.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'nominasjon' && election.status === 'nomination' && (
          <div className="px-0 py-4">
            <LayoutTable1PostingsShell
              wrap={false}
              titleTypography="sans"
              title="Kandidater"
              description="Liste over nominerte kandidater."
              headerActions={
                canManage ? (
                  <Button type="button" variant="primary" size="sm" onClick={openNominatePanel}>
                    Nominer kandidat
                  </Button>
                ) : null
              }
              toolbar={<span className="text-xs text-neutral-500">Nominasjonsfase</span>}
            >
              {candidates.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-neutral-500">Ingen kandidater nominert enda.</div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={TH}>Kandidat</th>
                      <th className={TH}>Status</th>
                      <th className={`${TH} text-right`}>Handling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c) => (
                      <tr key={c.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                        <td className="px-5 py-3 align-top">
                          <div className="whitespace-normal font-medium text-neutral-900">
                            {nameByUserId.get(c.user_id) ?? c.user_id}
                          </div>
                          {c.manifesto ? (
                            <p className="mt-1 max-w-xl whitespace-normal text-xs text-neutral-600">{c.manifesto}</p>
                          ) : null}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={c.status === 'approved' ? 'success' : 'neutral'}>
                            {c.status === 'approved' ? 'Godkjent' : 'Nominert'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canManage && c.status === 'nominated' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void setCandidateStatus(electionId, c.id, 'approved')}
                            >
                              Godkjenn
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </LayoutTable1PostingsShell>
          </div>
        )}

        {activeTab === 'valglokale' && election.status === 'voting' && (
          <div className="px-5 py-6">
            {!myVoter ? (
              <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                Du er ikke stemmeberettiget for dette valget.
              </div>
            ) : myVoter.has_voted ? (
              <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-10 text-center">
                <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-700" aria-hidden />
                <p className="text-sm font-medium text-emerald-900">Din stemme er registrert (Hemmelig valg)</p>
              </div>
            ) : approvedCandidates.length === 0 ? (
              <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                Ingen godkjente kandidater å stemme på ennå.
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-neutral-600">
                  Velg én kandidat og bekreft med knappen nedenfor. Stemmegivningen er hemmelig.
                </p>
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                      <th className={TH}>Kandidat</th>
                      <th className={TH}>Valg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedCandidates.map((c) => {
                      const selected = selectedCandidateId === c.id
                      return (
                        <tr key={c.id} className={LAYOUT_TABLE1_POSTINGS_BODY_ROW}>
                          <td className="px-5 py-3 whitespace-normal">
                            <span className="font-medium text-neutral-900">{nameByUserId.get(c.user_id) ?? c.user_id}</span>
                            {c.manifesto ? (
                              <p className="mt-1 max-w-2xl text-xs text-neutral-600">{c.manifesto}</p>
                            ) : null}
                          </td>
                          <td className="px-5 py-3">
                            <Button
                              type="button"
                              variant={selected ? 'primary' : 'secondary'}
                              size="sm"
                              onClick={() => setSelectedCandidateId(c.id)}
                            >
                              {selected ? 'Valgt' : 'Velg'}
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="flex justify-center border-t border-neutral-100 pt-6">
                  <Button
                    type="button"
                    variant="primary"
                    size="default"
                    disabled={!selectedCandidateId || casting}
                    onClick={() => void onCastVote()}
                  >
                    {casting ? 'Sender stemme…' : 'Avgi stemme'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'resultater' && election.status === 'closed' && (
          <div className="space-y-6 px-5 py-6">
            {voteTotals.length === 0 || maxVotes === 0 ? (
              <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
                Ingen stemmer avgitt.
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-sm text-neutral-600">Aggregerte stemmer (anonymisert).</p>
                {voteTotals.map((t) => {
                  const cand = candidates.find((c) => c.id === t.candidate_id)
                  const label = cand ? nameByUserId.get(cand.user_id) ?? cand.user_id : t.candidate_id
                  const pct = maxVotes > 0 ? Math.round((t.vote_count / maxVotes) * 100) : 0
                  return (
                    <div key={t.candidate_id} className="rounded-md border border-neutral-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-900">{label}</span>
                        <Badge variant="info">{t.vote_count} stemmer</Badge>
                      </div>
                      <div className="mt-2 h-3 w-full overflow-hidden rounded-sm bg-neutral-100">
                        <div
                          className="h-full rounded-sm bg-[#1a3d32] transition-all"
                          style={{ width: `${pct}%` }}
                          role="presentation"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <SlidePanel
        open={nominateOpen}
        onClose={() => setNominateOpen(false)}
        titleId="amu-nominate-title"
        title="Nominer kandidat"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNominateOpen(false)}>
              Avbryt
            </Button>
            <Button type="button" variant="primary" disabled={nomSaving} onClick={() => void submitNomination()}>
              {nomSaving ? 'Lagrer…' : 'Send nominasjon'}
            </Button>
          </div>
        }
      >
        <div className="space-y-0">
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Kandidat</span>
            <SearchableSelect
              value={nomUserId}
              onChange={(v) => setNomUserId(v)}
              options={assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))}
              placeholder="Søk etter medarbeider…"
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-nom-manifesto">
              Manifest / begrunnelse
            </label>
            <StandardTextarea id="amu-nom-manifesto" value={nomManifesto} onChange={(e) => setNomManifesto(e.target.value)} rows={5} />
          </div>
        </div>
      </SlidePanel>
    </div>
  )
}

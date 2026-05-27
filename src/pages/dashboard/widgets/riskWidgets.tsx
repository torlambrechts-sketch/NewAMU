// Risiko & styring-widgets: RAID, ApprovalChains, EscalationLadder, AuditStream.

import { useMemo, useState } from 'react'
import { ScrollText, Search } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import {
  useDashboardData,
  type DashboardApprovalRow,
  type DashboardEscalationRow,
  type DashboardTaskRow,
} from '../useDashboardData'
import { Avatar, Chip, EmptyState, FactsRow, KpiStrip, WidgetCard } from './widgetShared'

// ── RAID + risk matrix ──────────────────────────────────────────────────────

type RaidRisk = {
  id: string
  title: string
  detail: string
  trigger: string
  probability: 1 | 2 | 3 | 4 | 5
  consequence: 1 | 2 | 3 | 4 | 5
  mitigation: string
  owner: string
  status: string
}

function deriveRisks(tasks: DashboardTaskRow[]): RaidRisk[] {
  // Generere ein liste av risiki ut fra task_items: overdue, blocked,
  // mangler lov-referanse osv. + tre faste eksempler fra HMS-domenet.
  const overdueCount = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'closed').length
  const blockedCount = tasks.filter((t) => t.status === 'cancelled').length
  const psyTasks = tasks.filter((t) => t.law_refs.includes('AML § 4-3'))
  const totalLawCoverage = new Set(tasks.flatMap((t) => t.law_refs)).size

  const dynamic: RaidRisk[] = []

  if (overdueCount > 0) {
    dynamic.push({
      id: 'R1',
      title: `${overdueCount} oppgaver er forsinket`,
      detail: 'Oppgaver med frist før dagens dato som ikke er lukket. Risiko for at lovbestemte frister brytes.',
      trigger: 'task_items.due_date < today',
      probability: Math.min(5, Math.max(2, Math.ceil(overdueCount / 5))) as 1 | 2 | 3 | 4 | 5,
      consequence: 4,
      mitigation: 'Eskaleringsstige E01 — varsle daglig leder',
      owner: 'HMS-ansvarlig',
      status: 'Aktiv kontroll',
    })
  }
  if (blockedCount > 0) {
    dynamic.push({
      id: 'R2',
      title: `${blockedCount} kansellerte saker`,
      detail: 'Sagsbehandlingen er stoppet. Hvorfor? Manglende ressurser, blokkerende avhengighet, eller utdatert mal.',
      trigger: 'task_items.status = cancelled',
      probability: 3,
      consequence: 3,
      mitigation: 'AMU-gjennomgang av blokkere',
      owner: 'AMU',
      status: 'Overvåking',
    })
  }
  if (psyTasks.length === 0) {
    dynamic.push({
      id: 'R3',
      title: 'Psykososial-rutiner mangler',
      detail: 'Ingen task_items knyttet til AML § 4-3. Nye psykososial-krav trådte i kraft 1. jan 2026.',
      trigger: 'Lovendring',
      probability: 3,
      consequence: 4,
      mitigation: 'Iverksett D-01 STAMI-kartlegging vår',
      owner: 'BHT + HMS-ansvarlig',
      status: 'Plan',
    })
  }
  if (totalLawCoverage < 50) {
    dynamic.push({
      id: 'R4',
      title: `Lav lov-dekning (${totalLawCoverage} unike refs)`,
      detail: 'Få oppgaver bærer law_refs. Ved revisjon vanskelig å vise systematisk etterlevelse.',
      trigger: 'count(distinct law_refs)',
      probability: 2,
      consequence: 4,
      mitigation: 'Kjør cadence-veiviseren for å bygge ut maler med law_refs',
      owner: 'Daglig leder',
      status: 'Aktiv kontroll',
    })
  }

  // Faste eksempler fra HMS-domenet
  dynamic.push(
    {
      id: 'R5',
      title: 'Lederbytte før AMU-4',
      detail: 'HVO har varslet pensjonering. Mister erfaring + stansrett-kompetanse.',
      trigger: 'Personalfeed',
      probability: 4,
      consequence: 5,
      mitigation: 'Opplæring av stedfortredende juni–august',
      owner: 'Daglig leder',
      status: 'Eskalert',
    },
    {
      id: 'R6',
      title: 'STAMI-svarprosent under 80%',
      detail: 'Krav for valid kartlegging. Industri-snitt 64%. Ved lav svar — må gjentas.',
      trigger: 'Påminnelser før kartlegging',
      probability: 3,
      consequence: 4,
      mitigation: 'Lønnet tid · ledersamtaler · gevinst-info',
      owner: 'HMS-ansvarlig',
      status: 'Aktiv kontroll',
    },
    {
      id: 'R7',
      title: 'BHT-kontrakt utløper 31. des',
      detail: 'Reforhandling — pris og dekning kan endres.',
      trigger: 'Kontraktslogg',
      probability: 1,
      consequence: 2,
      mitigation: 'Innhent 2 tilbud · sammenligningsanalyse',
      owner: 'HMS-ansvarlig',
      status: 'Planlagt Q4',
    },
  )

  return dynamic
}

function riskScoreClass(score: number): { chip: 'success' | 'warn' | 'danger'; cell: string } {
  if (score >= 15) return { chip: 'danger', cell: 'bg-[#A03826] text-white' }
  if (score >= 9) return { chip: 'warn', cell: 'bg-[#B8761F] text-white' }
  if (score >= 4) return { chip: 'warn', cell: 'bg-[#D9A968] text-[#5a3a0e]' }
  return { chip: 'success', cell: 'bg-[#7FA38C] text-white' }
}

export function RaidWidget() {
  const data = useDashboardData()
  const risks = useMemo(() => deriveRisks(data.tasks), [data.tasks])
  const issueCount = data.tasks.filter((t) => t.status === 'cancelled').length

  const total = risks.length
  const high = risks.filter((r) => r.probability * r.consequence >= 12).length
  const medium = risks.filter((r) => {
    const s = r.probability * r.consequence
    return s >= 6 && s < 12
  }).length
  const low = total - high - medium

  return (
    <div className="space-y-3">
      {/* Tab-stripa har historisk hatt 4 RAID-faner (R/A/I/D), men kun
          Risks + Issues har innhold i dag. Vi viser dem og varsler i
          footeren at A og D er på Phase-2-roadmappen. */}
      <div className="flex items-center gap-0 border-b border-neutral-200">
        <span className="relative h-auto rounded-none px-4 py-2.5 text-[12px] font-semibold tracking-wide text-neutral-900">
          Risks ({risks.length})
          <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[#BA0C2F]" aria-hidden />
        </span>
        <span className="px-4 py-2.5 text-[12px] font-medium text-neutral-500">
          Issues ({issueCount})
        </span>
        <span className="ml-auto px-4 py-2.5 text-[10.5px] uppercase tracking-wider text-neutral-400">
          Assumptions · Decisions kommer i neste fase
        </span>
      </div>

      <>
          <KpiStrip
            items={[
              { label: 'Åpne risiki', value: total, sub: `${high} høye · ${medium} middels · ${low} lave`, tone: high > 0 ? 'warn' : 'success' },
              { label: 'Risikoreduksjon i år', value: '-37%', sub: 'fra Q1', tone: 'dark' },
              { label: 'Under aktiv kontroll', value: risks.filter((r) => r.status === 'Aktiv kontroll').length, sub: `av ${total} risiki` },
              { label: 'Issues lukket', value: data.tasks.filter((t) => t.status === 'closed').length, sub: 'task_items closed' },
            ]}
          />

          <WidgetCard title="Risikomatrise" subtitle="Plassering: sannsynlighet × konsekvens">
            <div className="overflow-x-auto">
              <div className="grid min-w-[600px] grid-cols-[80px_repeat(5,1fr)] gap-0 overflow-hidden rounded-md border border-neutral-200 bg-white">
                <div className="bg-neutral-50 px-3 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-neutral-500" style={{ writingMode: 'vertical-rl' as const }}>
                  Sannsynlighet
                </div>
                {/* 5x5 grid */}
                {[5, 4, 3, 2, 1].map((p) => (
                  Array.from({ length: 5 }).map((_, c) => {
                    const cons = c + 1
                    const score = p * cons
                    const cls = riskScoreClass(score).cell
                    const inThisCell = risks.filter((r) => r.probability === p && r.consequence === cons)
                    return (
                      <div
                        key={`${p}-${c}`}
                        className={`relative aspect-[2.5/1] border-l border-t border-neutral-100 ${score >= 15 ? 'bg-[#F0D9D2]' : score >= 9 ? 'bg-[#F4E8D2]' : score >= 4 ? 'bg-[#FFF8E8]' : 'bg-[#E4ECDF]'}`}
                        aria-label={`Sannsynlighet ${p}, konsekvens ${cons}, score ${score}`}
                      >
                        <div className="absolute right-1 top-1 font-mono text-[10px] font-semibold text-neutral-700">{score}</div>
                        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 p-2">
                          {inThisCell.map((r) => (
                            <span key={r.id} className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-semibold shadow ring-2 ring-white ${cls}`} title={r.title}>
                              {r.id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ))}
                <div className="col-span-1 col-start-1" />
                <div className="col-span-5 bg-neutral-50 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  Konsekvens · lav → katastrofal
                </div>
              </div>
            </div>
          </WidgetCard>

          <WidgetCard title="RAID-tabell · åpne risiki">
            <div className="divide-y divide-neutral-100">
              <div className="grid grid-cols-[60px_1.5fr_1fr_90px_1fr_120px] gap-3 bg-neutral-50 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                <div>ID</div>
                <div>Beskrivelse</div>
                <div>Trigger</div>
                <div className="text-center">P × K</div>
                <div>Tiltak</div>
                <div>Eier · status</div>
              </div>
              {risks.map((r) => {
                const score = r.probability * r.consequence
                const tone = riskScoreClass(score).chip
                return (
                  <div key={r.id} className="grid grid-cols-[60px_1.5fr_1fr_90px_1fr_120px] gap-3 px-4 py-3 text-[12px]">
                    <div className="font-mono text-[11px] font-bold text-[#BA0C2F]">{r.id}</div>
                    <div>
                      <div className="font-medium text-neutral-900">{r.title}</div>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{r.detail}</div>
                    </div>
                    <div className="text-[11.5px] text-neutral-500">{r.trigger}</div>
                    <div className="text-center"><Chip tone={tone}>{r.probability} × {r.consequence} = {score}</Chip></div>
                    <div className="text-[11.5px]">{r.mitigation}</div>
                    <div>
                      <div className="text-[12px] font-medium">{r.owner}</div>
                      <div className="text-[10.5px] text-neutral-500">{r.status}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </WidgetCard>
        </>
    </div>
  )
}

// ── Approval Chains ─────────────────────────────────────────────────────────

export function ApprovalChainsWidget() {
  const data = useDashboardData()

  const chains = useMemo(() => {
    const m = new Map<string, DashboardApprovalRow[]>()
    for (const a of data.approvals) {
      const arr = m.get(a.chain_code) ?? []
      arr.push(a)
      m.set(a.chain_code, arr)
    }
    return Array.from(m.entries())
  }, [data.approvals])

  return (
    <div className="space-y-3">
      {chains.map(([chainCode, steps]) => (
        <WidgetCard
          key={chainCode}
          title={`${chainCode} · ${steps[0]?.chain_label ?? ''}`}
          subtitle={`${steps.length} trinn · samme rekkefølge for alle saker av denne typen`}
        >
          <div className="overflow-x-auto">
            <div className="flex min-w-[700px] items-stretch gap-2">
              {steps.map((step, idx) => {
                const isFirst = idx === 0
                const isLast = idx === steps.length - 1
                return (
                  <div key={`${step.step_order}-${idx}`} className="flex flex-1 items-stretch">
                    <div className={`min-w-[160px] flex-1 rounded-lg border-[1.5px] p-4 ${
                      isFirst ? 'border-[#7FA38C] bg-[#E4ECDF]'
                      : isLast ? 'border-[#3B5BDB] bg-[#E1E7F7]'
                      : 'border-neutral-200 bg-neutral-50'
                    }`}>
                      <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                        TRINN {String(step.step_order).padStart(2, '0')}
                      </div>
                      <div className="mt-1 font-serif text-[14px] font-medium leading-tight">{step.step_title}</div>
                      {step.step_meta ? <div className="mt-1.5 text-[11px] text-neutral-500">{step.step_meta}</div> : null}
                      <div className="mt-2.5">
                        <ApprovalKindBadge kind={step.step_kind} />
                      </div>
                      {step.sla_days != null ? (
                        <div className="mt-1.5 text-[10.5px] text-neutral-500 font-mono">
                          SLA: {step.sla_days} dager
                        </div>
                      ) : null}
                    </div>
                    {!isLast && <span className="flex items-center px-2 text-xl text-neutral-300">→</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </WidgetCard>
      ))}
    </div>
  )
}

function ApprovalKindBadge({ kind }: { kind: 'utforer' | 'qa' | 'sluttsignering' | 'kollegialt' | 'informeres' }) {
  switch (kind) {
    case 'utforer': return <Chip tone="info">Utfører</Chip>
    case 'qa': return <Chip tone="warn">QA</Chip>
    case 'sluttsignering': return <Chip tone="success">Sluttsignering</Chip>
    case 'kollegialt': return <Chip tone="warn">Kollegialt vedtak</Chip>
    case 'informeres': return <Chip tone="paper">Informeres</Chip>
  }
}

// ── Escalation Ladder ───────────────────────────────────────────────────────

export function EscalationLadderWidget() {
  const data = useDashboardData()

  const ladders = useMemo(() => {
    const m = new Map<string, DashboardEscalationRow[]>()
    for (const e of data.escalations) {
      const arr = m.get(e.ladder_code) ?? []
      arr.push(e)
      m.set(e.ladder_code, arr)
    }
    return Array.from(m.entries())
  }, [data.escalations])

  return (
    <div className="space-y-3">
      {ladders.map(([code, steps]) => (
        <WidgetCard
          key={code}
          title={`${code} · ${steps[0]?.ladder_label ?? ''}`}
          subtitle={`${steps.length} eskaleringsnivåer · relativ til frist`}
          bodyPad={false}
        >
          <div className="divide-y divide-neutral-100">
            {steps.map((s) => {
              const dayLabel = s.relative_day === 0 ? '0 d' : s.relative_day > 0 ? `+${s.relative_day} d` : `${s.relative_day} d`
              const rowBg =
                s.severity === 'kritisk' ? 'bg-[#F0D9D2]'
                : s.severity === 'streng' ? 'bg-[#F4E8D2]'
                : 'bg-white'
              return (
                <div key={`${s.ladder_code}-${s.step_order}`} className={`grid grid-cols-[90px_1fr_180px_120px] items-start gap-4 px-5 py-4 ${rowBg}`}>
                  <span className="rounded-md bg-white px-2 py-1.5 text-center font-mono text-[14px] font-medium shadow-sm">
                    {dayLabel}
                  </span>
                  <div>
                    <div className="text-[13.5px] font-medium leading-snug">{s.trigger_label}</div>
                    {s.trigger_note ? <div className="mt-0.5 text-[11.5px] text-neutral-500">{s.trigger_note}</div> : null}
                  </div>
                  <div>
                    <div className="text-[12px] text-neutral-700">{s.action_label}</div>
                    {s.action_note ? <div className="mt-0.5 text-[11px] text-neutral-500">{s.action_note}</div> : null}
                  </div>
                  <div>
                    <SeverityBadge severity={s.severity} />
                  </div>
                </div>
              )
            })}
          </div>
        </WidgetCard>
      ))}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: 'mild' | 'standard' | 'streng' | 'kritisk' | 'stille' }) {
  switch (severity) {
    case 'mild': return <Chip tone="success">Mild</Chip>
    case 'standard': return <Chip tone="info">Standard</Chip>
    case 'streng': return <Chip tone="warn">Streng</Chip>
    case 'kritisk': return <Chip tone="danger">Kritisk</Chip>
    case 'stille': return <Chip tone="paper">Stille</Chip>
  }
}

// ── Audit Stream ────────────────────────────────────────────────────────────

const AUDIT_PAGE_SIZE = 20

export function AuditStreamWidget() {
  const data = useDashboardData()
  const [search, setSearch] = useState('')
  // Sider 1 → 1×PAGE_SIZE = 20 rader, sider 2 → 40 rader osv. Vi
  // unngår uendelig scroll for at brukeren skal beholde kontekstplassen
  // i tab-stripa over.
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.audit
    return data.audit.filter((a) =>
      a.action.toLowerCase().includes(q) ||
      a.table_name.toLowerCase().includes(q) ||
      (a.changed_by_name ?? '').toLowerCase().includes(q),
    )
  }, [data.audit, search])

  const visible = useMemo(() => filtered.slice(0, page * AUDIT_PAGE_SIZE), [filtered, page])
  const hasMore = visible.length < filtered.length

  return (
    <WidgetCard
      title="Revisjonsspor"
      subtitle="Uforanderlig logg av endringer på tvers av HMS-tabeller"
      rightSlot={
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" aria-hidden />
          <StandardInput
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk handling, tabell eller person …"
            aria-label="Søk i revisjonsspor"
            className="w-72 !py-1.5 pl-8 text-[12px]"
          />
        </div>
      }
      bodyPad={false}
    >
      {filtered.length === 0 ? (
        <EmptyState Icon={ScrollText} title="Ingen revisjonshendelser" body={search ? `Ingen treff på «${search}».` : 'Audit-loggen er tom — gjør en endring for å se den her.'} />
      ) : (
        <div className="divide-y divide-neutral-100">
          {visible.map((a) => (
            <div key={a.id} className="grid grid-cols-[140px_36px_1fr_140px] gap-4 px-5 py-3.5 text-[12.5px]">
              <div className="font-mono text-[11px] text-neutral-500">
                {new Date(a.changed_at).toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}<br />
                {new Date(a.changed_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full border bg-neutral-100 font-mono text-[11px] font-semibold uppercase">
                <AuditActionIcon action={a.action} />
              </div>
              <div>
                <div className="text-[12.5px] leading-snug">
                  <strong>{a.action.toUpperCase()}</strong>
                  {' i tabell '}
                  <code className="rounded border border-neutral-200 bg-neutral-50 px-1 py-0.5 font-mono text-[11px]">{a.table_name}</code>
                  {a.record_id ? <span className="text-neutral-500"> (id <code className="font-mono text-[10.5px]">{a.record_id.slice(0, 8)}…</code>)</span> : null}
                </div>
                <FactsRow items={[<span key="t">{a.table_name}</span>, <span key="r">record</span>]} />
              </div>
              <div className="flex items-center justify-end gap-2 text-right">
                <div>
                  <div className="text-[12px] font-medium leading-tight">{a.changed_by_name ?? 'Systemhendelse'}</div>
                  <div className="text-[10.5px] text-neutral-500">{a.changed_by ? 'Bruker' : 'System'}</div>
                </div>
                <Avatar name={a.changed_by_name ?? 'System'} userId={a.changed_by ?? undefined} />
              </div>
            </div>
          ))}
        </div>
      )}
      {filtered.length > 0 ? (
        <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-[11px] text-neutral-500">
          <span>
            Viser {visible.length} av {filtered.length} hendelser
            {data.limits.auditTruncated ? <> (siste {filtered.length} av totalt mange — last inn modulside for full liste)</> : null}
          </span>
          {hasMore ? (
            <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)}>
              Vis flere ({Math.min(AUDIT_PAGE_SIZE, filtered.length - visible.length)})
            </Button>
          ) : null}
        </div>
      ) : null}
    </WidgetCard>
  )
}

function AuditActionIcon({ action }: { action: string }) {
  const a = action.toUpperCase()
  if (a.includes('INSERT') || a.includes('CREATE')) return <span className="text-[#3F6B4F]">+</span>
  if (a.includes('UPDATE') || a.includes('MODIFY')) return <span className="text-[#B8761F]">~</span>
  if (a.includes('DELETE')) return <span className="text-[#A03826]">×</span>
  return <span className="text-neutral-500">·</span>
}


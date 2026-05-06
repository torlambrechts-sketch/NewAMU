import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  ListChecks,
  Pencil,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ModuleSectionCard } from '../../../src/components/module'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { InfoBox } from '../../../src/components/ui/AlertBox'
import type { AmuHook } from './types'
import type { AmuMeeting } from '../types'

const SERIF_STYLE = { fontFamily: "'Libre Baskerville', Georgia, serif" } as const
const STATUS_BAR_COLOR: Record<AmuMeeting['status'], string> = {
  signed: '#1a3d32',
  in_progress: '#c9a227',
  scheduled: '#7faa97',
  completed: '#7faa97',
  draft: '#d4d4d4',
  archived: '#d4d4d4',
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nb-NO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatDayShort(iso: string): { day: string; month: string } {
  const d = new Date(iso)
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('nb-NO', { month: 'short' }),
  }
}

function formatHHMMSS(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / 1000))
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function YearCadence({ meetings, year }: { meetings: AmuMeeting[]; year: number }) {
  const monthLabels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const byMonth = new Map<number, AmuMeeting[]>()
  meetings
    .filter((m) => m.year === year)
    .forEach((m) => {
      const k = new Date(m.scheduled_at).getMonth()
      const list = byMonth.get(k) ?? []
      list.push(m)
      byMonth.set(k, list)
    })

  return (
    <div className="rounded-lg border border-neutral-200 bg-[#fbf9f3] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Møtekadens · {year}</p>
        <p className="text-xs text-neutral-500">Krav: minst 4 møter (AML § 7-2)</p>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {Array.from({ length: 12 }, (_, i) => {
          const items = byMonth.get(i) ?? []
          const has = items.length > 0
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-full items-end justify-center rounded" style={{ background: '#f0ecdf' }}>
                {has ? (
                  <div
                    className="w-full rounded transition-all"
                    style={{ height: '100%', background: STATUS_BAR_COLOR[items[0].status], minHeight: 8 }}
                    title={items[0].title}
                  />
                ) : null}
              </div>
              <span className="text-[10px] font-semibold text-neutral-500">{monthLabels[i]}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        {[
          { c: '#1a3d32', l: 'Signert' },
          { c: '#c9a227', l: 'Pågår' },
          { c: '#7faa97', l: 'Planlagt' },
          { c: '#d4d4d4', l: 'Kladd' },
        ].map((it) => (
          <span key={it.l} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: it.c }} />
            <span className="text-neutral-600">{it.l}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function meetingStatusBadge(s: AmuMeeting['status']): { variant: 'success' | 'warning' | 'info' | 'neutral'; label: string } {
  if (s === 'signed') return { variant: 'success', label: 'Signert' }
  if (s === 'in_progress') return { variant: 'warning', label: 'Pågår' }
  if (s === 'scheduled') return { variant: 'info', label: 'Berammet' }
  if (s === 'completed') return { variant: 'neutral', label: 'Avsluttet' }
  if (s === 'archived') return { variant: 'neutral', label: 'Arkivert' }
  return { variant: 'neutral', label: 'Kladd' }
}

export function OverviewTab({
  amu,
  onOpenReport,
  onOpenLive,
  onOpenAgenda,
  onOpenMembers,
  onOpenCritical,
}: {
  amu: AmuHook
  onOpenReport?: () => void
  onOpenLive?: () => void
  onOpenAgenda?: () => void
  onOpenMembers?: () => void
  onOpenCritical?: () => void
}) {
  const year = new Date().getFullYear()
  const next =
    amu.meetings.find((m) => m.status === 'in_progress') ??
    amu.meetings.find((m) => m.status === 'scheduled' || m.status === 'draft')
  const isLive = next?.status === 'in_progress'

  useEffect(() => {
    if (!next?.id) return
    void amu.loadMeetingDetail(next.id).catch(() => {})
  }, [next?.id, amu.loadMeetingDetail])

  // Live ticking timer based on the meeting's scheduled_at when it's in progress.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isLive) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [isLive])

  const liveTimer = useMemo(() => {
    if (!isLive || !next) return null
    return formatHHMMSS(now - new Date(next.scheduled_at).getTime())
  }, [isLive, next, now])

  const nextAgenda = next
    ? amu.agendaItems.filter((a) => a.meeting_id === next.id).sort((a, b) => a.position - b.position)
    : []

  const presentCount = next
    ? amu.attendance.filter(
        (a) => a.meeting_id === next.id && (a.status === 'present' || a.status === 'digital'),
      ).length
    : 0
  const quorumThreshold = 4

  const employer = amu.members.filter((m) => m.side === 'employer' && m.active).length
  const employee = amu.members.filter((m) => m.side === 'employee' && m.active).length

  const openActions = amu.decisions.filter((d) => d.responsible_member_id && d.due_date).length
  const todayMs = Date.now()

  const meetingsThisYear = amu.meetings.filter((m) => m.year === year)
  const heldThisYear = meetingsThisYear.filter((m) => m.status === 'signed').length
  const requiredThisYear = amu.compliance?.meetings_required ?? 4
  const scheduledThisYear = meetingsThisYear.length

  const comp = amu.compliance

  const kpis: { big: string | number; title: string; sub: string }[] = [
    {
      big: `${heldThisYear}/${requiredThisYear}`,
      title: 'Møter avholdt',
      sub: `${scheduledThisYear} berammet i ${year}`,
    },
    {
      big: amu.members.length,
      title: 'Medlemmer',
      sub: `${employer} arbeidsgiver / ${employee} arbeidstaker`,
    },
    {
      big: amu.criticalQueue.length,
      title: 'Kritiske aktiviteter',
      sub: 'krever oppfølging fra AMU',
    },
    {
      big: openActions,
      title: 'Åpne tiltak',
      sub: 'fra tidligere møter',
    },
  ]

  // Compliance scorecard rows (8 items)
  const compRows: { label: string; ok: boolean; partial?: boolean; ref: string; detail: string }[] = comp
    ? [
        {
          label: 'Minst 4 møter i året',
          ok: comp.meetings_held >= comp.meetings_required,
          partial: scheduledThisYear >= comp.meetings_required,
          ref: 'AML § 7-2',
          detail: `${comp.meetings_held} avholdt · ${scheduledThisYear} berammet`,
        },
        {
          label: 'Lik representasjon (paritet)',
          ok: comp.parity_ok,
          ref: 'AML § 7-1 (2)',
          detail:
            employer === employee
              ? `${employer} fra hver side`
              : `${employer} arbeidsgiver vs ${employee} arbeidstaker — krever justering`,
        },
        {
          label: 'BHT representert',
          ok: comp.bht_present,
          ref: 'AML § 7-1 (3)',
          detail: amu.committee?.bht_provider ?? (comp.bht_present ? 'BHT er representert' : 'Mangler'),
        },
        {
          label: 'HMS-kurs (40t) gyldig for alle',
          ok: comp.hms_training_all_valid,
          ref: 'FOR § 3-18',
          detail: comp.hms_training_all_valid ? 'Alle gyldige' : 'En eller flere har utløpt',
        },
        {
          label: `Årsrapport ${year - 1} signert`,
          ok: comp.annual_report_signed,
          ref: 'AML § 7-2 (6)',
          detail: comp.annual_report_signed ? 'Signert og arkivert' : 'Ikke signert',
        },
        {
          label: 'Rotering av lederverv',
          ok: comp.legal_refs_satisfied.some((r) => r.includes('7-5')),
          ref: 'AML § 7-5',
          detail: amu.committee
            ? `${amu.committee.term_start.slice(0, 4)}: ${amu.committee.chair_side === 'employee' ? 'arbeidstakerside' : 'arbeidsgiverside'}`
            : 'Konfigurer utvalg',
        },
        {
          label: 'Innkalling ≥ 14 dager før møte',
          ok: true,
          ref: 'God praksis',
          detail: 'Auto-utsendelse aktivert',
        },
        {
          label: 'Referat distribueres til alle ansatte',
          ok: true,
          ref: 'AML § 7-2 (6)',
          detail: 'Auto-distribusjon på · arbeidsflyt aktiv',
        },
      ]
    : []

  const quickNav: { icon: LucideIcon; label: string; sub: string; onClick?: () => void }[] = [
    {
      icon: Users,
      label: 'Medlemmer og sammensetning',
      sub: `${amu.members.length} medlemmer${comp && !comp.parity_ok ? ' · paritet ⚠' : ''}`,
      onClick: onOpenMembers,
    },
    {
      icon: ListChecks,
      label: 'Sakslistemaler',
      sub: 'Konfigurer standard saksliste',
      onClick: onOpenAgenda,
    },
    {
      icon: FileText,
      label: `Årsrapport ${year}`,
      sub: amu.annualReport?.status === 'signed' ? 'Signert' : 'Kladd under arbeid',
      onClick: onOpenReport,
    },
    {
      icon: Activity,
      label: 'Kritiske saker',
      sub: `${amu.criticalQueue.length} åpne`,
      onClick: onOpenCritical,
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── KPI ROW ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <ModuleSectionCard key={k.title} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{k.title}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-neutral-900">{k.big}</p>
            <p className="mt-1 text-xs text-neutral-600">{k.sub}</p>
          </ModuleSectionCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* ── ACTIVE / NEXT MEETING CARD ─────────────────────────────── */}
          {next ? (
            <ModuleSectionCard className="overflow-hidden !p-0">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 bg-[#1a3d32] px-5 py-4 text-white">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    {isLive ? 'Pågår nå' : 'Neste møte'}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold" style={SERIF_STYLE}>
                    {next.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/85">{formatDateTime(next.scheduled_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/95 px-3 py-1 text-[11px] font-semibold text-amber-900">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-700 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-700" />
                      </span>
                      Live · {liveTimer}
                    </span>
                  ) : (
                    <Badge variant="info">Berammet</Badge>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    icon={<ArrowRight className="h-4 w-4" />}
                    className="!bg-white !text-[#1a3d32] hover:!bg-neutral-100"
                    onClick={() => {
                      if (isLive) {
                        onOpenLive?.()
                      } else if (amu.canManage) {
                        void amu.startMeeting(next.id).then(() => onOpenLive?.())
                      } else {
                        onOpenLive?.()
                      }
                    }}
                  >
                    {isLive ? 'Gå inn i møterom' : 'Forbered møte'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3">
                <div className="border-b border-neutral-100 px-5 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sted</p>
                  <p className="mt-1 text-sm text-neutral-900">{next.location ?? '—'}</p>
                  {next.is_hybrid ? <p className="mt-0.5 text-xs text-neutral-500">Hybrid — fysisk + Teams</p> : null}
                </div>
                <div className="border-b border-neutral-100 px-5 py-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Saker</p>
                  <p className="mt-1 text-sm text-neutral-900">
                    {nextAgenda.length} saker
                    {nextAgenda.length > 0 ? (
                      <span className="text-neutral-500">
                        {' '}
                        · {nextAgenda.filter((i) => i.status === 'decided').length} behandlet
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Frammøte</p>
                  <p className="mt-1 text-sm text-neutral-900">
                    {presentCount} av {amu.members.length} til stede
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Quorum {presentCount >= quorumThreshold ? 'oppfylt' : 'ikke oppfylt'} (≥{quorumThreshold})
                  </p>
                </div>
              </div>

              <div className="border-t border-neutral-100 px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Saksliste</p>
                  {amu.canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={onOpenAgenda}
                    >
                      Rediger
                    </Button>
                  ) : null}
                </div>
                {nextAgenda.length === 0 ? (
                  amu.canManage ? (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => void amu.generateAutoAgenda(next.id)}
                    >
                      Generer saksliste automatisk
                    </Button>
                  ) : (
                    <InfoBox>Ingen saksliste publisert ennå.</InfoBox>
                  )
                ) : (
                  <ol className="space-y-1.5">
                    {nextAgenda.slice(0, 6).map((item) => {
                      const isActive = item.status === 'active'
                      const isDone = item.status === 'decided'
                      return (
                        <li
                          key={item.id}
                          className={`flex items-center gap-3 rounded px-2 py-1.5 ${
                            isActive ? 'bg-amber-50' : ''
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              isDone
                                ? 'bg-[#1a3d32] text-white'
                                : isActive
                                  ? 'bg-amber-400 text-amber-900'
                                  : 'bg-neutral-100 text-neutral-600'
                            }`}
                          >
                            {isDone ? <Check className="h-3.5 w-3.5" /> : item.position}
                          </span>
                          <span
                            className={`flex-1 text-sm ${isDone ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}
                          >
                            {item.title}
                          </span>
                          {item.legal_ref ? (
                            <span className="font-mono text-[10px] text-neutral-400">{item.legal_ref}</span>
                          ) : null}
                          {isActive ? <Badge variant="warning">Behandles</Badge> : null}
                        </li>
                      )
                    })}
                    {nextAgenda.length > 6 ? (
                      <li className="px-2 pt-1 text-xs text-neutral-500">+ {nextAgenda.length - 6} flere saker…</li>
                    ) : null}
                  </ol>
                )}
              </div>
            </ModuleSectionCard>
          ) : (
            <ModuleSectionCard className="p-5">
              <InfoBox>Ingen kommende møter. Beram neste møte under Møteplan.</InfoBox>
            </ModuleSectionCard>
          )}

          {/* ── COMPLIANCE SCORECARD ───────────────────────────────────── */}
          <ModuleSectionCard className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900">
                Lovkrav {year} — samsvarsstatus
              </h2>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                icon={<ShieldCheck className="h-4 w-4" />}
                onClick={onOpenCritical}
              >
                Åpne kritiske saker
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {compRows.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-start gap-3 rounded-lg border p-3 ${
                    row.ok
                      ? 'border-neutral-200 bg-white'
                      : row.partial
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-red-200 bg-red-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                      row.ok
                        ? 'bg-green-100 text-green-700'
                        : row.partial
                          ? 'bg-amber-200 text-amber-800'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.ok ? (
                      <Check className="h-3 w-3" strokeWidth={3} />
                    ) : row.partial ? (
                      <AlertTriangle className="h-3 w-3" strokeWidth={3} />
                    ) : (
                      <X className="h-3 w-3" strokeWidth={3} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900">{row.label}</p>
                      <span className="font-mono text-[10px] text-neutral-500">{row.ref}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-600">{row.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </ModuleSectionCard>

          {/* ── YEAR CADENCE + MEETING LIST ────────────────────────────── */}
          <ModuleSectionCard className="p-5">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Møtekadens og historikk</h2>
            <YearCadence meetings={amu.meetings} year={year} />
            {meetingsThisYear.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {meetingsThisYear
                  .slice()
                  .sort(
                    (a, b) =>
                      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
                  )
                  .map((m) => {
                    const sb = meetingStatusBadge(m.status)
                    const ds = formatDayShort(m.scheduled_at)
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
                      >
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded bg-[#f1ecdf] text-center">
                          <span className="text-[9px] font-semibold uppercase text-neutral-500">{ds.month}</span>
                          <span className="text-sm font-bold leading-none text-neutral-900">{ds.day}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-neutral-900">{m.title}</p>
                          <p className="truncate text-xs text-neutral-500">{m.location ?? '—'}</p>
                        </div>
                        <Badge variant={sb.variant}>{sb.label}</Badge>
                      </div>
                    )
                  })}
              </div>
            ) : null}
          </ModuleSectionCard>
        </div>

        {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* CRITICAL QUEUE */}
          <ModuleSectionCard className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-neutral-900">Kritisk kø</h2>
              <Badge variant={amu.criticalQueue.length > 0 ? 'danger' : 'neutral'}>
                {amu.criticalQueue.length} åpne
              </Badge>
            </div>
            {amu.criticalQueue.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-500">Ingen kritiske aktiviteter</p>
            ) : (
              <div className="space-y-2">
                {amu.criticalQueue.map((c) => (
                  <div
                    key={`${c.item_type}-${c.source_id}`}
                    className={`rounded border-l-4 p-3 ${
                      c.severity === 'high' ? 'border-l-red-500 bg-red-50' : 'border-l-amber-400 bg-amber-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {c.severity === 'high' ? (
                        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-neutral-900">{c.label}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button variant="primary" size="sm" type="button" onClick={onOpenCritical}>
                        Åpne
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModuleSectionCard>

          {/* OPEN ACTIONS / DECISIONS WITH DUE-DATE */}
          {amu.decisions.some((d) => d.due_date) ? (
            <ModuleSectionCard className="p-5">
              <h2 className="mb-3 text-base font-semibold text-neutral-900">Åpne tiltak fra tidligere møter</h2>
              <div className="space-y-2">
                {amu.decisions
                  .filter((d) => d.due_date)
                  .slice(0, 6)
                  .map((d) => {
                    const member = amu.members.find((m) => m.id === d.responsible_member_id)
                    const dueMs = d.due_date ? new Date(d.due_date).getTime() : 0
                    const overdue = dueMs > 0 && dueMs < todayMs
                    return (
                      <div key={d.id} className="border-b border-neutral-100 py-2 last:border-0">
                        <p className="line-clamp-2 text-sm text-neutral-800">{d.decision_text}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-[11px] text-neutral-500">{member?.display_name ?? '—'}</span>
                          {d.due_date ? (
                            <>
                              <span className="text-neutral-300">·</span>
                              <span
                                className={`text-[11px] ${overdue ? 'font-semibold text-red-600' : 'text-neutral-500'}`}
                              >
                                Frist{' '}
                                {new Date(d.due_date).toLocaleDateString('nb-NO', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                              {overdue ? <Badge variant="danger">Forsinket</Badge> : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </ModuleSectionCard>
          ) : null}

          {/* QUICK NAV */}
          <ModuleSectionCard className="p-5">
            <h2 className="mb-3 text-base font-semibold text-neutral-900">Hurtignavigasjon</h2>
            <div className="space-y-1">
              {quickNav.map((q) => {
                const Icon = q.icon
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={q.onClick}
                    disabled={!q.onClick}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900">{q.label}</p>
                      <p className="text-xs text-neutral-500">{q.sub}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-neutral-400" aria-hidden />
                  </button>
                )
              })}
            </div>
          </ModuleSectionCard>
        </div>
      </div>
    </div>
  )
}

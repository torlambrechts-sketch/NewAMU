// AML hub presentation components — score hero, module grid, tasks
// table, Klarert feed, and regelverk bar. Ported from
// klarert-design-system/ui_kits/aml-compliance with TypeScript + the
// project's icon + Button primitives.

import {
  AlertCircle,
  AlertTriangle,
  BarChart2,
  BookOpen,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  FileSignature,
  Flame,
  GraduationCap,
  Hammer,
  HeartPulse,
  Lightbulb,
  ListFilter,
  Megaphone,
  Pin,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Vote,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Button } from '../../../../components/ui/Button'
import { Badge } from '../../../../components/ui/Badge'
import {
  AML_CHAPTERS,
  KLARERT_FEED,
  type KlarertFeedItem,
} from './amlModuleCatalog'
import type { AmlHubScore, AmlModuleLive, AmlTaskRow } from './useAmlHubData'

const SERIF = "'Libre Baskerville', Georgia, serif"
const FOREST = '#1a3d32'

// ── Icon resolver — maps the lucide name strings from the catalog
// to actual React components without dynamic-import gymnastics.
const ICONS: Record<string, ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  AlertCircle, AlertTriangle, BarChart2, BookOpen, Calendar, CalendarClock,
  ChevronDown, ChevronRight, ClipboardList, Clock, Download, FileSignature,
  Flame, GraduationCap, Hammer, HeartPulse, Lightbulb, ListFilter, Megaphone,
  Pin, Scale, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Users, Vote,
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? ChevronRight
  return <Cmp className={className} />
}

// ── Page header ────────────────────────────────────────────────────────
export function AmlPageHeader({ year = new Date().getFullYear() }: { year?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Etterlevelse · {year}
          </p>
          <h1
            className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 md:text-[34px] md:leading-[1.1]"
            style={{ fontFamily: SERIF, letterSpacing: '-0.012em' }}
          >
            Arbeidsmiljøloven
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Samlet oversikt over alle moduler og krav i AML — årshjulet, status per modul,
            utestående oppgaver, og oppdateringer fra Klarert. Anker for IK-revisjonen i {year}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" /> Eksporter rapport
          </Button>
          <Button
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Calendar className="h-4 w-4" /> {year}
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
          <Button
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#14312a]"
          >
            <ShieldCheck className="h-4 w-4" /> Signer kvartalsrapport
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Score Hero — ring + KPI strip + right rail ─────────────────────────
function ScoreRing({ pct, size = 132, thickness = 14, accent = FOREST }: { pct: number; size?: number; thickness?: number; accent?: string }) {
  const r = size / 2 - thickness / 2
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e5e5" strokeWidth={thickness} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={thickness}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={c / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fontSize={32}
        fontWeight={700}
        fill="#171717"
        style={{ fontFamily: 'Inter', fontVariantNumeric: 'tabular-nums' }}
      >
        {pct}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 22}
        textAnchor="middle"
        fontSize={11}
        fill="#525252"
        style={{ fontFamily: 'Inter', letterSpacing: '0.06em' }}
      >
        % AV KRAV
      </text>
    </svg>
  )
}

function HeroKpi({
  label, big, sub, tone = 'neutral',
}: {
  label: string
  big: ReactNode
  sub: string
  tone?: 'red' | 'amber' | 'green' | 'neutral'
}) {
  const accent = {
    red: { fg: '#991b1b', dot: '#dc2626' },
    amber: { fg: '#854d0e', dot: '#c98a2b' },
    green: { fg: '#166534', dot: '#15803d' },
    neutral: { fg: '#171717', dot: FOREST },
  }[tone]
  return (
    <div
      className="rounded-xl bg-white px-4 py-3.5"
      style={{ border: '1px solid #e3ddcc', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent.dot }} />
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">{label}</p>
      </div>
      <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: accent.fg }}>
        {big}
      </p>
      <p className="mt-0.5 text-xs text-neutral-600">{sub}</p>
    </div>
  )
}

export function ScoreHero({ score }: { score: AmlHubScore }) {
  const totalModules = score.modulesGreen + score.modulesAmber + score.modulesRed
  return (
    <section
      className="overflow-hidden rounded-2xl border"
      style={{
        background: 'linear-gradient(180deg, #fbf9f3 0%, #F1ECDF 100%)',
        borderColor: '#e3ddcc',
      }}
    >
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-10 md:p-8">
        <div className="flex items-center gap-5">
          <ScoreRing pct={score.pct} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              Samlet etterlevelse
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              {totalModules > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800 border border-green-200">
                  {score.modulesGreen} av {totalModules} på sporet
                </span>
              ) : null}
            </p>
            <p className="mt-2 max-w-[20rem] text-xs text-neutral-600">
              Beregnet over {totalModules} moduler, vektet etter lovkrav.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroKpi label="Utestående" big={score.tasksOpen} sub="oppgaver totalt" tone="neutral" />
          <HeroKpi label="Forfalt" big={score.tasksOverdue} sub="krever handling" tone="red" />
          <HeroKpi label="Snart frist" big={score.tasksDueSoon} sub="innen 14 dager" tone="amber" />
          <HeroKpi
            label="Moduler grønn"
            big={`${score.modulesGreen} / ${totalModules}`}
            sub={`${score.modulesAmber} gul · ${score.modulesRed} rød`}
            tone="green"
          />
        </div>

        <div className="hidden md:flex flex-col items-end gap-1 border-l border-[#e3ddcc] pl-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Neste IK-revisjon
          </p>
          <p className="text-sm font-semibold text-neutral-900">15. juni</p>
          <p className="text-xs text-neutral-600">Forbered dokumentasjon</p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: FOREST }}
          >
            Forbered revisjon <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </section>
  )
}

// ── ModuleCard + grid ──────────────────────────────────────────────────
const STATUS_TOKENS: Record<
  AmlModuleLive['status'],
  { bar: string; bg: string; border: string; text: string; label: string }
> = {
  green: { bar: '#15803d', bg: '#dcfce7', border: '#bbf7d0', text: '#166534', label: 'På sporet' },
  amber: { bar: '#c98a2b', bg: '#fef3c7', border: '#fde68a', text: '#854d0e', label: 'Følg opp' },
  red: { bar: '#dc2626', bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'Utenfor krav' },
}

function ModuleCard({ m }: { m: AmlModuleLive }) {
  const t = STATUS_TOKENS[m.status]
  const cardContent = (
    <>
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ background: t.bar }}
      />
      <div className="px-5 pb-3 pt-4 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: '#F1ECDF', color: FOREST }}
            >
              <Icon name={m.icon} className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-neutral-900">{m.title}</h3>
              <p className="text-[11px] text-neutral-500">
                <span className="font-mono">{m.law}</span>
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}` }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.bar }} />
            {t.label}
          </span>
        </div>
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{m.desc}</p>
      </div>

      <div className="px-6">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">{m.metric.label}</span>
          <span className="font-semibold tabular-nums text-neutral-900">
            {m.metric.valueFallback}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full" style={{ width: `${m.progress}%`, background: t.bar }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-100 px-6 py-3 text-[11px]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Neste</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-neutral-800">
            <Icon name={m.next.icon} className="h-3 w-3 shrink-0 text-neutral-500" />
            <span className="truncate">{m.next.label}</span>
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Åpne</p>
          <p className="mt-0.5 tabular-nums text-neutral-800">
            <span className="font-semibold text-neutral-900">{m.open}</span>
            {m.overdue > 0 ? (
              <span className="ml-1 font-semibold text-red-700">· {m.overdue} forfalt</span>
            ) : null}
          </p>
        </div>
      </div>
    </>
  )
  const baseClasses =
    'group relative flex flex-col rounded-xl bg-white transition-colors hover:border-[#1a3d32]'
  const baseStyle: React.CSSProperties = {
    border: '1px solid rgba(0,0,0,0.08)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  }
  if (m.to) {
    return (
      <a href={m.to} className={baseClasses} style={baseStyle}>
        {cardContent}
      </a>
    )
  }
  return (
    <div className={baseClasses} style={baseStyle}>
      {cardContent}
    </div>
  )
}

export function ModulesOverview({ modules }: { modules: AmlModuleLive[] }) {
  const totals = modules.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1
    return acc
  }, {})
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Moduler — alle krav i AML
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {modules.length} moduler. Hver kobles til konkrete paragrafer i Arbeidsmiljøloven eller tilstøtende forskrifter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 font-semibold text-green-800">
            <span className="h-1.5 w-1.5 rounded-full bg-[#15803d]" /> {totals.green ?? 0} på sporet
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-100 px-2.5 py-0.5 font-semibold text-yellow-800">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c98a2b]" /> {totals.amber ?? 0} følg opp
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 font-semibold text-red-800">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" /> {totals.red ?? 0} utenfor krav
          </span>
        </div>
      </div>
      <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((m) => (
          <ModuleCard key={m.id} m={m} />
        ))}
      </div>
    </section>
  )
}

// ── Outstanding tasks ──────────────────────────────────────────────────
const SEV_LABEL: Record<AmlTaskRow['severity'], string> = {
  critical: 'Kritisk',
  high: 'Høy',
  medium: 'Middels',
  low: 'Lav',
}

const SEV_BADGE: Record<AmlTaskRow['severity'], 'critical' | 'high' | 'warning' | 'neutral'> = {
  critical: 'critical',
  high: 'high',
  medium: 'warning',
  low: 'neutral',
}

export function OutstandingTasks({ tasks }: { tasks: AmlTaskRow[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Utestående oppgaver
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Sortert etter alvorlighet og frist. Klikk for tiltak og signering.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <ListFilter className="h-3.5 w-3.5" /> Mine oppgaver
          </Button>
          <Button
            variant="ghost"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <Download className="h-3.5 w-3.5" /> Eksporter
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {tasks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-500">
            Ingen aktive oppgaver tagget med AML-paragrafer.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                <th className="px-5 py-2.5">Oppgave</th>
                <th className="px-3 py-2.5">Modul</th>
                <th className="px-3 py-2.5">Lovverk</th>
                <th className="px-3 py-2.5">Alvorlighet</th>
                <th className="px-3 py-2.5">Ansvarlig</th>
                <th className="px-5 py-2.5 text-right">Frist</th>
              </tr>
            </thead>
            <tbody>
              {tasks.slice(0, 12).map((r) => (
                <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50/60">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-neutral-400 tabular-nums">
                        {r.id.slice(0, 8)}
                      </span>
                      <span className="font-medium text-neutral-900">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">{r.module}</td>
                  <td className="px-3 py-2.5 text-xs font-mono text-neutral-600">{r.law}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={SEV_BADGE[r.severity]}>{SEV_LABEL[r.severity]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">{r.owner}</td>
                  <td
                    className={`px-5 py-2.5 text-right tabular-nums ${
                      r.overdue ? 'font-semibold text-red-700' : 'text-neutral-700'
                    }`}
                  >
                    {r.overdue ? <span className="mr-1">⚠</span> : null}
                    {r.due ?? '—'}
                    {r.overdue && r.daysLate != null ? (
                      <span className="ml-1 text-[10px] font-semibold text-red-600">
                        {' '}· {r.daysLate}d
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
        <span>
          Viser {Math.min(tasks.length, 12)} av {tasks.length} aktive
        </span>
        <a
          href="/tasks/management/alle"
          className="font-semibold hover:underline"
          style={{ color: FOREST }}
        >
          Se alle oppgaver →
        </a>
      </div>
    </section>
  )
}

// ── Klarert feed ───────────────────────────────────────────────────────
const FEED_KIND: Record<
  KlarertFeedItem['kind'],
  { icon: string; label: string; bg: string; text: string; border: string }
> = {
  lov: { icon: 'Scale', label: 'Lovendring', bg: '#e7efe9', text: FOREST, border: '#c5d3c8' },
  klarert: { icon: 'Sparkles', label: 'Fra Klarert', bg: '#F1ECDF', text: '#854d0e', border: '#fde68a' },
  tip: { icon: 'Lightbulb', label: 'Tips', bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
}

export function KlarertFeed({ feed = KLARERT_FEED }: { feed?: KlarertFeedItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: FOREST }}
            >
              <span className="text-[14px] font-bold text-white" style={{ fontFamily: SERIF }}>
                K
              </span>
            </span>
            <h2
              className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
              style={{ fontFamily: SERIF }}
            >
              Fra Klarert
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            Lovendringer, produktoppdateringer og fagtips — kuratert for AML.
          </p>
        </div>
        <button
          type="button"
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          Alle
        </button>
      </div>
      <ul className="divide-y divide-neutral-100">
        {feed.map((it, i) => {
          const k = FEED_KIND[it.kind]
          return (
            <li key={i} className="relative flex items-start gap-3 px-5 py-4 hover:bg-neutral-50/60">
              {it.pinned ? (
                <span className="absolute left-0 top-0 h-full w-0.5 bg-[#c9a227]" aria-hidden />
              ) : null}
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{ background: k.bg, color: k.text, border: `1px solid ${k.border}` }}
              >
                <Icon name={k.icon} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: k.text }}
                  >
                    {k.label}
                  </span>
                  <span className="text-[11px] text-neutral-500">{it.date}</span>
                  {it.pinned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#854d0e]">
                      <Pin className="h-3 w-3" /> Festet
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900">{it.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{it.body}</p>
                <button
                  type="button"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: FOREST }}
                >
                  {it.cta} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Regelverk bar — quick links to AML chapters ────────────────────────
export function RegelverkBar() {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Regelverk · Arbeidsmiljøloven
          </h2>
          <p className="mt-1 text-xs text-neutral-600">
            Hopp direkte til kapittel — viser hvor mange moduler som er forankret i hver del.
          </p>
        </div>
        <a
          href="https://lovdata.no/dokument/NL/lov/2005-06-17-62"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold hover:underline"
          style={{ color: FOREST }}
        >
          Åpne lovdata →
        </a>
      </div>
      <div className="grid gap-px bg-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
        {AML_CHAPTERS.map((c) => (
          <a
            key={c.ch}
            href={`/overview/internkontroll/gaps?framework=aml&chapter=${encodeURIComponent(c.title)}`}
            className="flex items-baseline justify-between gap-3 bg-white px-5 py-3 hover:bg-neutral-50"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 tabular-nums">
                {c.ch}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-neutral-900">{c.title}</p>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-neutral-500">
              {c.modules > 0 ? (
                <span>
                  <span className="font-semibold text-neutral-800">{c.modules}</span> moduler
                </span>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}

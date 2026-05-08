// AmlScoreHero — top of the Arbeidsmiljøloven dashboard.
// Score ring + 4 tonal KPI tiles + "Neste IK-revisjon" right rail.
// Design source: ui_kits/aml-compliance/AmlPieces1.jsx ScoreHero.

import { ChevronRight } from 'lucide-react'
import type { AmlComplianceScore } from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

type Props = {
  score: AmlComplianceScore
  /** Right-rail content; when omitted shows the seed "Neste IK-revisjon". */
  nextAuditLabel?: string
  nextAuditDaysLeft?: number
}

export function AmlScoreHero({
  score,
  nextAuditLabel = '15. juni 2026',
  nextAuditDaysLeft = 38,
}: Props) {
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
        {/* Score ring */}
        <div className="flex items-center gap-5">
          <ScoreRing pct={score.pct} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
              Samlet etterlevelse
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                ▲ {score.delta} pp
              </span>
              <span className="ml-2 text-neutral-600">siden Q1</span>
            </p>
            <p className="mt-2 max-w-[20rem] text-xs text-neutral-600">
              Beregnet over {totalModules} moduler, vektet etter lovkrav.
              Sist signert {score.signed} av {score.signer}.
            </p>
          </div>
        </div>

        {/* KPI strip */}
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

        {/* Last sign / next audit (right rail) */}
        <div className="hidden flex-col items-end gap-1 border-l border-[#e3ddcc] pl-8 md:flex">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Neste IK-revisjon
          </p>
          <p className="text-sm font-semibold text-neutral-900">{nextAuditLabel}</p>
          <p className="text-xs text-neutral-600">{nextAuditDaysLeft} dager igjen</p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1a3d32] hover:underline"
          >
            Forbered revisjon <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </section>
  )
}

function ScoreRing({
  pct,
  size = 132,
  thickness = 14,
  accent = '#1a3d32',
}: {
  pct: number
  size?: number
  thickness?: number
  accent?: string
}) {
  const r = size / 2 - thickness / 2
  const c = 2 * Math.PI * r
  const dash = (pct / 100) * c
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-label={`Etterlevelse ${pct} % av krav`}
    >
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
  label,
  big,
  sub,
  tone = 'neutral',
}: {
  label: string
  big: string | number
  sub: string
  tone?: 'red' | 'amber' | 'green' | 'neutral'
}) {
  const accent = {
    red: { fg: '#991b1b', dot: '#dc2626' },
    amber: { fg: '#854d0e', dot: '#c98a2b' },
    green: { fg: '#166534', dot: '#15803d' },
    neutral: { fg: '#171717', dot: '#1a3d32' },
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
      <p className="mt-1 text-3xl font-bold tabular-nums" style={{ color: accent.fg, fontFamily: SERIF }}>
        {big}
      </p>
      <p className="mt-0.5 text-xs text-neutral-600">{sub}</p>
    </div>
  )
}

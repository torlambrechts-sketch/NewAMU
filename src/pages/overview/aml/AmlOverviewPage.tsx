// AML Overview — the unified Arbeidsmiljøloven landing.
//
// One screen answers "hvor står vi med Arbeidsmiljøloven?":
//   Zone 1 — Tilsyn-beredskap hero + 5-framework badge wall
//   Zone 2 — Gap matrix (paragraphs × 5 modules) via SystemReport
//   Zone 3 — Three side panels (Årshjul, Åpne planer, Trend)
//
// Sprint α from specs/unified-aml-view.md — replaces the old
// HmsOverviewPage composite at /overview/hms. The composite KPI editor
// has been preserved at /overview/hms/widgets.
//
// Datasets are reused from useInternkontrollDatasets — Phase 2+3
// already shipped the backbone. No new tables required for v0.

import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Sliders, ArrowRight, Construction } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { useInternkontrollDatasets } from '../internkontroll/useInternkontrollDatasets'
import { TilsynBeredskapHero } from './TilsynBeredskapHero'
import { FrameworkBadgeWall } from './FrameworkBadgeWall'
import { NeedsAttentionList } from './NeedsAttentionList'
import {
  ArshjulPanel,
  PlanItemsPanel,
  TrendPanel,
} from './AmlSidePanels'
import { computeTilsynScore } from './computeTilsynScore'

type Lens = 'leder' | 'vernerund' | 'tilsyn'

const LENS_LABELS: Record<Lens, string> = {
  leder: 'Lederlens',
  vernerund: 'Vernerundlens',
  tilsyn: 'Tilsynlens',
}

const LENS_DESCRIPTIONS: Record<Lens, string> = {
  leder:
    'Standardvisning — HMS-leder og daglig leder ser bredden av compliance.',
  vernerund:
    'Verneombud-fokus — kommer i Sprint β når data-filteret er på plass.',
  tilsyn:
    'Tilsynsforberedelse — kommer i Sprint γ med pre-flight-sjekkliste.',
}

export function AmlOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lens = (searchParams.get('lens') as Lens) ?? 'leder'

  // No filter chips at the page level — gap matrix has its own
  // framework chip inside the system-report renderer.
  const { datasets, loading } = useInternkontrollDatasets([])

  const scoreResult = useMemo(() => computeTilsynScore(datasets), [datasets])

  const setLens = (next: Lens) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'leder') params.delete('lens')
    else params.set('lens', next)
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      {/* Breadcrumb + page header */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-xs text-neutral-500">
          <Link to="/" className="hover:text-neutral-700">
            Arbeidsflate
          </Link>{' '}
          / <span className="text-neutral-700">HMS-oversikt</span>
        </div>
        <Link
          to="/overview/hms/widgets"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700"
          title="Den gamle, redigerbare widget-oversikten"
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden />
          Tilpasset oversikt
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Arbeidsmiljøloven — oversikt
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Ett bilde av etterlevelsen — på tvers av sjekklister, undersøkelser,
            dokumenter, registre og læring. Bygger på det samme data-laget som
            internkontroll-dashbordet.
          </p>
        </div>

        <LensSwitcher current={lens} onChange={setLens} />
      </div>

      {(lens === 'vernerund' || lens === 'tilsyn') && (
        <ComingSoonBanner lens={lens} />
      )}

      {/* Zone 1 — Hero + framework badge wall */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <TilsynBeredskapHero result={scoreResult} loading={loading} />
        </div>
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-700">
                Regelverk-dekning
              </div>
              <Link
                to="/overview/internkontroll/gaps"
                className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
              >
                Åpne gap-matrise <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            <FrameworkBadgeWall
              coverage={datasets.internkontroll_framework_coverage}
              loading={loading}
            />
          </div>
        </div>
      </div>

      {/* Zone 2 — Top-N "needs attention" list — focused subset of the
          full gap matrix, SMB-friendly. */}
      <NeedsAttentionList
        data={datasets.internkontroll_gap_matrix}
        loading={loading}
      />

      {/* Zone 3 — Three side panels */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ArshjulPanel />
        <PlanItemsPanel data={datasets.internkontroll_plan_items_by_status} />
        <TrendPanel />
      </div>

      {/* Footnote — sprint status */}
      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
        <span className="font-medium text-neutral-700">Sprint α:</span> hero,
        regelverk-dekning og gap-matrise er nå live. Per-§ deep page og
        evidence ledger kommer i Sprint β; årshjul, trend og Tilsynlens i
        Sprint γ. Se{' '}
        <code className="rounded bg-neutral-200 px-1 text-[11px]">
          specs/unified-aml-view.md
        </code>{' '}
        for detaljer.
      </div>
    </div>
  )
}

function LensSwitcher({
  current,
  onChange,
}: {
  current: Lens
  onChange: (l: Lens) => void
}) {
  const lenses: Lens[] = ['leder', 'vernerund', 'tilsyn']
  return (
    <div
      role="tablist"
      aria-label="Visning"
      className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
    >
      {lenses.map((l) => {
        const active = current === l
        return (
          <Button
            key={l}
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(l)}
            title={LENS_DESCRIPTIONS[l]}
            className={
              'rounded-[5px] px-3 py-1.5 !text-xs !font-medium ' +
              (active
                ? 'bg-white !text-neutral-900 shadow-sm hover:bg-white'
                : '!text-neutral-500 hover:!text-neutral-700')
            }
          >
            {LENS_LABELS[l]}
          </Button>
        )
      })}
    </div>
  )
}

function ComingSoonBanner({ lens }: { lens: Exclude<Lens, 'leder'> }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <Construction className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <div>
        <span className="font-semibold">{LENS_LABELS[lens]}</span> —{' '}
        {LENS_DESCRIPTIONS[lens]} Du ser foreløpig Lederlens-innholdet.
      </div>
    </div>
  )
}

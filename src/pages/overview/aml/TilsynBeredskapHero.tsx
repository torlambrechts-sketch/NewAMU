// Tilsyn-beredskap hero — single composite score + status + formula
// popover. The score is computed openly from four inputs, all visible.
// See specs/unified-aml-view.md §5 + computeTilsynScore.ts.

import { useState } from 'react'
import { Info, TrendingUp } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  STATUS_COLOR,
  STATUS_LABEL,
  type TilsynScoreResult,
} from './computeTilsynScore'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function TilsynBeredskapHero({
  result,
  loading,
}: {
  result: TilsynScoreResult
  loading?: boolean
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const ringColor = STATUS_COLOR[result.status]

  if (loading) {
    return (
      <div
        aria-busy
        className="flex animate-pulse items-center gap-6 rounded-lg border border-neutral-200 bg-white p-8"
      >
        <div className="h-32 w-32 rounded-full bg-neutral-100" />
        <div className="space-y-3">
          <div className="h-8 w-48 rounded bg-neutral-100" />
          <div className="h-4 w-64 rounded bg-neutral-100" />
        </div>
      </div>
    )
  }

  // Donut math: 0..100 → arc fraction of a circle, drawn as a stroke
  // dasharray on a 100-circumference circle. 1px = 1%.
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (result.score / 100) * circumference

  return (
    <div className="relative rounded-lg border border-neutral-200 bg-white p-8">
      <div className="flex flex-wrap items-center gap-8">
        {/* Donut + score */}
        <div className="relative h-36 w-36 shrink-0">
          <svg
            viewBox="0 0 140 140"
            className="h-full w-full -rotate-90"
            aria-hidden
          >
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-semibold tabular-nums text-neutral-900">
              {result.score}
            </div>
            <div className="text-xs font-medium text-neutral-500">/ 100</div>
          </div>
        </div>

        {/* Title + status + formula button */}
        <div className="flex-1 min-w-[16rem]">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Tilsyn-beredskap
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPopoverOpen((o) => !o)}
              className="h-5 w-5 rounded-full text-neutral-400 hover:text-neutral-600"
              aria-label="Hva er dette tallet?"
              aria-expanded={popoverOpen}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold text-white"
              style={{ backgroundColor: ringColor }}
            >
              {STATUS_LABEL[result.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              Snapshot — daglig trend kommer (Sprint γ)
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm text-neutral-600">
            Sammensatt score for Arbeidsmiljøloven-etterlevelse — basert på
            paragraf-dekning, bevis-friskhet, plan-progresjon og
            attestasjons-rate. Klikk «i» for å se hvordan tallet bygges opp.
          </p>
        </div>
      </div>

      {/* Formula popover — anchored bottom-right of the hero */}
      {popoverOpen && (
        <div
          role="dialog"
          aria-label="Score-formel"
          className="absolute right-6 top-20 z-10 w-80 rounded-lg border border-neutral-200 bg-white p-4 shadow-lg"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Slik bygges scoren opp
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="text-left font-medium">Komponent</th>
                <th className="text-right font-medium">Verdi</th>
                <th className="text-right font-medium">Vekt</th>
                <th className="text-right font-medium">Bidrag</th>
              </tr>
            </thead>
            <tbody>
              {result.components.map((c) => (
                <tr key={c.label} className="border-t border-neutral-100">
                  <td className="py-1.5 text-neutral-700">{c.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-700">
                    {c.rawPct}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-500">
                    {pct(c.weight)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums font-medium text-neutral-900">
                    {c.contribution.toFixed(1)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-neutral-200">
                <td className="py-1.5 text-sm font-semibold text-neutral-900">
                  Sum
                </td>
                <td colSpan={2} />
                <td className="py-1.5 text-right text-sm font-semibold tabular-nums text-neutral-900">
                  {result.score}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-snug text-neutral-500">
            Bevis-friskhet og attestasjons-rate er foreløpig satt til 100%
            inntil Sprint β/γ landerer datakildene.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPopoverOpen(false)}
            className="mt-3 w-full"
          >
            Lukk
          </Button>
        </div>
      )}
    </div>
  )
}

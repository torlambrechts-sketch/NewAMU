// FrameworkBadgeWall — five per-framework coverage badges arranged
// horizontally. Borrowed from Onspring's NIST Performance Monitoring
// badge wall (cleanest "where am I covered" surface across the six
// vendors we benchmarked). Each badge is clickable and routes into
// the framework-filtered gap surface.
//
// See specs/unified-aml-view.md §4 Zone 1.

import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  type FrameworkId,
} from '../internkontroll/frameworkParagraphs'

type CoverageMap = Record<string, number> // shortLabel → 0..100

// R.A.G. thresholds: ≥80 grønn · 60–79 gul · <60 rød · 0 / null grå
function statusFor(pct: number | undefined): {
  bg: string
  ring: string
  fg: string
  label: string
} {
  if (pct === undefined || pct === null) {
    return { bg: '#f1f5f9', ring: '#cbd5e1', fg: '#475569', label: 'Ikke aktiv' }
  }
  if (pct >= 80) return { bg: '#dcfce7', ring: '#16a34a', fg: '#166534', label: 'God' }
  if (pct >= 60) return { bg: '#fef3c7', ring: '#d97706', fg: '#854d0e', label: 'Akseptabel' }
  if (pct > 0) return { bg: '#fee2e2', ring: '#dc2626', fg: '#991b1b', label: 'Svak' }
  return { bg: '#f1f5f9', ring: '#cbd5e1', fg: '#475569', label: 'Tom' }
}

export function FrameworkBadgeWall({
  coverage,
  loading,
}: {
  /** Map from framework `shortLabel` (e.g. "AML", "IK-f") → % covered. */
  coverage: CoverageMap
  loading?: boolean
}) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FRAMEWORK_IDS.map((id) => (
          <div
            key={id}
            className="h-32 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {FRAMEWORK_IDS.map((id) => {
        const def = FRAMEWORKS[id]
        const pct = coverage[def.shortLabel]
        const s = statusFor(pct)
        const path = `/overview/internkontroll/gaps?framework=${id}`
        return (
          <Button
            key={id}
            variant="ghost"
            onClick={() => navigate(path)}
            className="group !block h-32 rounded-lg border bg-white p-3 !font-normal text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
            style={{ borderColor: s.ring }}
            aria-label={`${def.fullLabel} — ${pct ?? 0}% dekning. Åpne gap-matrise.`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {def.shortLabel}
                </div>
                <div className="mt-0.5 text-[11px] leading-tight text-neutral-500">
                  {def.fullLabel}
                </div>
              </div>
              <ChevronRight
                className="h-4 w-4 text-neutral-300 transition-colors group-hover:text-neutral-500"
                aria-hidden
              />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div
                  className="text-3xl font-semibold tabular-nums leading-none"
                  style={{ color: s.fg }}
                >
                  {pct ?? '—'}
                  {pct !== undefined && (
                    <span className="ml-0.5 text-base font-medium text-neutral-400">
                      %
                    </span>
                  )}
                </div>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: s.bg, color: s.fg }}
              >
                {s.label}
              </span>
            </div>
          </Button>
        )
      })}
    </div>
  )
}

// Re-export for external use — the type isn't currently consumed elsewhere,
// but keep it ergonomic for the page.
export type { FrameworkId }

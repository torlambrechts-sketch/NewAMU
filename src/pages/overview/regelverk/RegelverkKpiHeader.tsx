// To beslutningskort: "OK" og "Trenger oppmerksomhet" — inspirert av
// Vanta Tests-pattern. Toppen av siden, før filter og tabell.

import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { RequirementWithCoverage } from './regelverkCoverageTypes'

const FOREST = '#1a3d32'
const SERIF = "'Libre Baskerville', Georgia, serif"

export function RegelverkKpiHeader({
  requirements,
  regelverkLabel,
}: {
  requirements: RequirementWithCoverage[]
  regelverkLabel: string
}) {
  const total = requirements.length
  const covered = requirements.filter((r) => r.status === 'covered').length
  const onlyAvvik = requirements.filter((r) => r.status === 'only_avvik').length
  const uncovered = requirements.filter((r) => r.status === 'uncovered').length
  const pct = total === 0 ? 0 : Math.round((covered / total) * 100)

  const uncoveredMandatory = requirements.filter(
    (r) => r.status === 'uncovered' && r.obligation === 'mandatory',
  ).length
  const uncoveredRecommended = requirements.filter(
    (r) => r.status === 'uncovered' && r.obligation === 'recommended',
  ).length
  const avvikMandatory = requirements.filter(
    (r) => r.status === 'only_avvik' && r.obligation === 'mandatory',
  ).length

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-neutral-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              {regelverkLabel} — dekket
            </p>
            <p className="mt-1 flex items-baseline gap-2" style={{ fontFamily: SERIF }}>
              <span className="text-4xl font-semibold text-neutral-900">{pct}%</span>
              <span className="text-sm font-normal text-neutral-500">
                {covered} av {total} krav
              </span>
            </p>
          </div>
          <div
            className="grid size-10 place-items-center rounded-full"
            style={{ backgroundColor: 'rgba(26,61,50,0.08)' }}
          >
            <CheckCircle2 className="size-5" style={{ color: FOREST }} aria-hidden />
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: FOREST }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-600">
          <span>
            <span className="font-semibold text-emerald-900">{covered}</span> dekket
          </span>
          <span>
            <span className="font-semibold text-amber-900">{onlyAvvik}</span> kun avvik
          </span>
          <span>
            <span className="font-semibold text-red-900">{uncovered}</span> udekket
          </span>
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">
          Dekket = minst én rutine, kurs, sjekkliste, undersøkelse eller møte-mal med
          eksakt §-referanse.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
              Trenger oppmerksomhet
            </p>
            <p
              className="mt-1 text-4xl font-semibold text-neutral-900"
              style={{ fontFamily: SERIF }}
            >
              {uncoveredMandatory + uncoveredRecommended + onlyAvvik}
            </p>
          </div>
          <div className="grid size-10 place-items-center rounded-full bg-red-100">
            <AlertTriangle className="size-5 text-red-700" aria-hidden />
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-700">
              <span className="size-2 rounded-full bg-red-500" />
              Udekket pliktig
            </span>
            <span className="font-semibold tabular-nums text-neutral-900">
              {uncoveredMandatory}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-700">
              <span className="size-2 rounded-full bg-amber-500" />
              Kun avvik (pliktig)
            </span>
            <span className="font-semibold tabular-nums text-neutral-900">
              {avvikMandatory}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-neutral-700">
              <span className="size-2 rounded-full bg-neutral-400" />
              Udekket anbefalt
            </span>
            <span className="font-semibold tabular-nums text-neutral-900">
              {uncoveredRecommended}
            </span>
          </li>
        </ul>
      </div>
    </div>
  )
}

import { Button } from '../ui/Button'

/* eslint-disable react-refresh/only-export-components -- utility exports shared by ROS/inspection */

/**
 * Reusable 5×5 probability × consequence matrix (no domain imports).
 *
 * @example Inspection-style form (values from your round/finding state)
 * ```tsx
 * const [p, setP] = useState<number | null>(null)
 * const [c, setC] = useState<number | null>(null)
 * return (
 *   <RiskMatrix
 *     probability={p}
 *     consequence={c}
 *     onChange={(nextP, nextC) => {
 *       setP(nextP)
 *       setC(nextC)
 *     }}
 *   />
 * )
 * ```
 *
 * @example SJA / job safety row editor (same component, different parent state)
 * ```tsx
 * <RiskMatrix
 *   probability={row.likelihood}
 *   consequence={row.severity}
 *   readOnly={!canEdit}
 *   size="sm"
 *   onChange={(nextP, nextC) => onPatchRow({ likelihood: nextP, severity: nextC })}
 * />
 * ```
 */

export interface RiskMatrixProps {
  probability: number | null
  consequence: number | null
  onChange?: (p: number, c: number) => void
  readOnly?: boolean
  size?: 'sm' | 'md'
  /** Valgfrie etiketter for sannsynlighetsnivå 1–5 (f.eks. fra `ros_probability_scale_levels`) */
  probabilityLabels?: Record<number, string>
  /** Valgfrie etiketter for konsekvensnivå 1–5 (f.eks. fra `ros_consequence_categories` via matrix_column) */
  consequenceLabels?: Record<number, string>
}

export function riskScoreFromProbCons(p: number | null, c: number | null): number | null {
  if (p == null || c == null) return null
  return p * c
}

export function riskLabel(score: number | null): 'Lav' | 'Middels' | 'Høy' | 'Kritisk' | '—' {
  if (score == null) return '—'
  if (score <= 4) return 'Lav'
  if (score <= 9) return 'Middels'
  if (score <= 14) return 'Høy'
  return 'Kritisk'
}

/** Tailwind utility classes for score band (cell / badge styling). */
export function riskColorClass(score: number | null): string {
  if (score == null) return 'bg-neutral-100 text-neutral-600'
  if (score <= 4) return 'bg-green-100 text-green-800'
  if (score <= 9) return 'bg-yellow-100 text-yellow-800'
  if (score <= 14) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

function summaryLine(
  probability: number | null,
  consequence: number | null,
  probabilityLabels?: Record<number, string>,
  consequenceLabels?: Record<number, string>,
): string {
  const z = riskScoreFromProbCons(probability, consequence)
  const label = riskLabel(z)
  const pTxt =
    probability == null
      ? '—'
      : [String(probability), probabilityLabels?.[probability]].filter(Boolean).join(' · ')
  const cTxt =
    consequence == null
      ? '—'
      : [String(consequence), consequenceLabels?.[consequence]].filter(Boolean).join(' · ')
  return `Sannsynlighet: ${pTxt} — Konsekvens: ${cTxt} — Risikoskår: ${z == null ? '—' : String(z)} (${label === '—' ? '—' : label + ' risiko'})`
}

const PROB_ORDER = [5, 4, 3, 2, 1] as const
const CONS_ORDER = [1, 2, 3, 4, 5] as const

export function RiskMatrix({
  probability,
  consequence,
  onChange,
  readOnly = false,
  size = 'md',
  probabilityLabels,
  consequenceLabels,
}: RiskMatrixProps) {
  const gridGap = size === 'sm' ? 'gap-0.5' : 'gap-1'
  const cellPad = size === 'sm' ? 'p-1.5 min-h-[2rem]' : 'p-2 min-h-[2.75rem]'
  const cellText = size === 'sm' ? 'text-xs' : 'text-sm'
  const summaryText = size === 'sm' ? 'text-xs text-neutral-600' : 'text-sm text-neutral-600'

  const line = summaryLine(probability, consequence, probabilityLabels, consequenceLabels)

  return (
    <div className="flex flex-col gap-2">
      <p className={`text-center ${summaryText}`} aria-live="polite">
        {line}
      </p>

      <div
        className={`grid grid-cols-5 ${gridGap}`}
        role="grid"
        aria-label="Sannsynlighet og konsekvens, risikoskår 1–25"
      >
        {PROB_ORDER.map((p) =>
          CONS_ORDER.map((c) => {
            const score = p * c
            const selected = probability === p && consequence === c
            const color = riskColorClass(score)
            const baseCell = `${cellPad} ${cellText} flex items-center justify-center rounded-md font-medium transition-colors ${color}`
            const selectedRing = selected ? ' ring-2 ring-neutral-900 font-bold' : ''

            if (readOnly || !onChange) {
              return (
                <div
                  key={`${p}-${c}`}
                  role="gridcell"
                  aria-selected={selected}
                  className={`${baseCell}${selectedRing}`}
                >
                  {score}
                </div>
              )
            }

            return (
              <Button
                key={`${p}-${c}`}
                variant="ghost"
                size="sm"
                role="gridcell"
                aria-pressed={selected}
                aria-label={`Sannsynlighet ${p}, konsekvens ${c}, risikoskår ${score}`}
                className={`${baseCell}${selectedRing} h-auto min-h-0 w-full cursor-pointer rounded-md hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900`}
                onClick={() => onChange(p, c)}
              >
                {score}
              </Button>
            )
          }),
        )}
      </div>

      <p className={`text-center ${summaryText}`} aria-hidden="true">
        {line}
      </p>
    </div>
  )
}

/* eslint-enable react-refresh/only-export-components */

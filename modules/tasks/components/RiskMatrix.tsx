// RiskMatrix — interactive 5×5 S×K grid for the risiko template.
// Highlights the selected cell; shows two markers when residual risk is also set.
// Zone thresholds follow the template options: Lav ≤4, Middels 5–12, Høy ≥13.

type Props = {
  /** 1–5 initial probability (sannsynlighet uten tiltak) */
  probability: number | null
  /** 1–5 initial consequence (konsekvens uten tiltak) */
  consequence: number | null
  /** 1–5 residual probability after controls */
  residualProbability?: number | null
  /** 1–5 residual consequence after controls */
  residualConsequence?: number | null
  label?: string
}

function zone(p: number, c: number): 'low' | 'medium' | 'high' {
  const s = p * c
  if (s <= 4) return 'low'
  if (s <= 12) return 'medium'
  return 'high'
}

const ZONE_BG: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-100',
  medium: 'bg-amber-100',
  high: 'bg-red-100',
}

const ZONE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
}

const ZONE_DOT: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-600',
  medium: 'bg-amber-500',
  high: 'bg-red-600',
}

const CONS_LABELS = ['', 'Ubetydelig', 'Lav', 'Moderat', 'Alvorlig', 'Katastrofal']
const PROB_LABELS = ['', 'Svært lav', 'Lav', 'Middels', 'Høy', 'Svært høy']

export function RiskMatrix({ probability, consequence, residualProbability, residualConsequence, label }: Props) {
  const hasInitial = probability != null && consequence != null && probability >= 1 && consequence >= 1
  const hasResidual =
    residualProbability != null &&
    residualConsequence != null &&
    residualProbability >= 1 &&
    residualConsequence >= 1

  const initialScore = hasInitial ? probability! * consequence! : null
  const residualScore = hasResidual ? residualProbability! * residualConsequence! : null
  const initialZone = hasInitial ? zone(probability!, consequence!) : null
  const residualZone = hasResidual ? zone(residualProbability!, residualConsequence!) : null

  return (
    <div className="rounded border border-neutral-200 bg-white p-4">
      {label && <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</p>}

      {/* Consequence header */}
      <div className="flex items-end gap-0.5 mb-0.5 pl-14">
        <p className="text-[10px] text-neutral-400 mr-1 shrink-0">Konsekvens →</p>
        {[1, 2, 3, 4, 5].map((c) => (
          <div key={c} className="w-10 shrink-0 text-center">
            <p className="text-[9px] font-semibold text-neutral-500">{c}</p>
            <p className="text-[8px] text-neutral-400 leading-tight">{CONS_LABELS[c]}</p>
          </div>
        ))}
      </div>

      {/* Grid rows — probability 5 down to 1 */}
      <div className="space-y-0.5">
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="flex items-center gap-0.5">
            {/* Row label */}
            <div className="w-14 shrink-0 text-right pr-1.5">
              <p className="text-[9px] font-semibold text-neutral-500">{p}</p>
              <p className="text-[8px] text-neutral-400 leading-tight">{PROB_LABELS[p]}</p>
            </div>
            {/* Cells */}
            {[1, 2, 3, 4, 5].map((c) => {
              const z = zone(p, c)
              const isInitial = hasInitial && p === probability && c === consequence
              const isResidual = hasResidual && p === residualProbability && c === residualConsequence
              const score = p * c
              return (
                <div
                  key={c}
                  className={`relative w-10 h-10 shrink-0 rounded-sm flex items-center justify-center ${ZONE_BG[z]} ${
                    isInitial || isResidual ? 'ring-2 ring-offset-1 ring-neutral-700' : ''
                  }`}
                  title={`S×K = ${p}×${c} = ${score} (${ZONE_LABEL[z]})`}
                >
                  <span className="text-[9px] font-mono text-neutral-400">{score}</span>
                  {isInitial && (
                    <div className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-neutral-800 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-white">U</span>
                    </div>
                  )}
                  {isResidual && !isInitial && (
                    <div className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-white border border-neutral-700 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-neutral-700">E</span>
                    </div>
                  )}
                  {isResidual && isInitial && (
                    <div className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-white border border-neutral-700 flex items-center justify-center">
                      <span className="text-[7px] font-bold text-neutral-700">E</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend + summary */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map((z) => (
            <div key={z} className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-sm ${ZONE_BG[z]}`} />
              <span className="text-[10px] text-neutral-500">{ZONE_LABEL[z]}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 ml-auto">
          {hasInitial && (
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-neutral-800" />
              <span className="text-[10px] text-neutral-600">
                Uten tiltak: <strong className={`${initialZone === 'high' ? 'text-red-600' : initialZone === 'medium' ? 'text-amber-600' : 'text-green-700'}`}>{initialScore} — {ZONE_LABEL[initialZone!]}</strong>
              </span>
            </div>
          )}
          {hasResidual && (
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full border border-neutral-700 bg-white" />
              <span className="text-[10px] text-neutral-600">
                Etter tiltak: <strong className={`${residualZone === 'high' ? 'text-red-600' : residualZone === 'medium' ? 'text-amber-600' : 'text-green-700'}`}>{residualScore} — {ZONE_LABEL[residualZone!]}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {!hasInitial && (
        <p className="mt-2 text-center text-[10px] text-neutral-400">
          Fyll inn sannsynlighet (f8) og konsekvens (f9) for å se risikoposisjon i matrisen.
        </p>
      )}
    </div>
  )
}

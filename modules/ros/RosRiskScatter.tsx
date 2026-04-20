/** 5×5 risk matrix with hazard dots. Hollow = initial, filled = residual. */
import { Fragment } from 'react'
import { Button } from '../../src/components/ui/Button'
import type { RosHazardRow } from './types'
import { LAW_DOMAIN_BG, LAW_DOMAIN_BORDER } from './types'

const DEFAULT_PROB = ['', 'Svært lav', 'Lav', 'Middels', 'Høy', 'Svært høy']
const DEFAULT_CONS = ['', 'Ubetydelig', 'Liten', 'Moderat', 'Alvorlig', 'Katastrofal']

function cellColor(p: number, c: number): string {
  const s = p * c
  if (s >= 15) return 'bg-red-200'
  if (s >= 10) return 'bg-orange-100'
  if (s >= 5) return 'bg-yellow-100'
  return 'bg-green-100'
}

type Props = {
  hazards: RosHazardRow[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Radetiketter sannsynlighet 1–5 (fra organisasjonens database) */
  probabilityLabels?: Record<number, string>
  /** Kolonnetiketter konsekvens 1–5 — indeks = matrix_column */
  consequenceLabels?: Record<number, string>
}

export function RosRiskScatter({
  hazards,
  selectedId,
  onSelect,
  probabilityLabels,
  consequenceLabels,
}: Props) {
  const probLabel = (n: number) => probabilityLabels?.[n] ?? DEFAULT_PROB[n] ?? ''
  const consLabel = (n: number) => consequenceLabels?.[n] ?? DEFAULT_CONS[n] ?? ''

  const initialByCell = new Map<string, RosHazardRow[]>()
  const residualByCell = new Map<string, RosHazardRow[]>()
  for (const h of hazards) {
    if (h.initial_probability && h.initial_consequence) {
      const k = `${h.initial_probability}-${h.initial_consequence}`
      initialByCell.set(k, [...(initialByCell.get(k) ?? []), h])
    }
    if (h.residual_probability && h.residual_consequence) {
      const k = `${h.residual_probability}-${h.residual_consequence}`
      residualByCell.set(k, [...(residualByCell.get(k) ?? []), h])
    }
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        Risikobilde — initial (ring) · residual (fylt)
      </p>
      <div className="inline-grid" style={{ gridTemplateColumns: 'auto repeat(5, minmax(48px,1fr))' }}>
        <div className="h-8" />
        {[1, 2, 3, 4, 5].map((c) => (
          <div
            key={c}
            className="flex items-end justify-center pb-1 text-center text-[9px] leading-tight text-neutral-500"
          >
            {consLabel(c)}
          </div>
        ))}
        {[5, 4, 3, 2, 1].map((p) => (
          <Fragment key={p}>
            <div
              className="flex items-center justify-end pr-2 text-right text-[9px] leading-tight text-neutral-500"
              style={{ minWidth: 60 }}
            >
              {probLabel(p)}
            </div>
            {[1, 2, 3, 4, 5].map((c) => {
              const k = `${p}-${c}`
              const ini = initialByCell.get(k) ?? []
              const res = residualByCell.get(k) ?? []
              return (
                <div
                  key={k}
                  className={`relative border border-white/60 ${cellColor(p, c)}`}
                  style={{ aspectRatio: '1', minHeight: 40 }}
                >
                  <span className="absolute left-1 top-0.5 text-[8px] text-neutral-500/70">{p * c}</span>
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 p-1 pt-3">
                    {ini.map((h) => (
                      <Button
                        key={`i-${h.id}`}
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Initial: ${h.description}`}
                        aria-label={`Initial risiko for ${h.description}`}
                        onClick={() => onSelect(h.id)}
                        className={`h-3 w-3 min-h-0 min-w-0 rounded-full border-2 bg-transparent p-0 hover:scale-125 ${LAW_DOMAIN_BORDER[h.law_domain]} ${
                          selectedId === h.id ? 'scale-125' : ''
                        }`}
                      >
                        <span className="sr-only">{h.description}</span>
                      </Button>
                    ))}
                    {res.map((h) => (
                      <Button
                        key={`r-${h.id}`}
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={`Residual: ${h.description}`}
                        aria-label={`Residual risiko for ${h.description}`}
                        onClick={() => onSelect(h.id)}
                        className={`h-3 w-3 min-h-0 min-w-0 rounded-full p-0 hover:scale-125 ${
                          selectedId === h.id ? 'scale-125 ring-2 ring-white' : ''
                        } ${LAW_DOMAIN_BG[h.law_domain]}`}
                      >
                        <span className="sr-only">{h.description}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        <span className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-neutral-600" /> Initial risiko
        </span>
        <span className="flex items-center gap-1 text-[10px] text-neutral-500">
          <span className="inline-block h-3 w-3 rounded-full bg-neutral-600" /> Residual risiko
        </span>
      </div>
    </div>
  )
}

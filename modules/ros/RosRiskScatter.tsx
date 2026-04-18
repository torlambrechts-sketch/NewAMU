/** 5×5 risk matrix with hazard dots. Hollow = initial, filled = residual. */
import { Fragment } from 'react'
import type { RosHazardRow } from './types'
import { LAW_DOMAIN_COLOR } from './types'

const PROB_LABELS = ['', 'Svært lav', 'Lav', 'Middels', 'Høy', 'Svært høy']
const CONS_LABELS = ['', 'Ubetydelig', 'Liten', 'Moderat', 'Alvorlig', 'Katastrofal']

function cellColor(p: number, c: number): string {
  const s = p * c
  if (s >= 15) return 'bg-red-200'
  if (s >= 10) return 'bg-orange-100'
  if (s >= 5)  return 'bg-yellow-100'
  return 'bg-green-100'
}

type Props = {
  hazards: RosHazardRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function RosRiskScatter({ hazards, selectedId, onSelect }: Props) {
  // Group hazard dots by (p, c) for initial and residual
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
        {/* Header row: consequence labels */}
        <div className="h-8" />
        {[1,2,3,4,5].map((c) => (
          <div key={c} className="flex items-end justify-center pb-1 text-[9px] text-neutral-500 leading-tight text-center">
            {CONS_LABELS[c]}
          </div>
        ))}
        {/* Data rows: probability high→low */}
        {[5,4,3,2,1].map((p) => (
          <Fragment key={p}>
            <div className="flex items-center justify-end pr-2 text-[9px] text-neutral-500 leading-tight text-right" style={{ minWidth: 60 }}>
              {PROB_LABELS[p]}
            </div>
            {[1,2,3,4,5].map((c) => {
              const k = `${p}-${c}`
              const ini = initialByCell.get(k) ?? []
              const res = residualByCell.get(k) ?? []
              return (
                <div key={k} className={`relative border border-white/60 ${cellColor(p, c)}`} style={{ aspectRatio: '1', minHeight: 40 }}>
                  {/* Score */}
                  <span className="absolute top-0.5 left-1 text-[8px] text-neutral-500/70">{p*c}</span>
                  {/* Initial dots (hollow ring) */}
                  <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 p-1 pt-3">
                    {ini.map((h) => (
                      <button
                        key={`i-${h.id}`}
                        type="button"
                        title={`Initial: ${h.description}`}
                        onClick={() => onSelect(h.id)}
                        className={`h-3 w-3 rounded-full border-2 transition-transform hover:scale-125 ${
                          selectedId === h.id ? 'scale-125' : ''
                        }`}
                        style={{
                          borderColor: LAW_DOMAIN_COLOR[h.law_domain],
                          backgroundColor: 'transparent',
                        }}
                      />
                    ))}
                    {/* Residual dots (filled) */}
                    {res.map((h) => (
                      <button
                        key={`r-${h.id}`}
                        type="button"
                        title={`Residual: ${h.description}`}
                        onClick={() => onSelect(h.id)}
                        className={`h-3 w-3 rounded-full transition-transform hover:scale-125 ${
                          selectedId === h.id ? 'scale-125 ring-2 ring-white' : ''
                        }`}
                        style={{ backgroundColor: LAW_DOMAIN_COLOR[h.law_domain] }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>
      {/* Legend */}
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

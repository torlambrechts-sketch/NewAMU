import { useState } from 'react'
import type { IkLawCode, IkLegalRegisterRow } from './types'

const LAW_COLOR: Record<IkLawCode, string> = {
  AML: '#1a3d32',
  BVL: '#c2410c',
  ETL: '#d97706',
  FL: '#0891b2',
  PKL: '#6d28d9',
}

const ALL_LAWS: IkLawCode[] = ['AML', 'BVL', 'ETL', 'FL', 'PKL']

type Props = {
  rows: IkLegalRegisterRow[]
  canManage: boolean
  onUpsert: (row: Partial<IkLegalRegisterRow>) => void
  onMarkReviewed: (id: string) => void
}

export function IkLovregisterView({ rows, canManage, onUpsert, onMarkReviewed }: Props) {
  const [filterLaw, setFilterLaw] = useState<IkLawCode | 'ALL'>('ALL')

  const filtered = filterLaw === 'ALL' ? rows : rows.filter((r) => r.law_code === filterLaw)

  return (
    <div className="space-y-4">
      {/* Law filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterLaw('ALL')}
          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
            filterLaw === 'ALL'
              ? 'bg-neutral-900 text-white border-neutral-900'
              : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
          }`}
        >
          Alle lover
        </button>
        {ALL_LAWS.map((law) => (
          <button
            key={law}
            type="button"
            onClick={() => setFilterLaw(law)}
            className="rounded-lg border px-3 py-1 text-xs font-semibold transition-colors"
            style={
              filterLaw === law
                ? { backgroundColor: LAW_COLOR[law], color: '#fff', borderColor: LAW_COLOR[law] }
                : { borderColor: '#d4d4d4', color: '#525252', backgroundColor: '#fff' }
            }
          >
            {law}
          </button>
        ))}
        {canManage && (
          <button
            type="button"
            onClick={() => onUpsert({})}
            className="ml-auto rounded-lg border border-[#1a3d32] bg-[#1a3d32] px-3 py-1 text-xs font-semibold text-white hover:bg-[#14312a]"
          >
            + Legg til paragraf
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200/90 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-20">Lov</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-24">§</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tittel</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-28">Status</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-28">Sist revidert</th>
              {canManage && <th className="w-16" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const isStale = !row.reviewed_at ||
                (Date.now() - new Date(row.reviewed_at).getTime()) > 365 * 86_400_000
              return (
                <tr key={row.id} className="border-b border-neutral-100 hover:bg-neutral-50 last:border-b-0">
                  <td className="px-4 py-3">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: LAW_COLOR[row.law_code as IkLawCode] }}
                    >
                      {row.law_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600">{row.paragraph}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{row.title}</p>
                    {row.description && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{row.description}</p>}
                    {!row.applicable && row.deviation_note && (
                      <p className="text-xs text-amber-700 mt-0.5">Avvik: {row.deviation_note}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
                      row.applicable ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {row.applicable ? 'Gjelder' : 'Avvik'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {row.reviewed_at
                      ? new Date(row.reviewed_at).toLocaleDateString('nb-NO')
                      : <span className="text-amber-600 font-medium">Ikke revidert</span>
                    }
                    {isStale && row.reviewed_at && (
                      <span className="block text-[10px] text-amber-600">Forfalt</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onMarkReviewed(row.id)}
                          className="text-xs text-[#1a3d32] hover:underline"
                        >
                          Revider
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpsert(row)}
                          className="text-xs text-neutral-500 hover:underline"
                        >
                          Rediger
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-10 text-center text-sm text-neutral-400">
                  Ingen paragrafer registrert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

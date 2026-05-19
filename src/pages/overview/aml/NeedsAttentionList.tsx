// NeedsAttentionList — Zone 2 of the AML overview.
//
// Reads the existing internkontroll_gap_matrix dataset directly, ranks
// paragraphs by total artefact count (ascending → "thinnest covered
// first"), and shows the top N as actionable rows with a click-through
// into the paragraph deep page (today: /overview/internkontroll/gaps
// with the framework chip pre-filtered — Sprint β replaces this with
// /overview/hms/§:law_ref).
//
// SMB-friendly: ranked list rather than full heatmap. "Open the full
// matrix" is one click away via the link in the header.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { InternkontrollDatasets } from '../internkontroll/useInternkontrollDatasets'

type Row = {
  label: string // "K2A · AML § 2A-1"
  lawRef: string // "AML § 2A-1"
  total: number
  cells: number[]
  columns: string[]
}

function statusOf(total: number): { bg: string; fg: string; label: string } {
  if (total === 0)
    return { bg: '#fee2e2', fg: '#991b1b', label: 'Ikke dekket' }
  if (total <= 2)
    return { bg: '#fef3c7', fg: '#854d0e', label: 'Tynt dekket' }
  return { bg: '#dcfce7', fg: '#166534', label: 'Dekket' }
}

export function NeedsAttentionList({
  data,
  loading,
  limit = 8,
}: {
  data: InternkontrollDatasets['internkontroll_gap_matrix']
  loading?: boolean
  limit?: number
}) {
  const ranked = useMemo<Row[]>(() => {
    const rows: Row[] = data.rows.map((label, i) => {
      const cells = data.cells[i] ?? []
      const total = cells.reduce((s, n) => s + n, 0)
      return {
        label,
        lawRef: data.codeByLabel[label] ?? label,
        total,
        cells,
        columns: data.columns,
      }
    })
    // Lowest coverage first; tiebreak on natural row order (already
    // chapter-ordered upstream).
    return rows.sort((a, b) => a.total - b.total).slice(0, limit)
  }, [data, limit])

  if (loading) {
    return (
      <div className="space-y-1.5">
        {[...Array(limit)].map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-neutral-100"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
          Trenger oppmerksomhet — paragrafer med tynnest dekning
        </h2>
        <Link
          to="/overview/internkontroll/gaps"
          className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700"
        >
          Full gap-matrise <ChevronRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      <table className="w-full">
        <thead>
          <tr className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-2 font-medium">Paragraf</th>
            {ranked[0]?.columns.map((col) => (
              <th key={col} className="px-2 py-2 text-center font-medium">
                {col}
              </th>
            ))}
            <th className="px-4 py-2 text-right font-medium">Status</th>
            <th className="px-2 py-2" aria-label="Åpne" />
          </tr>
        </thead>
        <tbody>
          {ranked.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-8 text-center text-sm text-neutral-500"
              >
                Ingen paragrafer i valgt regelverk.
              </td>
            </tr>
          ) : (
            ranked.map((row) => {
              const s = statusOf(row.total)
              return (
                <tr
                  key={row.lawRef}
                  className="border-t border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="px-4 py-2">
                    <div className="text-sm font-medium text-neutral-900">
                      {row.lawRef}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {row.label.split(' · ')[0]}
                    </div>
                  </td>
                  {row.cells.map((c, i) => (
                    <td
                      key={i}
                      className={
                        'px-2 py-2 text-center text-sm tabular-nums ' +
                        (c === 0 ? 'text-neutral-300' : 'text-neutral-700')
                      }
                    >
                      {c}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right">
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link
                      to={`/overview/internkontroll/gaps?framework=aml`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label={`Inspiser ${row.lawRef}`}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// TableVekst — gjenbrukbar tabell i Vekst-design. Cream-canvas, serif
// kolonneoverskrifter, mild amber-aksent under header, organiske
// skille-linjer mellom rader. Bygd for å erstatte standard data-
// tabeller på de flatene som leser «folk-først, ikke compliance-først»
// — typisk vernerunde-funn, trivselshendelser, eller fokusområde-mål.

import type { ReactNode } from 'react'

const SERIF = "'Libre Baskerville', Georgia, serif"

export type TableVekstColumn<Row extends { id: string }> = {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  /** Optional custom renderer; default renders String(row[key]). */
  render?: (row: Row) => ReactNode
  /** Forcing a column width (e.g. '180px' or '12rem'). */
  width?: string
}

export type TableVekstProps<Row extends { id: string }> = {
  eyebrow?: string
  title?: string
  description?: ReactNode
  columns: TableVekstColumn<Row>[]
  rows: Row[]
  emptyState?: ReactNode
  /** Header right-hand actions (e.g. filter chips, new-row button). */
  actions?: ReactNode
  /** Footer text under the table (annotation, totals, etc). */
  footnote?: ReactNode
}

export function TableVekst<Row extends { id: string }>({
  eyebrow,
  title,
  description,
  columns,
  rows,
  emptyState,
  actions,
  footnote,
}: TableVekstProps<Row>) {
  return (
    <section className="rounded-3xl border border-[#1a3d32]/15 bg-white p-6 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)]">
      {(eyebrow || title || description || actions) && (
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-2 border-amber-200/70 pb-4">
          <div>
            {eyebrow && (
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                {eyebrow}
              </div>
            )}
            {title && (
              <h2
                className="mt-1 text-2xl font-bold leading-tight text-[#1a3d32]"
                style={{ fontFamily: SERIF }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#516760]">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}

      {rows.length === 0 ? (
        emptyState ?? (
          <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 px-6 py-10 text-center text-sm text-[#516760]">
            Ingen rader å vise ennå.
          </div>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="border-b border-amber-200 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#1a3d32]/70"
                    style={{
                      width: col.width,
                      textAlign: col.align ?? 'left',
                      fontFamily: SERIF,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-amber-50/40 ${
                    i < rows.length - 1 ? 'border-b border-[#1a3d32]/10' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-3 py-3 align-top text-sm text-[#2c3a35]"
                      style={{ textAlign: col.align ?? 'left' }}
                    >
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {footnote && <p className="mt-4 text-[11px] italic leading-relaxed text-[#516760]">{footnote}</p>}
    </section>
  )
}

/** A small chip-style cell renderer that picks a warm or neutral tint
 *  based on the value — useful for severity / status columns. */
export function TableVekstChip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'warm' | 'cool' | 'neutral' | 'forest'
}) {
  const cls =
    tone === 'warm'
      ? 'bg-amber-100 text-amber-900 ring-amber-200'
      : tone === 'cool'
      ? 'bg-rose-50 text-rose-900 ring-rose-200'
      : tone === 'forest'
      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      : 'bg-neutral-100 text-neutral-800 ring-neutral-200'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  )
}

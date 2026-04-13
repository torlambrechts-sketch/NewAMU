import type { CSSProperties, ReactNode } from 'react'

const BOX_SHADOW: CSSProperties = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

const WRAP_CLASS =
  'overflow-hidden rounded-lg border border-neutral-200/80 bg-white p-0 shadow-sm'

export type LayoutTable1PostingsShellProps = {
  /**
   * `true` — ytre hvit boks (layout-komponist / demo på hvit eller krem).
   * `false` — kun indre seksjoner (full bredde uten ytre kort).
   */
  wrap?: boolean
  title: string
  description?: string
  headerActions: ReactNode
  toolbar: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/**
 * Table 1 — Postings: samme oppbygging som i plattform layout-komponist og layout-referanse.
 * HSE Vernerunder bruker `wrap` (hvit Postings-kort) for å matche layout-komponisten.
 */
export function LayoutTable1PostingsShell({
  wrap = true,
  title,
  description,
  headerActions,
  toolbar,
  footer,
  children,
}: LayoutTable1PostingsShellProps) {
  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div className="min-w-0">
          <h2
            className="text-xl font-semibold text-neutral-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-neutral-600">{description}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{headerActions}</div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3">{toolbar}</div>
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-3 text-xs text-neutral-600">
          {footer}
        </div>
      ) : null}
    </>
  )

  if (wrap) {
    return (
      <div className={WRAP_CLASS} style={BOX_SHADOW}>
        {inner}
      </div>
    )
  }

  return <div className="min-w-0 overflow-hidden">{inner}</div>
}

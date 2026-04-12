import type { ReactNode } from 'react'

const BOX_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

/**
 * Ytre kort for «List 2»-mønsteret (samme hvite kort som layout-komponisten).
 * Innhold: topp (serif + CTA), verktøylinje, valgfritt filterpanel, tabell, bunntekst/paginering.
 */
export function List2Shell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm ${className}`}
      style={BOX_SHADOW}
    >
      {children}
    </div>
  )
}

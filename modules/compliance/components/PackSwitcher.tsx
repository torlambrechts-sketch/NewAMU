// PackSwitcher — segmented control for the active compliance pack.
// Lives in ModulePageShell.headerActions next to the primary CTA.
// Brand-green selection, square corners (DESIGN_SYSTEM.md §5).

import { Globe2, Shield } from 'lucide-react'
import { useActivePack, useSetActivePack } from '../../../src/context/packContextValue'
import { PACK_ORDER, PACKS } from '../../../src/lib/compliance/packs'
import type { CompliancePackSlug } from '../types'

const ICON: Record<CompliancePackSlug, typeof Shield> = {
  'aml-amu': Shield,
  'iso-45001': Globe2,
}

export function PackSwitcher() {
  const activePack = useActivePack()
  const setPackSlug = useSetActivePack()

  return (
    <div
      role="tablist"
      aria-label="Velg regelverk"
      className="inline-flex border border-neutral-300 bg-white"
    >
      {PACK_ORDER.map((slug) => {
        const pack = PACKS[slug]
        const Icon = ICON[slug]
        const active = pack.slug === activePack.slug
        return (
          <button
            key={slug}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => setPackSlug(slug)}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[#1a3d32] text-white'
                : 'text-neutral-700 hover:bg-neutral-50',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            {pack.shortName}
          </button>
        )
      })}
    </div>
  )
}

// PackSwitcher — segmented control for the active compliance pack.
// Reads licensed packs from the PackProvider (DB-driven). Hidden when only
// one pack is licensed; the page still works but there's nothing to switch.

import { Globe2, Shield } from 'lucide-react'
import {
  useActivePack,
  useLicensedPacks,
  useSetActivePack,
} from '../../../src/context/packContextValue'
import type { CompliancePackSlug } from '../types'

const ICON: Record<CompliancePackSlug, typeof Shield> = {
  'aml-amu': Shield,
  'iso-45001': Globe2,
}

export function PackSwitcher() {
  const activePack = useActivePack()
  const setPackSlug = useSetActivePack()
  const licensed = useLicensedPacks()

  if (licensed.length < 2) return null

  return (
    <div
      role="tablist"
      aria-label="Velg regelverk"
      className="inline-flex border border-neutral-300 bg-white"
    >
      {licensed.map((pack) => {
        const Icon = ICON[pack.slug] ?? Shield
        const active = pack.slug === activePack.slug
        return (
          <button
            key={pack.slug}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => setPackSlug(pack.slug)}
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

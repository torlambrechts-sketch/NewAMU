// Top-bar pack switcher — visible only on /compliance/* routes.
//
// Self-contained: reads licensed packs via usePacks(), reads/writes
// the ?pack= query param directly. Does not depend on PackProvider
// (PackProvider only wraps the compliance routes themselves; this
// widget lives in the global AticsShell). When the org has just one
// licensed pack, renders a static label (no menu) so it still signals
// the focus.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Globe2, Leaf, Lock, Shield, Star } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { usePacks } from '../../../modules/compliance/usePacks'
import { Button } from '../ui/Button'
import type { CompliancePackSlug } from '../../../modules/compliance/types'

const ICON: Record<CompliancePackSlug, typeof Shield> = {
  'aml-amu':   Shield,
  'iso-45001': Globe2,
  'iso-9001':  Star,
  'iso-14001': Leaf,
  'iso-27001': Lock,
}

type Variant = 'topbar' | 'sidebar'

type Props = {
  variant?: Variant
}

export function ShellCompliancePackSwitcher({ variant = 'topbar' }: Props) {
  const location = useLocation()
  const { supabase } = useOrgSetupContext()
  const { packs, loading } = usePacks({ supabase })
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Visible only on /compliance/*.
  const onComplianceRoute = location.pathname.startsWith('/compliance/')

  // Resolve the active pack from URL (or first licensed as fallback).
  const slugParam = searchParams.get('pack')
  const activePack = useMemo(() => {
    if (packs.length === 0) return null
    return packs.find((p) => p.slug === slugParam) ?? packs[0]
  }, [packs, slugParam])

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  if (!onComplianceRoute) return null
  if (loading) return null
  if (!activePack) return null

  const setPack = (slug: CompliancePackSlug) => {
    const next = new URLSearchParams(searchParams)
    if (packs.length > 0 && slug === packs[0].slug) {
      next.delete('pack')
    } else {
      next.set('pack', slug)
    }
    // Switching pack invalidates a template-scoped view (templates belong
    // to a single pack). Drop the template filter so the user lands on
    // the new pack's overview.
    next.delete('template')
    setSearchParams(next, { replace: true })
    setOpen(false)
  }

  const ActiveIcon = ICON[activePack.slug] ?? Shield

  // Single licensed pack → static label, no menu.
  if (packs.length < 2) {
    return (
      <div
        className={
          variant === 'topbar'
            ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white'
            : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800'
        }
        aria-label="Aktivt regelverk"
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
        {activePack.shortName}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <Button
        variant="ghost"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`rounded-none ${
          variant === 'topbar'
            ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15'
            : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50'
        }`}
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{activePack.shortName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>

      {open ? (
        <div
          role="listbox"
          aria-label="Velg regelverk"
          className="absolute right-0 z-50 mt-1 min-w-[14rem] border border-neutral-300 bg-white shadow-lg"
        >
          {packs.map((pack) => {
            const Icon = ICON[pack.slug] ?? Shield
            const active = pack.slug === activePack.slug
            return (
              <Button
                key={pack.slug}
                variant="ghost"
                role="option"
                aria-selected={active}
                onClick={() => setPack(pack.slug)}
                className={[
                  'flex w-full items-start justify-start gap-2 rounded-none px-3 py-2 text-left text-sm font-normal transition-colors',
                  active
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{pack.shortName}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {pack.pluralLabel}
                  </span>
                </span>
              </Button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

// Top-bar pack switcher for surveys — visible only on /survey routes.
//
// Self-contained: reads licensed survey packs via useSurveyPacks(), reads/
// writes ?pack= directly. Mirrors ShellCompliancePackSwitcher.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase, ChevronDown, ClipboardList, HardHat, HeartPulse, LogOut } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useSurveyPacks } from '../../../modules/survey/useSurveyPacks'
import type { SurveyPackSlug } from '../../../modules/survey/types'

const ICON: Record<SurveyPackSlug, typeof Briefcase> = {
  vendor: Briefcase,
  arbeidsmiljo: HardHat,
  compliance: ClipboardList,
  engagement: HeartPulse,
  exit: LogOut,
}

type Variant = 'topbar' | 'sidebar'

type Props = {
  variant?: Variant
}

export function ShellSurveyPackSwitcher({ variant = 'topbar' }: Props) {
  const location = useLocation()
  const { supabase } = useOrgSetupContext()
  const { packs, loading } = useSurveyPacks({ supabase })
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const onSurveyRoute = location.pathname === '/survey' || location.pathname.startsWith('/survey/')

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

  if (!onSurveyRoute) return null
  if (loading) return null
  if (!activePack) return null

  const setPack = (slug: SurveyPackSlug) => {
    const next = new URLSearchParams(searchParams)
    if (packs.length > 0 && slug === packs[0].slug) {
      next.delete('pack')
    } else {
      next.set('pack', slug)
    }
    next.delete('template')
    setSearchParams(next, { replace: true })
    setOpen(false)
  }

  const ActiveIcon = ICON[activePack.slug] ?? Briefcase

  if (packs.length < 2) {
    return (
      <div
        className={
          variant === 'topbar'
            ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white'
            : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800'
        }
        aria-label="Aktiv undersøkelsespakke"
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
        {activePack.short_name}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          variant === 'topbar'
            ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15'
            : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50'
        }
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{activePack.short_name}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Velg undersøkelsespakke"
          className="absolute right-0 z-50 mt-1 min-w-[16rem] border border-neutral-300 bg-white shadow-lg"
        >
          {packs.map((pack) => {
            const Icon = ICON[pack.slug] ?? Briefcase
            const active = pack.slug === activePack.slug
            return (
              <button
                key={pack.slug}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setPack(pack.slug)}
                className={[
                  'flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#1a3d32]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{pack.short_name}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {pack.plural_label}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

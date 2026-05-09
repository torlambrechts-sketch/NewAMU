// Task module pack switcher — visible only on /tasks/* routes.
// Reads/writes ?pack= query param. Mirrors ShellCompliancePackSwitcher.tsx.
// When org has only one licensed pack, renders a static label.

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Globe2, Shield } from 'lucide-react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useTaskPacks } from '../../../modules/tasks/useTaskPacks'
import type { TaskPack } from '../../types/task'

const ICON: Record<TaskPack, typeof Shield> = {
  'aml-amu': Shield,
  'iso-45001': Globe2,
}

type Variant = 'topbar' | 'sidebar'

export function ShellTaskPackSwitcher({ variant = 'topbar' }: { variant?: Variant }) {
  const location = useLocation()
  const { packs, loading } = useTaskPacks()
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const onTaskRoute = location.pathname.startsWith('/tasks/')

  const slugParam = searchParams.get('pack') as TaskPack | null
  const activePack = packs.find((p) => p.slug === slugParam) ?? packs[0] ?? null

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [open])

  if (!onTaskRoute || loading || !activePack) return null

  const setPack = (slug: TaskPack) => {
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

  const ActiveIcon = ICON[activePack.slug] ?? Shield

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
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          variant === 'topbar'
            ? 'inline-flex items-center gap-1.5 border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/15'
            : 'inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50'
        }
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden />
        <span>{activePack.shortName}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

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
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#c2410c]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block">{pack.shortName}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">{pack.pluralLabel}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

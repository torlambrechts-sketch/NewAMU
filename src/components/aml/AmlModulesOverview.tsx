// AmlModulesOverview — responsive grid of ModuleCards, one per AML
// topic. Header strip surfaces totals per status. Design source:
// ui_kits/aml-compliance/AmlPieces1.jsx ModulesOverview + ModuleCard.

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import * as Lucide from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ModuleSectionCard } from '../module/ModuleSectionCard'
import { StandardInput } from '../ui/Input'
import type { AmlModuleStatus, AmlModuleSummary } from '../../data/amlComplianceSeed'

const SERIF = "'Libre Baskerville', Georgia, serif"

const STATUS_TOKENS: Record<
  AmlModuleStatus,
  { bar: string; bg: string; border: string; text: string; label: string }
> = {
  green: { bar: '#15803d', bg: '#dcfce7', border: '#bbf7d0', text: '#166534', label: 'På sporet' },
  amber: { bar: '#c98a2b', bg: '#fef3c7', border: '#fde68a', text: '#854d0e', label: 'Følg opp' },
  red:   { bar: '#dc2626', bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'Utenfor krav' },
}

export function AmlModulesOverview({ modules }: { modules: AmlModuleSummary[] }) {
  const [search, setSearch] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<Set<AmlModuleStatus>>(new Set())

  const totals: Record<AmlModuleStatus, number> = { green: 0, amber: 0, red: 0 }
  for (const m of modules) totals[m.status] += 1

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return modules.filter((m) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(m.status)) return false
      if (q) {
        const haystack = [m.title, m.law, m.desc, m.owner].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [modules, search, activeStatuses])

  const toggleStatus = (s: AmlModuleStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const showOnlyDeviations = () => {
    setActiveStatuses(new Set<AmlModuleStatus>(['amber', 'red']))
  }
  const hasActiveFilters = search !== '' || activeStatuses.size > 0
  const clearFilters = () => {
    setSearch('')
    setActiveStatuses(new Set())
  }

  return (
    <ModuleSectionCard className="!p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Moduler — alle krav i AML
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {modules.length} moduler. Hver kobles til konkrete paragrafer i Arbeidsmiljøloven
            eller tilstøtende forskrifter.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusChip
            status="green"
            count={totals.green}
            label="på sporet"
            active={activeStatuses.has('green')}
            onClick={() => toggleStatus('green')}
          />
          <StatusChip
            status="amber"
            count={totals.amber}
            label="følg opp"
            active={activeStatuses.has('amber')}
            onClick={() => toggleStatus('amber')}
          />
          <StatusChip
            status="red"
            count={totals.red}
            label="utenfor krav"
            active={activeStatuses.has('red')}
            onClick={() => toggleStatus('red')}
          />
          <button
            type="button"
            onClick={showOnlyDeviations}
            className="ml-2 inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
          >
            Vis bare avvik
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-neutral-100 bg-neutral-50/40 px-5 py-2.5">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <StandardInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk modul, lov, ansvarlig…"
            className="pl-8 py-1.5 text-xs"
            aria-label="Søk moduler"
          />
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[11px] text-neutral-500 hover:text-neutral-800"
          >
            Tilbakestill
          </button>
        ) : null}
        <span className="ml-auto text-[11px] text-neutral-500">
          Viser {visible.length} av {modules.length}
        </span>
      </div>

      <div className="grid gap-3 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-neutral-500">
            Ingen moduler matcher filtrene.
          </p>
        ) : (
          visible.map((m) => <ModuleCard key={m.id} m={m} />)
        )}
      </div>
    </ModuleSectionCard>
  )
}

function StatusChip({
  status,
  count,
  label,
  active,
  onClick,
}: {
  status: AmlModuleStatus
  count: number
  label: string
  active: boolean
  onClick: () => void
}) {
  const t = STATUS_TOKENS[status]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-shadow ' +
        (active ? 'shadow-[inset_0_0_0_1px_#1a3d32]' : '')
      }
      style={{ background: t.bg, borderColor: t.border, color: t.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.bar }} />
      {count} {label}
    </button>
  )
}

function ModuleCard({ m }: { m: AmlModuleSummary }) {
  const t = STATUS_TOKENS[m.status]
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className="group relative flex flex-col rounded-xl bg-white transition-colors hover:border-[#1a3d32]"
      style={{ border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ background: t.bar }}
      />
      <div className="px-5 pb-3 pl-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span
              className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: '#F1ECDF', color: '#1a3d32' }}
            >
              <DynamicLucideIcon name={m.icon} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-neutral-900">{m.title}</h3>
              <p className="text-[11px] text-neutral-500">
                <span className="font-mono">{m.law}</span>
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: t.bg, color: t.text, borderColor: t.border }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.bar }} />
            {t.label}
          </span>
        </div>
        <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">{m.desc}</p>
      </div>

      <div className="px-6">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">{m.metric.label}</span>
          <span className="font-semibold tabular-nums text-neutral-900">{m.metric.value}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full"
            style={{ width: `${m.progress}%`, background: t.bar }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-neutral-100 px-6 py-3 text-[11px]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Neste</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-neutral-800">
            <DynamicLucideIcon
              name={m.next.icon}
              className="h-3 w-3 shrink-0 text-neutral-500"
            />
            <span className="truncate">{m.next.label}</span>
          </p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Åpne</p>
          <p className="mt-0.5 tabular-nums text-neutral-800">
            <span className="font-semibold text-neutral-900">{m.open}</span>
            {m.overdue > 0 ? (
              <span className="ml-1 font-semibold text-red-700">· {m.overdue} forfalt</span>
            ) : null}
          </p>
        </div>
      </div>
    </a>
  )
}

// Resolve the seed-data icon string to a Lucide component. Stable
// component (defined at module level — lint-safe) rather than computed
// inside ModuleCard's render. Falls back to Sparkles on miss so a typo
// in the seed doesn't crash the page.
function DynamicLucideIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const lib = Lucide as unknown as Record<
    string,
    ComponentType<SVGProps<SVGSVGElement>> | undefined
  >
  const Icon = lib[name] ?? lib.Sparkles
  if (!Icon) return null
  return <Icon className={className} />
}

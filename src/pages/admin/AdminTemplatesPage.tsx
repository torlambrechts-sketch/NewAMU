// /admin/templates — cross-module template browser. Surfaces every
// template in the org so admins can see what exists, filter by source
// or status, and jump into the per-module editor for CRUD. Reuses the
// per-module surfaces — this page is read + redirect, not a new
// authoring UX.

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, RefreshCw, Search } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'
import {
  ADMIN_TEMPLATE_SOURCE_LABELS,
  ADMIN_TEMPLATE_STATUS_LABELS,
  useAdminTemplates,
  type AdminTemplateRow,
  type AdminTemplateSource,
  type AdminTemplateStatus,
} from '../../hooks/useAdminTemplates'

const SOURCE_KEYS: AdminTemplateSource[] = [
  'compliance',
  'survey',
  'documents',
  'learning',
  'registers',
]
const STATUS_KEYS: AdminTemplateStatus[] = [
  'active',
  'inactive',
  'draft',
  'archived',
  'system',
]

const STATUS_VARIANT: Record<AdminTemplateStatus, 'active' | 'draft' | 'neutral' | 'info'> = {
  active: 'active',
  inactive: 'neutral',
  draft: 'draft',
  archived: 'neutral',
  system: 'info',
}

export function AdminTemplatesPage() {
  const { rows, loading, error, refresh } = useAdminTemplates()
  const [searchParams] = useSearchParams()
  // URL-driven initial source filter — lets sidebar entries
  // (e.g. Administrasjon → Maler → Sjekklister) pre-filter the table.
  const initialSource = searchParams.get('source') as AdminTemplateSource | null
  const [search, setSearch] = useState('')
  const [activeSources, setActiveSources] = useState<Set<AdminTemplateSource>>(
    () => (initialSource && SOURCE_KEYS.includes(initialSource) ? new Set([initialSource]) : new Set()),
  )
  const [activeStatuses, setActiveStatuses] = useState<Set<AdminTemplateStatus>>(new Set())

  const totals = useMemo(() => {
    const bySource = new Map<AdminTemplateSource, number>()
    const byStatus = new Map<AdminTemplateStatus, number>()
    for (const r of rows) {
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
    }
    return { bySource, byStatus }
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (activeSources.size > 0 && !activeSources.has(r.source)) return false
      if (activeStatuses.size > 0 && !activeStatuses.has(r.status)) return false
      if (q) {
        const hay = [r.name, r.category ?? '', r.sourceLabel, r.hint ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, activeSources, activeStatuses])

  const toggleSource = (s: AdminTemplateSource) => {
    setActiveSources((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleStatus = (s: AdminTemplateStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const hasActiveFilters =
    search !== '' || activeSources.size > 0 || activeStatuses.size > 0
  const clearFilters = () => {
    setSearch('')
    setActiveSources(new Set())
    setActiveStatuses(new Set())
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Admin' },
        { label: 'Maler' },
      ]}
      title="Maler"
      description="Alle maler i organisasjonen — sjekklister, undersøkelser, dokumenter, kurs, registertyper. Klikk en rad for å redigere i modulen som eier malen."
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? 'Laster …' : 'Oppdater'}
          </Button>
          <Link
            to="/organisation"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Til Selskap
          </Link>
        </div>
      }
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="!p-0">
        <div className="border-b border-neutral-100 px-5 pb-3 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Totalt
              </p>
              <p className="mt-0.5 text-sm text-neutral-700">
                <strong className="text-neutral-900">{rows.length}</strong> maler på tvers av{' '}
                {totals.bySource.size} moduler.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Modul
            </span>
            {SOURCE_KEYS.map((s) => {
              const on = activeSources.has(s)
              const count = totals.bySource.get(s) ?? 0
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSource(s)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ' +
                    (on
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')
                  }
                >
                  {ADMIN_TEMPLATE_SOURCE_LABELS[s]}
                  <span className={on ? 'text-white/80' : 'text-neutral-500'}>· {count}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Status
            </span>
            {STATUS_KEYS.map((s) => {
              const on = activeStatuses.has(s)
              const count = totals.byStatus.get(s) ?? 0
              if (count === 0 && !on) return null
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ' +
                    (on
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')
                  }
                >
                  {ADMIN_TEMPLATE_STATUS_LABELS[s]}
                  <span className={on ? 'text-white/80' : 'text-neutral-500'}>· {count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/40 px-5 py-2.5">
          <div className="relative flex-1 min-w-[220px] max-w-[360px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk navn, kategori, modul…"
              className="pl-8 py-1.5 text-xs"
              aria-label="Søk maler"
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
            Viser {visible.length} av {rows.length}
          </span>
        </div>

        {loading && rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Laster maler …</p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            {hasActiveFilters
              ? 'Ingen maler matcher filtrene.'
              : 'Ingen maler funnet i organisasjonen.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  <th className="px-5 py-2.5">Navn</th>
                  <th className="px-3 py-2.5">Modul</th>
                  <th className="px-3 py-2.5">Kategori</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-5 py-2.5 text-right">Sist oppdatert</th>
                  <th className="px-3 py-2.5 text-right" aria-label="Åpne" />
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <TemplateRow key={r.rowId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSectionCard>
    </ModulePageShell>
  )
}

function TemplateRow({ row }: { row: AdminTemplateRow }) {
  return (
    <tr className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60">
      <td className="px-5 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium text-neutral-900">{row.name}</span>
          {row.hint ? (
            <span className="font-mono text-[10px] text-neutral-500">{row.hint}</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <Badge variant="info">{row.sourceLabel}</Badge>
      </td>
      <td className="px-3 py-2.5 text-xs text-neutral-700">
        {row.category ?? <span className="text-neutral-400">—</span>}
      </td>
      <td className="px-3 py-2.5">
        <Badge variant={STATUS_VARIANT[row.status]}>
          {ADMIN_TEMPLATE_STATUS_LABELS[row.status]}
        </Badge>
        {row.isSystem ? (
          <span className="ml-1.5 inline-block rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
            system
          </span>
        ) : null}
      </td>
      <td className="px-5 py-2.5 text-right text-xs tabular-nums text-neutral-600">
        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('nb-NO') : '—'}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          to={row.editUrl}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a3d32] hover:underline"
        >
          Rediger <ArrowRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  )
}

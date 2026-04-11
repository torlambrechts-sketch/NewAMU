import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, LayoutGrid, Search, Star, Tag } from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useHse } from '../hooks/useHse'
import {
  useWorkspaceAuditFeed,
  type WorkspaceAuditSourceFilter,
  parseWorkspaceAuditSourceParam,
} from '../hooks/useWorkspaceAuditFeed'
import { PostingsStyleSurface } from '../components/tasks/tasksPostingsLayout'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import type { PermissionKey } from '../lib/permissionKeys'

const SOURCE_ORDER: Exclude<WorkspaceAuditSourceFilter, 'all'>[] = [
  'tasks',
  'internal_control',
  'hse',
  'org_health',
  'council',
  'representatives',
]

const SOURCE_SHORT: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, string> = {
  tasks: 'Oppgaver',
  internal_control: 'IK',
  hse: 'HSE',
  org_health: 'Org.helse',
  council: 'AMU',
  representatives: 'Repr.',
}

const SOURCE_PERM: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, PermissionKey> = {
  tasks: 'module.view.tasks',
  internal_control: 'module.view.internal_control',
  hse: 'module.view.hse',
  org_health: 'module.view.org_health',
  council: 'module.view.council',
  representatives: 'module.view.members',
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function WorkspaceAuditLogPage() {
  const { organization, supabaseConfigured, can, permissionKeys } = useOrgSetupContext()
  const gateNav = supabaseConfigured && permissionKeys.size > 0
  const hse = useHse()
  const { rows, total } = useWorkspaceAuditFeed()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = parseWorkspaceAuditSourceParam(searchParams.get('source'))
  const [q, setQ] = useState('')

  const permittedRows = useMemo(() => {
    return rows.filter((r) => {
      if (!gateNav) return true
      return can(SOURCE_PERM[r.source])
    })
  }, [rows, gateNav, can])

  const filtered = useMemo(() => {
    let list = category === 'all' ? permittedRows : permittedRows.filter((r) => r.source === category)
    const t = q.trim().toLowerCase()
    if (t) {
      list = list.filter(
        (r) =>
          r.message.toLowerCase().includes(t) ||
          r.action.toLowerCase().includes(t) ||
          r.sourceLabel.toLowerCase().includes(t) ||
          (r.detail?.toLowerCase().includes(t) ?? false),
      )
    }
    return list
  }, [permittedRows, category, q])

  const segmentCounts = useMemo(() => {
    let list = permittedRows
    const t = q.trim().toLowerCase()
    if (t) {
      list = list.filter(
        (r) =>
          r.message.toLowerCase().includes(t) ||
          r.action.toLowerCase().includes(t) ||
          r.sourceLabel.toLowerCase().includes(t) ||
          (r.detail?.toLowerCase().includes(t) ?? false),
      )
    }
    const bySource: Record<Exclude<WorkspaceAuditSourceFilter, 'all'>, number> = {
      tasks: 0,
      internal_control: 0,
      hse: 0,
      org_health: 0,
      council: 0,
      representatives: 0,
    }
    for (const r of list) {
      bySource[r.source] += 1
    }
    return { all: list.length, bySource }
  }, [permittedRows, q])

  const setCategory = (next: WorkspaceAuditSourceFilter) => {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'all') p.delete('source')
        else p.set('source', next)
        return p
      },
      { replace: true },
    )
  }

  const orgName = organization?.name?.trim() ?? 'Organisasjon'

  const sourceSectionLabel = category === 'all' ? 'Alle kilder' : SOURCE_SHORT[category]

  const auditSourceHubItems: HubMenu1Item[] = useMemo(() => {
    const items: HubMenu1Item[] = [
      {
        key: 'all',
        label: 'Alle',
        icon: LayoutGrid,
        active: category === 'all',
        badgeCount: segmentCounts.all,
        onClick: () => setCategory('all'),
      },
    ]
    for (const src of SOURCE_ORDER) {
      if (gateNav && !can(SOURCE_PERM[src])) continue
      items.push({
        key: src,
        label: SOURCE_SHORT[src],
        icon: Tag,
        active: category === src,
        badgeCount: segmentCounts.bySource[src],
        onClick: () => setCategory(src),
      })
    }
    return items
  }, [category, segmentCounts, gateNav, can])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Revisjonslogg' }, { label: sourceSectionLabel }]}
        title="Revisjonslogg"
        description={
          <>
            <p>
              <strong className="font-semibold tabular-nums text-neutral-900">{filtered.length}</strong> treff med gjeldende
              filter og søk. {orgName} · {total} rader totalt (filtrert på tilgang).
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              Møterevisjonslogg vises per hendelse; redigering skjer under det enkelte møtet i Arbeidsmiljørådet.
            </p>
          </>
        }
        headerActions={
          <div className="flex min-w-[120px] items-center justify-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <Star className="size-4 text-amber-700" aria-hidden />
            <span className="text-lg font-bold tabular-nums">{permittedRows.length}</span>
            <span className="text-[10px] font-semibold uppercase text-neutral-600">Synlig</span>
          </div>
        }
        menu={<HubMenu1Bar ariaLabel="Revisjonslogg — kilde" items={auditSourceHubItems} />}
      />

      <div className="mt-6 space-y-4">
        <PostingsStyleSurface className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Søk i logg…"
                className="w-full rounded-md border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
            >
              <Search className="size-3.5" />
              Avansert
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase"
            >
              Filter
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-4">Tidspunkt</th>
                  <th className="py-2 pr-4">Kilde</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Melding</th>
                  <th className="py-2 pr-4">Detalj</th>
                  <th className="py-2">Modul</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sm text-neutral-500">
                      Ingen hendelser for valgt filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-neutral-50/80">
                      <td className="py-3 pr-4 whitespace-nowrap text-xs text-neutral-600 tabular-nums">
                        {formatWhen(r.at)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-950">
                          {r.sourceLabel}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-neutral-700">{r.action}</td>
                      <td className="py-3 pr-4 text-neutral-900">{r.message}</td>
                      <td className="py-3 pr-4 max-w-[220px] truncate text-xs text-neutral-500" title={r.detail}>
                        {r.detail ?? '—'}
                      </td>
                      <td className="py-3">
                        <Link
                          to={r.linkTo}
                          className="text-xs font-semibold uppercase tracking-wide text-[#1a3d32] underline-offset-2 hover:underline"
                        >
                          Åpne
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PostingsStyleSurface>

        {(!gateNav || can('module.view.hse')) && (
          <PostingsStyleSurface className="p-4">
            <h2 className="text-sm font-semibold text-neutral-900">HSE — eksport og arkiv</h2>
            <p className="mt-1 text-xs text-neutral-600">
              JSON-eksport og utskrift (tidligere under HMS-revisjonslogg).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const json = hse.exportJson()
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `hse-export-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-xs font-medium text-white hover:bg-[#142e26]"
              >
                <Download className="size-4" />
                Eksporter HSE (JSON)
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Skriv ut / PDF
              </button>
            </div>
          </PostingsStyleSurface>
        )}
      </div>
    </div>
  )
}

// /admin/templates — cross-module template browser.
//
// Renders every template in the org so admins can browse, filter, and
// jump into the per-module editor for CRUD. Visual reference is the
// Pinpoint Background Checks layout block at
// /platform-admin/layout-reference → "Background checks (Certn)":
// status tabs across the top, a white card wrapping the toolbar +
// table + pagination footer, neutral-50 row hover, pill badges.
//
// This page is read + redirect, not a new authoring UX. Each row's
// "Rediger" link routes back to the source module's editor; the new
// "Ny mal" dropdown in the header sends admins to the source module's
// template admin where new templates are authored.

import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Megaphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
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

const STATUS_PILL: Record<AdminTemplateStatus, string> = {
  active: 'bg-emerald-100 text-emerald-950',
  inactive: 'bg-neutral-100 text-neutral-700',
  draft: 'bg-amber-100 text-amber-950',
  archived: 'bg-neutral-100 text-neutral-500',
  system: 'bg-sky-100 text-sky-950',
}

const SOURCE_NEW_PATH: Record<AdminTemplateSource, string> = {
  compliance: '/admin/settings/compliance/maler',
  survey: '/admin/settings/survey/maler',
  documents: '/admin/settings/documents/maler',
  learning: '/learning/courses',
  registers: '/admin/settings/registers',
}

const SOURCE_ICON: Record<AdminTemplateSource, typeof ClipboardList> = {
  compliance: ClipboardList,
  survey: Megaphone,
  documents: FileText,
  learning: GraduationCap,
  registers: Database,
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

export function AdminTemplatesPage() {
  const { rows, loading, error, refresh } = useAdminTemplates()
  const [searchParams] = useSearchParams()
  const initialSource = searchParams.get('source') as AdminTemplateSource | null
  const [activeSource, setActiveSource] = useState<AdminTemplateSource | null>(
    () => (initialSource && SOURCE_KEYS.includes(initialSource) ? initialSource : null),
  )
  const [search, setSearch] = useState('')
  const [activeStatus, setActiveStatus] = useState<AdminTemplateStatus | null>(null)
  const [pageSize, setPageSize] = useState<PageSize>(25)
  const [page, setPage] = useState(0)

  const totals = useMemo(() => {
    const bySource = new Map<AdminTemplateSource, number>()
    const byStatus = new Map<AdminTemplateStatus, number>()
    for (const r of rows) {
      bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
      byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1)
    }
    return { bySource, byStatus }
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (activeSource && r.source !== activeSource) return false
      if (activeStatus && r.status !== activeStatus) return false
      if (q) {
        const hay = [r.name, r.category ?? '', r.sourceLabel, r.hint ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, activeSource, activeStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)
  const firstIndex = filtered.length === 0 ? 0 : safePage * pageSize + 1
  const lastIndex = Math.min(filtered.length, (safePage + 1) * pageSize)

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
          <NyMalDropdown />
        </div>
      }
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      {/* Source tabs — same shape as the BackgroundChecks reference tab row */}
      <div className="flex flex-wrap items-end gap-x-1 gap-y-2 border-b border-neutral-200 pb-0">
        <SourceTab
          label="Alle"
          count={rows.length}
          active={activeSource === null}
          onClick={() => {
            setActiveSource(null)
            setPage(0)
          }}
        />
        {SOURCE_KEYS.map((s) => (
          <SourceTab
            key={s}
            label={ADMIN_TEMPLATE_SOURCE_LABELS[s]}
            count={totals.bySource.get(s) ?? 0}
            icon={SOURCE_ICON[s]}
            active={activeSource === s}
            onClick={() => {
              setActiveSource(s)
              setPage(0)
            }}
          />
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(0)
              }}
              placeholder="Søk etter navn, kategori, modul eller hint …"
              aria-label="Søk maler"
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
          <StatusFilter
            active={activeStatus}
            counts={totals.byStatus}
            onChange={(s) => {
              setActiveStatus(s)
              setPage(0)
            }}
          />
          <span className="text-xs text-neutral-500">
            {activeStatus
              ? `Status: ${ADMIN_TEMPLATE_STATUS_LABELS[activeStatus]}`
              : 'Ingen filter aktivert'}
          </span>
          <button
            type="button"
            className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100"
            aria-label="Innstillinger"
            disabled
          >
            <Settings className="size-4" />
          </button>
        </div>

        {/* Table */}
        {loading && rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">Laster maler …</p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-500">
            {filtered.length === 0 && rows.length > 0
              ? 'Ingen maler matcher filtrene.'
              : 'Ingen maler funnet i organisasjonen.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3 sm:px-5">Navn</th>
                  <th className="px-4 py-3 sm:px-5">Modul</th>
                  <th className="px-4 py-3 sm:px-5">Status</th>
                  <th className="px-4 py-3 sm:px-5">Sist oppdatert</th>
                  <th className="w-12 px-4 py-3 sm:px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visible.map((r) => (
                  <TemplateRow key={r.rowId} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-neutral-500">Rader per side</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as PageSize)
                  setPage(0)
                }}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <span className="text-neutral-500">
              Viser {firstIndex} – {lastIndex} av {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Forrige"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-1 text-neutral-500">
              {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Neste"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </ModulePageShell>
  )
}

function SourceTab({
  label,
  count,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  count: number
  icon?: typeof ClipboardList
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 px-3 py-2 text-left transition ${
        active ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'
      }`}
      style={
        active
          ? { borderBottomWidth: 3, borderBottomColor: '#1a3d32', marginBottom: -1 }
          : { marginBottom: -1, borderBottom: '3px solid transparent' }
      }
    >
      {Icon ? <Icon className="size-4 shrink-0 text-neutral-400" /> : null}
      <span className="whitespace-nowrap text-xs font-semibold sm:text-sm">{label}</span>
      <span className="tabular-nums text-sm font-bold text-neutral-900">{count}</span>
    </button>
  )
}

function StatusFilter({
  active,
  counts,
  onChange,
}: {
  active: AdminTemplateStatus | null
  counts: Map<AdminTemplateStatus, number>
  onChange: (status: AdminTemplateStatus | null) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex shrink-0 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold uppercase text-neutral-700 hover:bg-neutral-50"
      >
        Status filter
        <ChevronDown className="size-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <MenuItem
            label="Alle statuser"
            onClick={() => {
              onChange(null)
              setOpen(false)
            }}
            selected={active === null}
          />
          {STATUS_KEYS.map((s) => (
            <MenuItem
              key={s}
              label={`${ADMIN_TEMPLATE_STATUS_LABELS[s]} (${counts.get(s) ?? 0})`}
              onClick={() => {
                onChange(s)
                setOpen(false)
              }}
              selected={active === s}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function NyMalDropdown() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const onPick = (source: AdminTemplateSource) => {
    setOpen(false)
    navigate(SOURCE_NEW_PATH[source])
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#16382e]"
      >
        <Plus className="h-4 w-4" />
        Ny mal
        <ChevronDown className="h-3.5 w-3.5 opacity-80" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Velg malttype
          </div>
          {SOURCE_KEYS.map((s) => {
            const Icon = SOURCE_ICON[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => onPick(s)}
                role="menuitem"
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
              >
                <Icon className="size-4 shrink-0 text-neutral-500" />
                <div className="flex flex-col">
                  <span className="font-medium">{ADMIN_TEMPLATE_SOURCE_LABELS[s]}</span>
                  <span className="text-[11px] text-neutral-500">
                    Opprett i {ADMIN_TEMPLATE_SOURCE_LABELS[s].toLowerCase()}-modulen
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  selected,
}: {
  label: string
  onClick: () => void
  selected: boolean
}): ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
        selected ? 'bg-neutral-100 font-medium text-neutral-900' : 'text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      {label}
      {selected ? <span className="text-[#1a3d32]">●</span> : null}
    </button>
  )
}

function TemplateRow({ row }: { row: AdminTemplateRow }) {
  return (
    <tr className="hover:bg-neutral-50/80">
      <td className="px-4 py-4 sm:px-5">
        <p className="font-semibold text-neutral-900">{row.name}</p>
        {row.category ? (
          <p className="text-xs text-neutral-500">{row.category}</p>
        ) : null}
        {row.hint ? (
          <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{row.hint}</p>
        ) : null}
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
          {row.sourceLabel}
        </span>
      </td>
      <td className="px-4 py-4 sm:px-5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_PILL[row.status]}`}
        >
          {ADMIN_TEMPLATE_STATUS_LABELS[row.status]}
        </span>
        {row.isSystem ? (
          <span className="ml-1.5 inline-block rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
            system
          </span>
        ) : null}
      </td>
      <td className="px-4 py-4 text-neutral-600 sm:px-5">
        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString('nb-NO') : '—'}
      </td>
      <td className="px-4 py-4 text-right sm:px-5">
        <Link
          to={row.editUrl}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1a3d32] hover:underline"
          aria-label={`Rediger ${row.name}`}
        >
          Rediger <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          className="ml-2 text-neutral-400 hover:text-neutral-700"
          aria-label="Meny"
          disabled
        >
          <MoreHorizontal className="size-4" />
        </button>
      </td>
    </tr>
  )
}

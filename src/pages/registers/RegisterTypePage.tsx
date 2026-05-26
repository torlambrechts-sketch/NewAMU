// /registers/:typeId — detail view for one register.
//
// Same data-grid pattern as Sjekklister / Register-hub: full-width
// ModulePageShell, status bar + KPI tiles, a rounded card with the
// records table inside; filtering is a FilterBar with search (leading)
// + multi-select Visning chips + per-type saved views.
//
// Entries (records) are rendered through the schema-driven cell
// renderer so each type shows its own column shape (kjemikalier:
// CAS-nummer + faresetninger; HIRA: risk score; …).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Database,
  Download,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  User as UserIcon,
  UserCheck,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisterUiPreference } from '../../hooks/useUserUiPreferences'
import { useRegisters, useRegisterRecords } from '../../hooks/useRegisters'
import { useSavedViews } from '../../hooks/useSavedViews'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { WarningBox } from '../../components/ui/AlertBox'
import { FilterBar, SavedViewsControl } from '../../components/ui/FilterBar'
import { FilterChip } from '../../components/ui/FilterChip'
import { RegisterRecordForm } from '../../components/registers/RegisterRecordForm'
import { RegisterFrameworkPill } from '../../components/registers/RegisterFrameworkPill'
import { RegisterModeToggle } from '../../components/registers/RegisterModeToggle'
import { RegisterAuditLogCard } from '../../components/registers/RegisterAuditLogCard'
import { RegisterImportDialog } from '../../components/registers/RegisterImportDialog'
import {
  RegisterEntryCell,
  RegisterPersonCell,
} from '../../components/registers/RegisterEntryCell'
import { lucideByName } from '../../components/registers/lucideByName'
import { MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module/moduleTableKit'
import {
  computeRegisterStats,
  filterByChip,
} from '../../lib/registers/registerStats'
import {
  exportRecordsToCsv,
  downloadRegisterCsv,
} from '../../lib/registers/registerCsv'
import type { RegisterField, RegisterRecord } from '../../types/registers'

const PERSON_FIELD_HINTS = new Set([
  'employee',
  'name',
  'navn',
  'owner',
  'eier',
  'responsible',
  'ansvarlig',
  'reportedBy',
  'reported_by',
  'meldt_av',
  'reporter',
])

// Filter payload persisted in `module_saved_views.filters` for the
// per-type slug `register_records:<typeId>`. Chips are type-specific
// so views live per-register-type (slug includes typeId).
type RegisterRecordFilters = {
  chips: string[]
}

const EMPTY_RECORD_FILTERS: RegisterRecordFilters = { chips: [] }

function recordFiltersEqual(a: RegisterRecordFilters, b: RegisterRecordFilters): boolean {
  if (a.chips.length !== b.chips.length) return false
  const setA = new Set(a.chips)
  for (const id of b.chips) if (!setA.has(id)) return false
  return true
}

function recordFiltersFromSearchParams(params: URLSearchParams): RegisterRecordFilters {
  const raw = params.get('chip')
  return { chips: raw ? raw.split(',').filter(Boolean) : [] }
}

function syncRecordFiltersToUrl(f: RegisterRecordFilters) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (f.chips.length > 0) url.searchParams.set('chip', f.chips.join(','))
  else url.searchParams.delete('chip')
  window.history.replaceState(null, '', url.toString())
}

export function RegisterTypePage() {
  const { typeId } = useParams<{ typeId: string }>()
  const orgSetup = useOrgSetupContext()
  const navigate = useNavigate()
  const registers = useRegisters({ supabase: orgSetup.supabase })
  const recordsHook = useRegisterRecords({
    supabase: orgSetup.supabase,
    typeId: typeId ?? null,
  })
  const ui = useRegisterUiPreference()
  const easy = ui.mode === 'easy'

  const type = useMemo(
    () => registers.types.find((t) => t.id === typeId) ?? null,
    [registers.types, typeId],
  )

  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<
    | { kind: 'new' }
    | { kind: 'edit'; record: RegisterRecord }
    | null
  >(null)
  const [importOpen, setImportOpen] = useState(false)

  // Filter state — hydrated from URL on first mount, pushed back via
  // history.replaceState.
  const [filters, setFiltersState] = useState<RegisterRecordFilters>(() =>
    recordFiltersFromSearchParams(searchParams),
  )
  const setFilters = useCallback((next: RegisterRecordFilters) => {
    setFiltersState(next)
  }, [])
  useEffect(() => {
    syncRecordFiltersToUrl(filters)
  }, [filters])
  const activeFilterCount = filters.chips.length

  // Saved views — slug is per-register-type since chip vocabulary
  // varies between types (kjemikalier has CMR, HIRA has risk-score).
  const savedSlug = typeId ? `register_records:${typeId}` : 'register_records'
  const savedViews = useSavedViews<RegisterRecordFilters>(savedSlug)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [defaultApplied, setDefaultApplied] = useState(false)
  useEffect(() => {
    if (defaultApplied) return
    if (savedViews.loading) return
    if (activeFilterCount > 0) {
      const match = savedViews.views.find((v) =>
        recordFiltersEqual(filters, { ...EMPTY_RECORD_FILTERS, ...v.filters }),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (match) setActiveViewId(match.id)
      setDefaultApplied(true)
      return
    }
    if (savedViews.defaultViewId) {
      const def = savedViews.views.find((v) => v.id === savedViews.defaultViewId)
      if (def) {
        setFilters({ ...EMPTY_RECORD_FILTERS, ...def.filters })
        setActiveViewId(def.id)
      }
    }
    setDefaultApplied(true)
  }, [
    defaultApplied,
    savedViews.loading,
    savedViews.defaultViewId,
    savedViews.views,
    activeFilterCount,
    filters,
    setFilters,
  ])

  const hasUnsavedChanges = useMemo(() => {
    if (!activeViewId) return false
    const view = savedViews.views.find((v) => v.id === activeViewId)
    if (!view) return false
    return !recordFiltersEqual(filters, { ...EMPTY_RECORD_FILTERS, ...view.filters })
  }, [activeViewId, filters, savedViews.views])

  const stats = useMemo(
    () => (type ? computeRegisterStats(type, recordsHook.records) : null),
    [type, recordsHook.records],
  )

  const filteredRecords = useMemo(() => {
    if (!type) return []
    // Multi-select OR semantics: a record passes if it matches ANY of
    // the selected chips. Empty selection = pass-through.
    let out: RegisterRecord[]
    if (filters.chips.length === 0) {
      out = recordsHook.records
    } else {
      const seen = new Set<string>()
      out = []
      for (const chip of filters.chips) {
        for (const r of filterByChip(type, recordsHook.records, chip)) {
          if (!seen.has(r.id)) {
            seen.add(r.id)
            out.push(r)
          }
        }
      }
    }
    const norm = search.trim().toLowerCase()
    if (norm) {
      out = out.filter((r) => {
        for (const v of Object.values(r.values)) {
          if (typeof v === 'string' && v.toLowerCase().includes(norm)) return true
          if (typeof v === 'number' && String(v).includes(norm)) return true
        }
        return false
      })
    }
    return out
  }, [type, recordsHook.records, filters.chips, search])

  // ── States ───────────────────────────────────────────────────────────

  if (registers.loading && !type) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
        ]}
        title="Laster register …"
        loading
      >
        <p />
      </ModulePageShell>
    )
  }

  if (!type) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
        ]}
        title="Register ikke funnet"
        headerActions={
          <Link
            to="/registers"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
      >
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <WarningBox>
            Fant ikke registeret «{typeId}». Det kan være deaktivert for organisasjonen
            din eller slettet.
          </WarningBox>
        </div>
      </ModulePageShell>
    )
  }

  const display = type.displayMetadata
  const Icon = lucideByName(display.icon)
  const fields = type.metadataSchema.fields
  const primaryField =
    fields.find((f) => f.required && (f.kind === 'text' || f.kind === 'select' || f.kind === 'date')) ??
    fields[0]

  // Field chips driven by per-type stats + record metadata
  const chipDefs = buildChipDefs(stats?.byChip ?? {}, type.metadataSchema.fields)

  const description = easy
    ? `${stats?.totalAll ?? 0} oppføringer · ${display.ownerRole ?? 'Ingen eier'}`
    : type.description ?? ''

  // ── Mutations: import → bulk createRecord ────────────────────────────
  const handleImport = async (
    rows: { values: Record<string, unknown>; status: 'draft' | 'active' | 'archived'; reviewDueAt: string | null }[],
  ) => {
    let ok = 0
    let failed = 0
    for (const r of rows) {
      try {
        const id = await recordsHook.createRecord(r.values)
        if (id === null) failed += 1
        else {
          // Optionally update status / review_due_at when non-default.
          if (r.status !== 'active' || r.reviewDueAt) {
            await recordsHook.updateRecord(id, {
              status: r.status,
              reviewDueAt: r.reviewDueAt,
            })
          }
          ok += 1
        }
      } catch {
        failed += 1
      }
    }
    return { ok, failed }
  }

  const handleExport = () => {
    downloadRegisterCsv(exportRecordsToCsv(type, recordsHook.records))
  }

  return (
    <>
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Register', to: '/registers' },
          { label: type.resolvedName },
        ]}
        width="full"
        title={
          <span className="inline-flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
              <Icon className="h-5 w-5" />
            </span>
            <span>{type.resolvedName}</span>
          </span>
        }
        description={description}
        headerActions={
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <RegisterModeToggle mode={ui.mode} onChange={(v) => void ui.setMode(v)} />
            <Button
              type="button"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExport}
              disabled={recordsHook.records.length === 0}
            >
              Eksporter
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => setImportOpen(true)}
            >
              Importer
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setEditing({ kind: 'new' })}
            >
              Ny oppføring
            </Button>
            <Link
              to="/registers"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbake
            </Link>
          </div>
        }
      >
        {recordsHook.error ? <WarningBox>{recordsHook.error}</WarningBox> : null}

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <RegisterFrameworkPill regulationIds={type.regulationIds} />
            {display.mandatory ? (
              <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
                <ShieldCheck className="h-3 w-3" /> Lovpålagt
              </span>
            ) : null}
            {display.gdpr ? (
              <span className="inline-flex items-center gap-1 rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-800">
                <Lock className="h-3 w-3" /> GDPR
              </span>
            ) : null}
            {display.sensitive && !display.gdpr ? (
              <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                <Lock className="h-3 w-3" /> Sensitivt
              </span>
            ) : null}
            {!easy
              ? (display.legalLabels ?? []).map((l) => (
                  <span
                    key={l}
                    className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
                  >
                    {l}
                  </span>
                ))
              : null}
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-neutral-400" />
              {display.ownerRole ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-neutral-400" />
              <span className="tabular-nums">{stats?.totalAll ?? 0}</span> oppføringer
            </span>
          </div>
        </div>

        {/* KPI row */}
        {stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard
              tone="default"
              label="Totalt"
              big={stats.totalAll}
              sub={easy ? undefined : 'oppføringer'}
            />
            {stats.reviewsOverdue > 0 ? (
              <KpiCard
                tone="danger"
                label="Forfalt"
                big={stats.reviewsOverdue}
                sub="krever fornyelse"
              />
            ) : null}
            {stats.reviewsDueSoon > 0 ? (
              <KpiCard
                tone="warn"
                label="Utløper snart"
                big={stats.reviewsDueSoon}
                sub="innen 30 dager"
              />
            ) : null}
            {stats.cmrCount > 0 ? (
              <KpiCard
                tone="danger"
                label="CMR-stoffer"
                big={stats.cmrCount}
                sub="krever eksp.-register"
              />
            ) : null}
            {stats.drafts > 0 ? (
              <KpiCard
                tone="info"
                label="Utkast"
                big={stats.drafts}
                sub="ikke aktivert ennå"
              />
            ) : null}
            {stats.archived > 0 ? (
              <KpiCard
                tone="neutral"
                label="Arkivert"
                big={stats.archived}
                sub="historikk"
              />
            ) : null}
          </div>
        ) : null}

        {/* Entries table — same layout pattern as Sjekklister og
            Register-hub: header strip + FilterBar + body. */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-neutral-900">
              {filteredRecords.length}{' '}
              {filteredRecords.length === 1 ? 'oppføring' : 'oppføringer'}
            </h3>
          </div>

          <FilterBar
            leading={
              <div className="relative w-64 max-w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                <StandardInput
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Søk i oppføringer …"
                  aria-label="Søk i oppføringer"
                  className="w-full !py-1.5 pl-9 text-sm"
                />
              </div>
            }
            chips={
              chipDefs.length > 0 ? (
                <FilterChip
                  label="Visning"
                  options={chipDefs.map((c) => ({ value: c.id, label: c.label, count: c.count }))}
                  value={filters.chips}
                  onChange={(next) => {
                    setFilters({ ...filters, chips: next })
                    setActiveViewId(null)
                  }}
                />
              ) : null
            }
            activeFilterCount={activeFilterCount}
            onReset={() => {
              setFilters(EMPTY_RECORD_FILTERS)
              setActiveViewId(null)
            }}
            savedViews={
              <SavedViewsControl<RegisterRecordFilters>
                currentFilters={filters}
                activeViewId={activeViewId}
                hasUnsavedChanges={hasUnsavedChanges}
                onApplyView={(view) => {
                  setFilters({ ...EMPTY_RECORD_FILTERS, ...view.filters })
                  setActiveViewId(view.id)
                }}
                onClearActive={() => setActiveViewId(null)}
                saved={savedViews}
              />
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-neutral-50/60">
                <tr>
                  {fields.map((col) => (
                    <th key={col.key} className={MODULE_TABLE_TH}>
                      {col.label}
                    </th>
                  ))}
                  <th className={MODULE_TABLE_TH}>Status</th>
                  <th className={MODULE_TABLE_TH}>Gjennomgang</th>
                  <th className={`${MODULE_TABLE_TH} text-right`} />
                </tr>
              </thead>
              <tbody>
                {recordsHook.loading && recordsHook.records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 3}
                      className="px-5 py-12 text-center text-sm text-neutral-500"
                    >
                      Laster oppføringer …
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 3}
                      className="px-5 py-12 text-center text-sm text-neutral-500"
                    >
                      {recordsHook.records.length === 0
                        ? 'Ingen oppføringer ennå. Bruk «Ny oppføring» eller importer en CSV.'
                        : 'Ingen oppføringer i denne visningen.'}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={`${MODULE_TABLE_TR_BODY} cursor-pointer`}
                      onClick={() => navigate(`/registers/${encodeURIComponent(type.id)}/${record.id}`)}
                    >
                      {fields.map((col) => (
                        <td key={col.key} className="px-5 py-3 align-middle">
                          {isPersonField(col)
                            ? (
                              <RegisterPersonCell
                                value={record.values[col.key]}
                                primary={col === primaryField}
                              />
                            ) : (
                              <RegisterEntryCell
                                field={col}
                                record={record}
                                primary={col === primaryField}
                              />
                            )}
                        </td>
                      ))}
                      <td className="px-5 py-3 align-middle">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-5 py-3 align-middle">
                        <ReviewDate reviewDueAt={record.reviewDueAt} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-3 w-3" />}
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing({ kind: 'edit', record })
                          }}
                          aria-label="Rediger rad"
                          className="!gap-1 !rounded-md !border !border-neutral-200 !bg-white !px-2 !py-1 text-[11px] text-neutral-700 hover:!bg-neutral-50"
                        >
                          Rediger
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance + audit */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-900">Lovverk og tilgang</h3>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Lovverk
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(display.legalLabels ?? []).length === 0 ? (
                    <span className="text-neutral-400">Ingen lovreferanser registrert</span>
                  ) : (
                    (display.legalLabels ?? []).map((l) => (
                      <span
                        key={l}
                        className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
                      >
                        {l}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Eier / ansvarlig rolle
                </div>
                <div className="mt-1 text-sm text-neutral-900">
                  {display.ownerRole ?? 'Ikke satt'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Tilgangskontroll
                </div>
                <ul className="mt-1 space-y-1">
                  {(display.accessRules ?? []).length === 0 ? (
                    <li className="text-neutral-400">Ingen særregler — RLS følger orgens standard.</li>
                  ) : (
                    (display.accessRules ?? []).map((r) => (
                      <li
                        key={r}
                        className="flex items-start gap-1.5 text-neutral-700"
                      >
                        <UserCheck className="mt-0.5 h-3 w-3 shrink-0 text-[#1a3d32]" />
                        <span>{r}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Lagringstid
                </div>
                <div className="mt-1 text-sm text-neutral-900">
                  {display.retentionLabel ?? 'Ikke spesifisert'}
                </div>
              </div>
            </div>
          </div>

          <RegisterAuditLogCard registerTypeId={type.id} easy={easy} />
        </div>
      </ModulePageShell>

      {editing ? (
        <RegisterRecordForm
          open
          type={type}
          record={editing.kind === 'edit' ? editing.record : null}
          onClose={() => setEditing(null)}
          onSubmit={async ({ values, status, reviewDueAt }) => {
            if (editing.kind === 'new') {
              const id = await recordsHook.createRecord(values)
              if (id && (status !== 'active' || reviewDueAt)) {
                await recordsHook.updateRecord(id, { status, reviewDueAt })
              }
              return true
            }
            await recordsHook.updateRecord(editing.record.id, {
              values,
              status,
              reviewDueAt,
            })
            return true
          }}
          onDelete={async (record) => {
            await recordsHook.softDeleteRecord(record.id)
            setEditing(null)
          }}
        />
      ) : null}

      {importOpen ? (
        <RegisterImportDialog
          open={importOpen}
          type={type}
          onClose={() => setImportOpen(false)}
          onImport={handleImport}
        />
      ) : null}
    </>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────

function isPersonField(field: RegisterField): boolean {
  if (field.kind !== 'text') return false
  return PERSON_FIELD_HINTS.has(field.key.toLowerCase())
}

function StatusBadge({ status }: { status: 'draft' | 'active' | 'archived' }) {
  if (status === 'active') {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800">
        Aktiv
      </span>
    )
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
        Utkast
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
      Arkivert
    </span>
  )
}

function ReviewDate({ reviewDueAt }: { reviewDueAt: string | null }) {
  if (!reviewDueAt) return <span className="text-neutral-300">—</span>
  const d = new Date(reviewDueAt)
  if (Number.isNaN(d.getTime())) return <span className="text-neutral-300">—</span>
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = d < today
  const isSoon = !isOverdue && d.getTime() - today.getTime() <= 30 * 86_400_000
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return (
    <span
      className={[
        'inline-flex items-center gap-1 tabular-nums',
        isOverdue
          ? 'font-semibold text-red-700'
          : isSoon
            ? 'font-semibold text-amber-700'
            : 'text-neutral-700',
      ].join(' ')}
    >
      <Calendar className="h-3 w-3" />
      {`${dd}.${mm}.${yyyy}`}
      {isOverdue ? (
        <AlertTriangle className="h-3 w-3 text-red-700" aria-label="Forfalt" />
      ) : null}
    </span>
  )
}

type ChipDef = { id: string; label: string; count: number }

function buildChipDefs(
  byChip: Record<string, number>,
  fields: RegisterField[],
): ChipDef[] {
  const out: ChipDef[] = []
  // No 'all' entry — multi-select FilterChip treats empty selection as
  // "match everything", so the explicit "Alle" pill is redundant.

  if (byChip['reviews_overdue']) {
    out.push({ id: 'reviews_overdue', label: 'Forfalt', count: byChip['reviews_overdue'] })
  }
  if (byChip['reviews_due_soon']) {
    out.push({ id: 'reviews_due_soon', label: 'Utløper snart', count: byChip['reviews_due_soon'] })
  }
  if (byChip['cmr']) {
    out.push({ id: 'cmr', label: 'CMR', count: byChip['cmr'] })
  }
  if (byChip['drafts']) {
    out.push({ id: 'drafts', label: 'Utkast', count: byChip['drafts'] })
  }
  if (byChip['archived']) {
    out.push({ id: 'archived', label: 'Arkivert', count: byChip['archived'] })
  }

  // Field-specific status/severity chips
  for (const key of Object.keys(byChip)) {
    const colonIdx = key.indexOf(':')
    if (colonIdx < 1) continue
    const fieldKey = key.slice(0, colonIdx)
    const valueId = key.slice(colonIdx + 1)
    const field = fields.find((f) => f.key === fieldKey)
    if (!field || !field.options) continue
    const opt = field.options.find((o) => o.value === valueId)
    if (!opt) continue
    out.push({
      id: key,
      label: opt.label,
      count: byChip[key],
    })
  }

  return out
}

function KpiCard({
  tone,
  label,
  big,
  sub,
}: {
  tone: 'default' | 'danger' | 'warn' | 'info' | 'neutral'
  label: string
  big: number
  sub?: string
}) {
  const toneStyles: Record<typeof tone, { wrap: string; label: string; value: string; sub: string }> = {
    default: {
      wrap: 'rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm',
      label: 'text-neutral-500',
      value: 'text-neutral-900',
      sub: 'text-neutral-500',
    },
    danger: {
      wrap: 'rounded-xl border border-red-200 bg-red-50/60 p-4',
      label: 'text-red-800',
      value: 'text-red-900',
      sub: 'text-red-800',
    },
    warn: {
      wrap: 'rounded-xl border border-amber-200 bg-amber-50/60 p-4',
      label: 'text-amber-800',
      value: 'text-amber-900',
      sub: 'text-amber-800',
    },
    info: {
      wrap: 'rounded-xl border border-blue-200 bg-blue-50/60 p-4',
      label: 'text-blue-800',
      value: 'text-blue-900',
      sub: 'text-blue-800',
    },
    neutral: {
      wrap: 'rounded-xl border border-neutral-200/80 bg-neutral-50 p-4',
      label: 'text-neutral-600',
      value: 'text-neutral-800',
      sub: 'text-neutral-600',
    },
  }
  const s = toneStyles[tone]
  return (
    <div className={s.wrap}>
      <div className={`text-[10px] font-bold uppercase tracking-wider ${s.label}`}>{label}</div>
      <div
        className={`mt-1 text-2xl font-bold tabular-nums ${s.value}`}
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        {big}
      </div>
      {sub ? <div className={`text-[10px] ${s.sub}`}>{sub}</div> : null}
    </div>
  )
}

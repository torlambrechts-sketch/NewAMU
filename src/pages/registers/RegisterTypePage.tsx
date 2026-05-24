// /registers/:typeId — detail view for one register.
//
// Mirrors the Klarert RegisterDetail design: status bar (framework
// pill + lovpålagt / GDPR + legal labels), KPI tiles for the most
// relevant counts, filter chips above the entries table, then a
// "Lovverk og tilgang" + audit-log row below.
//
// Entries (records) are rendered through the schema-driven cell
// renderer so each type shows its own column shape (kjemikalier:
// CAS-nummer + faresetninger; HIRA: risk score; …).

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  SlidersHorizontal,
  Upload,
  User as UserIcon,
  UserCheck,
} from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useRegisterUiPreference } from '../../hooks/useUserUiPreferences'
import { useRegisters, useRegisterRecords } from '../../hooks/useRegisters'
import { ModulePageShell } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
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

  const [activeChip, setActiveChip] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<
    | { kind: 'new' }
    | { kind: 'edit'; record: RegisterRecord }
    | null
  >(null)
  const [importOpen, setImportOpen] = useState(false)

  const stats = useMemo(
    () => (type ? computeRegisterStats(type, recordsHook.records) : null),
    [type, recordsHook.records],
  )

  const filteredRecords = useMemo(() => {
    if (!type) return []
    let out = filterByChip(type, recordsHook.records, activeChip)
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
  }, [type, recordsHook.records, activeChip, search])

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

        {/* Entries table */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {chipDefs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChip(c.id)}
                  className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                    activeChip === c.id
                      ? 'bg-[#1a3d32] text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70',
                  ].join(' ')}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-52 rounded-md border border-neutral-200 bg-neutral-50 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#1a3d32] focus:bg-white"
                  placeholder="Søk …"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
                onClick={() => setActiveChip('all')}
              >
                Nullstill
              </Button>
            </div>
          </div>

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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditing({ kind: 'edit', record })
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700 transition-colors hover:bg-neutral-50"
                          aria-label="Rediger rad"
                        >
                          <Pencil className="h-3 w-3" />
                          Rediger
                        </button>
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

type ChipDef = { id: string; label: string }

function buildChipDefs(
  byChip: Record<string, number>,
  fields: RegisterField[],
): ChipDef[] {
  const out: ChipDef[] = []
  out.push({ id: 'all', label: `Alle (${byChip['all'] ?? 0})` })

  if (byChip['reviews_overdue']) {
    out.push({ id: 'reviews_overdue', label: `Forfalt (${byChip['reviews_overdue']})` })
  }
  if (byChip['reviews_due_soon']) {
    out.push({ id: 'reviews_due_soon', label: `Utløper snart (${byChip['reviews_due_soon']})` })
  }
  if (byChip['cmr']) {
    out.push({ id: 'cmr', label: `CMR (${byChip['cmr']})` })
  }
  if (byChip['drafts']) {
    out.push({ id: 'drafts', label: `Utkast (${byChip['drafts']})` })
  }
  if (byChip['archived']) {
    out.push({ id: 'archived', label: `Arkivert (${byChip['archived']})` })
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
      label: `${opt.label} (${byChip[key]})`,
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

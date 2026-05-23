// ChecklistsPage — three-mode landing for compliance checklists.
//
//   hub        no params              — redesigned unified landing: tabs,
//                                       KPI stats, execution table with
//                                       search + Enkel/Avansert mode toggle
//   pack       ?pack=<slug>           — pack lens: KPI row, banner, all
//                                       executions for the pack
//   template   ?template=<slug>       — single-template focus: title and
//                                       CTA reflect the template; list shows
//                                       only executions of that template
//
// The URL is the source of truth for mode. URL-driven instead of
// useActivePack() so /compliance/checklists with no ?pack= renders the hub
// rather than silently defaulting to the first licensed pack.
//
// The pack switcher itself lives in the global top bar
// (ShellCompliancePackSwitcher) so it stays visible across compliance pages.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ClipboardList,
  Filter,
  Flame,
  Plus,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Truck,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import { ComplianceCreateForm } from './ComplianceCreateForm'
import type { ComplianceExecutionRow, CompliancePackSlug } from './types'

const STATUS_LABEL: Record<ComplianceExecutionRow['status'], string> = {
  draft: 'Kladd',
  active: 'Pågår',
  signed: 'Fullført',
}

function statusBadgeVariant(
  status: ComplianceExecutionRow['status'],
): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

/** Pick a small icon from the execution title for visual variety in the table. */
function RowIcon({ title }: { title: string }) {
  const lower = title.toLowerCase()
  let Icon = ClipboardCheck
  let bg = 'bg-neutral-100'
  let fg = 'text-neutral-500'
  if (lower.includes('brann') || lower.includes('brannvern')) {
    Icon = Flame
    bg = 'bg-orange-50'
    fg = 'text-orange-500'
  } else if (lower.includes('truck') || lower.includes('løft') || lower.includes('kjøretøy')) {
    Icon = Truck
    bg = 'bg-blue-50'
    fg = 'text-blue-500'
  } else if (
    lower.includes('bygg') ||
    lower.includes('bygg') ||
    lower.includes('egenkontroll')
  ) {
    Icon = Building2
    bg = 'bg-teal-50'
    fg = 'text-teal-600'
  } else if (lower.includes('verne') || lower.includes('vernerunde')) {
    Icon = Shield
    bg = 'bg-green-50'
    fg = 'text-green-600'
  } else if (lower.includes('mal') || lower.includes('template')) {
    Icon = ClipboardList
    bg = 'bg-purple-50'
    fg = 'text-purple-600'
  }
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bg}`}>
      <Icon className={`h-4 w-4 ${fg}`} aria-hidden />
    </span>
  )
}

export function ChecklistsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const packSlugParam = searchParams.get('pack')
  const templateSlugParam = searchParams.get('template')

  const licensedPacks = useLicensedPacks()
  const { supabase, locations } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const { load, reloadAggregates } = cl
  const [createOpen, setCreateOpen] = useState(false)

  // Hub-mode UI state
  const [activeTab, setActiveTab] = useState<'executions' | 'templates'>('executions')
  const [viewMode, setViewMode] = useState<'enkel' | 'avansert'>('enkel')
  const [search, setSearch] = useState('')

  // Pack mode requires an explicit ?pack= so /compliance/checklists with no
  // params falls to the neutral hub instead of defaulting to packs[0].
  const activePack = useMemo(() => {
    if (!packSlugParam) return null
    return licensedPacks.find((p) => p.slug === (packSlugParam as CompliancePackSlug)) ?? null
  }, [licensedPacks, packSlugParam])

  // Template mode is anchored on the URL slug. We resolve against all loaded
  // templates so a deep-link like ?template=foo&pack=bar works on first
  // render even before the pack-filtered load finishes.
  const focusedTemplate = useMemo(() => {
    if (!templateSlugParam) return null
    if (activePack) {
      return (
        cl.templates.find(
          (t) => t.slug === templateSlugParam && t.pack === activePack.slug && t.is_active,
        ) ?? null
      )
    }
    return cl.templates.find((t) => t.slug === templateSlugParam && t.is_active) ?? null
  }, [cl.templates, activePack, templateSlugParam])

  const mode: 'template' | 'pack' | 'hub' = focusedTemplate
    ? 'template'
    : activePack
    ? 'pack'
    : 'hub'

  // Reload when mode/pack/template changes.
  //   hub      → load everything (no filter) so tiles see every pack.
  //   pack     → list + aggregates scoped to pack.
  //   template → list scoped to pack, but aggregates re-run with the
  //              template_id filter so the boxes below the heading
  //              reflect only this template's executions.
  // Depend on stable string ids — `focusedTemplate` is a memoised object
  // that gets a new identity on every templates reload, which would cause
  // the effect to re-fire after each `load()` and produce the bouncing
  // numbers (template-scoped → pack-scoped → template-scoped → …).
  const focusedTemplateId = focusedTemplate?.id ?? null
  const focusedTemplatePack = focusedTemplate?.pack ?? null
  const activePackSlug = activePack?.slug ?? null
  useEffect(() => {
    if (mode === 'hub') {
      void load()
    } else if (focusedTemplateId && focusedTemplatePack) {
      void (async () => {
        await load({ pack: focusedTemplatePack })
        await reloadAggregates(focusedTemplatePack, focusedTemplateId)
      })()
    } else if (activePackSlug) {
      void load({ pack: activePackSlug })
    }
  }, [load, reloadAggregates, mode, activePackSlug, focusedTemplateId, focusedTemplatePack])

  const visibleExecutions = useMemo(() => {
    if (mode === 'hub') return cl.executions
    if (focusedTemplate) {
      return cl.executions.filter(
        (e) => e.pack === focusedTemplate.pack && e.template_id === focusedTemplate.id,
      )
    }
    if (activePack) return cl.executions.filter((e) => e.pack === activePack.slug)
    return cl.executions
  }, [cl.executions, mode, activePack, focusedTemplate])

  // Templates passed to the create form: in template mode, just the focused
  // one (the slide panel preselects it); in pack mode, the pack's active
  // templates; never shown in hub mode.
  const formTemplates = useMemo(() => {
    if (focusedTemplate) return [focusedTemplate]
    if (activePack) {
      return cl.templates.filter((t) => t.pack === activePack.slug && t.is_active)
    }
    return []
  }, [cl.templates, activePack, focusedTemplate])

  // --- Hub-mode computations ---

  /** Location name lookup for STED column. */
  const locationById = useMemo(() => {
    const m = new Map<string, string>()
    for (const loc of locations ?? []) m.set(loc.id, loc.name)
    return m
  }, [locations])

  function getLocationDisplay(row: ComplianceExecutionRow): string {
    if (row.location_id) return locationById.get(row.location_id) ?? '—'
    if (row.scope_type === 'catalogue_item') return row.scope_catalogue_item_label ?? '—'
    if (row.scope_type === 'other') return row.scope_other_label ?? '—'
    return '—'
  }

  const activeTemplates = useMemo(
    () => cl.templates.filter((t) => t.is_active),
    [cl.templates],
  )

  /** Unique active category count across all packs. */
  const typeCount = useMemo(
    () => new Set(cl.categories.filter((c) => c.is_active).map((c) => c.id)).size,
    [cl.categories],
  )

  const ongoingCount = useMemo(
    () => cl.executions.filter((e) => e.status === 'active').length,
    [cl.executions],
  )

  const completionRate = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const recent = cl.executions.filter(
      (e) => e.scheduled_for && new Date(e.scheduled_for) >= cutoff,
    )
    if (!recent.length) return 0
    return Math.round((recent.filter((e) => e.status === 'signed').length / recent.length) * 100)
  }, [cl.executions])

  /** Executions filtered by search query (title + location name). */
  const filteredExecutions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cl.executions
    return cl.executions.filter((e) => {
      const loc = e.location_id ? (locationById.get(e.location_id) ?? '') : ''
      return (
        e.title.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        (e.scope_catalogue_item_label ?? '').toLowerCase().includes(q) ||
        (e.scope_other_label ?? '').toLowerCase().includes(q)
      )
    })
  }, [cl.executions, search, locationById])

  // --- Hub mode render ---
  if (mode === 'hub') {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Sjekklister' }]}
        title="Sjekklister"
        description="Planlegg og gjennomfør sjekklister — vernerunder, brannvern og daglig kontroll."
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Enkel / Avansert mode toggle */}
            <div
              role="tablist"
              aria-label="Visningsmodus"
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1"
            >
              <button
                role="tab"
                type="button"
                aria-selected={viewMode === 'enkel'}
                onClick={() => setViewMode('enkel')}
                className={`flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === 'enkel'
                    ? 'bg-[#1a3d32] text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <CircleDot className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Enkel</span>
                <span className={`text-[11px] font-normal ${viewMode === 'enkel' ? 'text-white/70' : 'text-neutral-400'}`}>
                  · For alle i felt
                </span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={viewMode === 'avansert'}
                onClick={() => setViewMode('avansert')}
                className={`flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === 'avansert'
                    ? 'bg-[#1a3d32] text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>Avansert</span>
                <span className={`text-[11px] font-normal ${viewMode === 'avansert' ? 'text-white/70' : 'text-neutral-400'}`}>
                  · HMS-ansvarlig
                </span>
              </button>
            </div>

            <Link
              to="/compliance/checklists/admin"
              aria-label="Innstillinger"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" aria-hidden />
              <span>Innstillinger</span>
            </Link>

            <Button
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
              disabled={cl.templates.filter((t) => t.is_active).length === 0}
            >
              Ny sjekkliste
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('executions')}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'executions'
                  ? 'bg-[#1a3d32] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Gjennomføringer
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'executions'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {cl.executions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'templates'
                  ? 'bg-[#1a3d32] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Maler
              <span
                className={`ml-1.5 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === 'templates'
                    ? 'bg-white/20 text-white'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {activeTemplates.length}
              </span>
            </button>
          </div>

          {/* KPI stat row */}
          <LayoutScoreStatRow
            items={[
              {
                big: String(activeTemplates.length),
                title: 'Aktive maler',
                sub: typeCount > 0 ? `${typeCount} typer` : 'Alle typer',
              },
              {
                big: String(ongoingCount),
                title: 'Pågående',
                sub: 'Denne uka',
              },
              {
                big: `${completionRate}%`,
                title: 'Fullført',
                sub: 'Siste 30 dager',
              },
            ]}
          />

          {/* Gjennomføringer tab */}
          {activeTab === 'executions' && (
            <LayoutTable1PostingsShell
              wrap
              title="Gjennomføringer"
              titleTypography="sans"
              toolbar={
                <div className="flex w-full items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                    <input
                      type="search"
                      placeholder="Søk i tittel, sted..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                    />
                  </div>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <Filter className="h-4 w-4" aria-hidden />
                    Filtrer
                  </button>
                </div>
              }
              footer={
                <span className="text-neutral-500">
                  Viser {filteredExecutions.length} av {cl.executions.length} oppføringer
                </span>
              }
            >
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Sted</th>
                    {viewMode === 'avansert' && (
                      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
                    )}
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Frist</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {filteredExecutions.length === 0 ? (
                    <tr>
                      <td colSpan={viewMode === 'avansert' ? 6 : 5}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">
                            {search.trim()
                              ? 'Ingen treff på søket.'
                              : 'Ingen gjennomføringer ennå.'}
                          </p>
                          {!search.trim() && (
                            <div className="mt-3 inline-flex">
                              <Button
                                variant="primary"
                                icon={<Plus className="h-4 w-4" />}
                                onClick={() => setCreateOpen(true)}
                                disabled={cl.templates.filter((t) => t.is_active).length === 0}
                              >
                                Ny sjekkliste
                              </Button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredExecutions.map((row) => {
                      const assignee = row.assigned_to
                        ? (cl.assignableUsers.find((u) => u.id === row.assigned_to)?.displayName ?? '—')
                        : '—'
                      return (
                        <tr
                          key={row.id}
                          className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                          onClick={() => navigate(`/compliance/checklists/${row.id}`)}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <RowIcon title={row.title} />
                              <div className="min-w-0">
                                <p className="font-medium text-neutral-900">{row.title}</p>
                                <p className="text-xs text-neutral-400">#{row.id.slice(-4).toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-neutral-600">
                            {getLocationDisplay(row)}
                          </td>
                          {viewMode === 'avansert' && (
                            <td className="px-5 py-3 text-neutral-600">{assignee}</td>
                          )}
                          <td className="px-5 py-3">
                            <Badge variant={statusBadgeVariant(row.status)}>
                              {STATUS_LABEL[row.status]}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-neutral-600">
                            {formatDate(row.scheduled_for)}
                          </td>
                          <td className="w-8 px-3 py-3 text-neutral-300">
                            <ChevronRight className="h-4 w-4" />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </LayoutTable1PostingsShell>
          )}

          {/* Maler tab */}
          {activeTab === 'templates' && (
            <LayoutTable1PostingsShell
              wrap
              title="Maler"
              titleTypography="sans"
              toolbar={
                <div className="flex w-full items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden />
                    <input
                      type="search"
                      placeholder="Søk i malnavn..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                    />
                  </div>
                  <Link
                    to="/compliance/checklists/admin"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <Settings className="h-4 w-4" aria-hidden />
                    Administrer
                  </Link>
                </div>
              }
              footer={
                <span className="text-neutral-500">
                  {activeTemplates.length} aktive maler
                </span>
              }
            >
              <table className="w-full min-w-[500px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Navn</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Pakke</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Kadense</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {activeTemplates
                    .filter((t) => {
                      const q = search.trim().toLowerCase()
                      return !q || t.name.toLowerCase().includes(q)
                    })
                    .map((tpl) => (
                      <tr
                        key={tpl.id}
                        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                        onClick={() =>
                          navigate(`/compliance/checklists?pack=${tpl.pack}&template=${tpl.slug}`)
                        }
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <RowIcon title={tpl.name} />
                            <div className="min-w-0">
                              <p className="font-medium text-neutral-900">{tpl.name}</p>
                              {tpl.description && (
                                <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
                                  {tpl.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="neutral">{tpl.pack}</Badge>
                        </td>
                        <td className="px-5 py-3 text-neutral-600">
                          {tpl.cadence_hint ?? '—'}
                        </td>
                        <td className="w-8 px-3 py-3 text-neutral-300">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))}
                  {activeTemplates.length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="py-12 text-center text-sm text-neutral-500">
                          Ingen aktive maler. Gå til Innstillinger for å aktivere maler.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </LayoutTable1PostingsShell>
          )}
        </div>

        <ComplianceCreateForm
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          templates={cl.templates.filter((t) => t.is_active)}
          assignableUsers={cl.assignableUsers}
          onCreate={async (payload) => {
            const id = await cl.createExecution(payload)
            if (id) {
              setCreateOpen(false)
              navigate(`/compliance/checklists/${id}`)
            }
          }}
        />
      </ModulePageShell>
    )
  }

  // pack/template modes share most chrome — diverge only on copy + filtering.
  const pack = activePack!
  const pageTitle = focusedTemplate ? focusedTemplate.name : pack.pluralLabel
  const pageDescription = focusedTemplate
    ? (focusedTemplate.description ?? pack.description)
    : pack.description
  const ctaLabel = focusedTemplate
    ? `Ny ${focusedTemplate.name.toLowerCase()}`
    : pack.ctaLabel

  return (
    <ModulePageShell
      breadcrumb={
        focusedTemplate
          ? [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel, to: `/compliance/checklists?pack=${pack.slug}` },
              { label: focusedTemplate.name },
            ]
          : [
              { label: 'HMS' },
              { label: 'Sjekklister', to: '/compliance/checklists' },
              { label: pack.pluralLabel },
            ]
      }
      title={pageTitle}
      description={pageDescription}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={formTemplates.length === 0}
          >
            {ctaLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {cl.error ? <WarningBox>{cl.error}</WarningBox> : null}

        {!focusedTemplate ? (
          <ModuleLegalBanner
            title={pack.shortName}
            intro={<p>{pack.description}</p>}
            references={pack.legalReferences.map((r) => ({
              code: r.code,
              text: r.text,
            }))}
          />
        ) : null}

        <LayoutScoreStatRow
          items={[
            {
              big: String(cl.aggregates.openCount),
              // Pack mode keeps the customer-tuned pack label (e.g.
              // "Åpne vernerunder"); template mode falls back to a
              // generic label so the box doesn't lie about which template
              // it represents — the sub line carries the template name.
              title: focusedTemplate ? 'Åpne kjøringer' : pack.kpiLabels.open,
              sub: focusedTemplate ? focusedTemplate.name : 'Under behandling',
            },
            {
              big: String(cl.aggregates.criticalFindings),
              title: focusedTemplate ? 'Kritiske funn' : pack.kpiLabels.critical,
              sub: 'Krever oppfølging',
            },
            {
              big: String(cl.aggregates.ytdCompleted),
              title: focusedTemplate ? 'Signert i år' : pack.kpiLabels.ytd,
              sub: focusedTemplate ? focusedTemplate.name : 'Signert i år',
            },
          ]}
        />

        <LayoutTable1PostingsShell
          wrap
          title={pageTitle}
          description={`Alle ${pageTitle.toLowerCase()} — sortert etter siste aktivitet.`}
          toolbar={null}
          footer={<span className="text-neutral-500">{visibleExecutions.length} poster</span>}
        >
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                  <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
                  <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                </tr>
              </thead>
              <tbody>
                {visibleExecutions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="py-12 text-center">
                        <p className="text-sm text-neutral-500">
                          Ingen {pageTitle.toLowerCase()} ennå.
                        </p>
                        <div className="mt-3 inline-flex">
                          <Button
                            variant="primary"
                            icon={<Plus className="h-4 w-4" />}
                            onClick={() => setCreateOpen(true)}
                            disabled={formTemplates.length === 0}
                          >
                            {ctaLabel}
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleExecutions.map((row) => (
                    <tr
                      key={row.id}
                      className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                      onClick={() => navigate(`/compliance/checklists/${row.id}`)}
                    >
                      <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusBadgeVariant(row.status)}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">
                        {formatDate(row.scheduled_for)}
                      </td>
                      <td className="w-8 px-3 py-3 text-neutral-300">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </LayoutTable1PostingsShell>
      </div>

      <ComplianceCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={formTemplates}
        assignableUsers={cl.assignableUsers}
        onCreate={async (payload) => {
          const id = await cl.createExecution(payload)
          if (id) {
            setCreateOpen(false)
            navigate(`/compliance/checklists/${id}`)
          }
        }}
      />
    </ModulePageShell>
  )
}

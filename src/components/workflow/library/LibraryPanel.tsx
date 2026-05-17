// LibraryPanel — browseable catalog of audit-ready workflow templates.
//
// Card-grid layout with a sticky filter rail + pack-level "install hele
// pakken" tiles. The previous 7-column table was the right shape during
// engineering ramp-up (you could eyeball law_refs vs scope vs version at
// a glance) but it doesn't match the storefront mental model the install
// flow actually needs. Users land here when they want to ADOPT a rule,
// not audit metadata — the card grid leads with what the rule does,
// followed by the regulator chips and law_refs as secondary context.
//
// Filter rail is URL-bound via useSearchParams so deep-links from the
// regelverk-coverage page (or anywhere else) can pre-filter the
// library. Pack tiles call provision_workflows_baseline_for_org via
// useWorkflows.seedWorkflowBaseline so the install path is identical
// to the existing programmatic baseline.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Eye,
  Filter as FilterIcon,
  Layers,
  Loader2,
  Package,
  Plus,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useWorkflowCatalog } from '../../../hooks/useWorkflowCatalog'
import { useWorkflows } from '../../../hooks/useWorkflows'
import { getWorkflowScope, listWorkflowScopes } from '../../../lib/workflows/workflowRegistry'
import { isGovernmentActionType } from '../../../types/workflow'
import type {
  WorkflowAction,
  WorkflowRuleCatalogRow,
  WorkflowXorActionsEnvelope,
} from '../../../types/workflow'
import { Button } from '../../ui/Button'
import { ModuleSectionCard } from '../../module/ModuleSectionCard'
import { LibraryPreviewPanel } from './LibraryPreviewPanel'
import { LibraryPackInstallModal } from './LibraryPackInstallModal'

// ─── Helpers ────────────────────────────────────────────────────────────────

function flattenCatalogActions(
  actions: WorkflowAction[] | WorkflowXorActionsEnvelope | unknown,
): WorkflowAction[] {
  if (Array.isArray(actions)) return actions as WorkflowAction[]
  if (actions && typeof actions === 'object' && 'mode' in (actions as Record<string, unknown>)) {
    const env = actions as WorkflowXorActionsEnvelope
    if (env.mode === 'xor_branches') return env.branches.flatMap((b) => b.actions)
  }
  return []
}

export function catalogActionCount(row: WorkflowRuleCatalogRow): number {
  return flattenCatalogActions(row.actions_json).length
}

export function catalogApprovalCount(row: WorkflowRuleCatalogRow): number {
  return flattenCatalogActions(row.actions_json).filter(
    (a) => (a as { type: string }).type === 'request_approval',
  ).length
}

function complexityBucket(count: number): '1-3' | '4-6' | '7+' {
  if (count <= 3) return '1-3'
  if (count <= 6) return '4-6'
  return '7+'
}

// Regulator detection — we infer from the gov action types present in
// the actions_json (or fall back to law-ref strings as a hint).
type Regulator = 'arbeidstilsynet' | 'datatilsynet' | 'nav' | 'ldo' | 'none'

const REGULATOR_LABEL: Record<Regulator, string> = {
  arbeidstilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  nav: 'NAV',
  ldo: 'LDO',
  none: 'Intern',
}

export function detectRegulators(row: WorkflowRuleCatalogRow): Regulator[] {
  const out = new Set<Regulator>()
  for (const action of flattenCatalogActions(row.actions_json)) {
    const t = (action as { type: string }).type
    if (t === 'rapporter_alvorlig_skade_arbeidstilsynet') out.add('arbeidstilsynet')
    else if (t === 'meld_personvernbrudd_datatilsynet') out.add('datatilsynet')
    else if (t === 'nav_sykefravar_oppfolging') out.add('nav')
    else if (t === 'varsel_ldo_export') out.add('ldo')
    else if (t === 'altinn_send_melding') out.add('arbeidstilsynet')
  }
  if (out.size === 0) out.add('none')
  return [...out]
}

const PACK_DEFINITIONS: Record<string, { label: string; description: string }> = {
  'aml-amu': {
    label: 'AML-AMU starter',
    description: 'Pliktene etter arbeidsmiljøloven og internkontrollforskriften, dokumentert i kjedet bevisspor.',
  },
  'iso-45001': {
    label: 'ISO 45001',
    description: 'Sertifiseringsklare rutiner for HMS-styringssystemet i tråd med ISO 45001.',
  },
  gdpr: {
    label: 'GDPR personvern',
    description: 'Personvern­hendelser, brudd­melding til Datatilsynet og oppfølging av registrertes rettigheter.',
  },
  apenhetsloven: {
    label: 'Åpenhetsloven',
    description: 'Aktsomhetsvurderinger og rapportering etter åpenhetsloven.',
  },
}

const ROW_PARAM_KEYS = ['modules', 'laws', 'regulators', 'complexity', 'packs', 'q'] as const

// Action-type → Norwegian label (used by the preview panel for friendly
// rendering). Keep keys lowercase and 1:1 with action discriminants.
export const ACTION_TYPE_LABELS: Record<string, string> = {
  create_task: 'Opprett oppgave',
  create_task_item: 'Opprett oppgave (mal)',
  create_deviation: 'Opprett avvik',
  create_ros_draft: 'Opprett ROS-utkast',
  add_amu_agenda_item: 'Legg til AMU-agendapunkt',
  request_signature: 'Be om signatur',
  wait_delay: 'Vent (relativ)',
  wait_until: 'Vent til (absolutt)',
  request_approval: 'Be om godkjenning',
  on_error: 'Ved feil — kjør',
  parallel: 'Kjør parallelt',
  escalate: 'Eskaler',
  send_email: 'Send e-post',
  send_notification: 'Send varsel',
  call_webhook: 'Kall webhook',
  log_only: 'Kun loggføring',
  rapporter_alvorlig_skade_arbeidstilsynet: 'Rapporter alvorlig skade — Arbeidstilsynet',
  meld_personvernbrudd_datatilsynet: 'Meld personvernbrudd — Datatilsynet',
  varsel_ldo_export: 'LDO — eksporter dokumentasjon',
  nav_sykefravar_oppfolging: 'NAV sykefraværsoppfølging',
  altinn_send_melding: 'Altinn — send melding',
}

// ─── Component ──────────────────────────────────────────────────────────────

type RowInstallState =
  | { kind: 'idle' }
  | { kind: 'installing' }
  | { kind: 'installed'; ruleId: string }
  | { kind: 'exists'; ruleId: string }
  | { kind: 'error'; message: string }

export function LibraryPanel({ onInstalled }: { onInstalled?: (ruleId: string) => void } = {}) {
  const { catalog, loading, error, refresh } = useWorkflowCatalog()
  const { rules, seedWorkflowBaseline, seedWorkflowFromCatalog, canCompose } = useWorkflows()
  const [searchParams, setSearchParams] = useSearchParams()

  // Per-row install state map keyed by slug.
  const [installStates, setInstallStates] = useState<Record<string, RowInstallState>>({})
  const [previewSlug, setPreviewSlug] = useState<string | null>(null)
  const [packModal, setPackModal] = useState<string | null>(null)
  const [installingPack, setInstallingPack] = useState<string | null>(null)
  const [packBanner, setPackBanner] = useState<{ pack: string; outcome: string } | null>(null)
  const [installBanner, setInstallBanner] = useState<string | null>(null)

  // ─── URL-bound filter state ──────────────────────────────────────────────
  const moduleFilters = useMemo(
    () => (searchParams.get('modules')?.split(',').filter(Boolean) ?? []),
    [searchParams],
  )
  const lawFilters = useMemo(
    () => (searchParams.get('laws')?.split(',').filter(Boolean) ?? []),
    [searchParams],
  )
  const regulatorFilters = useMemo(
    () => (searchParams.get('regulators')?.split(',').filter(Boolean) ?? []),
    [searchParams],
  )
  const complexityFilter = (searchParams.get('complexity') ?? '') as '' | '1-3' | '4-6' | '7+'
  const packFilters = useMemo(
    () => (searchParams.get('packs')?.split(',').filter(Boolean) ?? []),
    [searchParams],
  )
  const search = searchParams.get('q') ?? ''

  const setFilterParam = useCallback(
    (key: (typeof ROW_PARAM_KEYS)[number], value: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (!value) params.delete(key)
          else params.set(key, value)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const toggleArrayFilter = useCallback(
    (
      key: 'modules' | 'laws' | 'regulators' | 'packs',
      current: string[],
      value: string,
    ) => {
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      setFilterParam(key, next.length === 0 ? null : next.join(','))
    },
    [setFilterParam],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        ROW_PARAM_KEYS.forEach((k) => params.delete(k))
        return params
      },
      { replace: true },
    )
  }, [setSearchParams])

  // ─── Derived data ────────────────────────────────────────────────────────
  const scopes = listWorkflowScopes()
  const installedBySlug = useMemo(() => {
    const m = new Map<string, string>()
    rules.forEach((r) => {
      if (r.catalog_slug) m.set(r.catalog_slug, r.id)
      else m.set(r.slug, r.id)
    })
    return m
  }, [rules])

  const packs = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((row) => row.pack && set.add(row.pack))
    return [...set].sort()
  }, [catalog])

  const lawRefIndex = useMemo(() => {
    const set = new Set<string>()
    catalog.forEach((row) => row.law_refs.forEach((ref) => set.add(ref)))
    return [...set].sort()
  }, [catalog])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((row) => {
      if (moduleFilters.length > 0 && !moduleFilters.includes(row.scope_id)) return false
      if (packFilters.length > 0 && !packFilters.includes(row.pack ?? '')) return false
      if (lawFilters.length > 0) {
        const match = row.law_refs.some((ref) =>
          lawFilters.some((lf) => ref.toLowerCase().includes(lf.toLowerCase())),
        )
        if (!match) return false
      }
      if (regulatorFilters.length > 0) {
        const regs = detectRegulators(row)
        if (!regs.some((r) => regulatorFilters.includes(r))) return false
      }
      if (complexityFilter) {
        if (complexityBucket(catalogActionCount(row)) !== complexityFilter) return false
      }
      if (q) {
        const hay = [
          row.name_i18n?.nb ?? '',
          (row.description_i18n as { nb?: string } | null)?.nb ?? '',
          row.slug,
          row.law_refs.join(' '),
          row.trigger_event_name ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [catalog, search, moduleFilters, packFilters, lawFilters, regulatorFilters, complexityFilter])

  // For each pack: count how many of its rules are already installed in
  // this org. We show "Installer hele pakken" tiles only for packs that
  // still have at least one un-installed rule.
  const packCoverage = useMemo(() => {
    const acc = new Map<string, { total: number; installed: number; sample: WorkflowRuleCatalogRow[] }>()
    catalog.forEach((row) => {
      if (!row.pack) return
      const entry = acc.get(row.pack) ?? { total: 0, installed: 0, sample: [] }
      entry.total += 1
      if (installedBySlug.has(row.slug)) entry.installed += 1
      if (entry.sample.length < 3) entry.sample.push(row)
      acc.set(row.pack, entry)
    })
    return acc
  }, [catalog, installedBySlug])

  const incompletePacks = useMemo(() => {
    const list = [...packCoverage.entries()].filter(([, info]) => info.installed < info.total)
    list.sort((a, b) => b[1].total - a[1].total)
    return list.slice(0, 3)
  }, [packCoverage])

  // ─── Install single rule ────────────────────────────────────────────────
  const handleInstallRow = async (slug: string) => {
    setInstallStates((s) => ({ ...s, [slug]: { kind: 'installing' } }))
    const result = await seedWorkflowFromCatalog(slug)
    if (!result.ok) {
      setInstallStates((s) => ({
        ...s,
        [slug]: { kind: 'error', message: result.error ?? 'Ukjent feil' },
      }))
      return
    }
    if (result.action === 'exists') {
      setInstallStates((s) => ({ ...s, [slug]: { kind: 'exists', ruleId: result.ruleId } }))
    } else {
      setInstallStates((s) => ({ ...s, [slug]: { kind: 'installed', ruleId: result.ruleId } }))
      setInstallBanner(
        'Regelen ble installert som inaktiv. Aktiver den i Mine arbeidsflyter når den er klar.',
      )
    }
    void refresh()
  }

  // ─── Install pack ────────────────────────────────────────────────────────
  const handleConfirmPackInstall = async (pack: string) => {
    setInstallingPack(pack)
    const result = await seedWorkflowBaseline({ pack })
    setInstallingPack(null)
    if (!result.ok) {
      setPackBanner({ pack, outcome: `Feil: ${result.error ?? 'ukjent'}` })
      return
    }
    const outcome = result.installed.reduce(
      (acc, r) => {
        acc[r.installed_action] = (acc[r.installed_action] ?? 0) + 1
        return acc
      },
      { inserted: 0, updated: 0, skipped: 0 } as Record<string, number>,
    )
    setPackBanner({
      pack,
      outcome: `${outcome.inserted} nye · ${outcome.updated} oppdaterte · ${outcome.skipped} uendrede`,
    })
    setPackModal(null)
    void refresh()
  }

  // Clear stale per-row banners when the search query changes a lot.
  useEffect(() => {
    if (search === '' && Object.keys(installStates).length === 0) setInstallBanner(null)
  }, [search, installStates])

  if (loading && catalog.length === 0) {
    return <div className="p-6 text-sm text-neutral-500">Laster mal-bibliotek …</div>
  }
  if (error) {
    return <div className="p-6 text-sm text-red-700">Kunne ikke laste maler: {error}</div>
  }

  const activeFilterCount =
    moduleFilters.length +
    lawFilters.length +
    regulatorFilters.length +
    packFilters.length +
    (complexityFilter ? 1 : 0) +
    (search ? 1 : 0)

  const previewRow = previewSlug ? catalog.find((r) => r.slug === previewSlug) ?? null : null
  const packForModal = packModal ? packCoverage.get(packModal) : undefined

  return (
    <div className="space-y-5">
      {/* Banners */}
      {installBanner && (
        <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="flex-1">{installBanner}</div>
          <button
            type="button"
            onClick={() => setInstallBanner(null)}
            aria-label="Skjul melding"
            className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {packBanner && (
        <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="flex-1">
            Pakken{' '}
            <span className="font-semibold">
              {PACK_DEFINITIONS[packBanner.pack]?.label ?? packBanner.pack}
            </span>{' '}
            installert: {packBanner.outcome}
          </div>
          <button
            type="button"
            onClick={() => setPackBanner(null)}
            aria-label="Skjul melding"
            className="rounded-md p-1 text-emerald-700 hover:bg-emerald-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Pack tiles */}
      {incompletePacks.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {incompletePacks.map(([packKey, info]) => {
            const def = PACK_DEFINITIONS[packKey] ?? {
              label: packKey,
              description: 'Forhåndsdefinert pakke fra mal-katalogen.',
            }
            const govCount = info.sample.reduce((n, r) => n + (r.contains_gov_action ? 1 : 0), 0)
            const approvalCount = info.sample.reduce((n, r) => n + catalogApprovalCount(r), 0)
            return (
              <ModuleSectionCard
                key={packKey}
                className="flex flex-col gap-3 border-emerald-200/80 bg-emerald-50/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-emerald-700" />
                    <h3 className="text-sm font-semibold text-neutral-900">{def.label}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {info.installed}/{info.total} installert
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-neutral-700">{def.description}</p>
                <p className="text-xs text-neutral-600">
                  <span className="font-medium text-neutral-800">{info.total} maler</span>
                  {govCount > 0 && <> · {govCount} statlige meldinger</>}
                  {approvalCount > 0 && <> · {approvalCount} påkrevde godkjennere</>}
                </p>
                <div className="mt-1 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    icon={<Package className="h-3.5 w-3.5" />}
                    disabled={!canCompose || installingPack === packKey}
                    onClick={() => setPackModal(packKey)}
                  >
                    {installingPack === packKey ? 'Installerer …' : 'Installer hele pakken'}
                  </Button>
                </div>
              </ModuleSectionCard>
            )
          })}
        </div>
      )}

      {/* Two-column body: sticky filter rail + card grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <FilterRail
          scopes={scopes}
          packs={packs}
          lawRefIndex={lawRefIndex}
          moduleFilters={moduleFilters}
          lawFilters={lawFilters}
          regulatorFilters={regulatorFilters}
          packFilters={packFilters}
          complexityFilter={complexityFilter}
          search={search}
          activeFilterCount={activeFilterCount}
          onToggleArray={toggleArrayFilter}
          onSetSearch={(v) => setFilterParam('q', v || null)}
          onSetComplexity={(v) => setFilterParam('complexity', v || null)}
          onClear={clearFilters}
        />

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-neutral-600">
            <span className="font-medium text-neutral-900">
              {filtered.length} {filtered.length === 1 ? 'mal' : 'maler'}
            </span>
            <span>av {catalog.length} totalt i biblioteket</span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                <X className="h-3 w-3" /> Nullstill filtrene
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <ModuleSectionCard className="p-8 text-center">
              <p className="text-sm text-neutral-600">
                Ingen maler matcher filtrene. Justér filtrene til venstre, eller{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-medium text-emerald-800 underline"
                >
                  nullstill alle
                </button>
                .
              </p>
            </ModuleSectionCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => {
                const state = installStates[row.slug] ?? { kind: 'idle' as const }
                const installedId = installedBySlug.get(row.slug) ?? null
                return (
                  <LibraryCard
                    key={row.id}
                    row={row}
                    state={state}
                    installedRuleId={installedId}
                    canCompose={!!canCompose}
                    onPreview={() => setPreviewSlug(row.slug)}
                    onInstall={() => handleInstallRow(row.slug)}
                    onOpenInRules={(ruleId) => {
                      onInstalled?.(ruleId)
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        <Shield className="mr-1 inline h-3 w-3" />
        Pakke-installasjon kjører <code className="rounded bg-neutral-100 px-1">provision_workflows_baseline_for_org()</code>{' '}
        — egne tilpasninger overskrives aldri. Statlige meldinger må aktiveres av bruker med tillatelsen{' '}
        <code className="rounded bg-neutral-100 px-1">workflows.activate_external</code>.
      </p>

      <LibraryPreviewPanel
        row={previewRow}
        onClose={() => setPreviewSlug(null)}
        onInstall={() => {
          if (!previewRow) return
          void handleInstallRow(previewRow.slug)
        }}
        installState={previewRow ? installStates[previewRow.slug] ?? { kind: 'idle' } : { kind: 'idle' }}
        installedRuleId={previewRow ? installedBySlug.get(previewRow.slug) ?? null : null}
        canCompose={!!canCompose}
      />

      <LibraryPackInstallModal
        open={packModal !== null}
        pack={packModal}
        info={packForModal}
        rows={catalog}
        installedBySlug={installedBySlug}
        installing={installingPack !== null}
        onClose={() => setPackModal(null)}
        onConfirm={(pack) => handleConfirmPackInstall(pack)}
      />
    </div>
  )
}

// ─── Filter rail ────────────────────────────────────────────────────────────

type FilterRailProps = {
  scopes: ReturnType<typeof listWorkflowScopes>
  packs: string[]
  lawRefIndex: string[]
  moduleFilters: string[]
  lawFilters: string[]
  regulatorFilters: string[]
  packFilters: string[]
  complexityFilter: '' | '1-3' | '4-6' | '7+'
  search: string
  activeFilterCount: number
  onToggleArray: (key: 'modules' | 'laws' | 'regulators' | 'packs', current: string[], value: string) => void
  onSetSearch: (v: string) => void
  onSetComplexity: (v: '' | '1-3' | '4-6' | '7+') => void
  onClear: () => void
}

const REGULATOR_OPTIONS: Regulator[] = ['arbeidstilsynet', 'datatilsynet', 'nav', 'ldo', 'none']
const COMPLEXITY_OPTIONS: Array<{ value: '1-3' | '4-6' | '7+'; label: string }> = [
  { value: '1-3', label: '1–3 steg' },
  { value: '4-6', label: '4–6 steg' },
  { value: '7+', label: '7+ steg' },
]

function FilterRail({
  scopes,
  packs,
  lawRefIndex,
  moduleFilters,
  lawFilters,
  regulatorFilters,
  packFilters,
  complexityFilter,
  search,
  activeFilterCount,
  onToggleArray,
  onSetSearch,
  onSetComplexity,
  onClear,
}: FilterRailProps) {
  const [lawQuery, setLawQuery] = useState('')

  const lawSuggestions = useMemo(() => {
    const q = lawQuery.trim().toLowerCase()
    if (!q) return lawRefIndex.slice(0, 8)
    return lawRefIndex.filter((r) => r.toLowerCase().includes(q)).slice(0, 12)
  }, [lawQuery, lawRefIndex])

  return (
    <aside className="xl:sticky xl:top-4 xl:self-start">
      <ModuleSectionCard className="space-y-5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <FilterIcon className="h-4 w-4 text-neutral-500" /> Filtrer maler
          </h3>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Nullstill ({activeFilterCount})
            </button>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            Søk
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => onSetSearch(e.target.value)}
              placeholder="Navn, slug, hendelse …"
              className="w-full rounded-md border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            <Layers className="h-3 w-3" /> Modul
          </label>
          <div className="space-y-1">
            {scopes.map((scope) => {
              const checked = moduleFilters.includes(scope.scopeId)
              return (
                <label
                  key={scope.scopeId}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-neutral-800 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleArray('modules', moduleFilters, scope.scopeId)}
                    className="h-3.5 w-3.5 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                  />
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: scope.accent ?? '#a3a3a3' }}
                  />
                  <span className="truncate">{scope.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            <Scale className="h-3 w-3" /> Lov-referanse
          </label>
          <input
            value={lawQuery}
            onChange={(e) => setLawQuery(e.target.value)}
            placeholder="f.eks. AML § 5-2"
            className="mb-1.5 w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25"
          />
          {lawFilters.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {lawFilters.map((law) => (
                <button
                  key={law}
                  type="button"
                  onClick={() => onToggleArray('laws', lawFilters, law)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#1a3d32] px-2 py-0.5 text-[10px] font-semibold text-white"
                >
                  {law}
                  <X className="h-2.5 w-2.5" />
                </button>
              ))}
            </div>
          )}
          <div className="max-h-32 overflow-y-auto rounded-md border border-neutral-200 bg-neutral-50 p-1">
            {lawSuggestions.length === 0 ? (
              <p className="px-1.5 py-1 text-[11px] text-neutral-500">Ingen treff.</p>
            ) : (
              lawSuggestions.map((law) => {
                const active = lawFilters.includes(law)
                return (
                  <button
                    key={law}
                    type="button"
                    onClick={() => onToggleArray('laws', lawFilters, law)}
                    className={`block w-full truncate rounded px-1.5 py-1 text-left text-[11px] ${
                      active
                        ? 'bg-[#1a3d32] text-white'
                        : 'text-neutral-700 hover:bg-white hover:text-neutral-900'
                    }`}
                  >
                    {law}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            <Building2 className="h-3 w-3" /> Regulator
          </label>
          <div className="flex flex-wrap gap-1">
            {REGULATOR_OPTIONS.map((reg) => {
              const active = regulatorFilters.includes(reg)
              return (
                <button
                  key={reg}
                  type="button"
                  onClick={() => onToggleArray('regulators', regulatorFilters, reg)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'
                  }`}
                >
                  {REGULATOR_LABEL[reg]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
            <FilterIcon className="h-3 w-3" /> Kompleksitet
          </label>
          <div className="flex flex-wrap gap-1">
            {COMPLEXITY_OPTIONS.map((opt) => {
              const active = complexityFilter === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onSetComplexity(active ? '' : opt.value)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    active
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {packs.length > 0 && (
          <div>
            <label className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              <Package className="h-3 w-3" /> Pakke
            </label>
            <div className="space-y-1">
              {packs.map((p) => {
                const checked = packFilters.includes(p)
                const label = PACK_DEFINITIONS[p]?.label ?? p
                return (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-neutral-800 hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleArray('packs', packFilters, p)}
                      className="h-3.5 w-3.5 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                    />
                    <span className="truncate">{label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </ModuleSectionCard>
    </aside>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

type LibraryCardProps = {
  row: WorkflowRuleCatalogRow
  state: RowInstallState
  installedRuleId: string | null
  canCompose: boolean
  onPreview: () => void
  onInstall: () => void
  onOpenInRules: (ruleId: string) => void
}

function LibraryCard({
  row,
  state,
  installedRuleId,
  canCompose,
  onPreview,
  onInstall,
  onOpenInRules,
}: LibraryCardProps) {
  const scope = getWorkflowScope(row.scope_id)
  const actionCount = catalogActionCount(row)
  const approvalCount = catalogApprovalCount(row)
  const regulators = detectRegulators(row).filter((r) => r !== 'none')
  const isGov = row.contains_gov_action
  const desc = (row.description_i18n as { nb?: string } | null)?.nb
  const packLabel = row.pack ? PACK_DEFINITIONS[row.pack]?.label ?? row.pack : null

  const installed = state.kind === 'installed' || state.kind === 'exists' || !!installedRuleId
  const ruleId =
    state.kind === 'installed' || state.kind === 'exists' ? state.ruleId : installedRuleId

  return (
    <ModuleSectionCard className="flex h-full flex-col gap-3 p-4">
      {/* Header chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ borderColor: scope?.accent ?? '#d4d4d4', color: scope?.accent ?? '#525252' }}
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: scope?.accent ?? '#a3a3a3' }}
          />
          {scope?.label ?? row.scope_id}
        </span>
        {packLabel && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700">
            {packLabel}
          </span>
        )}
        {isGov ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-900">
            <ShieldAlert className="h-3 w-3" /> Statlig
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
            <Shield className="h-3 w-3" /> Intern
          </span>
        )}
      </div>

      {/* Title + description */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-snug text-neutral-900">
          {row.name_i18n?.nb ?? row.slug}
        </h3>
        {desc && <p className="line-clamp-3 text-xs leading-relaxed text-neutral-600">{desc}</p>}
      </div>

      {/* Law refs */}
      {row.law_refs.length > 0 && (
        <p className="text-[11px] leading-snug text-neutral-600">
          <Scale className="mr-1 inline h-3 w-3 text-neutral-400" />
          {row.law_refs.slice(0, 4).join(' · ')}
          {row.law_refs.length > 4 ? ` +${row.law_refs.length - 4}` : ''}
        </p>
      )}

      {/* Trigger + step summary */}
      <div className="mt-auto space-y-1 text-[11px] text-neutral-600">
        {row.trigger_event_name ? (
          <p>
            <span className="font-medium text-neutral-700">Trigger:</span>{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{row.trigger_event_name}</code>
          </p>
        ) : row.schedule_cron ? (
          <p>
            <span className="font-medium text-neutral-700">Trigger:</span>{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">{row.schedule_cron}</code>
            <span className="ml-1 text-neutral-500">(planlagt)</span>
          </p>
        ) : (
          <p>
            <span className="font-medium text-neutral-700">Trigger:</span>{' '}
            <span className="text-neutral-500">data­endring ({row.trigger_on})</span>
          </p>
        )}
        <p>
          {actionCount} {actionCount === 1 ? 'handling' : 'handlinger'}
          {approvalCount > 0 && (
            <>
              {' '}
              · {approvalCount} {approvalCount === 1 ? 'godkjenning' : 'godkjenninger'}
            </>
          )}
          {regulators.length > 0 && (
            <> · {regulators.map((r) => REGULATOR_LABEL[r]).join(', ')}</>
          )}
        </p>
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<Eye className="h-3.5 w-3.5" />}
          onClick={onPreview}
        >
          Forhåndsvis flyt
        </Button>
        {state.kind === 'installing' ? (
          <Button type="button" size="sm" variant="primary" disabled icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}>
            Installerer …
          </Button>
        ) : installed && ruleId ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Check className="h-3.5 w-3.5" />}
            onClick={() => onOpenInRules(ruleId)}
          >
            Installert — Åpne i Mine arbeidsflyter
          </Button>
        ) : state.kind === 'error' ? (
          <Button
            type="button"
            size="sm"
            variant="danger"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            onClick={onInstall}
            title={state.message}
          >
            Prøv igjen
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="primary"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={onInstall}
            disabled={!canCompose}
          >
            Installer <ArrowRight className="ml-0.5 h-3 w-3" />
          </Button>
        )}
      </div>
    </ModuleSectionCard>
  )
}

export type { RowInstallState }

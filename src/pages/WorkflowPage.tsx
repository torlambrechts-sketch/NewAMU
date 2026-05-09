/**
 * WorkflowPage — Automatisering hub under Admin.
 * Lists all org workflow rules grouped by source module (Regler tab),
 * system template catalog (Maler tab), and run history (Historikk tab).
 * Replaced the original simple ModuleRulesModuleSection layout.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpDown,
  CheckCircle2,
  GitFork,
  History,
  MoreHorizontal,
  Plus,
  Scale,
  Search,
  Upload,
  Workflow,
  Zap,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { useWorkflows } from '../hooks/useWorkflows'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getWfModuleMeta } from '../components/workflow/workflowModuleRegistry'
import type { WorkflowRuleRow, WorkflowRunRow } from '../types/workflow'

// ─── Module chip ──────────────────────────────────────────────────────────────

function ModChip({ sourceModule }: { sourceModule: string }) {
  const m = getWfModuleMeta(sourceModule)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: m.tint, borderColor: m.border, color: m.accent }}
    >
      {m.label}
    </span>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      title={value ? 'Aktiv' : 'Inaktiv'}
      className="inline-flex items-center"
    >
      <span
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
        style={{ background: value ? '#1a3d32' : '#d4d4d4' }}
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
    </button>
  )
}

// ─── Chain preview ────────────────────────────────────────────────────────────

function ChainPreview({ rule }: { rule: WorkflowRuleRow }) {
  const actions = Array.isArray(rule.actions_json) ? rule.actions_json : []
  const condition = rule.condition_json
  const hasCondition = condition && condition.match !== 'always'

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
        <Zap className="h-3 w-3" />
        {rule.trigger_on === 'insert' ? 'Opprettet' : rule.trigger_on === 'update' ? 'Oppdatert' : 'Ins/Upd'}
      </span>
      {hasCondition && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
          <GitFork className="h-3 w-3" />
          betingelse
        </span>
      )}
      <ArrowRight className="h-3 w-3 text-neutral-400" />
      {actions.slice(0, 4).map((a, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-neutral-700"
        >
          {a.type.replace(/_/g, ' ')}
        </span>
      ))}
      {actions.length > 4 && (
        <span className="text-[10px] font-semibold text-neutral-500">+{actions.length - 4}</span>
      )}
    </div>
  )
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function WfKpiStrip({
  rules,
  runs,
}: {
  rules: WorkflowRuleRow[]
  runs: WorkflowRunRow[]
}) {
  const cream = '#F1ECDF'
  const active = rules.filter((r) => r.is_active).length
  const inactive = rules.length - active
  const runs30 = runs.length
  const successCount = runs.filter((r) => r.status === 'success').length
  const successRate = runs30 > 0 ? Math.round((successCount / runs30) * 100) : 100
  const items = [
    { big: active, title: 'Aktive arbeidsflyter', sub: `${inactive} inaktiv · ${rules.length} totalt` },
    { big: runs30, title: 'Kjøringer · 30 d', sub: 'Siste 30 dager' },
    { big: `${successRate} %`, title: 'Suksessrate', sub: 'Mål ≥ 98 % · siste 30 d' },
    { big: `${Math.round(runs30 * 0.08)} t`, title: 'Tid spart', sub: 'Estimert · manuell vs. automatisk' },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it, i) => (
        <div key={i} className="min-w-0 rounded-xl px-4 py-4 sm:px-5" style={{ backgroundColor: cream }}>
          <p className="text-3xl font-bold tabular-nums text-neutral-900">{it.big}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">{it.title}</p>
          <p className="mt-0.5 text-xs text-neutral-600">{it.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Workflow library (Regler tab) ────────────────────────────────────────────

function WorkflowLibrary({
  rules,
  canManage,
  onToggle,
  onEdit,
  onNew,
}: {
  rules: WorkflowRuleRow[]
  canManage: boolean
  onToggle: (id: string, active: boolean) => void
  onEdit: (id: string) => void
  onNew: (sourceModule?: string) => void
}) {
  const [activeFilter, setActiveFilter] = useState<'alle' | 'active' | 'inactive'>('alle')
  const [moduleFilter, setModuleFilter] = useState('alle')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return rules.filter((r) => {
      if (activeFilter === 'active' && !r.is_active) return false
      if (activeFilter === 'inactive' && r.is_active) return false
      if (moduleFilter !== 'alle' && r.source_module !== moduleFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [rules, activeFilter, moduleFilter, search])

  const grouped = useMemo(() => {
    const map: Record<string, WorkflowRuleRow[]> = {}
    for (const r of filtered) {
      ;(map[r.source_module] = map[r.source_module] ?? []).push(r)
    }
    return map
  }, [filtered])

  const moduleKeys = Object.keys(grouped)
  const activeCount = rules.filter((r) => r.is_active).length
  const inactiveCount = rules.length - activeCount
  const moduleOptions = [...new Set(rules.map((r) => r.source_module))]

  const tabs = [
    { id: 'alle', label: 'Alle', count: rules.length },
    { id: 'active', label: 'Aktive', count: activeCount },
    { id: 'inactive', label: 'Inaktive', count: inactiveCount },
  ] as const

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-4 py-3"
        style={{ border: '1px solid #e5e5e5', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveFilter(t.id as typeof activeFilter)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeFilter === t.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeFilter === t.id ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs">
            <Search className="h-3.5 w-3.5 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 outline-none placeholder:text-neutral-400"
              placeholder="Søk i navn, ID..."
            />
          </label>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="alle">Alle moduler</option>
            {moduleOptions.map((m) => (
              <option key={m} value={m}>{getWfModuleMeta(m).label}</option>
            ))}
          </select>
          <button className="rounded-md border border-neutral-300 bg-white p-1.5 text-neutral-500 hover:bg-neutral-50" title="Sortering">
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {moduleKeys.length === 0 && (
        <ModuleSectionCard className="p-8 text-center">
          <Workflow className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
          <p className="text-sm font-semibold text-neutral-700">Ingen arbeidsflyter funnet</p>
          <p className="mt-1 text-xs text-neutral-500">
            {search || moduleFilter !== 'alle' ? 'Prøv et annet søk eller fjern filtre.' : 'Kom i gang ved å opprette din første arbeidsflyt.'}
          </p>
          {canManage && (
            <button
              onClick={() => onNew()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#153329]"
            >
              <Plus className="h-4 w-4" />
              Ny arbeidsflyt
            </button>
          )}
        </ModuleSectionCard>
      )}

      {moduleKeys.map((mod) => {
        const meta = getWfModuleMeta(mod)
        const modRules = grouped[mod]
        return (
          <ModuleSectionCard key={mod} className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <ModChip sourceModule={mod} />
                <span className="text-xs text-neutral-500">
                  {modRules.length} arbeidsflyt{modRules.length === 1 ? '' : 'er'}
                </span>
              </div>
              {canManage && (
                <button
                  onClick={() => onNew(mod)}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: meta.accent }}
                >
                  + Ny i {meta.label.toLowerCase()}
                </button>
              )}
            </div>
            <ul className="divide-y divide-neutral-100">
              {modRules.map((r) => (
                <li
                  key={r.id}
                  className="px-5 py-3.5 transition-colors hover:bg-neutral-50/60"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                    <div className="flex items-start gap-3 lg:w-80 lg:shrink-0">
                      <Toggle
                        value={r.is_active}
                        onChange={(v) => canManage && onToggle(r.id, v)}
                      />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2">
                          <button
                            onClick={() => onEdit(r.id)}
                            className="text-sm font-semibold text-neutral-900 hover:underline"
                          >
                            {r.name}
                          </button>
                          <span className="font-mono text-[10px] text-neutral-400">{r.slug}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-600">{r.description}</p>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <ChainPreview rule={r} />
                    </div>

                    <div className="flex items-center gap-4 lg:w-56 lg:shrink-0 lg:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Opprettet</p>
                        <p className="text-xs tabular-nums text-neutral-700">
                          {new Date(r.created_at).toLocaleDateString('nb-NO')}
                        </p>
                      </div>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-700">
                        AD
                      </span>
                      <button className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </ModuleSectionCard>
        )
      })}
    </div>
  )
}

// ─── Template catalog (Maler tab) ─────────────────────────────────────────────

type TemplateCatalogRow = {
  id: string
  slug: string
  name: string
  description: string
  source_module: string
  trigger_event_name: string
  law_refs: string[]
  category: string
}

function TemplateCatalog({
  templates,
  onUse,
}: {
  templates: TemplateCatalogRow[]
  onUse: (t: TemplateCatalogRow) => void
}) {
  if (templates.length === 0) {
    return (
      <ModuleSectionCard className="p-8 text-center">
        <p className="text-sm text-neutral-500">Ingen maler tilgjengelig ennå.</p>
      </ModuleSectionCard>
    )
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => {
        const meta = getWfModuleMeta(t.source_module)
        return (
          <div
            key={t.id}
            className="flex flex-col rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <ModChip sourceModule={t.source_module} />
              <span className="font-mono text-[10px] text-neutral-400">{t.trigger_event_name}</span>
            </div>
            <h3 className="mt-3 text-sm font-semibold text-neutral-900">{t.name}</h3>
            <p className="mt-1 flex-1 text-xs text-neutral-600 line-clamp-3">{t.description}</p>
            {t.law_refs.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Scale className="h-3 w-3 text-neutral-400" />
                {t.law_refs.map((l, i) => (
                  <span key={i} className="font-mono text-[10px] text-neutral-500">{l}</span>
                ))}
              </div>
            )}
            <button
              onClick={() => onUse(t)}
              className="mt-4 w-full rounded-lg border py-2 text-xs font-semibold transition-colors hover:opacity-90"
              style={{ borderColor: meta.border, color: meta.accent, background: meta.tint }}
            >
              Bruk denne malen
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── Run history (Historikk tab) ──────────────────────────────────────────────

function RunHistory({ runs, rules }: { runs: WorkflowRunRow[]; rules: WorkflowRuleRow[] }) {
  const ruleMap = useMemo(() => Object.fromEntries(rules.map((r) => [r.id, r])), [rules])

  if (runs.length === 0) {
    return (
      <ModuleSectionCard className="p-8 text-center">
        <History className="mx-auto mb-3 h-8 w-8 text-neutral-300" />
        <p className="text-sm text-neutral-500">Ingen kjøringer ennå.</p>
      </ModuleSectionCard>
    )
  }

  return (
    <ModuleSectionCard className="!p-0 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/60">
            <th className="px-5 py-3 text-left font-semibold text-neutral-600">Tidspunkt</th>
            <th className="px-5 py-3 text-left font-semibold text-neutral-600">Regel</th>
            <th className="px-5 py-3 text-left font-semibold text-neutral-600">Modul</th>
            <th className="px-5 py-3 text-left font-semibold text-neutral-600">Hendelse</th>
            <th className="px-5 py-3 text-left font-semibold text-neutral-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {runs.map((run) => {
            const rule = run.rule_id ? ruleMap[run.rule_id] : null
            const isSuccess = run.status === 'success'
            const isFailed = run.status === 'failed'
            return (
              <tr key={run.id} className="hover:bg-neutral-50/60">
                <td className="px-5 py-3 font-mono tabular-nums text-neutral-600">
                  {new Date(run.created_at).toLocaleString('nb-NO')}
                </td>
                <td className="px-5 py-3 font-semibold text-neutral-900">
                  {rule?.name ?? <span className="text-neutral-400">—</span>}
                </td>
                <td className="px-5 py-3">
                  <ModChip sourceModule={run.source_module} />
                </td>
                <td className="px-5 py-3 font-mono text-neutral-600">{run.event}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      isSuccess
                        ? 'bg-green-50 text-green-700'
                        : isFailed
                        ? 'bg-red-50 text-red-700'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {isSuccess ? '✓' : isFailed ? '✕' : '○'} {run.status}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ModuleSectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageTab = 'regler' | 'maler' | 'historikk'

export function WorkflowPage() {
  const { supabase, can, isAdmin, profile } = useOrgSetupContext()
  const navigate = useNavigate()
  const canManage = profile?.is_org_admin === true || isAdmin || can('workflows.manage')
  const { rules, runs, loading, setRuleActive, upsertRule } = useWorkflows()
  const [tab, setTab] = useState<PageTab>('regler')
  const [templates, setTemplates] = useState<TemplateCatalogRow[]>([])
  const [templatesLoaded, setTemplatesLoaded] = useState(false)

  const loadTemplates = useCallback(async () => {
    if (!supabase || templatesLoaded) return
    const { data } = await supabase
      .from('workflow_template_catalog')
      .select('*')
      .eq('is_system', true)
      .order('name')
    setTemplates((data ?? []) as TemplateCatalogRow[])
    setTemplatesLoaded(true)
  }, [supabase, templatesLoaded])

  const handleTabChange = (t: PageTab) => {
    setTab(t)
    if (t === 'maler') void loadTemplates()
  }

  const handleToggle = useCallback(
    (id: string, active: boolean) => {
      void setRuleActive(id, active)
    },
    [setRuleActive],
  )

  const handleEdit = useCallback(
    (id: string) => navigate(`/workflow/${id}`),
    [navigate],
  )

  const handleNew = useCallback(
    (sourceModule?: string) => {
      const params = sourceModule ? `?sourceModule=${sourceModule}` : ''
      navigate(`/workflow/new${params}`)
    },
    [navigate],
  )

  const handleUseTemplate = useCallback(
    async (t: TemplateCatalogRow) => {
      if (!canManage) return
      await upsertRule({
        slug: `${t.slug}-${Date.now()}`,
        name: t.name,
        description: t.description,
        source_module: t.source_module,
        trigger_on: 'insert',
        is_active: false,
        condition_json: { match: 'always' },
        actions_json: [],
        priority: 0,
      })
      setTab('regler')
    },
    [canManage, upsertRule],
  )

  const tabs: { id: PageTab; label: string }[] = [
    { id: 'regler', label: 'Regler' },
    { id: 'maler', label: 'Maler' },
    { id: 'historikk', label: 'Historikk' },
  ]

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Administrasjon', to: '/organisation/admin' }, { label: 'Automatisering' }]}
      title="Automatisering"
      description="Knytt hendelser fra alle moduler — avvik, ROS, vernerunder, sykefravær — til handlinger som e-post, oppgaver, signaturer og ROS-utkast. Sporer alt for revisor."
      headerActions={
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            <Upload className="h-3.5 w-3.5" />
            Importer mal
          </button>
          <button
            onClick={() => handleTabChange('historikk')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <History className="h-3.5 w-3.5" />
            Kjørehistorikk
          </button>
          {canManage && (
            <button
              onClick={() => handleNew()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a3d32] px-3 py-2 text-sm font-semibold text-white hover:bg-[#153329]"
            >
              <Plus className="h-4 w-4" />
              Ny arbeidsflyt
            </button>
          )}
        </div>
      }
    >
      {/* KPI strip */}
      <WfKpiStrip rules={rules} runs={runs} />

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-neutral-200 pb-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'border-[#1a3d32] text-[#1a3d32]'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading && tab === 'regler' && (
        <div className="py-8 text-center text-sm text-neutral-400">Laster arbeidsflyter…</div>
      )}

      {!loading && tab === 'regler' && (
        <WorkflowLibrary
          rules={rules}
          canManage={canManage}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onNew={handleNew}
        />
      )}

      {tab === 'maler' && (
        <TemplateCatalog templates={templates} onUse={handleUseTemplate} />
      )}

      {tab === 'historikk' && (
        <RunHistory runs={runs} rules={rules} />
      )}
    </ModulePageShell>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart2, ChevronDown, GitBranch, Loader2, Pencil, Play, Plus, Settings, Trash2, X, Zap } from 'lucide-react'
import { WorkflowFlowBuilder } from '../components/workflow/WorkflowFlowBuilder'
import { flowDocumentFromLegacy } from '../lib/workflowFlowFromLegacy'
import {
  compileWorkflowFlow,
  defaultWorkflowFlowDocument,
  type WorkflowFlowDocument,
} from '../lib/workflowFlowTypes'
import { useWorkflows } from '../hooks/useWorkflows'
import { WORKFLOW_SOURCE_MODULES } from '../types/workflow'
import type { WorkflowAction, WorkflowCondition, WorkflowRuleRow, WorkflowXorActionsEnvelope } from '../types/workflow'
import {
  sourceModuleLabel,
  summarizeRuleActions,
  summarizeRuleCondition,
  triggerLabel,
} from '../lib/workflowRuleSummary'
import { WF_FIELD_INPUT, WF_FIELD_LABEL, WF_LEAD, WF_PANEL_INSET } from '../components/workflow/workflowPanelStyles'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import { WorkflowPage as ModuleRulesView } from './WorkflowPage'

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CARD = 'rounded-none border border-neutral-200/90 bg-white p-6 shadow-sm'
const BTN_PRI = 'inline-flex items-center gap-2 rounded-none bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white'
const BTN_SEC = 'inline-flex items-center gap-2 rounded-none border border-neutral-200 px-4 py-2.5 text-sm text-neutral-700'

const DEFAULT_CONDITION: WorkflowCondition = { match: 'always' }
const DEFAULT_ACTIONS: WorkflowAction[] = [
  {
    type: 'create_task',
    title: 'Oppfølgingsoppgave',
    description: 'Opprettet av arbeidsflyt',
    assignee: 'Ansvarlig',
    dueInDays: 7,
    module: 'hse',
    sourceType: 'manual',
  },
]

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/gi, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'regel'
  )
}

function actionsToJsonString(actions: WorkflowAction[] | WorkflowXorActionsEnvelope): string {
  return JSON.stringify(actions, null, 2)
}

export function WorkflowModulePage() {
  const wf = useWorkflows()
  const [tab, setTab] = useState<'overview' | 'design' | 'runs' | 'settings' | 'module-rules'>('overview')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [devJsonOpen, setDevJsonOpen] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | 'new' | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [sourceModule, setSourceModule] = useState('hse')
  const [triggerOn, setTriggerOn] = useState<'insert' | 'update' | 'both'>('both')
  const [flowDoc, setFlowDoc] = useState<WorkflowFlowDocument>(() => defaultWorkflowFlowDocument())
  const [conditionJson, setConditionJson] = useState<WorkflowCondition>(DEFAULT_CONDITION)
  const [actionsPayload, setActionsPayload] = useState<WorkflowAction[] | WorkflowXorActionsEnvelope>(DEFAULT_ACTIONS)
  const [conditionText, setConditionText] = useState(JSON.stringify(DEFAULT_CONDITION, null, 2))
  const [actionsText, setActionsText] = useState(JSON.stringify(DEFAULT_ACTIONS, null, 2))
  const [compileErr, setCompileErr] = useState<string | null>(null)
  const [formErr, setFormErr] = useState<string | null>(null)

  const templatesCount = useMemo(() => wf.rules.filter((r) => r.is_template).length, [wf.rules])

  const filteredRules = useMemo(
    () => (sourceFilter === 'all' ? wf.rules : wf.rules.filter((r) => r.source_module === sourceFilter)),
    [wf.rules, sourceFilter],
  )

  const rulesByModule = useMemo(() => {
    const map = new Map<string, WorkflowRuleRow[]>()
    for (const r of wf.rules) {
      const list = map.get(r.source_module) ?? []
      list.push(r)
      map.set(r.source_module, list)
    }
    return map
  }, [wf.rules])

  const workflowHubItems: HubMenu1Item[] = useMemo(
    () => [
      {
        key: 'overview',
        label: 'Oversikt',
        icon: BarChart2,
        active: tab === 'overview',
        onClick: () => setTab('overview'),
      },
      {
        key: 'design',
        label: 'Design & regler',
        icon: GitBranch,
        active: tab === 'design',
        onClick: () => setTab('design'),
      },
      {
        key: 'runs',
        label: 'Historikk',
        icon: Play,
        active: tab === 'runs',
        onClick: () => setTab('runs'),
      },
      {
        key: 'settings',
        label: 'Maler',
        icon: Settings,
        active: tab === 'settings',
        badgeCount: templatesCount,
        onClick: () => setTab('settings'),
      },
      {
        key: 'module-rules',
        label: 'Modul-regler',
        icon: Zap,
        active: tab === 'module-rules',
        onClick: () => setTab('module-rules'),
      },
    ],
    [tab, templatesCount],
  )

  const workflowSectionLabel =
    tab === 'overview' ? 'Oversikt'
    : tab === 'design' ? 'Design & regler'
    : tab === 'runs' ? 'Historikk'
    : tab === 'module-rules' ? 'Modul-regler'
    : 'Maler'

  const recompileFlow = useCallback((doc: WorkflowFlowDocument) => {
    const out = compileWorkflowFlow(doc)
    if ('error' in out) {
      setCompileErr(out.error)
      return
    }
    setCompileErr(null)
    setConditionJson(out.condition_json)
    setActionsPayload(out.actions_json)
    setConditionText(JSON.stringify(out.condition_json, null, 2))
    setActionsText(JSON.stringify(out.actions_json, null, 2))
  }, [])

  const handleFlowDocChange = useCallback(
    (doc: WorkflowFlowDocument) => {
      setFlowDoc(doc)
      const out = compileWorkflowFlow(doc)
      if ('error' in out) {
        setCompileErr(out.error)
        return
      }
      setCompileErr(null)
      setConditionJson(out.condition_json)
      setActionsPayload(out.actions_json)
      setConditionText(JSON.stringify(out.condition_json, null, 2))
      setActionsText(JSON.stringify(out.actions_json, null, 2))
    },
    [],
  )

  const parseJson = useCallback(<T,>(raw: string, label: string): T | null => {
    try {
      return JSON.parse(raw) as T
    } catch {
      setFormErr(`Ugyldig JSON i ${label}`)
      return null
    }
  }, [])

  const openNewRule = useCallback(() => {
    setFormErr(null)
    setCompileErr(null)
    setEditingRuleId('new')
    setEditorOpen(true)
    setName('')
    setSlug('')
    setSourceModule('hse')
    setTriggerOn('both')
    const doc = defaultWorkflowFlowDocument()
    setFlowDoc(doc)
    recompileFlow(doc)
    setDevJsonOpen(false)
  }, [recompileFlow])

  const openEditRule = useCallback(
    (r: WorkflowRuleRow) => {
      setFormErr(null)
      setCompileErr(null)
      setEditingRuleId(r.id)
      setEditorOpen(true)
      setName(r.name)
      setSlug(r.slug)
      setSourceModule(r.source_module)
      setTriggerOn(r.trigger_on)
      setConditionJson(r.condition_json)
      setActionsPayload(r.actions_json)
      setConditionText(JSON.stringify(r.condition_json, null, 2))
      setActionsText(actionsToJsonString(r.actions_json))

      const fg = r.flow_graph_json
      const doc =
        fg && typeof fg === 'object' && (fg as { version?: number }).version === 1
          ? (fg as WorkflowFlowDocument)
          : flowDocumentFromLegacy(r.condition_json, r.actions_json)
      setFlowDoc(doc)
      setDevJsonOpen(false)
      queueMicrotask(() => recompileFlow(doc))
    },
    [recompileFlow],
  )

  const closeEditor = useCallback(() => {
    setEditorOpen(false)
    setEditingRuleId(null)
  }, [])

  useEffect(() => {
    if (!editorOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [editorOpen])

  useEffect(() => {
    if (!editorOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, closeEditor])

  const handleSaveRule = useCallback(async () => {
    setFormErr(null)
    const out = compileWorkflowFlow(flowDoc)
    if ('error' in out) {
      setFormErr(out.error)
      return
    }
    const cond = out.condition_json
    const acts = out.actions_json

    const s = slug.trim() || slugify(name)
    const res = await wf.upsertRule({
      id: editingRuleId && editingRuleId !== 'new' ? editingRuleId : undefined,
      slug: s,
      name: name.trim() || 'Uten navn',
      description: '',
      source_module: sourceModule,
      trigger_on: triggerOn,
      is_active: false,
      condition_json: cond,
      actions_json: acts,
      flow_graph_json: flowDoc as unknown as Record<string, unknown>,
    })
    if (res.ok) {
      closeEditor()
    } else if (!wf.canManage) {
      setFormErr('Du har ikke tilgang til å lagre regler. Kontakt administrator.')
    } else {
      setFormErr(wf.error ?? 'Lagring feilet. Prøv igjen.')
    }
  }, [closeEditor, editingRuleId, flowDoc, name, slug, sourceModule, triggerOn, wf])

  const applyAdvancedToFlow = useCallback(() => {
    const c = parseJson<WorkflowCondition>(conditionText, 'betingelse')
    const rawActs = parseJson<unknown>(actionsText, 'handlinger')
    if (!c || rawActs === null) return
    let acts: WorkflowAction[] | WorkflowXorActionsEnvelope
    if (Array.isArray(rawActs)) acts = rawActs
    else if (typeof rawActs === 'object' && rawActs !== null && (rawActs as { mode?: string }).mode === 'xor_branches') {
      acts = rawActs as WorkflowXorActionsEnvelope
    } else {
      setFormErr('Ugyldig actions-format')
      return
    }
    setFormErr(null)
    const doc = flowDocumentFromLegacy(c, acts)
    setFlowDoc(doc)
    setConditionJson(c)
    setActionsPayload(acts)
    recompileFlow(doc)
  }, [actionsText, conditionText, parseJson, recompileFlow])

  return (
    <div className={PAGE_WRAP}>
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Arbeidsflyt' }, { label: workflowSectionLabel }]}
        title="Arbeidsflyt"
        description={
          <>
            Bygg regler med <strong>dra-og-slipp</strong>: velg hva som skal utløse flyten (oppgaver, HSE, ROS, saker,
            anonym rapportering, …) og hva som skal skje (oppgave, e-post, varsling, webhook).{' '}
            <strong>XOR</strong> gir parallelle grener der nøyaktig én må matche.
          </>
        }
        headerActions={
          <div
            className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-neutral-200/80 bg-[#1a3d32] text-[#c9a227]"
            aria-hidden
          >
            <GitBranch className="size-9" />
          </div>
        }
        menu={<HubMenu1Bar ariaLabel="Arbeidsflyt — faner" items={workflowHubItems} />}
      />

      {wf.error && (
        <p className="mt-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{wf.error}</p>
      )}

      {tab === 'overview' && (
        <div className="mt-8 space-y-6">
          {/* Summary bar */}
          <div className={`${CARD} flex flex-wrap items-center gap-6 py-4`}>
            <div className="text-center">
              <p className="text-3xl font-bold text-[#1a3d32]">{wf.rules.length}</p>
              <p className="mt-0.5 text-xs text-neutral-500">Totalt</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-700">{wf.rules.filter((r) => r.is_active).length}</p>
              <p className="mt-0.5 text-xs text-neutral-500">Aktive</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-neutral-400">{wf.rules.filter((r) => !r.is_active).length}</p>
              <p className="mt-0.5 text-xs text-neutral-500">Inaktive</p>
            </div>
          </div>

          {/* Per-module cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {WORKFLOW_SOURCE_MODULES.map((mod) => {
              const moduleRules = rulesByModule.get(mod.value) ?? []
              const activeCount = moduleRules.filter((r) => r.is_active).length
              return (
                <div key={mod.value} className={`${CARD} space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{mod.label.split(' (')[0]}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${activeCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                      {activeCount}/{moduleRules.length} aktive
                    </span>
                  </div>
                  {moduleRules.length === 0 ? (
                    <p className="text-xs text-neutral-400">Ingen regler ennå</p>
                  ) : (
                    <ul className="space-y-1">
                      {moduleRules.slice(0, 4).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-xs text-neutral-700">
                          <span className="truncate">{r.name}</span>
                          <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                            {r.is_active ? 'På' : 'Av'}
                          </span>
                        </li>
                      ))}
                      {moduleRules.length > 4 && (
                        <li className="text-[11px] text-neutral-400">+{moduleRules.length - 4} til</li>
                      )}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSourceFilter(mod.value); setTab('design') }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1a3d32] hover:underline"
                  >
                    <GitBranch className="size-3" />
                    Rediger regler
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'design' && (
        <div className="mt-8 space-y-6">
          {/* Module filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500">Filtrer:</span>
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${sourceFilter === 'all' ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
            >
              Alle moduler
            </button>
            {WORKFLOW_SOURCE_MODULES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSourceFilter(m.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${sourceFilter === m.value ? 'bg-[#1a3d32] text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              >
                {m.label.split(' (')[0]}
              </button>
            ))}
          </div>

          <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Regler</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {sourceFilter === 'all'
                  ? 'Alle moduler · klikk en modul-filter over for å snevre inn.'
                  : `Viser regler for: ${WORKFLOW_SOURCE_MODULES.find((m) => m.value === sourceFilter)?.label.split(' (')[0] ?? sourceFilter}`}
              </p>
            </div>
            {wf.canManage ? (
              <button type="button" onClick={openNewRule} className={BTN_PRI}>
                <Plus className="size-4" /> Ny regel
              </button>
            ) : (
              <p className="text-sm text-neutral-500">
                Du har ikke tilgang til å opprette regler.{' '}
                <span className="text-neutral-400">(Krever workflows.manage eller admin)</span>
              </p>
            )}
          </div>

          {editorOpen && wf.canManage && (
            <>
              <button
                type="button"
                aria-label="Lukk"
                className="fixed inset-0 z-[60] bg-black/40"
                onClick={closeEditor}
              />
              <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[min(100vw,1200px)] flex-col border-l border-neutral-200/90 bg-[#f7f6f2] shadow-2xl">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200/90 bg-[#f4f1ea] px-5 py-4">
                  <div>
                    <h3
                      className="text-lg font-semibold text-neutral-900"
                      style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                    >
                      {editingRuleId === 'new' ? 'Ny regel' : 'Rediger regel'}
                    </h3>
                    <p className={`${WF_LEAD} mt-1.5`}>
                      Fyll inn grunninfo under. Bygg flyten med menyene til venstre og rediger detaljer til høyre.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={closeEditor}
                      className="rounded-none border border-transparent p-2 text-neutral-500 hover:bg-white/80 hover:text-neutral-800"
                      aria-label="Lukk"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f6f2] px-4 py-4 sm:px-5">
                  {formErr && (
                    <p className="mb-4 rounded-none border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {formErr}
                    </p>
                  )}

                  <div className={`${WF_PANEL_INSET} border-neutral-200/90`}>
                    <p className={WF_FIELD_LABEL}>Grunninfo</p>
                    <p className={`${WF_LEAD} mt-2`}>
                      Navn og teknisk ID (slug) for regelen. Kilde bestemmer hvilke data som utløser flyten; utløser styrer
                      om den skal reagere på nye rader, oppdateringer eller begge deler.
                    </p>
                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <div>
                        <label className={WF_FIELD_LABEL} htmlFor="wf-rule-name">
                          Navn
                        </label>
                        <input
                          id="wf-rule-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={WF_FIELD_INPUT}
                          placeholder="F.eks. Kritisk hendelse → HMS-oppgave"
                        />
                      </div>
                      <div>
                        <label className={WF_FIELD_LABEL} htmlFor="wf-rule-slug">
                          Slug (ID)
                        </label>
                        <input
                          id="wf-rule-slug"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                          className={`${WF_FIELD_INPUT} font-mono text-xs`}
                          placeholder="auto fra navn hvis tom"
                        />
                      </div>
                      <div>
                        <label className={WF_FIELD_LABEL} htmlFor="wf-rule-source">
                          Kilde (modul)
                        </label>
                        <select
                          id="wf-rule-source"
                          value={sourceModule}
                          onChange={(e) => setSourceModule(e.target.value)}
                          className={WF_FIELD_INPUT}
                        >
                          {WORKFLOW_SOURCE_MODULES.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={WF_FIELD_LABEL} htmlFor="wf-rule-trigger">
                          Utløser
                        </label>
                        <select
                          id="wf-rule-trigger"
                          value={triggerOn}
                          onChange={(e) => setTriggerOn(e.target.value as 'insert' | 'update' | 'both')}
                          className={WF_FIELD_INPUT}
                        >
                          <option value="both">Lagring (ny + oppdatering)</option>
                          <option value="insert">Kun første lagring</option>
                          <option value="update">Kun oppdateringer</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-neutral-200/80 pt-6">
                    <WorkflowFlowBuilder
                      value={flowDoc}
                      onChange={handleFlowDocChange}
                      sourceModule={sourceModule}
                      compileError={compileErr}
                    />
                  </div>

                  <div className="mt-6 border-t border-neutral-200/80 pt-4">
                    <div className={`${WF_PANEL_INSET} border-neutral-200/90`}>
                      <button
                        type="button"
                        onClick={() => setDevJsonOpen((o) => !o)}
                        className="flex w-full items-center justify-between gap-2 rounded-none border border-neutral-200/90 bg-white px-3 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                      >
                        <span className="text-sm font-semibold text-neutral-900">Utvikler: JSON (import / eksport)</span>
                        <ChevronDown className={`size-4 shrink-0 text-neutral-500 transition ${devJsonOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {devJsonOpen ? (
                        <div className="mt-4 space-y-4 border-t border-neutral-200/80 pt-4">
                          <p className={WF_LEAD}>
                            Kun for feilsøking eller migrering. «Synkroniser til flyt» overskriver den visuelle byggeren.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setConditionText(JSON.stringify(conditionJson, null, 2))
                                setActionsText(actionsToJsonString(actionsPayload))
                              }}
                              className={BTN_SEC}
                            >
                              Oppdater tekstfelt fra flyt
                            </button>
                            <button type="button" onClick={applyAdvancedToFlow} className={BTN_SEC}>
                              Synkroniser JSON → flyt
                            </button>
                          </div>
                          <div>
                            <label className={WF_FIELD_LABEL} htmlFor="wf-dev-cond">
                              Betingelse (JSON)
                            </label>
                            <textarea
                              id="wf-dev-cond"
                              value={conditionText}
                              onChange={(e) => setConditionText(e.target.value)}
                              rows={6}
                              className={`${WF_FIELD_INPUT} font-mono text-xs`}
                            />
                          </div>
                          <div>
                            <label className={WF_FIELD_LABEL} htmlFor="wf-dev-act">
                              Handlinger (JSON)
                            </label>
                            <textarea
                              id="wf-dev-act"
                              value={actionsText}
                              onChange={(e) => setActionsText(e.target.value)}
                              rows={10}
                              className={`${WF_FIELD_INPUT} font-mono text-xs`}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-neutral-200/90 bg-[#f4f1ea] px-5 py-4">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="inline-flex items-center gap-2 rounded-none border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 shadow-none hover:bg-neutral-50"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveRule()}
                    className="inline-flex items-center gap-2 rounded-none border border-[#1a3d32] bg-[#1a3d32] px-4 py-2.5 text-sm font-medium text-white shadow-none hover:bg-[#142e26]"
                  >
                    Lagre regel (av som standard)
                  </button>
                </div>
              </aside>
            </>
          )}

          <div className="overflow-x-auto rounded-none border border-neutral-200/90">
            <table className="min-w-[960px] w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Kilde</th>
                  <th className="px-4 py-3">Utløser</th>
                  <th className="px-4 py-3">Betingelse</th>
                  <th className="px-4 py-3">Handling</th>
                  <th className="px-4 py-3">Mal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {wf.loading && wf.rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      <Loader2 className="mx-auto size-6 animate-spin" /> Laster…
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                      {wf.rules.length === 0
                        ? 'Ingen regler ennå. Legg til maler under Maler eller opprett egen regel.'
                        : 'Ingen regler for valgt modul.'}
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((r) => (
                    <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                      <td className="px-4 py-3">
                        {wf.canManage ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={r.is_active}
                            onClick={() => void wf.setRuleActive(r.id, !r.is_active)}
                            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
                              r.is_active ? 'bg-emerald-600' : 'bg-neutral-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition ${
                                r.is_active ? 'translate-x-5' : ''
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="text-neutral-400">{r.is_active ? 'På' : 'Av'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900">{r.name}</td>
                      <td className="max-w-[200px] px-4 py-3 text-neutral-700" title={r.source_module}>
                        {sourceModuleLabel(r.source_module)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{triggerLabel(r.trigger_on)}</td>
                      <td className="max-w-[220px] px-4 py-3 text-neutral-600" title={summarizeRuleCondition(r.condition_json)}>
                        <span className="line-clamp-2">{summarizeRuleCondition(r.condition_json)}</span>
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-neutral-600" title={summarizeRuleActions(r.actions_json)}>
                        <span className="line-clamp-2">{summarizeRuleActions(r.actions_json)}</span>
                      </td>
                      <td className="px-4 py-3">{r.is_template ? 'Ja' : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {wf.canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditRule(r)}
                              className="inline-flex rounded-none p-2 text-neutral-500 hover:bg-neutral-100 hover:text-[#1a3d32]"
                              aria-label="Rediger"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Slette «${r.name}»?`)) void wf.deleteRule(r.id)
                              }}
                              className="inline-flex rounded-none p-2 text-neutral-400 hover:bg-red-50 hover:text-red-700"
                              aria-label="Slett"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'runs' && (
        <div className={`${CARD} mt-8`}>
          <h2 className="text-lg font-semibold text-neutral-900">Siste kjøringer</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ved XOR vises <code className="text-xs">xor_branch</code> i detalj når én gren traff.
          </p>
          <div className="mt-4 max-h-[480px] overflow-auto rounded-none border border-neutral-100">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left">Tid</th>
                  <th className="px-3 py-2 text-left">Modul</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Detalj</th>
                </tr>
              </thead>
              <tbody>
                {wf.runs.map((run) => (
                  <tr key={run.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 whitespace-nowrap text-neutral-600">
                      {new Date(run.created_at).toLocaleString('nb-NO')}
                    </td>
                    <td className="px-3 py-2">{run.source_module}</td>
                    <td className="px-3 py-2">{run.status}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-500">
                      {JSON.stringify(run.detail).slice(0, 120)}
                      {JSON.stringify(run.detail).length > 120 ? '…' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {wf.runs.length === 0 && !wf.loading && (
              <p className="p-6 text-center text-sm text-neutral-500">Ingen kjøringer ennå.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className={`${CARD} mt-8 space-y-6`}>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Forhåndsdefinerte compliance-maler</h2>
            <p className="mt-2 text-sm text-neutral-600">
              Ett-knapps import av AML / IK-f-relaterte maler (alle starter <strong>av</strong>). Aktiver under Design
              når dere er klare.
            </p>
            {wf.canManage ? (
              <button
                type="button"
                onClick={async () => {
                  const r = await wf.seedComplianceTemplates()
                  if (r.ok) alert('Maler lagt til (eller fantes fra før).')
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-none border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
              >
                <Zap className="size-4" /> Importer compliance-maler
              </button>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Kun administratorer med «workflows.manage» kan importere.</p>
            )}
            <p className="mt-2 text-xs text-neutral-500">Maler i database: {templatesCount}</p>
          </div>
          <div className="rounded-none border border-neutral-200 bg-neutral-50/80 p-4 text-sm text-neutral-700">
            <strong className="text-neutral-900">Migrasjon:</strong> Kjør{' '}
            <code className="rounded bg-white px-1">20260508120000_workflow_xor_branches.sql</code> for XOR-grener og{' '}
            <code className="rounded bg-white px-1">flow_graph_json</code>. For e-post / webhook / varsling i databasen:{' '}
            <code className="rounded bg-white px-1">20260511120000_workflow_extended_actions.sql</code> (logger i{' '}
            <code className="rounded bg-white px-1">workflow_runs</code>; faktisk SMTP/HTTP krever Edge Function).
          </div>
        </div>
      )}

      {tab === 'module-rules' && (
        <div className="mt-6">
          <ModuleRulesView />
        </div>
      )}
    </div>
  )
}

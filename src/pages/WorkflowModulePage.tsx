import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart2,
  ChevronDown,
  GitBranch,
  History,
  LayoutTemplate,
  Loader2,
  Pencil,
  Play,
  Plus,
  Settings,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { WorkflowFlowBuilder } from '../components/workflow/WorkflowFlowBuilder'
import { flowDocumentFromLegacy } from '../lib/workflowFlowFromLegacy'
import {
  compileWorkflowFlow,
  defaultWorkflowFlowDocument,
  type WorkflowFlowDocument,
} from '../lib/workflowFlowTypes'
import { useWorkflows } from '../hooks/useWorkflows'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WORKFLOW_SOURCE_MODULES } from '../types/workflow'
import type { WorkflowAction, WorkflowCondition, WorkflowRuleRow, WorkflowXorActionsEnvelope } from '../types/workflow'
import {
  sourceModuleLabel,
  summarizeRuleActions,
  summarizeRuleCondition,
  triggerLabel,
} from '../lib/workflowRuleSummary'
import { WF_FIELD_INPUT, WF_FIELD_LABEL, WF_LEAD, WF_PANEL_INSET } from '../components/workflow/workflowPanelStyles'
import { WorkflowRulesTab } from '../components/workflow/WorkflowRulesTab'
import { WorkflowPage as ModuleRulesView } from './WorkflowPage'

// ── Style constants ────────────────────────────────────────────────────────────

const SIDEBAR_ITEM_BASE =
  'group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-left'
const SIDEBAR_ITEM_ACTIVE =
  'bg-[#1a3d32] text-white font-medium'
const SIDEBAR_ITEM_INACTIVE =
  'text-neutral-700 hover:bg-neutral-100'
const SIDEBAR_DIVIDER_LABEL =
  'mt-4 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-400'
const BTN_PRI =
  'inline-flex items-center gap-2 rounded-lg bg-[#1a3d32] px-3 py-2 text-sm font-medium text-white hover:bg-[#142e26] disabled:opacity-60'
const BTN_SEC =
  'inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50'
const CARD =
  'rounded-xl border border-neutral-200/90 bg-white shadow-sm'

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

function actionsToJsonString(a: WorkflowAction[] | WorkflowXorActionsEnvelope): string {
  return JSON.stringify(a, null, 2)
}

// ── Section type ──────────────────────────────────────────────────────────────

type Section =
  | 'overview'
  | `module:${string}` // e.g. "module:hse", "module:ros"
  | 'module-rules'
  | 'runs'
  | 'settings'

// ── Main component ────────────────────────────────────────────────────────────

export function WorkflowModulePage() {
  const wf = useWorkflows()
  const { supabase } = useOrgSetupContext()

  const [section, setSection] = useState<Section>('overview')
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

  // Active rule count per module — for sidebar badges
  const activeByModule = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of wf.rules) {
      if (r.is_active) map.set(r.source_module, (map.get(r.source_module) ?? 0) + 1)
    }
    return map
  }, [wf.rules])

  const totalByModule = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of wf.rules) map.set(r.source_module, (map.get(r.source_module) ?? 0) + 1)
    return map
  }, [wf.rules])

  const templatesCount = useMemo(() => wf.rules.filter((r) => r.is_template).length, [wf.rules])

  const recompileFlow = useCallback((doc: WorkflowFlowDocument) => {
    const out = compileWorkflowFlow(doc)
    if ('error' in out) { setCompileErr(out.error); return }
    setCompileErr(null)
    setConditionJson(out.condition_json)
    setActionsPayload(out.actions_json)
    setConditionText(JSON.stringify(out.condition_json, null, 2))
    setActionsText(JSON.stringify(out.actions_json, null, 2))
  }, [])

  const handleFlowDocChange = useCallback((doc: WorkflowFlowDocument) => {
    setFlowDoc(doc)
    const out = compileWorkflowFlow(doc)
    if ('error' in out) { setCompileErr(out.error); return }
    setCompileErr(null)
    setConditionJson(out.condition_json)
    setActionsPayload(out.actions_json)
    setConditionText(JSON.stringify(out.condition_json, null, 2))
    setActionsText(JSON.stringify(out.actions_json, null, 2))
  }, [])

  const parseJson = useCallback(<T,>(raw: string, label: string): T | null => {
    try { return JSON.parse(raw) as T }
    catch { setFormErr(`Ugyldig JSON i ${label}`); return null }
  }, [])

  const openNewRule = useCallback((forModule?: string) => {
    setFormErr(null); setCompileErr(null)
    setEditingRuleId('new'); setEditorOpen(true)
    setName(''); setSlug('')
    setSourceModule(forModule ?? 'hse')
    setTriggerOn('both')
    const doc = defaultWorkflowFlowDocument()
    setFlowDoc(doc); recompileFlow(doc); setDevJsonOpen(false)
  }, [recompileFlow])

  const openEditRule = useCallback((r: WorkflowRuleRow) => {
    setFormErr(null); setCompileErr(null)
    setEditingRuleId(r.id); setEditorOpen(true)
    setName(r.name); setSlug(r.slug)
    setSourceModule(r.source_module); setTriggerOn(r.trigger_on)
    setConditionJson(r.condition_json); setActionsPayload(r.actions_json)
    setConditionText(JSON.stringify(r.condition_json, null, 2))
    setActionsText(actionsToJsonString(r.actions_json))
    const fg = r.flow_graph_json
    const doc =
      fg && typeof fg === 'object' && (fg as { version?: number }).version === 1
        ? (fg as WorkflowFlowDocument)
        : flowDocumentFromLegacy(r.condition_json, r.actions_json)
    setFlowDoc(doc); setDevJsonOpen(false)
    queueMicrotask(() => recompileFlow(doc))
  }, [recompileFlow])

  const closeEditor = useCallback(() => {
    setEditorOpen(false); setEditingRuleId(null)
  }, [])

  useEffect(() => {
    if (!editorOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [editorOpen])

  useEffect(() => {
    if (!editorOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeEditor() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editorOpen, closeEditor])

  const handleSaveRule = useCallback(async () => {
    setFormErr(null)
    const out = compileWorkflowFlow(flowDoc)
    if ('error' in out) { setFormErr(out.error); return }
    const s = slug.trim() || slugify(name)
    const res = await wf.upsertRule({
      id: editingRuleId && editingRuleId !== 'new' ? editingRuleId : undefined,
      slug: s,
      name: name.trim() || 'Uten navn',
      description: '',
      source_module: sourceModule,
      trigger_on: triggerOn,
      is_active: false,
      condition_json: out.condition_json,
      actions_json: out.actions_json,
      flow_graph_json: flowDoc as unknown as Record<string, unknown>,
    })
    if (res.ok) closeEditor()
    else if (!wf.canManage) setFormErr('Du har ikke tilgang til å lagre regler.')
    else setFormErr(wf.error ?? 'Lagring feilet. Prøv igjen.')
  }, [closeEditor, editingRuleId, flowDoc, name, slug, sourceModule, triggerOn, wf])

  const applyAdvancedToFlow = useCallback(() => {
    const c = parseJson<WorkflowCondition>(conditionText, 'betingelse')
    const rawActs = parseJson<unknown>(actionsText, 'handlinger')
    if (!c || rawActs === null) return
    let acts: WorkflowAction[] | WorkflowXorActionsEnvelope
    if (Array.isArray(rawActs)) acts = rawActs
    else if (typeof rawActs === 'object' && rawActs !== null && (rawActs as { mode?: string }).mode === 'xor_branches')
      acts = rawActs as WorkflowXorActionsEnvelope
    else { setFormErr('Ugyldig actions-format'); return }
    setFormErr(null)
    const doc = flowDocumentFromLegacy(c, acts)
    setFlowDoc(doc); setConditionJson(c); setActionsPayload(acts); recompileFlow(doc)
  }, [actionsText, conditionText, parseJson, recompileFlow])

  // Current module slug (when section is module:xxx)
  const activeModuleSlug = section.startsWith('module:') ? section.slice(7) : null
  const activeModuleLabel = activeModuleSlug
    ? (WORKFLOW_SOURCE_MODULES.find((m) => m.value === activeModuleSlug)?.label.split(' (')[0] ?? activeModuleSlug)
    : null

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const sidebar = (
    <nav
      className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-neutral-200/80 bg-neutral-50 px-2 py-4"
      style={{ minHeight: 0 }}
      aria-label="Arbeidsflyt-seksjoner"
    >
      {/* Overview */}
      <button
        type="button"
        onClick={() => setSection('overview')}
        className={`${SIDEBAR_ITEM_BASE} ${section === 'overview' ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_INACTIVE}`}
      >
        <BarChart2 className="size-4 shrink-0" />
        <span>Oversikt</span>
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${section === 'overview' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
          {wf.rules.filter((r) => r.is_active).length}/{wf.rules.length}
        </span>
      </button>

      {/* Per-module sections */}
      <p className={SIDEBAR_DIVIDER_LABEL}>Moduler</p>
      {WORKFLOW_SOURCE_MODULES.map((mod) => {
        const s: Section = `module:${mod.value}`
        const isActive = section === s
        const active = activeByModule.get(mod.value) ?? 0
        const total = totalByModule.get(mod.value) ?? 0
        return (
          <button
            key={mod.value}
            type="button"
            onClick={() => setSection(s)}
            className={`${SIDEBAR_ITEM_BASE} ${isActive ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_INACTIVE}`}
          >
            <GitBranch className="size-4 shrink-0" />
            <span className="min-w-0 truncate">{mod.label.split(' (')[0]}</span>
            {total > 0 && (
              <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${isActive ? 'bg-white/20 text-white' : active > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'}`}>
                {active}/{total}
              </span>
            )}
          </button>
        )
      })}

      {/* System sections */}
      <p className={SIDEBAR_DIVIDER_LABEL}>System</p>
      <button
        type="button"
        onClick={() => setSection('module-rules')}
        className={`${SIDEBAR_ITEM_BASE} ${section === 'module-rules' ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_INACTIVE}`}
      >
        <LayoutTemplate className="size-4 shrink-0" />
        <span>Modul-maler</span>
      </button>
      <button
        type="button"
        onClick={() => setSection('runs')}
        className={`${SIDEBAR_ITEM_BASE} ${section === 'runs' ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_INACTIVE}`}
      >
        <History className="size-4 shrink-0" />
        <span>Historikk</span>
      </button>
      <button
        type="button"
        onClick={() => setSection('settings')}
        className={`${SIDEBAR_ITEM_BASE} ${section === 'settings' ? SIDEBAR_ITEM_ACTIVE : SIDEBAR_ITEM_INACTIVE}`}
      >
        <Settings className="size-4 shrink-0" />
        <span className="min-w-0 truncate">Compliance-maler</span>
        {templatesCount > 0 && (
          <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${section === 'settings' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-500'}`}>
            {templatesCount}
          </span>
        )}
      </button>
    </nav>
  )

  // ── Rule editor drawer ─────────────────────────────────────────────────────
  const editorDrawer = editorOpen && wf.canManage ? (
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
            <h3 className="text-lg font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
              {editingRuleId === 'new' ? 'Ny regel' : 'Rediger regel'}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Bygg flyten med menyene. <strong>XOR</strong> gir parallelle grener der nøyaktig én matcher.
            </p>
          </div>
          <button
            type="button"
            onClick={closeEditor}
            className="rounded-lg border border-transparent p-2 text-neutral-500 hover:bg-white/80 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f6f2] px-4 py-4 sm:px-5">
          {formErr && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{formErr}</p>
          )}

          <div className={`${WF_PANEL_INSET} border-neutral-200/90`}>
            <p className={WF_FIELD_LABEL}>Grunninfo</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className={WF_FIELD_LABEL} htmlFor="wf-rule-name">Navn</label>
                <input id="wf-rule-name" value={name} onChange={(e) => setName(e.target.value)} className={WF_FIELD_INPUT} placeholder="F.eks. Kritisk hendelse → HMS-oppgave" />
              </div>
              <div>
                <label className={WF_FIELD_LABEL} htmlFor="wf-rule-slug">Slug (ID)</label>
                <input id="wf-rule-slug" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${WF_FIELD_INPUT} font-mono text-xs`} placeholder="auto fra navn hvis tom" />
              </div>
              <div>
                <label className={WF_FIELD_LABEL} htmlFor="wf-rule-source">Kilde (modul)</label>
                <select id="wf-rule-source" value={sourceModule} onChange={(e) => setSourceModule(e.target.value)} className={WF_FIELD_INPUT}>
                  {WORKFLOW_SOURCE_MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className={WF_FIELD_LABEL} htmlFor="wf-rule-trigger">Utløser</label>
                <select id="wf-rule-trigger" value={triggerOn} onChange={(e) => setTriggerOn(e.target.value as 'insert' | 'update' | 'both')} className={WF_FIELD_INPUT}>
                  <option value="both">Lagring (ny + oppdatering)</option>
                  <option value="insert">Kun første lagring</option>
                  <option value="update">Kun oppdateringer</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-200/80 pt-6">
            <WorkflowFlowBuilder value={flowDoc} onChange={handleFlowDocChange} sourceModule={sourceModule} compileError={compileErr} />
          </div>

          <div className="mt-6 border-t border-neutral-200/80 pt-4">
            <div className={`${WF_PANEL_INSET} border-neutral-200/90`}>
              <button
                type="button"
                onClick={() => setDevJsonOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200/90 bg-white px-3 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50"
              >
                <span className="text-sm font-semibold text-neutral-900">Utvikler: JSON (import / eksport)</span>
                <ChevronDown className={`size-4 shrink-0 text-neutral-500 transition ${devJsonOpen ? 'rotate-180' : ''}`} />
              </button>
              {devJsonOpen && (
                <div className="mt-4 space-y-4 border-t border-neutral-200/80 pt-4">
                  <p className={WF_LEAD}>Kun for feilsøking eller migrering. «Synkroniser til flyt» overskriver den visuelle byggeren.</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setConditionText(JSON.stringify(conditionJson, null, 2)); setActionsText(actionsToJsonString(actionsPayload)) }} className={BTN_SEC}>
                      Oppdater tekstfelt fra flyt
                    </button>
                    <button type="button" onClick={applyAdvancedToFlow} className={BTN_SEC}>Synkroniser JSON → flyt</button>
                  </div>
                  <div>
                    <label className={WF_FIELD_LABEL} htmlFor="wf-dev-cond">Betingelse (JSON)</label>
                    <textarea id="wf-dev-cond" value={conditionText} onChange={(e) => setConditionText(e.target.value)} rows={6} className={`${WF_FIELD_INPUT} font-mono text-xs`} />
                  </div>
                  <div>
                    <label className={WF_FIELD_LABEL} htmlFor="wf-dev-act">Handlinger (JSON)</label>
                    <textarea id="wf-dev-act" value={actionsText} onChange={(e) => setActionsText(e.target.value)} rows={10} className={`${WF_FIELD_INPUT} font-mono text-xs`} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-neutral-200/90 bg-[#f4f1ea] px-5 py-4">
          <button type="button" onClick={closeEditor} className={BTN_SEC}>Avbryt</button>
          <button type="button" onClick={() => void handleSaveRule()} className={BTN_PRI}>
            Lagre regel <span className="text-xs opacity-70">(starter inaktiv)</span>
          </button>
        </div>
      </aside>
    </>
  ) : null

  // ── Overview section ───────────────────────────────────────────────────────
  const overviewContent = (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-6 rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
        <div>
          <p className="text-3xl font-bold text-[#1a3d32]">{wf.rules.length}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Regler totalt</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-emerald-700">{wf.rules.filter((r) => r.is_active).length}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Aktive</p>
        </div>
        <div>
          <p className="text-3xl font-bold text-neutral-400">{wf.rules.filter((r) => !r.is_active).length}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Inaktive / utkast</p>
        </div>
        {wf.canManage && (
          <div className="ml-auto flex items-center">
            <button type="button" onClick={() => openNewRule()} className={BTN_PRI}>
              <Plus className="size-4" /> Ny regel
            </button>
          </div>
        )}
      </div>

      {/* Per-module cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {WORKFLOW_SOURCE_MODULES.map((mod) => {
          const moduleRules = wf.rules.filter((r) => r.source_module === mod.value)
          const activeCount = moduleRules.filter((r) => r.is_active).length
          return (
            <div key={mod.value} className={`${CARD} flex flex-col gap-3 p-4`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">{mod.label.split(' (')[0]}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${activeCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  {activeCount}/{moduleRules.length}
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
                        {r.is_active ? 'Aktiv' : 'Av'}
                      </span>
                    </li>
                  ))}
                  {moduleRules.length > 4 && <li className="text-[11px] text-neutral-400">+{moduleRules.length - 4} til</li>}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setSection(`module:${mod.value}`)}
                className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-[#1a3d32] hover:underline"
              >
                <GitBranch className="size-3" />
                {moduleRules.length > 0 ? 'Rediger regler' : 'Legg til regler'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Module section content ─────────────────────────────────────────────────
  const moduleContent = activeModuleSlug ? (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{activeModuleLabel}</h2>
          <p className="text-sm text-neutral-500">
            {totalByModule.get(activeModuleSlug) ?? 0} regler ·{' '}
            {activeByModule.get(activeModuleSlug) ?? 0} aktive
          </p>
        </div>
        {wf.canManage && (
          <button type="button" onClick={() => openNewRule(activeModuleSlug)} className={BTN_PRI}>
            <Plus className="size-4" /> Ny regel
          </button>
        )}
      </div>
      <WorkflowRulesTab key={activeModuleSlug} supabase={supabase} module={activeModuleSlug} />
    </div>
  ) : null

  // ── Runs / history content ─────────────────────────────────────────────────
  const runsContent = (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-neutral-900">Kjøringslogg</h2>
      <div className={`${CARD} overflow-hidden p-0`}>
        <div className="max-h-[600px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-neutral-50 text-left">
              <tr className="border-b border-neutral-200">
                <th className="px-4 py-3 font-semibold text-neutral-600">Tid</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Modul</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Status</th>
                <th className="px-4 py-3 font-semibold text-neutral-600">Detalj</th>
              </tr>
            </thead>
            <tbody>
              {wf.runs.map((run) => (
                <tr key={run.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-600">{new Date(run.created_at).toLocaleString('nb-NO')}</td>
                  <td className="px-4 py-2.5">{sourceModuleLabel(run.source_module)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${run.status === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="max-w-[300px] truncate px-4 py-2.5 font-mono text-neutral-500">
                    {JSON.stringify(run.detail).slice(0, 120)}{JSON.stringify(run.detail).length > 120 ? '…' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {wf.runs.length === 0 && !wf.loading && (
            <p className="p-8 text-center text-sm text-neutral-500">Ingen kjøringer ennå.</p>
          )}
        </div>
      </div>
    </div>
  )

  // ── Settings / compliance templates content ────────────────────────────────
  const settingsContent = (
    <div className="space-y-6">
      <div className={`${CARD} space-y-4 p-6`}>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Compliance-maler</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ett-knapps import av AML / IK-f-relaterte maler (alle starter <strong>inaktive</strong>). Aktiver under den aktuelle
            modulen når dere er klare.
          </p>
        </div>
        {wf.canManage ? (
          <button
            type="button"
            onClick={async () => {
              const r = await wf.seedComplianceTemplates()
              if (r.ok) alert('Maler lagt til (eller fantes fra før).')
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100"
          >
            <Zap className="size-4" /> Importer compliance-maler
          </button>
        ) : (
          <p className="text-sm text-neutral-500">Kun administratorer med «workflows.manage» kan importere.</p>
        )}
        <p className="text-xs text-neutral-400">Maler i database: {templatesCount}</p>
      </div>
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50 p-4 text-sm text-neutral-700">
        <strong className="text-neutral-900">Migrasjon:</strong> Kjør{' '}
        <code className="rounded bg-white px-1">20260508120000_workflow_xor_branches.sql</code> for XOR-grener og{' '}
        <code className="rounded bg-white px-1">flow_graph_json</code>. For e-post / webhook / varsling i databasen:{' '}
        <code className="rounded bg-white px-1">20260511120000_workflow_extended_actions.sql</code>.
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Top header bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-neutral-200/80 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32] text-[#c9a227]">
            <GitBranch className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-neutral-900">Arbeidsflyt</h1>
            <p className="text-xs text-neutral-500">Automatiseringsregler for alle moduler</p>
          </div>
        </div>
        {wf.loading && <Loader2 className="size-4 animate-spin text-neutral-400" />}
      </header>

      {wf.error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">{wf.error}</div>
      )}

      {/* Two-panel layout */}
      <div className="flex min-h-0 flex-1">
        {sidebar}

        {/* Main content */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-[#f8f7f4] px-6 py-6">
          {section === 'overview' && overviewContent}
          {activeModuleSlug && moduleContent}
          {section === 'module-rules' && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-neutral-900">Modul-maler</h2>
              <ModuleRulesView />
            </div>
          )}
          {section === 'runs' && runsContent}
          {section === 'settings' && settingsContent}
        </main>
      </div>

      {editorDrawer}
    </div>
  )
}

// useInternkontrollPageData — single read-side hook that backs the
// unified Internkontroll page.
//
// Aggregates the live data needed for all eight sections (Oversikt,
// Krav, Kontroller, Gap, Årshjul, Tiltak, Prosjekter, Revisjon) into
// a single in-memory shape so each SectionXxx renderer can pick what
// it needs without re-fetching.
//
// Sources joined client-side (data fits comfortably in one round-trip
// for a typical org):
//   • FRAMEWORKS + useRegelverkCoverage    → krav + coverage
//   • internal_controls                     → kontroller (Tier 2)
//   • internal_control_clauses              → kontroll ↔ krav links
//   • regulation_clauses                    → clause id ↔ code map
//   • internal_control_status_v             → last/next-run + cadence label
//   • internal_control_executions           → årshjul gjennomført + revisjon
//   • compliance_plan_items                 → tiltak + prosjekter (grouped)
//   • register_types                        → register coverage for AML
//   • useControlsByLawRef                   → per-§ control count (shared)

import { useEffect, useMemo, useState } from 'react'
import {
  useRegelverkCoverage,
  type CoverageEntry,
  type CoverageMap,
} from '../../../hooks/useRegelverkCoverage'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useControlsByLawRef } from './useControlsByLawRef'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  type FrameworkId,
} from './frameworkParagraphs'
import { categorizeLawRef, type IkCategoryId } from './sections/internkontrollTokens'
import type {
  ControlFamily,
  ControlFrequencyHint,
  ControlStatus,
  ControlStatusLabel,
} from '../../../types/complianceLayer'
import { MAX_PLAN_ITEMS_PER_FRAMEWORK } from '../../../../modules/compliance-layer/limits'

// Defensive page-level caps. Numbers tuned to fit a comfortably-active
// org (≈200 controls, ≈500 plan-items, ≈400 recent executions) without
// hitting a hard scaling cliff. Tenants that cross these limits get a
// truncated view + a console hint, not a broken page.
const MAX_PAGE_CONTROLS = 500
const MAX_PAGE_EXECUTIONS = 400
const MAX_PAGE_PLAN_ITEMS = MAX_PLAN_ITEMS_PER_FRAMEWORK * 5

// ── Types surfaced to section renderers ─────────────────────────────────────

export type IkFramework = {
  id: FrameworkId
  short: string
  name: string
  color: string
  /** Lucide icon name passed to the FrameworkIcon helper. */
  icon: string
  mandatory: boolean
  reqs: number
  covered: number
  partial: number
  gap: number
}

export type IkKravStatus = 'covered' | 'partial' | 'gap' | 'na'
export type IkCriticality = 'høy' | 'middels' | 'lav'

export type IkKrav = {
  id: string
  fw: FrameworkId
  /** Paragraph code, e.g. "AML § 4-3". */
  ref: string
  /** Chapter token (e.g. "Kap. 4 — Krav til arbeidsmiljøet") if known. */
  chapter?: string
  title: string
  status: IkKravStatus
  criticality: IkCriticality
  /** Functional category — derived from `ref` via `categorizeLawRef`.
   *  Drives the KATEGORIER sidebar block + per-section category filter. */
  category: IkCategoryId
  /** Control ids that satisfy this paragraph. */
  controls: string[]
  /** Coverage entries (templates / instances) that mention this paragraph. */
  evidence: CoverageEntry[]
  /** Whether the row counts as register coverage (AML only). */
  registerCovered: boolean
  /** Owner name resolved from internal_controls.owner_user_id (Phase 1: '—'). */
  owner: string
  /** Last-review date (Phase 1: latest execution among covering controls). */
  reviewed: string
  /** Next-review date (Phase 1: earliest next_due_at among controls). */
  nextReview: string
  /** Optional gap description (filled in for status='partial'/'gap'). */
  gap?: string
}

export type IkKontrollType = 'forebyggende' | 'oppdagende' | 'korrigerende'

export type IkKontroll = {
  id: string
  slug: string
  title: string
  type: IkKontrollType
  frequency: ControlFrequencyHint | null
  /** Lucide-friendly readable frequency label. */
  frequencyLabel: string
  evidence: string
  owner: string
  ownerRole: string | null
  status: 'aktiv' | 'utkast' | 'utgått'
  effectiveness: number
  lastRun: string
  nextRun: string
  /** Krav (paragraph codes) covered. */
  covers: string[]
  /** Distinct categories the covered paragraphs fall into. A kontroll
   *  that covers AML §3-1 + GDPR Art.32 belongs to BOTH `hms-arbeid`
   *  and `personvern`; sidebar filter shows it under either. */
  categories: IkCategoryId[]
  statusLabel: ControlStatusLabel | null
  totalExecutions: number
}

export type IkAarshjulEvent = {
  id: string
  /** 4-digit year of the underlying timestamp. Year-wheel UIs scope to
   *  a single calendar year; storing this lets the renderer filter
   *  without re-parsing the date string. */
  year: number
  month: number
  /** Day-of-month + "." (e.g. "14.") for display. */
  date: string
  title: string
  fw: FrameworkId[]
  owner: string
  status: 'done' | 'planned'
  controlId: string
}

/** CAPA 9-state lifecycle exposed by `task_items.status`. Mirror of
 *  `src/types/task.ts` — we only consume strings here so the dependency
 *  is minimal. Legacy values `todo`/`done` are accepted by the DB check
 *  constraint and may appear on historical rows. */
export type BridgeTaskStatus =
  | 'open'
  | 'in_progress'
  | 'root_cause_identified'
  | 'action_defined'
  | 'action_implemented'
  | 'effectiveness_pending'
  | 'effectiveness_verified'
  | 'closed'
  | 'cancelled'
  | 'todo'
  | 'done'

export type IkTiltak = {
  id: string
  title: string
  description: string | null
  krav: string[]
  fw: FrameworkId
  /** Functional category derived from the law_ref the tiltak closes. */
  category: IkCategoryId
  owner: string
  /** Mapped from compliance_plan_items.status. */
  priority: 'kritisk' | 'høy' | 'middels' | 'lav'
  status: 'planlagt' | 'pågår' | 'til-godkjenning' | 'fullført' | 'forsinket'
  deadline: string
  progress: number
  project: string | null
  taskId: string | null
  rawStatus: 'planned' | 'in_progress' | 'blocked' | 'done'
  dueAt: string | null
  /** When the plan-item has a bridge task in `task_items`, the live
   *  CAPA status of that task. Surfaces alongside `status` so users
   *  see what the doer side actually thinks. Null when no bridge. */
  bridgeStatus: BridgeTaskStatus | null
  /** Assignee on the bridge task (distinct from owner — executes the
   *  work). Null when no bridge or task is unassigned. */
  bridgeAssignee: string | null
  /** SLA deadline from the bridge task. Falls back to plan-item due_at. */
  bridgeSlaDueAt: string | null
}

export type IkProsjektMilestone = {
  label: string
  date: string
  done: boolean
  current?: boolean
}

export type IkProsjekt = {
  id: string
  name: string
  leader: string
  status: string
  phase: string
  progress: number
  deadline: string
  budget: string
  spent: string
  description: string
  tasks: number
  openTasks: number
  krav: number
  krav_covered: number
  milestones: IkProsjektMilestone[]
  /** Plan-item IDs in scope. */
  tiltakIds: string[]
  /** Paragraph codes in scope. */
  kravCodes: string[]
  /** Canonical task_projects.id when this project is persistent.
   *  Null for legacy milestone-string groupings. */
  projectId: string | null
  /** Project board methodology — drives the chip label + deep-link. */
  methodology: 'pdca' | 'kanban' | null
  /** True for legacy milestone-string groupings (no task_projects row). */
  isLegacy: boolean
}

export type IkAuditEntry = {
  /** ISO timestamp used for sorting — keep separate from the display
   *  string so the sort is stable across locales and DST transitions. */
  whenIso: string
  /** Human-readable Norwegian timestamp for rendering. */
  when: string
  who: string
  action: string
  detail: string
}

export type IkStats = {
  total: number
  covered: number
  partial: number
  gaps: number
  na: number
  overdue: number
  activeKontroller: number
  upcoming: number
}

export type IkData = {
  frameworks: IkFramework[]
  krav: IkKrav[]
  kontroller: IkKontroll[]
  aarshjul: IkAarshjulEvent[]
  monthNames: string[]
  tiltak: IkTiltak[]
  prosjekter: IkProsjekt[]
  audit: IkAuditEntry[]
  stats: IkStats
}

// ── Static framework metadata (icon + color + short label) ──────────────────

const FW_META: Record<FrameworkId, { color: string; icon: string; mandatory: boolean }> = {
  aml: { color: '#2f7757', icon: 'Scale', mandatory: true },
  'ik-f': { color: '#1a3d32', icon: 'BookOpen', mandatory: true },
  gdpr: { color: '#6366F1', icon: 'Lock', mandatory: true },
  apenhetsloven: { color: '#c98a2b', icon: 'Eye', mandatory: true },
  'iso-45001': { color: '#16A34A', icon: 'BadgeCheck', mandatory: false },
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mai',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

// ── Raw row types from the DB ───────────────────────────────────────────────

type RegisterRow = { id: string; label: string; aml_paragraphs: string[] | null }
type ClauseRow = { id: string; code: string }
type ControlRow = {
  id: string
  slug: string
  name: string
  purpose: string
  control_family: ControlFamily
  frequency_hint: ControlFrequencyHint | null
  owner_role: string | null
  owner_user_id: string | null
  status: ControlStatus
  is_active: boolean
}
type JunctionRow = { control_id: string; clause_id: string }
type StatusRow = {
  control_id: string
  status_label: ControlStatusLabel | null
  last_occurred_at: string | null
  next_due_at: string | null
  total_executions: number
}
type ExecutionRow = {
  id: string
  control_id: string
  occurred_at: string
  period_label: string | null
  summary: string | null
  signed_by: string | null
  signed_at: string | null
}
/** Persistent project record from public.task_projects. Replaces the
 *  earlier "milestone-string grouping" path — projects created in
 *  Oppgavestyring (PDCA/Kanban boards, dates, lead, law_refs) now
 *  surface 1:1 on the Internkontroll page. */
type ProjectRow = {
  id: string
  title: string
  description: string | null
  methodology: string
  status: string
  start_date: string | null
  end_date: string | null
  law_refs: string[] | null
  lead_user_id: string | null
  created_at: string
}

/** Minimal slice of task_items pulled for the bridge view. Each row
 *  is a task created via `useCompliancePlanItems.ensureBridgeTask`
 *  (source_type='compliance_plan', source_id=<plan_item.id>) — the
 *  CAPA twin of an internkontroll tiltak. We only read what the
 *  internkontroll page needs to surface; the full task lives in the
 *  Tasks module. */
type BridgeTaskRow = {
  id: string
  source_id: string
  status: string
  assignee_user_id: string | null
  assignee_name: string | null
  sla_due_at: string | null
  closed_at: string | null
}
type PlanItemRow = {
  id: string
  law_ref: string
  framework_id: string
  title: string
  description: string | null
  owner_user_id: string | null
  status: 'planned' | 'in_progress' | 'blocked' | 'done'
  due_at: string | null
  milestone: string | null
  project_id: string | null
  task_id: string | null
  created_at: string
  updated_at: string
}

function normalizeLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

function dedupe(entries: CoverageEntry[]): CoverageEntry[] {
  const m = new Map<string, CoverageEntry>()
  for (const e of entries) m.set(`${e.kind}:${e.id}`, e)
  return [...m.values()]
}

const FREQUENCY_LABELS: Record<NonNullable<ControlFrequencyHint>, string> = {
  arlig: 'Årlig',
  halvarlig: 'Halvårlig',
  kvartalsvis: 'Kvartalsvis',
  manedlig: 'Månedlig',
  ukentlig: 'Ukentlig',
  daglig: 'Daglig',
  ad_hoc: 'Hendelse',
}

const FAMILY_TO_TYPE: Record<ControlFamily, IkKontrollType> = {
  preventive: 'forebyggende',
  detective: 'oppdagende',
  corrective: 'korrigerende',
  directive: 'forebyggende',
}

const CONTROL_STATUS_MAP: Record<ControlStatus, IkKontroll['status']> = {
  active: 'aktiv',
  draft: 'utkast',
  retired: 'utgått',
}

// Plan-item status → tiltak status + priority. Phase 1: priority is
// derived from the original framework's criticality buckets; if every
// row gets 'middels' the page is still readable.
function mapPlanStatus(
  status: PlanItemRow['status'],
  dueAt: string | null,
): { status: IkTiltak['status']; priority: IkTiltak['priority'] } {
  const now = Date.now()
  const due = dueAt ? Date.parse(dueAt) : null
  const overdue = status !== 'done' && due !== null && due < now
  if (status === 'done') return { status: 'fullført', priority: 'lav' }
  if (status === 'blocked') return { status: 'til-godkjenning', priority: 'høy' }
  if (overdue) return { status: 'forsinket', priority: 'kritisk' }
  if (status === 'in_progress') return { status: 'pågår', priority: 'høy' }
  return { status: 'planlagt', priority: 'middels' }
}

export type BridgeTaskInfo = {
  status: BridgeTaskStatus
  assigneeName: string | null
  slaDueAt: string | null
}

/**
 * Convert a raw compliance_plan_item row into the IkTiltak view-model.
 * Exported so the Tiltak section can derive directly from the live
 * useCompliancePlanItems hook (single source of truth for writes).
 *
 * `bridgesByPlanId` carries the bridge task slice from `task_items`
 * keyed by plan-item id. When present, the resulting IkTiltak exposes
 * the live CAPA status + assignee so the UI can render the doer's
 * truth alongside the auditor view.
 */
export function planItemToTiltak(
  p: {
    id: string
    law_ref: string
    framework_id: string
    title: string
    description: string | null
    owner_user_id: string | null
    status: PlanItemRow['status']
    due_at: string | null
    milestone: string | null
    task_id: string | null
  },
  frameworks: IkFramework[],
  userNames?: Map<string, string>,
  bridgesByPlanId?: Map<string, BridgeTaskInfo>,
): IkTiltak {
  const mapped = mapPlanStatus(p.status, p.due_at)
  const progress =
    p.status === 'done'
      ? 1
      : p.status === 'in_progress'
        ? 0.5
        : p.status === 'blocked'
          ? 0.4
          : 0.1
  const fwId: FrameworkId = (FRAMEWORK_IDS as readonly string[]).includes(p.framework_id)
    ? (p.framework_id as FrameworkId)
    : frameworkFromLawRef(p.law_ref)
  // Touch frameworks so the import isn't dead (used by callers that
  // want to keep the fw → color lookup in scope of the same hook).
  void frameworks
  const bridge = bridgesByPlanId?.get(p.id) ?? null
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    krav: [`k-${fwId}-${p.law_ref}`],
    fw: fwId,
    category: categorizeLawRef(p.law_ref),
    owner: p.owner_user_id ? userNames?.get(p.owner_user_id) ?? '—' : '—',
    priority: mapped.priority,
    status: mapped.status,
    deadline: formatDate(p.due_at),
    progress,
    project: p.milestone ?? null,
    taskId: p.task_id,
    rawStatus: p.status,
    dueAt: p.due_at,
    bridgeStatus: bridge?.status ?? null,
    bridgeAssignee: bridge?.assigneeName ?? null,
    bridgeSlaDueAt: bridge?.slaDueAt ?? null,
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('nb-NO', { day: '2-digit', month: '2-digit' })
}

function monthNumber(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 1
  return d.getMonth() + 1
}

function yearNumber(iso: string): number {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return new Date().getFullYear()
  return d.getFullYear()
}

// Map a paragraph to a guessed framework id. Picks the framework whose
// short label appears as a prefix in the law ref, defaulting to AML.
// Codes from frameworks outside our five FrameworkId values (ISO 9001 /
// 14001 / 27001, LDL = Likestillings- og diskrimineringsloven, etc.)
// don't have a dedicated tab today — we fall through to AML so the row
// is at least *visible* in the unified view rather than disappearing.
function frameworkFromLawRef(ref: string): FrameworkId {
  if (ref.startsWith('AML ')) return 'aml'
  if (ref.startsWith('IK-f ')) return 'ik-f'
  if (ref.startsWith('GDPR ')) return 'gdpr'
  if (ref.startsWith('Åpenhetsloven ')) return 'apenhetsloven'
  if (ref.startsWith('ISO 45001')) return 'iso-45001'
  // ISO 9001 / 14001 / 27001 share the management-system clause numbers
  // with ISO 45001 (§4 — Context, §9.2 — Internal audit, etc.). Bucket
  // them with 45001 so multi-standard rows still surface on the page
  // rather than being misclassified as AML.
  if (ref.startsWith('ISO ')) return 'iso-45001'
  return 'aml'
}

export function useInternkontrollPageData(): {
  data: IkData
  loading: boolean
  /** Bridge-task metadata keyed by source compliance_plan_items.id —
   *  surfaced so callers that derive live tiltak from a write hook
   *  (e.g. useCompliancePlanItems) can still attach the CAPA twin's
   *  status + assignee without re-querying. */
  bridgesByPlanId: Map<string, BridgeTaskInfo>
} {
  const { supabase, organization } = useOrgSetupContext()
  const { coverage, loading: coverageLoading } = useRegelverkCoverage()
  const controlsLookup = useControlsByLawRef()

  // All fetched rows are persisted in a single state slot keyed by
  // orgId, so an in-flight org switch never lets the derived shapes
  // compute against stale data. `loaded === null` (or stale orgId)
  // doubles as the loading signal — avoids a synchronous setState in
  // the effect body (`react-hooks/set-state-in-effect`).
  type Loaded = {
    orgId: string
    registerRows: RegisterRow[]
    clauseRows: ClauseRow[]
    controlRows: ControlRow[]
    junctions: JunctionRow[]
    statusRows: StatusRow[]
    executionRows: ExecutionRow[]
    planRows: PlanItemRow[]
    /** task_items rows whose source_type='compliance_plan' — the bridge
     *  twin of each plan-item. Read-only on this page; the Tasks module
     *  owns writes. */
    bridgeTasks: BridgeTaskRow[]
    /** Persistent task_projects records. Drives the Prosjekter section
     *  (in place of the legacy milestone-string grouping). */
    projects: ProjectRow[]
  }
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!supabase || !organization?.id) return
    const orgId = organization.id
    let cancelled = false
    void Promise.all([
      supabase
        .from('register_types')
        .select('id, label, aml_paragraphs')
        .or(`organization_id.eq.${orgId},organization_id.is.null`)
        .eq('is_active', true),
      supabase
        .from('regulation_clauses')
        .select('id, code')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('is_active', true),
      supabase
        .from('internal_controls')
        .select(
          'id, slug, name, purpose, control_family, frequency_hint, owner_role, owner_user_id, status, is_active',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .limit(MAX_PAGE_CONTROLS),
      supabase
        .from('internal_control_clauses')
        .select('control_id, clause_id')
        .eq('organization_id', orgId),
      supabase
        .from('internal_control_status_v')
        .select('control_id, status_label, last_occurred_at, next_due_at, total_executions')
        .eq('organization_id', orgId),
      supabase
        .from('internal_control_executions')
        .select('id, control_id, occurred_at, period_label, summary, signed_by, signed_at')
        .eq('organization_id', orgId)
        .order('occurred_at', { ascending: false })
        .limit(MAX_PAGE_EXECUTIONS),
      supabase
        .from('compliance_plan_items')
        .select(
          'id, law_ref, framework_id, title, description, owner_user_id, status, due_at, milestone, project_id, task_id, created_at, updated_at',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(MAX_PAGE_PLAN_ITEMS),
      // Bridge: tasks whose source_type='compliance_plan' are the CAPA
      // twin of a plan-item. The partial unique index
      // `task_items_compliance_plan_bridge_uidx` guarantees 1:1 so we
      // can use `source_id` as the join key directly.
      supabase
        .from('task_items')
        .select(
          'id, source_id, status, assignee_user_id, assignee_name, sla_due_at, closed_at',
        )
        .eq('organization_id', orgId)
        .eq('source_type', 'compliance_plan')
        .is('deleted_at', null)
        .limit(MAX_PAGE_PLAN_ITEMS),
      // task_projects — Phase 2: persistent project records replacing
      // the milestone-string grouping. RLS scopes by org already.
      supabase
        .from('task_projects')
        .select(
          'id, title, description, methodology, status, start_date, end_date, law_refs, lead_user_id, created_at',
        )
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]).then(([reg, cl, ctrl, jn, st, ex, pl, bridges, projects]) => {
      if (cancelled) return
      // Log non-fatal query failures so they don't disappear into the
      // void. We still build a partial view from whatever did succeed —
      // a missing internal_control_executions table shouldn't block the
      // krav/kontroll sections from rendering.
      const failures: string[] = []
      if (reg.error) failures.push(`register_types: ${reg.error.message}`)
      if (cl.error) failures.push(`regulation_clauses: ${cl.error.message}`)
      if (ctrl.error) failures.push(`internal_controls: ${ctrl.error.message}`)
      if (jn.error) failures.push(`internal_control_clauses: ${jn.error.message}`)
      if (st.error) failures.push(`internal_control_status_v: ${st.error.message}`)
      if (ex.error) failures.push(`internal_control_executions: ${ex.error.message}`)
      if (pl.error) failures.push(`compliance_plan_items: ${pl.error.message}`)
      if (bridges.error) failures.push(`task_items (bridge): ${bridges.error.message}`)
      if (projects.error) failures.push(`task_projects: ${projects.error.message}`)
      if (failures.length > 0) {
        console.warn('[internkontroll] partial load — some sources failed:', failures)
      }
      setLoaded({
        orgId,
        registerRows: (reg.data ?? []) as RegisterRow[],
        clauseRows: (cl.data ?? []) as ClauseRow[],
        controlRows: (ctrl.data ?? []) as ControlRow[],
        junctions: (jn.data ?? []) as JunctionRow[],
        statusRows: (st.data ?? []) as StatusRow[],
        executionRows: (ex.data ?? []) as ExecutionRow[],
        planRows: (pl.data ?? []) as PlanItemRow[],
        bridgeTasks: (bridges.data ?? []) as BridgeTaskRow[],
        projects: (projects.data ?? []) as ProjectRow[],
      })
    })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  // "Loaded for current org" — derived purely from refs so we never set
  // a transient loading flag synchronously inside the fetch effect.
  const isCurrent = loaded !== null && loaded.orgId === organization?.id
  const current = isCurrent ? loaded : null

  // Resolve user names for owners / actors. Fetched separately so a
  // missing profile row doesn't fail the main load.
  useEffect(() => {
    if (!supabase) return
    if (!current) return
    const allIds = new Set<string>()
    for (const c of current.controlRows) if (c.owner_user_id) allIds.add(c.owner_user_id)
    for (const p of current.planRows) if (p.owner_user_id) allIds.add(p.owner_user_id)
    for (const e of current.executionRows) if (e.signed_by) allIds.add(e.signed_by)
    if (allIds.size === 0) return
    let cancelled = false
    // profiles.id IS auth.users.id (1:1 row per user; see useOrgSetup.ts).
    // display_name is non-null per schema; we still guard against empty
    // strings so the fallback ('—') wins for unset names.
    void supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', [...allIds])
      .then(({ data }) => {
        if (cancelled || !data) return
        const m = new Map<string, string>()
        for (const row of data as Array<{ id: string; display_name: string | null }>) {
          const name = row.display_name?.trim()
          if (name) m.set(row.id, name)
        }
        setUserNames(m)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, current])

  const loading = coverageLoading || controlsLookup.loading || !isCurrent

  const data = useMemo<IkData>(() => {
    if (!current) {
      return buildData({
        coverage,
        registerRows: [],
        clauseRows: [],
        controlRows: [],
        junctions: [],
        statusRows: [],
        executionRows: [],
        planRows: [],
        bridgeTasks: [],
        projects: [],
        userNames,
        countByLawRef: controlsLookup.countByLawRef,
      })
    }
    return buildData({
      coverage,
      registerRows: current.registerRows,
      clauseRows: current.clauseRows,
      controlRows: current.controlRows,
      junctions: current.junctions,
      statusRows: current.statusRows,
      executionRows: current.executionRows,
      planRows: current.planRows,
      bridgeTasks: current.bridgeTasks,
      projects: current.projects,
      userNames,
      countByLawRef: controlsLookup.countByLawRef,
    })
  }, [coverage, current, userNames, controlsLookup.countByLawRef])

  // Build the bridge map at the hook level too (the same way buildData
  // does internally) so callers can attach bridge info to tiltak they
  // derive from sources other than `current.planRows`.
  const bridgesByPlanId = useMemo(() => {
    const m = new Map<string, BridgeTaskInfo>()
    const rows = current?.bridgeTasks ?? []
    for (const b of rows) {
      if (!b.source_id) continue
      m.set(b.source_id, {
        status: (b.status as BridgeTaskStatus) ?? 'open',
        assigneeName:
          b.assignee_name ??
          (b.assignee_user_id ? userNames.get(b.assignee_user_id) ?? null : null),
        slaDueAt: b.sla_due_at,
      })
    }
    return m
  }, [current, userNames])

  return { data, loading, bridgesByPlanId }
}

function buildData(input: {
  coverage: CoverageMap
  registerRows: RegisterRow[]
  clauseRows: ClauseRow[]
  controlRows: ControlRow[]
  junctions: JunctionRow[]
  statusRows: StatusRow[]
  executionRows: ExecutionRow[]
  planRows: PlanItemRow[]
  bridgeTasks: BridgeTaskRow[]
  projects: ProjectRow[]
  userNames: Map<string, string>
  countByLawRef: Map<string, number>
}): IkData {
  const {
    coverage,
    registerRows,
    clauseRows,
    controlRows,
    junctions,
    statusRows,
    executionRows,
    planRows,
    bridgeTasks,
    projects,
    userNames,
    countByLawRef,
  } = input

  // Bridge-task lookup keyed by source plan-item id. Partial unique
  // index guarantees 1:1, so a Map is safe; even if a duplicate slipped
  // past the constraint the last writer wins which is the freshest
  // signal anyway.
  const bridgesByPlanId = new Map<string, BridgeTaskInfo>()
  for (const b of bridgeTasks) {
    if (!b.source_id) continue
    bridgesByPlanId.set(b.source_id, {
      status: (b.status as BridgeTaskStatus) ?? 'open',
      assigneeName: b.assignee_name ?? (b.assignee_user_id ? userNames.get(b.assignee_user_id) ?? null : null),
      slaDueAt: b.sla_due_at,
    })
  }

  // clause id ↔ code map.
  const codeByClauseId = new Map<string, string>()
  for (const c of clauseRows) codeByClauseId.set(c.id, normalizeLawRef(c.code))
  const clauseIdsByCode = new Map<string, string[]>()
  for (const c of clauseRows) {
    const key = normalizeLawRef(c.code)
    const arr = clauseIdsByCode.get(key) ?? []
    arr.push(c.id)
    clauseIdsByCode.set(key, arr)
  }

  const controlsById = new Map<string, ControlRow>()
  for (const c of controlRows) controlsById.set(c.id, c)
  const statusByControlId = new Map<string, StatusRow>()
  for (const s of statusRows) statusByControlId.set(s.control_id, s)
  const cluasesByControl = new Map<string, string[]>() // control_id → paragraph codes
  for (const j of junctions) {
    const code = codeByClauseId.get(j.clause_id)
    if (!code) continue
    const arr = cluasesByControl.get(j.control_id) ?? []
    arr.push(code)
    cluasesByControl.set(j.control_id, arr)
  }
  const controlsByCode = new Map<string, string[]>() // code → control ids
  for (const j of junctions) {
    const code = codeByClauseId.get(j.clause_id)
    if (!code) continue
    const arr = controlsByCode.get(code) ?? []
    arr.push(j.control_id)
    controlsByCode.set(code, arr)
  }

  // ── Frameworks (running totals across krav) ────────────────────────────
  const frameworkSummaries: Record<FrameworkId, IkFramework> = Object.fromEntries(
    FRAMEWORK_IDS.map((id) => {
      const def = FRAMEWORKS[id]
      return [
        id,
        {
          id,
          short: def.shortLabel,
          name: def.fullLabel,
          color: FW_META[id].color,
          icon: FW_META[id].icon,
          mandatory: FW_META[id].mandatory,
          reqs: def.paragraphs.length,
          covered: 0,
          partial: 0,
          gap: 0,
        } satisfies IkFramework,
      ]
    }),
  ) as Record<FrameworkId, IkFramework>

  // ── Krav (per paragraph) ───────────────────────────────────────────────
  const krav: IkKrav[] = []
  for (const id of FRAMEWORK_IDS) {
    const def = FRAMEWORKS[id]
    for (const p of def.paragraphs) {
      const norm = normalizeLawRef(p.code)
      const entries = dedupe(coverage.get(norm) ?? [])
      const ctrlIds = controlsByCode.get(norm) ?? []
      const ctrlCount = countByLawRef.get(norm) ?? 0
      const registerCovered =
        id === 'aml' &&
        registerRows.some((r) => (r.aml_paragraphs ?? []).includes(p.code))
      const hasModuleEvidence = entries.length > 0
      const hasAnyControl = ctrlCount > 0

      // Status:
      //   - 'covered' when at least one of: an active control with a
      //     non-stale last-execution, ≥1 module evidence row.
      //   - 'partial' when there's evidence/control but no recent
      //     run (stale or never_executed) OR draft control.
      //   - 'gap' when nothing.
      let status: IkKravStatus = 'gap'
      let gapNote: string | undefined
      let lastRun: string | null = null
      let nextRun: string | null = null
      let ownerName: string | null = null
      let staleSomewhere = false
      let activeAnywhere = false
      for (const cid of ctrlIds) {
        const c = controlsById.get(cid)
        if (!c || !c.is_active || c.status === 'retired') continue
        const sv = statusByControlId.get(cid)
        if (!ownerName && c.owner_user_id) {
          ownerName = userNames.get(c.owner_user_id) ?? null
        }
        if (sv?.last_occurred_at) {
          if (!lastRun || sv.last_occurred_at > lastRun) lastRun = sv.last_occurred_at
        }
        if (sv?.next_due_at) {
          if (!nextRun || sv.next_due_at < nextRun) nextRun = sv.next_due_at
        }
        if (sv?.status_label === 'on_track' || sv?.status_label === 'due_soon') {
          activeAnywhere = true
        } else if (
          sv?.status_label === 'overdue' ||
          sv?.status_label === 'never_executed' ||
          c.status === 'draft'
        ) {
          staleSomewhere = true
        }
      }

      if (activeAnywhere || hasModuleEvidence || registerCovered) {
        status = staleSomewhere && !activeAnywhere ? 'partial' : 'covered'
        if (status === 'partial')
          gapNote = 'Kontroll registrert, men sist gjennomføring er forsinket eller mangler.'
      } else if (hasAnyControl) {
        status = 'partial'
        gapNote = 'Kontroll definert, men ingen gjennomføring registrert ennå.'
      } else {
        status = 'gap'
        gapNote = 'Ingen kontroller, maler eller publiserte ressurser dekker dette kravet.'
      }

      // Criticality heuristic — base on chapter context. AML §§ 3-x,
      // 4-x and 7-x are high-stakes; § 18-x (tilsyn) is høy too;
      // GDPR Art. 5/6/30/32/33/35/37 are høy. Tweakable per row by
      // org-admin in a follow-up release.
      let criticality: IkCriticality = 'middels'
      const high =
        /\b§\s?(3|4|5|6|7|18)\b/.test(p.code) ||
        /\b(Art\.\s?(5|6|9|13|14|24|28|30|32|33|34|35|37|44))\b/.test(p.code) ||
        /\b§\s?(8|10\.2)\b/.test(p.code)
      if (high) criticality = 'høy'
      if (/\bArt\.\s?(7|17|34)\b/.test(p.code) || /\b§\s?(13|16)\b/.test(p.code))
        criticality = 'middels'

      const evidence: CoverageEntry[] = entries
      krav.push({
        id: `k-${id}-${p.code}`,
        fw: id,
        ref: p.code,
        chapter: p.chapter,
        title: p.title ?? p.code,
        status,
        criticality,
        category: categorizeLawRef(p.code),
        controls: ctrlIds,
        evidence,
        registerCovered,
        owner: ownerName ?? '—',
        reviewed: formatDate(lastRun),
        nextReview: formatDate(nextRun),
        gap: status === 'covered' ? undefined : gapNote,
      })

      const sum = frameworkSummaries[id]
      if (status === 'covered') sum.covered += 1
      else if (status === 'partial') sum.partial += 1
      else if (status === 'gap') sum.gap += 1
    }
  }

  const frameworks = FRAMEWORK_IDS.map((id) => frameworkSummaries[id])

  // ── Kontroller ────────────────────────────────────────────────────────
  const kontroller: IkKontroll[] = controlRows.map((c) => {
    const sv = statusByControlId.get(c.id)
    const covers = cluasesByControl.get(c.id) ?? []
    // Distinct functional categories across all covered paragraphs —
    // a kontroll that satisfies AML §3-1 + GDPR Art.32 belongs to both
    // 'hms-arbeid' and 'personvern'.
    const categories: IkCategoryId[] = [...new Set(covers.map(categorizeLawRef))]
    const owner = c.owner_user_id ? userNames.get(c.owner_user_id) ?? c.owner_role ?? '—' : c.owner_role ?? '—'
    // Effectiveness scoring (1..5) from status + execution history.
    let effectiveness = 3
    if (sv?.status_label === 'on_track') effectiveness = 5
    else if (sv?.status_label === 'due_soon') effectiveness = 4
    else if (sv?.status_label === 'overdue') effectiveness = 2
    else if (sv?.status_label === 'never_executed') effectiveness = 1
    else if (sv?.status_label === 'retired') effectiveness = 0
    return {
      id: c.id,
      slug: c.slug,
      title: c.name,
      type: FAMILY_TO_TYPE[c.control_family],
      frequency: c.frequency_hint,
      frequencyLabel: c.frequency_hint ? FREQUENCY_LABELS[c.frequency_hint] : 'Ad hoc',
      evidence: c.purpose ? 'dokument' : 'sjekkliste',
      owner,
      ownerRole: c.owner_role,
      status: c.is_active ? CONTROL_STATUS_MAP[c.status] : 'utgått',
      effectiveness,
      lastRun: formatDate(sv?.last_occurred_at ?? null),
      nextRun: formatDate(sv?.next_due_at ?? null),
      covers,
      categories,
      statusLabel: sv?.status_label ?? null,
      totalExecutions: sv?.total_executions ?? 0,
    }
  })

  // ── Årshjul ────────────────────────────────────────────────────────────
  const aarshjul: IkAarshjulEvent[] = []
  // Past executions go in as 'done'.
  for (const e of executionRows) {
    const c = controlsById.get(e.control_id)
    if (!c) continue
    const codes = cluasesByControl.get(e.control_id) ?? []
    const fws = new Set<FrameworkId>(codes.map((code) => frameworkFromLawRef(code)))
    aarshjul.push({
      id: `e-${e.id}`,
      year: yearNumber(e.occurred_at),
      month: monthNumber(e.occurred_at),
      date: dayLabel(e.occurred_at),
      title: e.summary || c.name,
      fw: [...fws],
      owner: c.owner_user_id ? userNames.get(c.owner_user_id) ?? c.owner_role ?? '—' : c.owner_role ?? '—',
      status: 'done',
      controlId: c.id,
    })
  }
  // Planned next runs.
  for (const sv of statusRows) {
    if (!sv.next_due_at) continue
    const c = controlsById.get(sv.control_id)
    if (!c || !c.is_active || c.status === 'retired') continue
    const codes = cluasesByControl.get(sv.control_id) ?? []
    const fws = new Set<FrameworkId>(codes.map((code) => frameworkFromLawRef(code)))
    aarshjul.push({
      id: `p-${sv.control_id}-${sv.next_due_at}`,
      year: yearNumber(sv.next_due_at),
      month: monthNumber(sv.next_due_at),
      date: dayLabel(sv.next_due_at),
      title: c.name,
      fw: [...fws],
      owner: c.owner_user_id ? userNames.get(c.owner_user_id) ?? c.owner_role ?? '—' : c.owner_role ?? '—',
      status: 'planned',
      controlId: c.id,
    })
  }
  // Stable order: by (year, month) ascending so the year-wheel section
  // can slice contiguous current-year events.
  aarshjul.sort((a, b) => a.year - b.year || a.month - b.month)

  // ── Tiltak ────────────────────────────────────────────────────────────
  const tiltak: IkTiltak[] = planRows.map((p) => {
    const mapped = mapPlanStatus(p.status, p.due_at)
    // Progress derived from status: planned=0, in_progress=0.5, blocked=0.4, done=1.
    const progress =
      p.status === 'done' ? 1 : p.status === 'in_progress' ? 0.5 : p.status === 'blocked' ? 0.4 : 0.1
    const fwId = (FRAMEWORK_IDS as readonly string[]).includes(p.framework_id)
      ? (p.framework_id as FrameworkId)
      : frameworkFromLawRef(p.law_ref)
    const bridge = bridgesByPlanId.get(p.id) ?? null
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      krav: [`k-${fwId}-${p.law_ref}`],
      fw: fwId,
      category: categorizeLawRef(p.law_ref),
      owner: p.owner_user_id ? userNames.get(p.owner_user_id) ?? '—' : '—',
      priority: mapped.priority,
      status: mapped.status,
      deadline: formatDate(p.due_at),
      progress,
      project: p.milestone ?? null,
      taskId: p.task_id,
      rawStatus: p.status,
      dueAt: p.due_at,
      bridgeStatus: bridge?.status ?? null,
      bridgeAssignee: bridge?.assigneeName ?? null,
      bridgeSlaDueAt: bridge?.slaDueAt ?? null,
    }
  })

  // ── Prosjekter — Phase 2: task_projects is the persistent source ─────
  // Three lanes feed the section:
  //   1. Every task_projects row, with its plan-items resolved through
  //      compliance_plan_items.project_id (the new FK column).
  //   2. Plan-items whose `milestone` text matches a project title —
  //      preserves legacy ad-hoc grouping without forcing a back-fill.
  //   3. Plan-items with neither project_id nor a matching milestone
  //      that DO have a milestone string get a synthesised pseudo-
  //      project keyed `legacy:<milestone>` so users on old data still
  //      see their groupings. Pseudo-projects are flagged via an
  //      `isLegacy` marker the section reads to dim the chrome and
  //      surface a "Konverter til prosjekt" CTA.
  const prosjekter: IkProsjekt[] = (() => {
    const projectsById = new Map<string, ProjectRow>()
    const projectsByTitle = new Map<string, ProjectRow>()
    for (const p of projects) {
      projectsById.set(p.id, p)
      projectsByTitle.set(p.title.trim().toLowerCase(), p)
    }

    type Group = { rows: PlanItemRow[]; project: ProjectRow | null; milestoneFallback: string | null }
    const groups = new Map<string, Group>()
    for (const pi of planRows) {
      let key: string | null = null
      let project: ProjectRow | null = null
      let milestoneFallback: string | null = null
      if (pi.project_id && projectsById.has(pi.project_id)) {
        key = `proj:${pi.project_id}`
        project = projectsById.get(pi.project_id) ?? null
      } else if (pi.milestone) {
        const ms = pi.milestone.trim()
        if (ms) {
          const matched = projectsByTitle.get(ms.toLowerCase())
          if (matched) {
            key = `proj:${matched.id}`
            project = matched
          } else {
            key = `legacy:${ms}`
            milestoneFallback = ms
          }
        }
      }
      if (!key) continue
      const g = groups.get(key) ?? { rows: [], project, milestoneFallback }
      g.rows.push(pi)
      groups.set(key, g)
    }

    // Empty-but-still-real projects (no plan-items attached yet) get a
    // card too so the user sees the project exists.
    for (const p of projects) {
      const key = `proj:${p.id}`
      if (!groups.has(key)) groups.set(key, { rows: [], project: p, milestoneFallback: null })
    }

    const out: IkProsjekt[] = []
    for (const [key, g] of groups.entries()) {
      const { rows, project, milestoneFallback } = g
      const done = rows.filter((r) => r.status === 'done').length
      const totalKrav = new Set(rows.map((r) => r.law_ref)).size
      const coveredKrav = new Set(
        rows.filter((r) => r.status === 'done').map((r) => r.law_ref),
      ).size
      const openTasks = rows.filter((r) => r.status !== 'done').length
      const earliest = rows
        .map((r) => r.due_at)
        .filter((d): d is string => !!d)
        .sort()[0]
      const latest = rows
        .map((r) => r.due_at)
        .filter((d): d is string => !!d)
        .sort()
        .pop()

      const name = project?.title ?? milestoneFallback ?? '—'
      const leaderId = project?.lead_user_id ?? rows.find((r) => r.owner_user_id)?.owner_user_id ?? null
      const leader = leaderId ? userNames.get(leaderId) ?? '—' : '—'
      const projectDeadline = project?.end_date ?? latest ?? null
      const projectStart = project?.start_date ?? rows[0]?.created_at ?? null
      const methodologyLabel = project?.methodology === 'kanban' ? 'Kanban' : 'PDCA'

      const milestones: IkProsjektMilestone[] = [
        {
          label: 'Oppstart',
          date: formatDate(projectStart ?? null),
          done: true,
        },
        {
          label: 'Tiltak igangsatt',
          date: formatDate(earliest ?? null),
          done: rows.some((r) => r.status !== 'planned'),
          current: rows.some((r) => r.status === 'in_progress'),
        },
        {
          label: 'Tiltak fullført',
          date: formatDate(projectDeadline ?? null),
          done: rows.length > 0 && done === rows.length,
        },
      ]

      out.push({
        id: project ? `proj-${project.id}` : `legacy-${milestoneFallback ?? key}`,
        name,
        leader,
        status: project?.status ?? (rows.length > 0 && done === rows.length ? 'fullført' : 'pågår'),
        phase: project
          ? methodologyLabel
          : rows.length > 0 && done === rows.length
            ? 'Avsluttet'
            : openTasks > rows.length / 2
              ? 'Planlegging'
              : 'Pågår',
        progress: rows.length === 0 ? 0 : done / rows.length,
        deadline: formatDate(projectDeadline ?? null),
        budget: 'kr 0',
        spent: 'kr 0',
        description:
          project?.description ||
          (milestoneFallback
            ? `${rows.length} tiltak gruppert under fritekst-milepælen «${milestoneFallback}». Konverter til et task_projects-prosjekt for fullt prosjektkort.`
            : `${rows.length} tiltak.`),
        tasks: rows.length,
        openTasks,
        krav: totalKrav,
        krav_covered: coveredKrav,
        milestones,
        tiltakIds: rows.map((r) => r.id),
        kravCodes: [...new Set(rows.map((r) => r.law_ref))],
        // Phase-2 additions on the view model so the renderer can
        // expose the canonical project link + methodology badge.
        projectId: project?.id ?? null,
        methodology: project?.methodology === 'kanban' ? 'kanban' : project ? 'pdca' : null,
        isLegacy: !project,
      })
    }
    return out.sort((a, b) => Number(a.isLegacy) - Number(b.isLegacy) || a.name.localeCompare(b.name, 'nb'))
  })()

  // ── Revisjon-logg (most recent first) ────────────────────────────────
  const audit: IkAuditEntry[] = []
  const formatWhen = (iso: string): string =>
    new Date(iso).toLocaleString('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  for (const e of executionRows.slice(0, 60)) {
    const c = controlsById.get(e.control_id)
    audit.push({
      whenIso: e.occurred_at,
      when: formatWhen(e.occurred_at),
      who: e.signed_by ? userNames.get(e.signed_by) ?? 'System' : 'System',
      action: 'registrerte gjennomføring',
      detail: c
        ? `${c.name}${e.summary ? ' — ' + e.summary : ''}${e.period_label ? ' (' + e.period_label + ')' : ''}`
        : (e.summary ?? ''),
    })
  }
  for (const p of planRows.slice(0, 40)) {
    audit.push({
      whenIso: p.updated_at,
      when: formatWhen(p.updated_at),
      who: p.owner_user_id ? userNames.get(p.owner_user_id) ?? 'System' : 'System',
      action:
        p.status === 'done'
          ? 'lukket tiltak'
          : p.status === 'in_progress'
          ? 'startet tiltak'
          : p.status === 'blocked'
          ? 'blokkerte tiltak'
          : 'opprettet tiltak',
      detail: `${p.law_ref} — ${p.title}`,
    })
  }
  // Sort newest-first by ISO timestamp (not the human-readable string —
  // "01.06.2026" sorts BEFORE "25.05.2026" lexicographically, but actually
  // comes after it in calendar order).
  audit.sort((a, b) => b.whenIso.localeCompare(a.whenIso))

  // ── Stats roll-up ────────────────────────────────────────────────────
  const stats: IkStats = {
    total: krav.length,
    covered: krav.filter((k) => k.status === 'covered').length,
    partial: krav.filter((k) => k.status === 'partial').length,
    gaps: krav.filter((k) => k.status === 'gap').length,
    na: krav.filter((k) => k.status === 'na').length,
    overdue: tiltak.filter((t) => t.status === 'forsinket').length,
    activeKontroller: kontroller.filter((c) => c.status === 'aktiv').length,
    upcoming: aarshjul.filter((a) => a.status === 'planned').length,
  }

  return {
    frameworks,
    krav,
    kontroller,
    aarshjul,
    monthNames: MONTH_NAMES,
    tiltak,
    prosjekter,
    audit,
    stats,
  }
}

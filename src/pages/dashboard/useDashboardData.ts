// useDashboardData — sentralt data-hook som henter alt /dashboard-widgets
// trenger for å rendre 19 forskjellige dashboards.
//
// Strategi: én Supabase-fetch på mount, deler resultatet via et
// React-context-objekt slik at hver widget-komponent får memo'd data
// uten å re-fetche. Hvis brukeren har en aktiv cadence-plan brukes
// snapshot fra cadence_plan_* — ellers faller vi tilbake på live
// task_items + internal_controls slik at dashboards har innhold uten
// at en cadence-plan er iverksatt.
//
// Sikkerhet: alle queries er RLS-gated på organization_id, så hver
// bruker ser kun sin egen organisasjons data.

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

// ── Data types ──────────────────────────────────────────────────────────────

export type DashboardTaskRow = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  pack: string
  source_type: string | null
  source_id: string | null
  source_category: string
  pdca_phase: string
  template_slug: string | null
  template_kind: string | null
  law_refs: string[]
  due_date: string | null
  assignee_user_id: string | null
  assignee_name: string | null
  owner_user_id: string | null
  owner_name: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export type DashboardControlRow = {
  id: string
  slug: string
  name: string
  purpose: string | null
  control_family: string
  frequency_hint: string | null
  owner_role: string | null
  owner_user_id: string | null
  status: string
  is_active: boolean
  created_at: string
}

export type DashboardMeetingRow = {
  id: string
  title: string
  meeting_type: string | null
  starts_at: string | null
  ends_at: string | null
  status: string | null
  agenda_count?: number
}

export type DashboardPlanRow = {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  regelverk: string[]
  pack: string
  snapshot_headcount: number | null
  snapshot_nace: string | null
  activated_at: string | null
  created_at: string
}

export type DashboardPlanModuleRow = {
  module_id: string
  name: string
  group_label: string | null
  tier: 'required' | 'recommended' | 'optional'
  law_refs: string[]
  volume: number
  frequency: string | null
  cadence_hint: string | null
  description: string | null
}

export type DashboardPlanRoleRow = {
  role_key: string
  role_label: string
  law_ref: string | null
  person_user_id: string | null
  person_name: string | null
  fallback_user_id: string | null
  fallback_name: string | null
  is_mandatory: boolean
  note: string | null
}

export type DashboardApprovalRow = {
  chain_code: string
  chain_label: string
  step_order: number
  step_title: string
  step_meta: string | null
  step_kind: 'utforer' | 'qa' | 'sluttsignering' | 'kollegialt' | 'informeres'
  sla_days: number | null
}

export type DashboardEscalationRow = {
  ladder_code: string
  ladder_label: string
  step_order: number
  relative_day: number
  trigger_label: string
  trigger_note: string | null
  action_label: string
  action_note: string | null
  severity: 'mild' | 'standard' | 'streng' | 'kritisk' | 'stille'
}

export type DashboardAuditRow = {
  id: string
  changed_at: string
  action: string
  table_name: string
  record_id: string | null
  changed_by: string | null
  /** Display navn — fylles fra profiles-tabellen i hook'en. */
  changed_by_name: string | null
  new_data: Record<string, unknown> | null
}

export type DashboardProfileRow = {
  id: string
  display_name: string
}

/** Hver enkelt-spørring kan nå ha truffet limit-en. Når truncated=true bør
 *  widgets vise et lite varsel («Viser første 400 oppgaver — gå til /tasks
 *  for full liste») i stedet for å late som tallene er komplette. */
export type DashboardLimits = {
  tasksTruncated: boolean
  controlsTruncated: boolean
  meetingsTruncated: boolean
  auditTruncated: boolean
  profilesTruncated: boolean
}

export const DASHBOARD_LIMITS = {
  tasks: 400,
  controls: 200,
  meetings: 60,
  audit: 40,
  profiles: 500,
} as const

export type DashboardData = {
  /** True under første last (sentral spinner). */
  loading: boolean
  /** True under realtime-trigget bakgrunnsrefetch (diskret indikator). */
  refreshing: boolean
  error: string | null
  plan: DashboardPlanRow | null
  modules: DashboardPlanModuleRow[]
  roles: DashboardPlanRoleRow[]
  approvals: DashboardApprovalRow[]
  escalations: DashboardEscalationRow[]
  tasks: DashboardTaskRow[]
  controls: DashboardControlRow[]
  meetings: DashboardMeetingRow[]
  audit: DashboardAuditRow[]
  profiles: Map<string, string> // user_id → display_name
  limits: DashboardLimits
  reload: () => Promise<void>
}

// ── Default escalation/approval bundles (matches our HTML cadence) ──────────
// Brukes når det ikke finnes en cadence-plan ennå, slik at widgets har
// noe meningsfullt å vise.

const DEFAULT_APPROVALS: DashboardApprovalRow[] = [
  { chain_code: 'G01', chain_label: 'Vernerunderapporter', step_order: 1, step_title: 'Verneombud utfører og signerer', step_meta: 'Verneombud · ved fravær: fallback (24 t)', step_kind: 'utforer', sla_days: null },
  { chain_code: 'G01', chain_label: 'Vernerunderapporter', step_order: 2, step_title: 'HMS-ansvarlig kvalitetssikrer', step_meta: 'HMS-ansvarlig · 3 dagers SLA', step_kind: 'qa', sla_days: 3 },
  { chain_code: 'G01', chain_label: 'Vernerunderapporter', step_order: 3, step_title: 'Daglig leder signerer', step_meta: 'Daglig leder · 7 dagers SLA', step_kind: 'sluttsignering', sla_days: 7 },
  { chain_code: 'G02', chain_label: 'AMU-protokoller', step_order: 1, step_title: 'HVO utarbeider utkast', step_meta: 'HVO · innen 5 dager', step_kind: 'utforer', sla_days: 5 },
  { chain_code: 'G02', chain_label: 'AMU-protokoller', step_order: 2, step_title: 'AMU godkjenner kollegialt', step_meta: 'Krever 3 av 5 stemmer', step_kind: 'kollegialt', sla_days: null },
  { chain_code: 'G02', chain_label: 'AMU-protokoller', step_order: 3, step_title: 'Daglig leder mottar', step_meta: 'Informeres · ingen vedtaksrett', step_kind: 'informeres', sla_days: null },
  { chain_code: 'G03', chain_label: 'Årsrapport AMU → styret', step_order: 1, step_title: 'HMS-ansvarlig utarbeider', step_meta: 'Senest 15. november', step_kind: 'utforer', sla_days: null },
  { chain_code: 'G03', chain_label: 'Årsrapport AMU → styret', step_order: 2, step_title: 'HVO kommenterer', step_meta: '5 dagers SLA', step_kind: 'qa', sla_days: 5 },
  { chain_code: 'G03', chain_label: 'Årsrapport AMU → styret', step_order: 3, step_title: 'AMU vedtar', step_meta: 'Møte i desember', step_kind: 'kollegialt', sla_days: null },
  { chain_code: 'G03', chain_label: 'Årsrapport AMU → styret', step_order: 4, step_title: 'Daglig leder signerer', step_meta: 'Innen 31. desember', step_kind: 'sluttsignering', sla_days: null },
]

const DEFAULT_ESCALATIONS: DashboardEscalationRow[] = [
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 1, relative_day: -14, trigger_label: 'Første påminnelse til oppgaveeier', trigger_note: 'Mild · ingen kopi til andre', action_label: 'E-post + push-varsel', action_note: '«Frist nærmer seg»', severity: 'mild' },
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 2, relative_day: -7, trigger_label: 'Andre påminnelse + kopi til linjeleder', trigger_note: 'Mild · linjeleder informeres', action_label: 'E-post + Slack-DM', action_note: '«1 uke igjen»', severity: 'mild' },
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 3, relative_day: -1, trigger_label: 'Siste påminnelse', trigger_note: 'Standard · HMS-ansvarlig informeres', action_label: 'E-post + Slack-DM + SMS', action_note: '«Frist i morgen»', severity: 'standard' },
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 4, relative_day: 0, trigger_label: 'Frist passert — fallback aktiveres', trigger_note: 'Streng · fallback-kjeden tar over', action_label: 'Oppgave reassignet automatisk', action_note: 'Original eier varslet', severity: 'streng' },
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 5, relative_day: 3, trigger_label: 'Varsel til daglig leder', trigger_note: 'Streng · compliance-risiko', action_label: 'E-post med full kontekst', action_note: 'Lovreferanse inkludert', severity: 'streng' },
  { ladder_code: 'E01', ladder_label: 'Standard for lovbestemte oppgaver', step_order: 6, relative_day: 14, trigger_label: 'Styrevarsel + AMU-orientering', trigger_note: 'Kritisk · oppført i AMU-protokoll', action_label: 'Tilsynsfare flagget', action_note: 'Drøftingsmøte påkrevd', severity: 'kritisk' },
  { ladder_code: 'E02', ladder_label: 'Mild — for frivillige oppgaver', step_order: 1, relative_day: -3, trigger_label: 'Påminnelse til eier', trigger_note: 'Kun e-post', action_label: 'E-post', action_note: null, severity: 'mild' },
  { ladder_code: 'E02', ladder_label: 'Mild — for frivillige oppgaver', step_order: 2, relative_day: 0, trigger_label: 'Frist passert', trigger_note: 'Markert som forfalt', action_label: 'Logg-oppføring', action_note: null, severity: 'stille' },
]

// ── Provider + hook ─────────────────────────────────────────────────────────
//
// Pattern: DashboardDataProvider fyrer av ÉN fetch ved mount og deler
// resultatet til alle widget-komponenter via Context. Uten provideren
// ville hver widget kalt hooket og trigget 11 parallelle Supabase-spørringer
// per gjengivelse (N+1-problem).

const DashboardDataContext = createContext<DashboardData | null>(null)

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const data = useDashboardDataInternal()
  return createElement(DashboardDataContext.Provider, { value: data }, children)
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext)
  if (!ctx) {
    throw new Error('useDashboardData må kalles inne i en <DashboardDataProvider>')
  }
  return ctx
}

function useDashboardDataInternal(): DashboardData {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [plan, setPlan] = useState<DashboardPlanRow | null>(null)
  const [modules, setModules] = useState<DashboardPlanModuleRow[]>([])
  const [roles, setRoles] = useState<DashboardPlanRoleRow[]>([])
  const [approvals, setApprovals] = useState<DashboardApprovalRow[]>([])
  const [escalations, setEscalations] = useState<DashboardEscalationRow[]>([])
  const [tasks, setTasks] = useState<DashboardTaskRow[]>([])
  const [controls, setControls] = useState<DashboardControlRow[]>([])
  const [meetings, setMeetings] = useState<DashboardMeetingRow[]>([])
  const [audit, setAudit] = useState<DashboardAuditRow[]>([])
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map())
  const [limits, setLimits] = useState<DashboardLimits>({
    tasksTruncated: false,
    controlsTruncated: false,
    meetingsTruncated: false,
    auditTruncated: false,
    profilesTruncated: false,
  })
  // `loading` er sant kun under FØRSTE last; brukes til å vise det
  // sentrale spinner-skjermbildet. Realtime-trigget reload må ikke
  // blanke ut hele siden, derfor egen flagg `refreshing` for bakgrunns-
  // refetch.
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // hasLoadedOnce + requestId lever i refs, ikke state, slik at:
  //   1. `load`-callbacken får stabil identitet (ellers re-subscriber
  //      realtime-effekten på hver vellykket last).
  //   2. Samtidige load()-kall avbryter hverandre i siste-vinner-stil
  //      (ny request-id ⇒ tidligere ferdig-handler ignoreres).
  const hasLoadedOnceRef = useRef(false)
  const requestIdRef = useRef(0)

  const load = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(false)
      return
    }
    const myRequestId = ++requestIdRef.current
    const isFirst = !hasLoadedOnceRef.current
    if (isFirst) setLoading(true)
    else setRefreshing(true)
    setError(null)
    const isStale = () => requestIdRef.current !== myRequestId

    try {
      // Step 1 — finn nyeste aktive cadence-plan, faller tilbake til siste draft.
      const { data: planRows, error: planErr } = await supabase
        .from('cadence_plans')
        .select('id, name, status, regelverk, pack, snapshot_headcount, snapshot_nace, activated_at, created_at')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('activated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1)
      if (planErr) throw new Error(`Cadence-planer: ${planErr.message}`)
      const activePlan = (planRows?.[0] as DashboardPlanRow | undefined) ?? null
      setPlan(activePlan)

      // Step 2 — last plan-children hvis vi har plan.
      if (activePlan) {
        const planId = activePlan.id
        const [modRes, roleRes, appRes, escRes] = await Promise.all([
          supabase.from('cadence_plan_modules')
            .select('module_id, name, group_label, tier, law_refs, volume, frequency, cadence_hint, description')
            .eq('cadence_plan_id', planId),
          supabase.from('cadence_plan_roles')
            .select('role_key, role_label, law_ref, person_user_id, person_name, fallback_user_id, fallback_name, is_mandatory, note')
            .eq('cadence_plan_id', planId),
          supabase.from('cadence_plan_approvals')
            .select('chain_code, chain_label, step_order, step_title, step_meta, step_kind, sla_days')
            .eq('cadence_plan_id', planId)
            .order('chain_code')
            .order('step_order'),
          supabase.from('cadence_plan_escalations')
            .select('ladder_code, ladder_label, step_order, relative_day, trigger_label, trigger_note, action_label, action_note, severity')
            .eq('cadence_plan_id', planId)
            .order('ladder_code')
            .order('step_order'),
        ])
        // Respekter planens eksplisitte data — selv en bevisst tom liste
        // betyr "denne planen har ingen godkjenningskjeder/eskaleringer".
        // Bare når INGEN plan finnes faller vi tilbake på defaults (slik
        // at widgets har noe å vise før første cadence iverksettes).
        setModules((modRes.data ?? []) as DashboardPlanModuleRow[])
        setRoles((roleRes.data ?? []) as DashboardPlanRoleRow[])
        setApprovals((appRes.data ?? []) as DashboardApprovalRow[])
        setEscalations((escRes.data ?? []) as DashboardEscalationRow[])
      } else {
        setModules([])
        setRoles([])
        setApprovals(DEFAULT_APPROVALS)
        setEscalations(DEFAULT_ESCALATIONS)
      }

      // Step 3 — last task_items, internal_controls, meetings, audit.
      const [taskRes, ctlRes, mtgRes, auditRes, profRes] = await Promise.all([
        supabase.from('task_items')
          .select('id, title, description, status, priority, pack, source_type, source_id, source_category, pdca_phase, template_slug, template_kind, law_refs, due_date, assignee_user_id, assignee_name, owner_user_id, owner_name, closed_at, created_at, updated_at')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(400),
        supabase.from('internal_controls')
          .select('id, slug, name, purpose, control_family, frequency_hint, owner_role, owner_user_id, status, is_active, created_at')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('meetings')
          .select('id, title, meeting_type, starts_at, ends_at, status')
          .eq('organization_id', orgId)
          .order('starts_at', { ascending: false, nullsFirst: false })
          .limit(60),
        supabase.from('hse_audit_log')
          .select('id, changed_at, action, table_name, record_id, changed_by, new_data')
          .eq('organization_id', orgId)
          .order('changed_at', { ascending: false })
          .limit(40),
        supabase.from('profiles')
          .select('id, display_name')
          .eq('organization_id', orgId)
          .limit(500),
      ])

      // Stale-sjekk: hvis en nyere load() har startet etter at vi sendte
      // Promise.all, hopper vi ut før vi rører state. Forhindrer at en
      // gammel respons overskriver fersk data.
      if (isStale()) return

      const taskRows = (taskRes.data ?? []) as DashboardTaskRow[]
      const ctlRows = (ctlRes.data ?? []) as DashboardControlRow[]
      const mtgRows = (mtgRes.data ?? []) as DashboardMeetingRow[]
      setTasks(taskRows)
      setControls(ctlRows)
      setMeetings(mtgRows)
      const profMap = new Map<string, string>()
      const profRows = (profRes.data ?? []) as DashboardProfileRow[]
      for (const p of profRows) {
        if (p.id && p.display_name) profMap.set(p.id, p.display_name)
      }
      setProfiles(profMap)

      const auditRaw = (auditRes.data ?? []) as Array<Omit<DashboardAuditRow, 'changed_by_name'>>
      setAudit(
        auditRaw.map((row) => ({
          ...row,
          changed_by_name: row.changed_by ? (profMap.get(row.changed_by) ?? null) : null,
        })),
      )

      // Truncation-flagg: query truffet sin .limit() betyr at brukeren ser
      // delvis data. Widgets viser et lite varsel slik at det er åpenbart.
      setLimits({
        tasksTruncated: taskRows.length >= DASHBOARD_LIMITS.tasks,
        controlsTruncated: ctlRows.length >= DASHBOARD_LIMITS.controls,
        meetingsTruncated: mtgRows.length >= DASHBOARD_LIMITS.meetings,
        auditTruncated: auditRaw.length >= DASHBOARD_LIMITS.audit,
        profilesTruncated: profRows.length >= DASHBOARD_LIMITS.profiles,
      })

      if (isStale()) return // En nyere load() har overtatt — ikke skriv state.
      setLoading(false)
      setRefreshing(false)
      hasLoadedOnceRef.current = true
    } catch (e) {
      if (isStale()) return
      setError(e instanceof Error ? e.message : 'Kunne ikke laste dashboard-data')
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  // ── Realtime: re-fetch når task_items eller hse_audit_log endrer seg ────
  // i denne org-en. Vi debouncer 600ms slik at en burst av endringer (f.eks.
  // ved cadence-aktivering som genererer 20 task_items på rad) bare gir én
  // refetch. RLS sikrer at vi bare får events for vår egen org.
  const reloadDebounceRef = useRef<number | null>(null)
  const queueReload = useCallback(() => {
    if (reloadDebounceRef.current != null) {
      window.clearTimeout(reloadDebounceRef.current)
    }
    reloadDebounceRef.current = window.setTimeout(() => {
      void load()
      reloadDebounceRef.current = null
    }, 600)
  }, [load])

  useEffect(() => {
    if (!supabase || !orgId) return
    // Defense-in-depth: orgId havner i kanal-navn + filter-strenger som
    // realtime-serveren parser. Vi forventer UUID, men sjekker likevel
    // før vi sender en konstruert streng over wire. RLS er primær
    // forsvar — denne sjekken hindrer at en feiltypet ID når server.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgId)) {
      return
    }
    const channel = supabase
      .channel(`dashboard:org:${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_items', filter: `organization_id=eq.${orgId}` },
        queueReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hse_audit_log', filter: `organization_id=eq.${orgId}` },
        queueReload,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cadence_plans', filter: `organization_id=eq.${orgId}` },
        queueReload,
      )
      .subscribe()

    return () => {
      if (reloadDebounceRef.current != null) {
        window.clearTimeout(reloadDebounceRef.current)
        reloadDebounceRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [supabase, orgId, queueReload])

  return useMemo(
    () => ({
      loading,
      refreshing,
      error,
      plan,
      modules,
      roles,
      approvals,
      escalations,
      tasks,
      controls,
      meetings,
      audit,
      profiles,
      limits,
      reload: load,
    }),
    [loading, refreshing, error, plan, modules, roles, approvals, escalations, tasks, controls, meetings, audit, profiles, limits, load],
  )
}

// ── Helpers widgets share ───────────────────────────────────────────────────

/** Cadence-hint → korte måneds-posisjoner for swim-lane timeline. */
export function cadenceHintToTimeline(hint: string | null | undefined): Array<{ leftPct: number; widthPct: number; label: string }> {
  switch (hint) {
    case 'kvartalsvis':
      return [
        { leftPct: 8, widthPct: 6, label: 'Q1' },
        { leftPct: 33, widthPct: 6, label: 'Q2' },
        { leftPct: 58, widthPct: 6, label: 'Q3' },
        { leftPct: 83, widthPct: 6, label: 'Q4' },
      ]
    case 'halvarlig':
      return [
        { leftPct: 20, widthPct: 7, label: 'Vår' },
        { leftPct: 65, widthPct: 7, label: 'Høst' },
      ]
    case 'manedlig':
      return [{ leftPct: 1, widthPct: 96, label: 'Månedlig' }]
    case 'arlig':
      return [{ leftPct: 8, widthPct: 6, label: 'Årlig' }]
    case 'ad_hoc':
    default:
      return [{ leftPct: 1, widthPct: 96, label: 'Ad hoc' }]
  }
}

/** Grupper task_items etter status, mapper til 5 kanban-kolonner. */
export function groupByKanbanColumn(tasks: DashboardTaskRow[]): Record<string, DashboardTaskRow[]> {
  const out: Record<string, DashboardTaskRow[]> = {
    backlog: [],
    ready: [],
    in_progress: [],
    review: [],
    done: [],
  }
  for (const t of tasks) {
    switch (t.status) {
      case 'open':
        out.backlog.push(t); break
      case 'in_progress':
      case 'root_cause_identified':
      case 'action_defined':
      case 'action_implemented':
        out.in_progress.push(t); break
      case 'effectiveness_pending':
        out.review.push(t); break
      case 'effectiveness_verified':
      case 'closed':
        out.done.push(t); break
      case 'cancelled':
        // skip cancelled tasks from kanban
        break
      default:
        out.backlog.push(t)
    }
  }
  return out
}

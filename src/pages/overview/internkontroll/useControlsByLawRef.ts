// Compliance Layer ↔ Internkontroll bridge.
//
// Used by the internkontroll gap-matrix page to surface "which internal
// controls cover this paragraph?" inside the Paragraph Inspector. Joins
// three sources at the client because the data fits comfortably in a
// single round-trip (~30 controls × ~6 clauses average + ~30 status
// rows for a typical org):
//
//   regulation_clauses                (code → clause_id map)
//   internal_control_clauses          (clause_id → control_id, coverage_level)
//   internal_controls                 (name, slug, family, is_active)
//   internal_control_status_v         (status_label, last_occurred_at, next_due_at)
//
// Output: a `controlsByLawRef` map keyed by the exact `code` string
// (e.g. "AML § 7-2 (2) f") so the inspector can look up by the same
// string the planner already uses for plan-items and module artefacts.

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type {
  ControlCoverageLevel,
  ControlFamily,
  ControlStatus,
  ControlStatusLabel,
} from '../../../types/complianceLayer'

export type ControlCoverageSummary = {
  controlId: string
  slug: string
  name: string
  controlFamily: ControlFamily
  status: ControlStatus
  isActive: boolean
  isSystem: boolean
  coverageLevel: ControlCoverageLevel
  statusLabel: ControlStatusLabel | null
  lastOccurredAt: string | null
  nextDueAt: string | null
}

type ClauseLite = { id: string; code: string }
type JunctionLite = {
  control_id: string
  clause_id: string
  coverage_level: ControlCoverageLevel
}
type ControlLite = {
  id: string
  slug: string
  name: string
  control_family: ControlFamily
  status: ControlStatus
  is_active: boolean
  is_system: boolean
}
type StatusLite = {
  control_id: string
  status_label: ControlStatusLabel
  last_occurred_at: string | null
  next_due_at: string | null
}

export type UseControlsByLawRefReturn = {
  loading: boolean
  controlsByLawRef: Map<string, ControlCoverageSummary[]>
  /** Convenience: per-paragraph count for gap-matrix totals. */
  countByLawRef: Map<string, number>
  /** All loaded controls — small set; used for "all controls" reports. */
  allControls: ControlLite[]
}

type LoadedState = {
  orgId: string
  clauses: ClauseLite[]
  junctions: JunctionLite[]
  controls: ControlLite[]
  statuses: StatusLite[]
}

export function useControlsByLawRef(): UseControlsByLawRefReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  // Single state slot keyed by orgId. The async callback writes the
  // whole snapshot atomically, and the consumer derives "loaded for the
  // current org" by comparing orgId to loaded.orgId — so an in-flight
  // org switch never lets the lookup compute against stale rows.
  const [loaded, setLoaded] = useState<LoadedState | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    void loadAll(supabase, orgId).then((res) => {
      if (cancelled) return
      setLoaded({ orgId, ...res })
    })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  const isCurrent = loaded !== null && loaded.orgId === orgId
  const stillLoading = !isCurrent

  const lookup = useMemo(() => {
    if (!isCurrent || !loaded) {
      return {
        byLawRef: new Map<string, ControlCoverageSummary[]>(),
        countByLawRef: new Map<string, number>(),
        allControls: [] as ControlLite[],
      }
    }
    const { clauses, junctions, controls, statuses } = loaded

    const clauseIdToCode = new Map<string, string>()
    for (const c of clauses) clauseIdToCode.set(c.id, c.code)

    const controlsById = new Map<string, ControlLite>()
    for (const c of controls) controlsById.set(c.id, c)

    const statusByControlId = new Map<string, StatusLite>()
    for (const s of statuses) statusByControlId.set(s.control_id, s)

    const byLawRef = new Map<string, ControlCoverageSummary[]>()
    const countByLawRef = new Map<string, number>()
    for (const j of junctions) {
      const code = clauseIdToCode.get(j.clause_id)
      if (!code) continue
      const ctrl = controlsById.get(j.control_id)
      if (!ctrl) continue
      const sv = statusByControlId.get(j.control_id)
      const entry: ControlCoverageSummary = {
        controlId: ctrl.id,
        slug: ctrl.slug,
        name: ctrl.name,
        controlFamily: ctrl.control_family,
        status: ctrl.status,
        isActive: ctrl.is_active,
        isSystem: ctrl.is_system,
        coverageLevel: j.coverage_level,
        statusLabel: sv?.status_label ?? null,
        lastOccurredAt: sv?.last_occurred_at ?? null,
        nextDueAt: sv?.next_due_at ?? null,
      }
      // Same key as the gap-matrix codes — both sides normalise so an
      // org-custom clause with whitespace variants ("AML §4-3" vs
      // "AML § 4-3") still matches the framework paragraph definition.
      const key = normalizeLawRefKey(code)
      const list = byLawRef.get(key) ?? []
      list.push(entry)
      byLawRef.set(key, list)
      countByLawRef.set(key, list.length)
    }
    // Sort each bucket so the primary control surfaces first, then
    // status (overdue first), then name.
    const statusRank: Record<ControlStatusLabel, number> = {
      overdue: 0,
      due_soon: 1,
      never_executed: 2,
      on_track: 3,
      retired: 4,
    }
    const coverageRank: Record<ControlCoverageLevel, number> = {
      primary: 0,
      supporting: 1,
      partial: 2,
    }
    for (const list of byLawRef.values()) {
      list.sort((a, b) => {
        const cd = coverageRank[a.coverageLevel] - coverageRank[b.coverageLevel]
        if (cd !== 0) return cd
        const sd =
          (a.statusLabel ? statusRank[a.statusLabel] : 99) -
          (b.statusLabel ? statusRank[b.statusLabel] : 99)
        if (sd !== 0) return sd
        return a.name.localeCompare(b.name, 'nb')
      })
    }
    return { byLawRef, countByLawRef, allControls: controls }
  }, [isCurrent, loaded])

  return {
    loading: stillLoading,
    controlsByLawRef: lookup.byLawRef,
    countByLawRef: lookup.countByLawRef,
    allControls: lookup.allControls,
  }
}

// Mirrors the `normalizeLawRef` helper inside useInternkontrollDatasets so
// the gap-matrix and the inspector lookup key on the same canonical form.
function normalizeLawRefKey(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

async function loadAll(supabase: SupabaseClient, orgId: string) {
  const [cl, jn, ctrl, st] = await Promise.all([
    supabase
      .from('regulation_clauses')
      .select('id, code')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('is_active', true),
    supabase
      .from('internal_control_clauses')
      .select('control_id, clause_id, coverage_level')
      .eq('organization_id', orgId),
    supabase
      .from('internal_controls')
      .select('id, slug, name, control_family, status, is_active, is_system')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .neq('status', 'retired'),
    supabase
      .from('internal_control_status_v')
      .select('control_id, status_label, last_occurred_at, next_due_at')
      .eq('organization_id', orgId),
  ])
  return {
    clauses: (cl.data ?? []) as ClauseLite[],
    junctions: (jn.data ?? []) as JunctionLite[],
    controls: (ctrl.data ?? []) as ControlLite[],
    statuses: (st.data ?? []) as StatusLite[],
  }
}

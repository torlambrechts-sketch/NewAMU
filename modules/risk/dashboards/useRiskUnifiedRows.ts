// useRiskUnifiedRows — P2 view-backed source loader.
//
// Reads from `risk_register_summary_v` in one query and maps to the
// same UnifiedRiskRow[] the P1 client-side folder produces, so the
// downstream `buildRiskDatasets` (and every widget) consumes the same
// shape.
//
// Why a separate hook (not a rewrite of useRiskSourceData):
//   - Backwards compat: orgs that haven't applied the 20260913100000
//     migration would 500 on the view query. Pages can fall back to
//     useRiskSourceData + foldSourcesToRows when this hook reports an
//     error (graceful degrade — see RiskAnalysePage).
//   - The view's columns line up with UnifiedRiskRow, but the field
//     names differ (snake_case vs camelCase). One adapter function
//     here is cheaper than threading a parallel type through the rest
//     of the module.
//   - The view computes `has_open_action`, `is_psychosocial`, `band`,
//     and `is_stale` server-side from the canonical sources (joins
//     `action_plan_items` and `task_items.parent_item_id`). That's
//     the headline P2 win — the heuristics in foldSourcesToRows
//     get replaced by joined truth.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type {
  HazardCategoryId,
  RiskBand,
  SourceSeverity,
} from './hazardCategories'
import type { RiskSource, UnifiedRiskRow } from './useRiskDatasets'

type SummaryViewRow = {
  source: string
  source_id: string
  organization_id: string
  title: string
  hazard_category: string
  likelihood: number
  consequence: number
  residual_likelihood: number | null
  residual_consequence: number | null
  residual_justification: string | null
  severity_tier: string
  status_tier: string
  is_open: boolean
  has_open_action: boolean
  law_refs: string[] | null
  department_id: string | null
  location_id: string | null
  owner_user_id: string | null
  created_at: string
  last_reviewed_at: string
  closed_at: string | null
  origin_slug: string | null
  risk_score: number
  band: string
  is_red: boolean
  is_psychosocial: boolean
  is_stale: boolean
  is_red_without_action: boolean
}

const VALID_SOURCES: ReadonlySet<RiskSource> = new Set<RiskSource>([
  'checklist', 'task', 'deviation', 'inspection', 'alert', 'ros', 'sja',
])
const VALID_BANDS: ReadonlySet<RiskBand> = new Set<RiskBand>(['green', 'yellow', 'red'])
const VALID_SEVERITY: ReadonlySet<SourceSeverity> = new Set<SourceSeverity>([
  'low', 'medium', 'high', 'critical',
])

function clamp15(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1
  if (n >= 5) return 5
  return Math.round(n) as 1 | 2 | 3 | 4 | 5
}

function adapt(row: SummaryViewRow, deptLabelById: Map<string, string>): UnifiedRiskRow {
  const source: RiskSource = VALID_SOURCES.has(row.source as RiskSource)
    ? (row.source as RiskSource)
    : 'task'
  const band: RiskBand = VALID_BANDS.has(row.band as RiskBand)
    ? (row.band as RiskBand)
    : 'green'
  const severityTier: SourceSeverity = VALID_SEVERITY.has(row.severity_tier as SourceSeverity)
    ? (row.severity_tier as SourceSeverity)
    : 'medium'
  const status: UnifiedRiskRow['status'] =
    row.status_tier === 'closed' || row.status_tier === 'mitigated' || row.status_tier === 'in_progress'
      ? row.status_tier
      : 'open'

  return {
    id: `${row.source}:${row.source_id}`,
    source,
    sourceId: row.source_id,
    title: row.title,
    hazardCategory: row.hazard_category as HazardCategoryId,
    likelihood: clamp15(row.likelihood),
    consequence: clamp15(row.consequence),
    riskScore: row.risk_score,
    band,
    severityTier,
    status,
    isOpen: row.is_open,
    hasResidualJustification:
      (row.residual_justification?.trim().length ?? 0) >= 10,
    hasOpenAction: row.has_open_action,
    lawRefs: Array.isArray(row.law_refs) ? row.law_refs : [],
    isPsychosocial: row.is_psychosocial,
    departmentId: row.department_id,
    departmentLabel: row.department_id
      ? deptLabelById.get(row.department_id) ?? '(uten avdeling)'
      : '(uten avdeling)',
    ownerUserId: row.owner_user_id,
    createdAt: row.created_at,
    lastReviewedAt: row.last_reviewed_at,
    closedAt: row.closed_at,
    isRed: row.is_red,
  }
}

export type RiskUnifiedRowsState = {
  loading: boolean
  /** Non-null when the view query failed. Callers fall back to useRiskSourceData. */
  error: string | null
  rows: UnifiedRiskRow[]
  /**
   * True iff the view exists. Derived from `error` — when the view is
   * missing (migration not applied) the error message contains a
   * recognisable signature; otherwise we assume available.
   */
  viewAvailable: boolean
  reload: () => Promise<void>
}

// Heuristic — PostgREST returns these signatures when the relation
// doesn't exist. Centralised so the derivation rule has one home.
function looksLikeMissingRelation(msg: string | null): boolean {
  if (!msg) return false
  return /does not exist|PGRST205|42P01|risk_register_summary_v/i.test(msg)
}

export function useRiskUnifiedRows(): RiskUnifiedRowsState {
  const { supabase, organization, departments } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [rows, setRows] = useState<UnifiedRiskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    const deptLabelById = new Map<string, string>()
    for (const d of departments) deptLabelById.set(d.id, d.name)
    try {
      const { data, error: e } = await supabase
        .from('risk_register_summary_v')
        .select('*')
        .eq('organization_id', orgId)
        .limit(5000)
      if (e) {
        setError(e.message ?? String(e))
        setRows([])
        return
      }
      const adapted = (data as SummaryViewRow[] | null ?? [])
        .map((r) => adapt(r, deptLabelById))
      setRows(adapted)
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId, departments])

  useEffect(() => { void reload() }, [reload])

  const viewAvailable = !looksLikeMissingRelation(error)
  return { loading, error, rows, viewAvailable, reload }
}

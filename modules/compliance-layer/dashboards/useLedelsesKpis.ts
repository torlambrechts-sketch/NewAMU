// useLedelsesKpis — strategic compliance KPIs for the daglig leder.
//
// Implements ROADMAP §5.5: four top-line numbers consumed by the
// HMS-oversikt composite scope.
//
//   1. ledelses_aml_coverage      (kpi-record)
//        - aml_total: number of active AML paragraphs (per regulation_clauses)
//        - aml_covered: count with ≥1 internal_control_clauses junction
//        - aml_coverage_pct: rounded percentage
//   2. ledelses_open_palegg       (kpi-record)
//        - open_palegg: register_records of type 'aml_18_tilsynssaker'
//          whose `outcome` is one of (pålegg / tvangsmulkt / stansing /
//          varsel_pålegg / overtredelsesgebyr / pågår) AND `closure_at`
//          is null. The shape matches the live register_types schema
//          for aml_18_tilsynssaker (verified against the production DB).
//   3. ledelses_arp_status        (kpi-record)
//        - arp_last_ack_at: most recent acknowledgement of any wiki page
//          created from the `tpl-aktivitetsplikt` document template
//        - arp_days_since_ack: integer days since last ack (null when
//          never acknowledged → status_label = 'overdue' on the widget)
//   4. ledelses_paragraphs_uten_plan (kpi-record)
//        - count: AML paragraphs with 0 internal_control_clauses AND 0
//          compliance_plan_items (after normalisation of law_ref string)
//
// All four are read-only org-scoped queries. RLS on each source table
// filters per current_org_id() via the security_invoker views and the
// existing per-module policies.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../../src/lib/supabaseError'

export type LedelsesKpis = {
  aml_total: number
  aml_covered: number
  aml_coverage_pct: number
  open_palegg: number
  arp_last_ack_at: string | null
  arp_days_since_ack: number | null
  paragraphs_uten_plan: number
}

export type LedelsesDatasets = {
  ledelses_aml_coverage: Pick<
    LedelsesKpis,
    'aml_total' | 'aml_covered' | 'aml_coverage_pct'
  >
  ledelses_open_palegg: Pick<LedelsesKpis, 'open_palegg'>
  ledelses_arp_status: Pick<LedelsesKpis, 'arp_last_ack_at' | 'arp_days_since_ack'>
  ledelses_paragraphs_uten_plan: Pick<LedelsesKpis, 'paragraphs_uten_plan'>
}

export type UseLedelsesKpisReturn = {
  loading: boolean
  error: string | null
  data: LedelsesKpis
  datasets: LedelsesDatasets
}

const EMPTY: LedelsesKpis = {
  aml_total: 0,
  aml_covered: 0,
  aml_coverage_pct: 0,
  open_palegg: 0,
  arp_last_ack_at: null,
  arp_days_since_ack: null,
  paragraphs_uten_plan: 0,
}

// `outcome` values that count as "open" (not yet closed). Lifted
// verbatim from register_types.metadata_schema for aml_18_tilsynssaker.
const OPEN_PALEGG_OUTCOMES = [
  'pålegg',
  'tvangsmulkt',
  'stansing',
  'varsel_pålegg',
  'overtredelsesgebyr',
  'pågår',
]

// The ARP template slug (`tpl-aktivitetsplikt`) is referenced by the
// `compliance_layer_arp_latest_ack()` SECURITY DEFINER RPC — keep them
// in sync if either side changes.

export function useLedelsesKpis(): UseLedelsesKpisReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LedelsesKpis>(EMPTY)

  const load = useCallback(
    async (sb: SupabaseClient, oid: string) => {
      setError(null)
      try {
        // Five small parallel queries + 1 RPC. None scans more than a
        // few hundred rows on a typical org so total latency is gated
        // by RTT. The ARP latest-ack goes through a SECURITY DEFINER
        // RPC because wiki_compliance_receipts RLS only exposes a
        // viewer's own acks — without the RPC, non-admin members would
        // see a false "Aldri bekreftet" signal on HMS-oversikt.
        const [
          amlClauses,
          coveredClauseIds,
          paleggRows,
          planLawRefs,
          arpLatest,
        ] = await Promise.all([
          // 1a. All active AML clauses for this org → gives us aml_total + the
          //     set of ids we need for the "covered" + "uten plan" counts.
          sb
            .from('regulation_clauses')
            .select('id, code')
            .eq('organization_id', oid)
            .eq('regulation_id', 'aml')
            .eq('is_active', true)
            .is('deleted_at', null),
          // 1b. Distinct clause_ids touched by any control junction.
          sb
            .from('internal_control_clauses')
            .select('clause_id')
            .eq('organization_id', oid),
          // 2. Open tilsyns-/påleggs-saker.
          sb
            .from('register_records')
            .select('id, values, status')
            .eq('organization_id', oid)
            .eq('register_type_id', 'aml_18_tilsynssaker')
            .is('deleted_at', null),
          // 3. compliance_plan_items law_refs (we need just the strings).
          sb
            .from('compliance_plan_items')
            .select('law_ref')
            .eq('organization_id', oid)
            .is('deleted_at', null),
          // 4. ARP latest ack via SECURITY DEFINER RPC — see migration
          //    20260929120000_compliance_planner_review_hardening.
          sb.rpc('compliance_layer_arp_latest_ack'),
        ])

        if (amlClauses.error) throw amlClauses.error
        if (coveredClauseIds.error) throw coveredClauseIds.error
        if (paleggRows.error) throw paleggRows.error
        if (planLawRefs.error) throw planLawRefs.error
        if (arpLatest.error) throw arpLatest.error

        const clauses = (amlClauses.data ?? []) as Array<{
          id: string
          code: string
        }>
        const covered = new Set<string>(
          (coveredClauseIds.data ?? []).map(
            (r: { clause_id: string }) => r.clause_id,
          ),
        )
        const planCodes = new Set<string>(
          (planLawRefs.data ?? []).map((r: { law_ref: string }) =>
            normaliseLawRef(r.law_ref),
          ),
        )

        const aml_total = clauses.length
        const aml_covered = clauses.filter((c) => covered.has(c.id)).length
        const aml_coverage_pct =
          aml_total === 0 ? 0 : Math.round((aml_covered / aml_total) * 100)

        // §-er uten plan: AML clauses with NO control coverage AND NO
        // plan item targeting the paragraph (by normalised law_ref).
        const paragraphs_uten_plan = clauses.filter((c) => {
          if (covered.has(c.id)) return false
          if (planCodes.has(normaliseLawRef(c.code))) return false
          return true
        }).length

        const palegg = (paleggRows.data ?? []) as Array<{
          values: Record<string, unknown>
        }>
        const open_palegg = palegg.filter((r) => {
          const outcome = typeof r.values?.outcome === 'string'
            ? (r.values.outcome as string)
            : null
          const closureAt = typeof r.values?.closure_at === 'string'
            ? (r.values.closure_at as string)
            : null
          if (!outcome) return false
          if (!OPEN_PALEGG_OUTCOMES.includes(outcome)) return false
          if (closureAt) return false
          return true
        }).length

        // ARP — RPC returns a single timestamptz (or null).
        let arp_last_ack_at: string | null = null
        let arp_days_since_ack: number | null = null
        const arpRaw = arpLatest.data as string | null
        if (arpRaw) {
          arp_last_ack_at = arpRaw
          const ms = Date.now() - new Date(arpRaw).getTime()
          arp_days_since_ack = Math.floor(ms / 86_400_000)
        }

        setData({
          aml_total,
          aml_covered,
          aml_coverage_pct,
          open_palegg,
          arp_last_ack_at,
          arp_days_since_ack,
          paragraphs_uten_plan,
        })
      } catch (e) {
        setError(getSupabaseErrorMessage(e))
        setData(EMPTY)
      }
    },
    [],
  )

  useEffect(() => {
    if (!supabase || !orgId) {
      setData(EMPTY)
      setLoading(false)
      return
    }
    // Reset on org switch so the new org's chrome doesn't briefly
    // display the previous org's KPIs.
    setLoading(true)
    setData(EMPTY)
    let cancelled = false
    void load(supabase, orgId).then(() => {
      if (cancelled) return
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, load])

  const datasets = useMemo<LedelsesDatasets>(
    () => ({
      ledelses_aml_coverage: {
        aml_total: data.aml_total,
        aml_covered: data.aml_covered,
        aml_coverage_pct: data.aml_coverage_pct,
      },
      ledelses_open_palegg: {
        open_palegg: data.open_palegg,
      },
      ledelses_arp_status: {
        arp_last_ack_at: data.arp_last_ack_at,
        arp_days_since_ack: data.arp_days_since_ack,
      },
      ledelses_paragraphs_uten_plan: {
        paragraphs_uten_plan: data.paragraphs_uten_plan,
      },
    }),
    [data],
  )

  return { loading, error, data, datasets }
}

/**
 * Normalise law-ref strings so plan items typed as 'AML §4-3' match
 * clauses stored as 'AML § 4-3'. Mirrors the helper in
 * useInternkontrollDatasets.
 */
function normaliseLawRef(ref: string): string {
  return ref.replace(/\s+/g, ' ').replace(/§\s*/g, '§ ').trim()
}

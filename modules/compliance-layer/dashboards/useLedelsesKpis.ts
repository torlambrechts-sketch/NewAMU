// useLedelsesKpis — strategic compliance KPIs for the daglig leder.
//
// Implements ROADMAP §5.5: four top-line numbers consumed by the
// HMS-oversikt composite scope.
//
//   1. ledelses_aml_coverage      (kpi-record)
//        - aml_total / aml_covered / aml_coverage_pct
//   2. ledelses_open_palegg       (kpi-record)
//        - open_palegg
//   3. ledelses_arp_status        (kpi-record)
//        - arp_last_ack_at + arp_days_since_ack
//   4. ledelses_paragraphs_uten_plan (kpi-record)
//        - paragraphs_uten_plan
//
// All four come from a single SECURITY DEFINER RPC
// `compliance_layer_ledelses_kpis()` (see migration
// 20260929120100_compliance_layer_ledelses_kpis_rpc.sql). Server-side
// aggregation: no clause / control / plan-item / register-record row
// data ever ships to the browser — just the 6 scalars. This kept the
// HMS-oversikt KPI strip flat as the underlying tables grow.

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

// Both the open-pålegg outcome allow-list and the ARP template slug
// (`tpl-aktivitetsplikt`) live in the SQL of
// `compliance_layer_ledelses_kpis()` — keep the function definition
// in sync with the canonical register_types.metadata_schema.

export function useLedelsesKpis(): UseLedelsesKpisReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LedelsesKpis>(EMPTY)

  const load = useCallback(
    async (sb: SupabaseClient, signal: AbortSignal) => {
      setError(null)
      try {
        // Single SECURITY DEFINER RPC. All 6 KPIs computed server-side
        // (see migration 20260929120100_compliance_layer_ledelses_kpis_rpc).
        // Replaces the previous 5-select + 1-RPC client-side fold —
        // we no longer pull every clause / control / register record
        // / plan_item to the browser just to count them. AbortSignal
        // cancels the request when the effect tears down (rapid org
        // switch) — without it the cancelled state still fires but
        // the network keeps going.
        const { data: rpc, error: respErr } = await sb
          .rpc('compliance_layer_ledelses_kpis')
          .abortSignal(signal)
        if (respErr) throw respErr
        const payload = (rpc ?? {}) as Partial<{
          aml_total: number
          aml_covered: number
          aml_coverage_pct: number
          open_palegg: number
          arp_last_ack_at: string | null
          paragraphs_uten_plan: number
        }>

        const arpRaw = payload.arp_last_ack_at ?? null
        const arp_days_since_ack =
          arpRaw === null
            ? null
            : Math.floor((Date.now() - new Date(arpRaw).getTime()) / 86_400_000)

        setData({
          aml_total: payload.aml_total ?? 0,
          aml_covered: payload.aml_covered ?? 0,
          aml_coverage_pct: payload.aml_coverage_pct ?? 0,
          open_palegg: payload.open_palegg ?? 0,
          arp_last_ack_at: arpRaw,
          arp_days_since_ack,
          paragraphs_uten_plan: payload.paragraphs_uten_plan ?? 0,
        })
      } catch (e) {
        // AbortController is the normal teardown path for rapid org
        // switches — never surface as a UI error. Check both the
        // signal and the error name because some runtimes throw the
        // AbortError before the signal flag flips.
        if (signal.aborted) return
        if ((e as { name?: string }).name === 'AbortError') return
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
    const controller = new AbortController()
    void load(supabase, controller.signal).finally(() => {
      // Drop loading state in finally so an aborted request doesn't
      // leave the spinner stuck until the next effect run.
      if (controller.signal.aborted) return
      setLoading(false)
    })
    return () => {
      controller.abort()
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

// useSystemReport — load a single system-defined dashboard layout row.
//
// System reports are code-owned, locked-down layouts seeded via SQL
// migration (see 20260908120000_… for the schema flag and
// 20260908120001_… for the first seed). They have:
//   - is_system = true
//   - organization_id IS NULL  (org-agnostic)
//   - exactly one row per (scope_id, slug) — enforced by a partial
//     unique index.
//
// RLS lets any authenticated user SELECT system rows. There is
// intentionally no save path here — these layouts are immutable from
// the application's perspective and only change via new migrations.

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabaseErrorMessage } from '../supabaseError'
import type { ReportModule } from '../../types/reportBuilder'
import type { DashboardFilter } from './dashboardFilters'

// Loose widget shape — mirrors useDashboardLayout's schema so kind-
// specific fields (valuePath, segmentsPath, …) survive the round-trip.
const ReportModuleSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    datasetKey: z.string(),
    kind: z.enum(['kpi', 'table', 'bar', 'donut', 'line', 'heatmap', 'scorecard', 'bowtie']),
  })
  .passthrough()

const SystemReportRowSchema = z.object({
  // id is uuid in Postgres; we don't double-check the format here because
  // Zod's strict uuid validator rejects sentinel ids like
  // 00000000-0000-0000-0000-000000000001 (version nibble 0).
  id: z.string(),
  scope_id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  layout: z.array(ReportModuleSchema).default([]),
  filters: z.array(z.unknown()).default([]),
  kind: z.enum(['dashboard', 'report', 'report_template']).default('report_template'),
  is_system: z.boolean(),
  version: z.number().int(),
})

export type SystemReportRow = {
  id: string
  scopeId: string
  slug: string
  name: string
  description: string | null
  layout: ReportModule[]
  filters: DashboardFilter[]
  version: number
}

export function useSystemReport({
  supabase,
  id,
}: {
  supabase: SupabaseClient | null
  /** The system row's slug, e.g. 'regelverk-coverage-overview'. */
  id: string
}): { row: SystemReportRow | null; loading: boolean; error: string | null } {
  const [row, setRow] = useState<SystemReportRow | null>(null)
  // Loading starts true only when we're actually going to fetch — keeps
  // the no-supabase / no-id transition silent (no loading spinner).
  const [loading, setLoading] = useState<boolean>(() => Boolean(supabase && id))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !id) return
    let cancelled = false

    void (async () => {
      if (cancelled) return
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('dashboard_layouts')
        .select(
          'id, scope_id, slug, name, description, layout, filters, kind, is_system, version',
        )
        .eq('is_system', true)
        .eq('slug', id)
        .is('deleted_at', null)
        .maybeSingle()

      if (cancelled) return

      if (err) {
        setError(getSupabaseErrorMessage(err))
        setRow(null)
        setLoading(false)
        return
      }
      if (!data) {
        setError(`Fant ingen system-rapport «${id}». Seedet en migrasjon glippet?`)
        setRow(null)
        setLoading(false)
        return
      }

      const parsed = SystemReportRowSchema.safeParse(data)
      if (!parsed.success) {
        setError(`Ugyldig system-rapport «${id}»: ${parsed.error.message}`)
        setRow(null)
        setLoading(false)
        return
      }

      setRow({
        id: parsed.data.id,
        scopeId: parsed.data.scope_id,
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description,
        layout: parsed.data.layout as ReportModule[],
        filters: parsed.data.filters as DashboardFilter[],
        version: parsed.data.version,
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [supabase, id])

  return useMemo(() => ({ row, loading, error }), [row, loading, error])
}

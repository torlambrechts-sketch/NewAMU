// useAdminTemplateUsage — aggregates "how many times has this template
// been used?" across modules for the /admin/templates browser.
//
// Pragmatic scope: compliance is the only source with a single,
// queryable execution table today (`compliance_executions.template_id`).
// Survey campaigns, document pages, learning enrolments and register
// records each live in different shapes (some without a direct
// template-id foreign key); their counts are deferred until each
// module exposes a usage view. For unmapped sources we return 0 +
// `null` last-used so the UI can render "—".

import { useEffect, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'

export type AdminTemplateUsage = {
  /** Total executions / runs / records that reference this template. */
  count: number
  /** ISO timestamp of the most recent use, or null when never used. */
  lastUsedAt: string | null
}

export function useAdminTemplateUsage(): Map<string, AdminTemplateUsage> {
  const { supabase, organization } = useOrgSetupContext()
  const [byTemplateId, setByTemplateId] = useState<Map<string, AdminTemplateUsage>>(new Map())

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let cancelled = false
    void (async () => {
      // Compliance: aggregate executions by template_id. We query the
      // recent slice and reduce locally — works for orgs with up to
      // ~10k executions per template. A future view-backed aggregate
      // (`v_compliance_template_usage`) would scale further.
      const { data, error } = await supabase
        .from('compliance_executions')
        .select('template_id, completed_at, started_at')
        .order('started_at', { ascending: false })
        .limit(5000)
      if (cancelled || error) return
      const next = new Map<string, AdminTemplateUsage>()
      for (const r of (data ?? []) as { template_id: string; completed_at: string | null; started_at: string | null }[]) {
        const prev = next.get(r.template_id)
        const ts = r.completed_at ?? r.started_at
        next.set(r.template_id, {
          count: (prev?.count ?? 0) + 1,
          lastUsedAt:
            prev?.lastUsedAt && (!ts || prev.lastUsedAt > ts) ? prev.lastUsedAt : ts ?? prev?.lastUsedAt ?? null,
        })
      }
      setByTemplateId(next)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  return byTemplateId
}

// Compliance Packs — fetch the active org's licensed pack rows from
// public.compliance_packs and surface them as CompliancePack objects.
//
// "Licensed" = a row exists for this org with is_active = true. The hook
// is read-only (admin write paths land later in the admin page commit).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type {
  CompliancePack,
  PackKpiLabels,
  PackLegalReference,
  PackSeverityLabels,
} from '../../src/lib/compliance/packs'
import type { CompliancePackSlug } from './types'

type UsePacksInput = {
  supabase: SupabaseClient | null
}

export type UpdatePackInput = {
  slug: CompliancePackSlug
  shortName?: string
  pluralLabel?: string
  ctaLabel?: string
  description?: string
  legalReferences?: PackLegalReference[]
  kpiLabels?: PackKpiLabels
  severityLabels?: PackSeverityLabels
  position?: number
}

export type UsePacksReturn = {
  loading: boolean
  error: string | null
  packs: CompliancePack[]
  getPack: (slug: string | null | undefined) => CompliancePack | null
  refresh: () => Promise<void>
  updatePack: (input: UpdatePackInput) => Promise<void>
}

// ── Zod (DB row shape) ──────────────────────────────────────────────────────

const PackLegalRefSchema: z.ZodType<PackLegalReference> = z.object({
  code: z.string(),
  text: z.string(),
})

const KpiLabelsSchema: z.ZodType<PackKpiLabels> = z.object({
  open: z.string(),
  critical: z.string(),
  ytd: z.string(),
})

const SeverityLabelsSchema: z.ZodType<PackSeverityLabels> = z.object({
  critical: z.string(),
  high: z.string(),
  medium: z.string(),
  low: z.string(),
})

const CompliancePackRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  slug: z.enum(['aml-amu', 'iso-45001']),
  short_name: z.string(),
  plural_label: z.string(),
  cta_label: z.string(),
  description: z.string(),
  legal_references: z.array(PackLegalRefSchema),
  kpi_labels: KpiLabelsSchema,
  severity_labels: SeverityLabelsSchema,
  position: z.number().int(),
  is_active: z.boolean(),
})

type CompliancePackRow = z.infer<typeof CompliancePackRowSchema>

function mapRowToPack(row: CompliancePackRow): CompliancePack {
  return {
    slug: row.slug as CompliancePackSlug,
    shortName: row.short_name,
    pluralLabel: row.plural_label,
    ctaLabel: row.cta_label,
    description: row.description,
    legalReferences: row.legal_references,
    kpiLabels: row.kpi_labels,
    severityLabels: row.severity_labels,
    position: row.position,
    isActive: row.is_active,
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function usePacks(input: UsePacksInput): UsePacksReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [packs, setPacks] = useState<CompliancePack[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: respErr } = await supabase
        .from('compliance_packs')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('position', { ascending: true })
        .order('slug', { ascending: true })
      if (respErr) throw respErr

      const ok: CompliancePack[] = []
      let failed = 0
      for (const row of data ?? []) {
        const parsed = CompliancePackRowSchema.safeParse(row)
        if (parsed.success) ok.push(mapRowToPack(parsed.data))
        else failed += 1
      }
      setPacks(ok)
      if (failed > 0) {
        setError(`Kunne ikke tolke ${failed} pakkerader.`)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => {
    void load()
  }, [load])

  const getPack = useCallback(
    (slug: string | null | undefined): CompliancePack | null => {
      if (!slug) return null
      return packs.find((p) => p.slug === slug) ?? null
    },
    [packs],
  )

  const updatePack = useCallback(
    async (input: UpdatePackInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)

      const update: Record<string, unknown> = {}
      if (input.shortName !== undefined) update.short_name = input.shortName
      if (input.pluralLabel !== undefined) update.plural_label = input.pluralLabel
      if (input.ctaLabel !== undefined) update.cta_label = input.ctaLabel
      if (input.description !== undefined) update.description = input.description
      if (input.legalReferences !== undefined)
        update.legal_references = input.legalReferences
      if (input.kpiLabels !== undefined) update.kpi_labels = input.kpiLabels
      if (input.severityLabels !== undefined)
        update.severity_labels = input.severityLabels
      if (input.position !== undefined) update.position = input.position
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('compliance_packs')
          .update(update)
          .eq('organization_id', orgId)
          .eq('slug', input.slug)
          .select('*')
          .single()
        if (upErr) throw upErr

        const parsed = CompliancePackRowSchema.safeParse(data)
        if (parsed.success) {
          const next = mapRowToPack(parsed.data)
          setPacks((prev) =>
            prev.map((p) => (p.slug === next.slug ? next : p)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({ loading, error, packs, getPack, refresh: load, updatePack }),
    [loading, error, packs, getPack, load, updatePack],
  )
}

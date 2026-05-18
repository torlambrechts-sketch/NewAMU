// ISO 27001 Statement of Applicability hook.
//
// Loads all 93 Annex A controls + the org's per-control SoA entries.
// If the org has no SoA rows yet, provision_iso_27001_soa_for_org() is
// called once to seed the initial rows (all applicable, not_started).
//
// upsertSoA() handles both applicability changes and implementation status
// updates — the SoA table uses (organization_id, control_id) as its
// conflict key so it's safe to upsert repeatedly.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useOrgSetupContext } from './useOrgSetupContext'
import { getSupabaseErrorMessage } from '../lib/supabaseError'
import type { AnnexAControl, IsoSoAEntry, SoAImplementationStatus } from '../types/iso'

// ── Schemas ───────────────────────────────────────────────────────────────────

const AnnexAControlRowSchema = z.object({
  id: z.string(),
  theme: z.enum(['organizational', 'people', 'physical', 'technological']),
  control_id: z.string(),
  title: z.string(),
  description: z.string(),
  position: z.number().int(),
})

const SoARowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  control_id: z.string(),
  applicable: z.boolean(),
  exclusion_reason: z.string().nullable(),
  implementation_status: z.enum(['not_started', 'planned', 'in_progress', 'implemented']),
  responsible_id: z.string().uuid().nullable(),
  target_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

function mapControl(row: z.infer<typeof AnnexAControlRowSchema>): AnnexAControl {
  return {
    id: row.id,
    theme: row.theme,
    controlId: row.control_id,
    title: row.title,
    description: row.description,
    position: row.position,
  }
}

function mapSoA(row: z.infer<typeof SoARowSchema>): IsoSoAEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    controlId: row.control_id,
    applicable: row.applicable,
    exclusionReason: row.exclusion_reason,
    implementationStatus: row.implementation_status,
    responsibleId: row.responsible_id,
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export type SoAUpdateInput = {
  controlId: string
  applicable?: boolean
  exclusionReason?: string | null
  implementationStatus?: SoAImplementationStatus
  responsibleId?: string | null
  targetDate?: string | null
}

export type UseIsoSoAReturn = {
  loading: boolean
  error: string | null
  controls: AnnexAControl[]
  entries: IsoSoAEntry[]
  entryByControlId: Map<string, IsoSoAEntry>
  implementedCount: number
  applicableCount: number
  upsertSoA: (input: SoAUpdateInput) => Promise<void>
  refresh: () => Promise<void>
}

export function useIsoSoA(): UseIsoSoAReturn {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [controls, setControls] = useState<AnnexAControl[]>([])
  const [entries, setEntries] = useState<IsoSoAEntry[]>([])

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      // Load all 93 Annex A controls (system table, no org filter).
      const { data: controlRows, error: cErr } = await supabase
        .from('iso_27001_annex_a_controls')
        .select('*')
        .order('position', { ascending: true })
      if (cErr) throw cErr

      const parsedControls: AnnexAControl[] = []
      for (const row of controlRows ?? []) {
        const p = AnnexAControlRowSchema.safeParse(row)
        if (p.success) parsedControls.push(mapControl(p.data))
      }
      setControls(parsedControls)

      // Load org SoA entries.
      const { data: soaRows, error: sErr } = await supabase
        .from('iso_27001_soa')
        .select('*')
        .eq('organization_id', orgId)
      if (sErr) throw sErr

      // If no entries exist yet, call the provision function to seed them.
      if ((soaRows ?? []).length === 0 && parsedControls.length > 0) {
        const { error: rpcErr } = await supabase.rpc('provision_iso_27001_soa_for_org', {
          p_org_id: orgId,
        })
        if (rpcErr) throw rpcErr

        // Reload after provision.
        const { data: freshRows, error: fErr } = await supabase
          .from('iso_27001_soa')
          .select('*')
          .eq('organization_id', orgId)
        if (fErr) throw fErr

        const parsedFresh: IsoSoAEntry[] = []
        for (const row of freshRows ?? []) {
          const p = SoARowSchema.safeParse(row)
          if (p.success) parsedFresh.push(mapSoA(p.data))
        }
        setEntries(parsedFresh)
      } else {
        const parsedEntries: IsoSoAEntry[] = []
        for (const row of soaRows ?? []) {
          const p = SoARowSchema.safeParse(row)
          if (p.success) parsedEntries.push(mapSoA(p.data))
        }
        setEntries(parsedEntries)
      }
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  const entryByControlId = useMemo(
    () => new Map(entries.map((e) => [e.controlId, e])),
    [entries],
  )

  const implementedCount = useMemo(
    () => entries.filter((e) => e.implementationStatus === 'implemented').length,
    [entries],
  )

  const applicableCount = useMemo(
    () => entries.filter((e) => e.applicable).length,
    [entries],
  )

  const upsertSoA = useCallback(
    async (input: SoAUpdateInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const update: Record<string, unknown> = {
          organization_id: orgId,
          control_id: input.controlId,
        }
        if (input.applicable !== undefined) update.applicable = input.applicable
        if (input.exclusionReason !== undefined) update.exclusion_reason = input.exclusionReason
        if (input.implementationStatus !== undefined) update.implementation_status = input.implementationStatus
        if (input.responsibleId !== undefined) update.responsible_id = input.responsibleId
        if (input.targetDate !== undefined) update.target_date = input.targetDate

        const { data, error: upsertErr } = await supabase
          .from('iso_27001_soa')
          .upsert(update, { onConflict: 'organization_id,control_id' })
          .select('*')
          .single()
        if (upsertErr) throw upsertErr

        const parsed = SoARowSchema.safeParse(data)
        if (parsed.success) {
          const next = mapSoA(parsed.data)
          setEntries((prev) => {
            const idx = prev.findIndex((e) => e.controlId === input.controlId)
            return idx >= 0 ? prev.map((e, i) => (i === idx ? next : e)) : [...prev, next]
          })
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId, entryByControlId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      controls,
      entries,
      entryByControlId,
      implementedCount,
      applicableCount,
      upsertSoA,
      refresh: load,
    }),
    [loading, error, controls, entries, entryByControlId, implementedCount, applicableCount, upsertSoA, load],
  )
}

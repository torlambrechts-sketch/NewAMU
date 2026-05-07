// useRegulations — load the active regulations for the current org.
// Cat 1 of the cross-module two-level taxonomy
// (category-architecture §T1). Per-org rows so customers can extend the
// seeded baseline; `is_system = true` marks the seeded ones for admin
// UIs that want to gate edit/delete.

import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from './useOrgSetupContext'
import type { Regulation } from '../types/regulations'

type DbRegulationRow = {
  id: string
  organization_id: string
  name: string
  short_name: string
  description: string
  legal_authority: string | null
  position: number
  is_active: boolean
  is_system: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
}

function mapRow(r: DbRegulationRow): Regulation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    shortName: r.short_name,
    description: r.description,
    legalAuthority: r.legal_authority,
    position: r.position,
    isActive: r.is_active,
    isSystem: r.is_system,
    deletedAt: r.deleted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function useRegulations({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [regulations, setRegulations] = useState<Regulation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
    })
    void supabase
      .from('regulations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('position', { ascending: true })
      .order('short_name', { ascending: true })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else setRegulations(((data ?? []) as DbRegulationRow[]).map(mapRow))
        setFetchedFor(orgId)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId])

  return useMemo(
    () => ({ regulations, loading: loading || fetchedFor !== orgId, error }),
    [regulations, loading, error, fetchedFor, orgId],
  )
}

// Cross-type aggregate of register records — used by the analyse page
// (RegistersAnalysePage) and the cross-scope reporting host. Previously
// lived inline in RegistersAnalysePage; promoted here so the report
// wrapper can call it without re-exporting from a page file.

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RegisterRecord } from '../../../types/registers'

export function useAllRegisterRecords(
  supabase: SupabaseClient | null,
  orgId: string | null,
) {
  const [records, setRecords] = useState<RegisterRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !orgId) return
    if (fetchedFor === orgId) return
    let cancelled = false
    queueMicrotask(() => {
      setLoading(true)
      setError(null)
    })
    void supabase
      .from('register_records')
      .select('*')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(e.message)
        else {
          type DbRow = {
            id: string
            organization_id: string
            register_type_id: string
            values: Record<string, unknown> | null
            status: string
            review_due_at: string | null
            owner_user_id: string | null
            evidence_doc_refs: string[] | null
            created_at: string
            updated_at: string
          }
          setRecords(
            (data ?? []).map((row): RegisterRecord => {
              const r = row as DbRow
              return {
                id: r.id,
                organizationId: r.organization_id,
                registerTypeId: r.register_type_id,
                values: r.values ?? {},
                status:
                  r.status === 'draft' || r.status === 'archived' ? r.status : 'active',
                reviewDueAt: r.review_due_at,
                ownerUserId: r.owner_user_id,
                evidenceDocRefs: r.evidence_doc_refs ?? [],
                createdAt: r.created_at,
                updatedAt: r.updated_at,
              }
            }),
          )
        }
        setFetchedFor(orgId)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, orgId, fetchedFor])

  return { records, loading, error }
}

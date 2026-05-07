// Vendors — master record for leverandør-pack surveys (Decision 2C from
// GLOBAL_SURVEY_PLAN). Read + minimal CRUD; the admin UI (Commit 9) will
// surface a vendor picker that uses this hook.

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { getSupabaseErrorMessage } from '../../src/lib/supabaseError'
import type { VendorRow, VendorStatus } from './types'
import { VendorRowSchema } from './types'

type UseVendorsInput = {
  supabase: SupabaseClient | null
}

export type CreateVendorInput = {
  displayName: string
  orgNumber?: string
  primaryEmail?: string
  contactName?: string
}

export type UpdateVendorInput = {
  id: string
  displayName?: string
  orgNumber?: string | null
  primaryEmail?: string | null
  contactName?: string | null
  status?: VendorStatus
  isActive?: boolean
}

export type UseVendorsReturn = {
  loading: boolean
  error: string | null
  vendors: VendorRow[]
  refresh: () => Promise<void>
  createVendor: (input: CreateVendorInput) => Promise<string | null>
  updateVendor: (input: UpdateVendorInput) => Promise<void>
  softDeleteVendor: (id: string) => Promise<void>
}

export function useVendors(input: UseVendorsInput): UseVendorsReturn {
  const { supabase } = input
  const { organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [vendors, setVendors] = useState<VendorRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetchedFor, setFetchedFor] = useState<string | null>(null)
  const targetKey = supabase && orgId ? orgId : null

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    try {
      const { data, error: respErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .order('display_name', { ascending: true })
      if (respErr) throw respErr

      const ok: VendorRow[] = []
      let failed = 0
      for (const row of data ?? []) {
        const parsed = VendorRowSchema.safeParse(row)
        if (parsed.success) ok.push(parsed.data)
        else failed += 1
      }
      setVendors(ok)
      setFetchedFor(orgId)
      setError(failed > 0 ? `Kunne ikke tolke ${failed} leverandørrader.` : null)
    } catch (unknownError) {
      setError(getSupabaseErrorMessage(unknownError))
      setFetchedFor(orgId)
    }
  }, [supabase, orgId])

  useEffect(() => {
    if (!supabase || !orgId) return
    void load()
  }, [load, supabase, orgId])

  const loading = targetKey !== null && targetKey !== fetchedFor

  const createVendor = useCallback(
    async (input: CreateVendorInput): Promise<string | null> => {
      if (!supabase || !orgId) return null
      setError(null)
      try {
        const { data, error: insErr } = await supabase
          .from('vendors')
          .insert({
            display_name: input.displayName,
            org_number: input.orgNumber ?? null,
            primary_email: input.primaryEmail ?? null,
            contact_name: input.contactName ?? null,
            status: 'active',
            is_active: true,
          })
          .select('*')
          .single()
        if (insErr) throw insErr
        const parsed = VendorRowSchema.safeParse(data)
        if (parsed.success) {
          setVendors((prev) => {
            const next = [...prev, parsed.data]
            next.sort((a, b) => a.display_name.localeCompare(b.display_name, 'nb'))
            return next
          })
          return parsed.data.id
        }
        return null
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
        return null
      }
    },
    [supabase, orgId],
  )

  const updateVendor = useCallback(
    async (input: UpdateVendorInput): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      const update: Record<string, unknown> = {}
      if (input.displayName !== undefined) update.display_name = input.displayName
      if (input.orgNumber !== undefined) update.org_number = input.orgNumber
      if (input.primaryEmail !== undefined) update.primary_email = input.primaryEmail
      if (input.contactName !== undefined) update.contact_name = input.contactName
      if (input.status !== undefined) update.status = input.status
      if (input.isActive !== undefined) update.is_active = input.isActive
      if (Object.keys(update).length === 0) return

      try {
        const { data, error: upErr } = await supabase
          .from('vendors')
          .update(update)
          .eq('id', input.id)
          .eq('organization_id', orgId)
          .select('*')
          .single()
        if (upErr) throw upErr
        const parsed = VendorRowSchema.safeParse(data)
        if (parsed.success) {
          setVendors((prev) =>
            prev.map((v) => (v.id === input.id ? parsed.data : v)),
          )
        }
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  const softDeleteVendor = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase || !orgId) return
      setError(null)
      try {
        const { error: upErr } = await supabase
          .from('vendors')
          .update({ deleted_at: new Date().toISOString(), is_active: false })
          .eq('id', id)
          .eq('organization_id', orgId)
        if (upErr) throw upErr
        setVendors((prev) => prev.filter((v) => v.id !== id))
      } catch (unknownError) {
        setError(getSupabaseErrorMessage(unknownError))
      }
    },
    [supabase, orgId],
  )

  return useMemo(
    () => ({
      loading,
      error,
      vendors,
      refresh: load,
      createVendor,
      updateVendor,
      softDeleteVendor,
    }),
    [loading, error, vendors, load, createVendor, updateVendor, softDeleteVendor],
  )
}

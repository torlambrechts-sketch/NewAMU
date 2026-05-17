// Partner Console v0 — membership feed for the current user.
//
// Reads the rows in `partner_memberships` the caller participates in,
// resolves the partner_organizations meta, and hydrates a slim
// "customers" list (one row per (partner, customer-org)) used by the
// OrgSwitcher + PartnerConsolePage.
//
// All data is RLS-filtered so a user with no membership returns
// `isPartnerMember: false` and empty arrays.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from './useOrgSetupContext'
import type {
  PartnerCustomer,
  PartnerMembershipRow,
  PartnerOrganizationRow,
} from '../types/partner'

const ACTIVE_PARTNER_KEY = 'partner-console-active-partner-id'

function readActivePartnerFromStorage(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PARTNER_KEY)
  } catch {
    return null
  }
}

function writeActivePartnerToStorage(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_PARTNER_KEY, id)
    else localStorage.removeItem(ACTIVE_PARTNER_KEY)
  } catch {
    /* ignore */
  }
}

type CustomerOrgRow = {
  id: string
  name: string
  organization_number: string | null
  brreg_snapshot: Record<string, unknown> | null
}

function extractNace(snapshot: Record<string, unknown> | null): { code: string | null; label: string | null } {
  if (!snapshot || typeof snapshot !== 'object') return { code: null, label: null }
  const naeringskode = (snapshot as Record<string, unknown>).naeringskode1
  if (naeringskode && typeof naeringskode === 'object') {
    const obj = naeringskode as Record<string, unknown>
    const code = typeof obj.kode === 'string' ? obj.kode : null
    const label = typeof obj.beskrivelse === 'string' ? obj.beskrivelse : null
    return { code, label }
  }
  return { code: null, label: null }
}

export type UsePartnerMembershipReturn = {
  loading: boolean
  /** All partner firms the caller has at least one active membership in. */
  partners: PartnerOrganizationRow[]
  /** The "active" partner (multi-firm consortium switch). */
  currentPartner: PartnerOrganizationRow | null
  setCurrentPartnerId: (id: string | null) => void
  /** Memberships for the caller; one row per (partner, customer-org, user). */
  memberships: PartnerMembershipRow[]
  /** Customer-org list scoped to the current partner. */
  customers: PartnerCustomer[]
  /** True when the caller has at least one active partner membership. */
  isPartnerMember: boolean
  /** True when the caller has manager/admin role in the current partner. */
  isPartnerManager: boolean
  refresh: () => void
}

export function usePartnerMembership(): UsePartnerMembershipReturn {
  const { supabase, user } = useOrgSetupContext()
  const userId = user?.id ?? null

  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState<PartnerOrganizationRow[]>([])
  const [memberships, setMemberships] = useState<PartnerMembershipRow[]>([])
  const [customerOrgs, setCustomerOrgs] = useState<CustomerOrgRow[]>([])
  const [activePartnerId, setActivePartnerId] = useState<string | null>(readActivePartnerFromStorage)
  const [version, setVersion] = useState(0)

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    if (!supabase || !userId) {
      setPartners([])
      setMemberships([])
      setCustomerOrgs([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const memRes = await supabase
        .from('partner_memberships')
        .select('partner_id, organization_id, user_id, role, active, hourly_rate_override, granted_at, revoked_at')
        .eq('user_id', userId)
        .eq('active', true)
      if (cancelled) return
      if (memRes.error) {
        console.warn('partner_memberships select failed', memRes.error.message)
        setMemberships([])
        setPartners([])
        setCustomerOrgs([])
        setLoading(false)
        return
      }
      const mems = (memRes.data ?? []) as PartnerMembershipRow[]
      setMemberships(mems)

      const partnerIds = Array.from(new Set(mems.map((m) => m.partner_id)))
      const orgIds = Array.from(new Set(mems.map((m) => m.organization_id)))

      const [pRes, oRes] = await Promise.all([
        partnerIds.length
          ? supabase
              .from('partner_organizations')
              .select(
                'id, name, default_hourly_rate, billing_email, brand_accent, vat_rate, bank_account_number, payment_terms_days, created_at, updated_at',
              )
              .in('id', partnerIds)
          : Promise.resolve({ data: [], error: null }),
        orgIds.length
          ? supabase
              .from('organizations')
              .select('id, name, organization_number, brreg_snapshot')
              .in('id', orgIds)
          : Promise.resolve({ data: [], error: null }),
      ])
      if (cancelled) return
      setPartners((pRes.error ? [] : (pRes.data ?? [])) as PartnerOrganizationRow[])
      setCustomerOrgs((oRes.error ? [] : (oRes.data ?? [])) as CustomerOrgRow[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId, version])

  // Resolve the "active" partner. Default = first if storage value is stale.
  const currentPartner = useMemo<PartnerOrganizationRow | null>(() => {
    if (partners.length === 0) return null
    if (activePartnerId) {
      const match = partners.find((p) => p.id === activePartnerId)
      if (match) return match
    }
    return partners[0]
  }, [partners, activePartnerId])

  const setCurrentPartnerId = useCallback((id: string | null) => {
    setActivePartnerId(id)
    writeActivePartnerToStorage(id)
  }, [])

  const customers = useMemo<PartnerCustomer[]>(() => {
    if (!currentPartner) return []
    const orgIndex = new Map(customerOrgs.map((o) => [o.id, o]))
    return memberships
      .filter((m) => m.partner_id === currentPartner.id)
      .map((m) => {
        const o = orgIndex.get(m.organization_id)
        const { code: nace_code, label: nace_label } = extractNace(o?.brreg_snapshot ?? null)
        const rate = m.hourly_rate_override ?? currentPartner.default_hourly_rate
        return {
          partner_id: m.partner_id,
          organization_id: m.organization_id,
          organization_name: o?.name ?? '(ukjent organisasjon)',
          organization_number: o?.organization_number ?? null,
          nace_code,
          nace_label,
          role: m.role,
          hourly_rate: Number(rate),
          active: m.active,
        }
      })
      .sort((a, b) => a.organization_name.localeCompare(b.organization_name, 'nb'))
  }, [memberships, customerOrgs, currentPartner])

  const isPartnerMember = memberships.length > 0
  const isPartnerManager = useMemo(() => {
    if (!currentPartner) return false
    return memberships.some(
      (m) =>
        m.partner_id === currentPartner.id &&
        m.active &&
        (m.role === 'manager' || m.role === 'admin'),
    )
  }, [memberships, currentPartner])

  return {
    loading,
    partners,
    currentPartner,
    setCurrentPartnerId,
    memberships,
    customers,
    isPartnerMember,
    isPartnerManager,
    refresh,
  }
}

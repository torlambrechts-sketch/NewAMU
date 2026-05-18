// resolveActiveOrgId — defense-in-depth test.
//
// Locks the contract that a localStorage value only resolves to the
// customer org when the caller has at least one active
// partner_membership. A bogus localStorage value falls back to the
// caller's own profile.organization_id, so RLS is the final gate
// (this resolver is best-effort + non-authoritative).

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { resolveActiveOrgId } from './resolveActiveOrgId'

type Q = {
  from: (table: string) => Q
  select: (cols: string) => Q
  eq: (col: string, value: unknown) => Q
  limit: (n: number) => Promise<{ data: unknown; error: unknown }>
  single: () => Promise<{ data: unknown; error: unknown }>
}

function mockSupabase(opts: {
  hasActiveMembership: boolean
  profileOrgId: string | null
}) {
  return {
    from: (table: string) => {
      if (table === 'partner_memberships') {
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({
                data: opts.hasActiveMembership ? [{ id: 'mem-1' }] : [],
                error: null,
              }),
            }),
          }),
        } as unknown as Q
      }
      // profiles
      return {
        select: () => ({
          single: async () => ({
            data: opts.profileOrgId ? { organization_id: opts.profileOrgId } : null,
            error: null,
          }),
        }),
      } as unknown as Q
    },
  } as unknown as Parameters<typeof resolveActiveOrgId>[0]
}

describe('resolveActiveOrgId', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: vi.fn((k: string) => (k === 'studio-active-customer-org-id' ? 'customer-org' : null)),
      },
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when supabase is null', async () => {
    expect(await resolveActiveOrgId(null)).toBeNull()
  })

  it('returns the stored customer org when caller has an active partner_membership', async () => {
    const supa = mockSupabase({ hasActiveMembership: true, profileOrgId: 'own-org' })
    expect(await resolveActiveOrgId(supa)).toBe('customer-org')
  })

  it('falls back to own org when no active partner_membership', async () => {
    const supa = mockSupabase({ hasActiveMembership: false, profileOrgId: 'own-org' })
    expect(await resolveActiveOrgId(supa)).toBe('own-org')
  })

  it('falls back to own org when localStorage is empty', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    const supa = mockSupabase({ hasActiveMembership: true, profileOrgId: 'own-org' })
    expect(await resolveActiveOrgId(supa)).toBe('own-org')
  })

  it('returns null when profile has no organization_id', async () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    const supa = mockSupabase({ hasActiveMembership: false, profileOrgId: null })
    expect(await resolveActiveOrgId(supa)).toBeNull()
  })
})

// Loads role_definitions + role_permissions + user_roles counts for
// the Roller & tilganger section.

import { useCallback, useEffect, useState } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { RoleSummary } from './types'

interface RoleRow {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
}

const ROLE_METADATA: Record<
  string,
  {
    risk: RoleSummary['riskLevel']
    scope: string
    lawRefs: string[]
    fallbackDescription: string
  }
> = {
  admin: {
    risk: 'høy',
    scope: 'Hele systemet',
    lawRefs: [],
    fallbackDescription:
      'Full tilgang. Begrenset til 2 personer som best practice for ISO 27001 A.5.15.',
  },
  member: {
    risk: 'lav',
    scope: 'Egne data + arbeidsområde',
    lawRefs: ['AML § 2-3'],
    fallbackDescription:
      'Standard tilgang for ansatte. Lese personlige dokumenter, kursportefølje og varslingsrett.',
  },
  dl: {
    risk: 'høy',
    scope: 'Hele organisasjonen',
    lawRefs: ['AML § 2-1', 'AML § 3-1'],
    fallbackDescription: 'Lovpålagt øverste ansvar for HMS. Kan ikke delegeres bort.',
  },
  hmsleder: {
    risk: 'middels',
    scope: 'HMS-arbeidet',
    lawRefs: ['AML § 3-5'],
    fallbackDescription:
      'Koordinerer det systematiske HMS-arbeidet. Lovpålagt grunnopplæring.',
  },
  hr: {
    risk: 'middels',
    scope: 'Personal og HR',
    lawRefs: ['AML § 14-6'],
    fallbackDescription: 'Eier av personalkartotek og GDPR-protokoll for personal.',
  },
  hvo: {
    risk: 'lav',
    scope: 'Hele virksomheten',
    lawRefs: ['AML § 6-1'],
    fallbackDescription:
      'Lovpålagt når > 1 verneombud. Velges av og blant verneombudene.',
  },
  vo: {
    risk: 'lav',
    scope: 'Eget verneområde',
    lawRefs: ['AML § 6-2'],
    fallbackDescription:
      'Lovpålagt. Verneområde må fastsettes skriftlig. 40-timers grunnkurs påkrevd.',
  },
  amu: {
    risk: 'lav',
    scope: 'Arbeidsmiljøutvalget',
    lawRefs: ['AML § 7-1'],
    fallbackDescription:
      'Balanseres likt mellom arbeidsgiver- og arbeidstakerside.',
  },
  bht: {
    risk: 'lav',
    scope: 'Helse og BHT-tjenester',
    lawRefs: ['AML § 3-3'],
    fallbackDescription:
      'Ekstern · taushetsplikt. Rådgivende rolle i AMU.',
  },
  leder: {
    risk: 'middels',
    scope: 'Egen avdeling',
    lawRefs: ['AML § 4-1'],
    fallbackDescription: 'Eier av rutiner og oppfølging i egen enhet.',
  },
  ansatt: {
    risk: 'lav',
    scope: 'Egne data + arbeidsområde',
    lawRefs: ['AML § 2-3'],
    fallbackDescription:
      'Alle ansatte. Lesetilgang til personlige dokumenter og varslingsrett.',
  },
  dpo: {
    risk: 'middels',
    scope: 'GDPR-håndtering',
    lawRefs: ['GDPR Art. 37'],
    fallbackDescription:
      'Lovpålagt for virksomheter som behandler særlige kategorier i stor skala.',
  },
  tillitsvalgt: {
    risk: 'lav',
    scope: 'Eget fagforbund',
    lawRefs: ['Hovedavtalen'],
    fallbackDescription:
      'Ekstern rolle. Tilgang til AMU og varsler om reorganisering.',
  },
}

export interface AdminRolesResult {
  roles: RoleSummary[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useAdminRoles(): AdminRolesResult {
  const { supabase, organization } = useOrgSetupContext()
  const [roles, setRoles] = useState<RoleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [roleRes, permRes, urRes] = await Promise.all([
        supabase
          .from('role_definitions')
          .select('id, organization_id, slug, name, description, is_system')
          .eq('organization_id', organization.id)
          .order('name'),
        supabase.from('role_permissions').select('role_id, permission_key'),
        supabase.from('user_roles').select('role_id, user_id'),
      ])

      if (roleRes.error) throw roleRes.error
      if (permRes.error) throw permRes.error
      if (urRes.error) throw urRes.error

      const permCounts = new Map<string, number>()
      for (const p of (permRes.data ?? []) as { role_id: string; permission_key: string }[]) {
        permCounts.set(p.role_id, (permCounts.get(p.role_id) ?? 0) + 1)
      }
      const userCounts = new Map<string, number>()
      for (const u of (urRes.data ?? []) as { role_id: string; user_id: string }[]) {
        userCounts.set(u.role_id, (userCounts.get(u.role_id) ?? 0) + 1)
      }

      const summaries: RoleSummary[] = ((roleRes.data ?? []) as RoleRow[]).map((r) => {
        const meta = ROLE_METADATA[r.slug] ?? {
          risk: 'lav' as const,
          scope: 'Egne data',
          lawRefs: [],
          fallbackDescription: r.description ?? '',
        }
        return {
          id: r.id,
          slug: r.slug,
          name: r.name,
          description: r.description ?? meta.fallbackDescription,
          isSystem: r.is_system,
          permissionCount: permCounts.get(r.id) ?? 0,
          userCount: userCounts.get(r.id) ?? 0,
          riskLevel: meta.risk,
          lawRefs: meta.lawRefs,
          scope: meta.scope,
        }
      })

      setRoles(summaries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste roller')
    } finally {
      setLoading(false)
    }
  }, [supabase, organization?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { roles, loading, error, refresh }
}

// Delegering — tidsavgrenset rolledelegering ved fravær.
//
// Extracted from the `delegation` tab of the legacy AdminPage. Lists
// rows from `role_delegations` and lets admins create a new
// delegation (recipient by email, role, end date). Start date defaults
// to "now" — the legacy form did the same.

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { StandardInput } from '../../ui/Input'
import { SearchableSelect } from '../../ui/SearchableSelect'
import { Button } from '../../ui/Button'
import { WarningBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import type { ProfileRow } from '../../../types/organization'

type RoleRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
}

type DelegationRow = {
  id: string
  role_id: string
  from_user_id: string
  to_user_id: string
  starts_at: string
  ends_at: string
  note: string | null
}

export function DelegationAdminPanel() {
  const { supabase: sb, organization, user } = useOrgSetupContext()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [delegations, setDelegations] = useState<DelegationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [delTo, setDelTo] = useState('')
  const [delRoleId, setDelRoleId] = useState('')
  const [delEnds, setDelEnds] = useState('')

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, rRes, dRes] = await Promise.all([
        sb.from('profiles').select('*').order('display_name'),
        sb.from('role_definitions').select('*').order('name'),
        sb.from('role_delegations').select('*').order('ends_at', { ascending: false }),
      ])
      if (pRes.error) throw pRes.error
      if (rRes.error) throw rRes.error
      if (dRes.error) throw dRes.error
      setProfiles((pRes.data ?? []) as ProfileRow[])
      setRoles((rRes.data ?? []) as RoleRow[])
      setDelegations((dRes.data ?? []) as DelegationRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste')
    } finally {
      setLoading(false)
    }
  }, [sb, organization?.id])

  useEffect(() => {
    void load()
  }, [load])

  const createDelegation = async () => {
    if (!sb || !organization?.id || !user || !delTo.trim() || !delRoleId || !delEnds) return
    const toUser = profiles.find(
      (p) => p.email?.toLowerCase() === delTo.trim().toLowerCase(),
    )
    if (!toUser) {
      setError('Fant ikke bruker med den e-posten i organisasjonen.')
      return
    }
    const { error: err } = await sb.from('role_delegations').insert({
      organization_id: organization.id,
      role_id: delRoleId,
      from_user_id: user.id,
      to_user_id: toUser.id,
      starts_at: new Date().toISOString(),
      ends_at: new Date(delEnds).toISOString(),
      note: null,
      created_by: user.id,
    })
    if (err) setError(err.message)
    else {
      setDelTo('')
      setDelRoleId('')
      setDelEnds('')
      void load()
    }
  }

  if (!sb || !organization) {
    return <p className="p-4 text-center text-neutral-600">Ingen organisasjon.</p>
  }

  if (loading) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
      </div>
    )
  }

  const roleSelectOptions = roles.map((r) => ({ value: r.id, label: r.name }))

  return (
    <div className="space-y-6">
      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Ny delegering</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Gir mottaker rettigheter fra valgt rolle i perioden (i tillegg til egne roller).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={WPSTD_FORM_FIELD_LABEL}>Mottakers e-post</label>
            <StandardInput
              type="email"
              placeholder="Mottakers e-post (må være bruker i org.)"
              value={delTo}
              onChange={(e) => setDelTo(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Rolle</label>
            <SearchableSelect
              value={delRoleId}
              options={roleSelectOptions}
              placeholder="Velg rolle"
              onChange={setDelRoleId}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Sluttdato</label>
            <StandardInput
              type="datetime-local"
              value={delEnds}
              onChange={(e) => setDelEnds(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button
            variant="primary"
            className="sm:col-span-2 justify-center"
            onClick={() => void createDelegation()}
          >
            Opprett delegering
          </Button>
        </div>
      </ModuleSectionCard>

      <ul className="space-y-2">
        {delegations.map((d) => (
          <li key={d.id}>
            <ModuleSectionCard className="px-4 py-3 text-sm text-neutral-700" clip="visible">
              Rolle {roles.find((x) => x.id === d.role_id)?.name ?? d.role_id} — til{' '}
              {profiles.find((p) => p.id === d.to_user_id)?.email ?? d.to_user_id} — til{' '}
              {new Date(d.ends_at).toLocaleString('nb-NO')}
            </ModuleSectionCard>
          </li>
        ))}
      </ul>
    </div>
  )
}

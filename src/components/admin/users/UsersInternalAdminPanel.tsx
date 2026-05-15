// Interne brukere — invitasjoner og rolletildeling.
//
// Extracted from the `users` tab of the legacy AdminPage. Loads
// profiles + invitations + role definitions per org, surfaces an
// invite form, a pending-invites list, and a per-user role table.
// Role assignment is the same RPC used by the legacy tab; nothing
// about persistence changed.

import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2, Mail, Plus, Upload } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { StandardInput } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { WarningBox } from '../../ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL } from '../../layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { getSupabaseBrowserClient } from '../../../lib/supabaseClient'
import type { ProfileRow } from '../../../types/organization'

type RoleRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
}

type InvitationRow = {
  id: string
  email: string
  status: string
  expires_at: string
  created_at: string
  token: string
}

export function UsersInternalAdminPanel() {
  const { supabase: sb, organization, user, refreshPermissions } = useOrgSetupContext()
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [invites, setInvites] = useState<InvitationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([])

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, rRes, iRes] = await Promise.all([
        sb.from('profiles').select('*').order('display_name'),
        sb.from('role_definitions').select('*').order('name'),
        sb.from('invitations').select('*').order('created_at', { ascending: false }),
      ])
      if (pRes.error) throw pRes.error
      if (rRes.error) throw rRes.error
      if (iRes.error) throw iRes.error
      setProfiles((pRes.data ?? []) as ProfileRow[])
      setRoles((rRes.data ?? []) as RoleRow[])
      setInvites((iRes.data ?? []) as InvitationRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste')
    } finally {
      setLoading(false)
    }
  }, [sb, organization?.id])

  useEffect(() => {
    void load()
  }, [load])

  const createInvite = async () => {
    if (!sb) return
    const { data, error: err } = await sb.rpc('create_invitation', {
      p_email: inviteEmail.trim(),
      p_role_ids: inviteRoleIds.length ? inviteRoleIds : null,
      p_days_valid: 14,
    })
    if (err) {
      setError(err.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const path = (row as { invite_url_path?: string } | null)?.invite_url_path
    if (path) {
      const full = `${window.location.origin}${path}`
      void navigator.clipboard.writeText(full).catch(() => {})
      setError(null)
      alert(`Invitasjonslenke kopiert til utklippstavle:\n${full}`)
    }
    setInviteEmail('')
    void load()
  }

  const revokeInvite = async (id: string) => {
    if (!sb) return
    await sb.from('invitations').update({ status: 'revoked' }).eq('id', id)
    void load()
  }

  const updateUserRoles = async (userId: string, roleIds: string[]) => {
    if (!sb) return
    await sb.from('user_roles').delete().eq('user_id', userId)
    if (roleIds.length) {
      const { error: err } = await sb.from('user_roles').insert(
        roleIds.map((role_id) => ({ user_id: userId, role_id, assigned_by: user?.id })),
      )
      if (err) setError(err.message)
    }
    void load()
    await refreshPermissions()
  }

  const exportUsersJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      organizationId: organization?.id,
      profiles: profiles.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        email: p.email,
        is_org_admin: p.is_org_admin,
      })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `atics-users-${organization?.organization_number ?? 'export'}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importUsersJson = async (file: File) => {
    const text = await file.text()
    const parsed = JSON.parse(text) as {
      profiles?: { display_name?: string; email?: string; is_org_admin?: boolean }[]
    }
    if (!parsed.profiles?.length) {
      setError('Ugyldig fil: forventet profiles-array')
      return
    }
    setError('Import oppretter ikke Auth-brukere automatisk — bruk invitasjoner for ekte kontoer. Katalograder kan legges til separat.')
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

  return (
    <div className="space-y-6">
      {error ? <WarningBox>{error}</WarningBox> : null}

      <ModuleSectionCard className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <Mail className="size-5 text-[#1a3d32]" />
          Ny invitasjon
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>E-post</label>
            <StandardInput
              type="email"
              placeholder="e-post"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Roller (velg én eller flere)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    setInviteRoleIds((prev) =>
                      prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    inviteRoleIds.includes(r.id)
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => void createInvite()}
            disabled={!inviteEmail.includes('@')}
          >
            Opprett lenke
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Lenken kopieres til utklippstavle. Mottaker må registrere/logge inn med samme e-post.
        </p>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5">
        <h2 className="text-lg font-semibold text-neutral-900">Ventende invitasjoner</h2>
        <ul className="mt-3 divide-y divide-neutral-100">
          {invites.filter((i) => i.status === 'pending').length === 0 ? (
            <li className="py-2 text-sm text-neutral-500">Ingen</li>
          ) : (
            invites
              .filter((i) => i.status === 'pending')
              .map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {i.email} — utløper {new Date(i.expires_at).toLocaleDateString('nb-NO')}
                  </span>
                  <Button variant="danger" size="sm" onClick={() => void revokeInvite(i.id)}>
                    Trekk tilbake
                  </Button>
                </li>
              ))
          )}
        </ul>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">Brukere i organisasjonen</h2>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={exportUsersJson}>
              Eksporter JSON
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50">
              <Upload className="size-4" />
              Import JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void importUsersJson(f)
                }}
              />
            </label>
          </div>
        </div>
        <UserRoleTable sb={sb} profiles={profiles} roles={roles} onSave={updateUserRoles} />
      </ModuleSectionCard>
    </div>
  )
}

function UserRoleTable({
  sb,
  profiles,
  roles,
  onSave,
}: {
  sb: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>
  profiles: ProfileRow[]
  roles: RoleRow[]
  onSave: (userId: string, roleIds: string[]) => void
}) {
  const [map, setMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sb) return
    let cancelled = false
    void (async () => {
      const { data, error } = await sb.from('user_roles').select('user_id, role_id')
      if (error || cancelled) return
      const m: Record<string, string[]> = {}
      for (const row of data as { user_id: string; role_id: string }[]) {
        m[row.user_id] = m[row.user_id] ?? []
        m[row.user_id]!.push(row.role_id)
      }
      setMap(m)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, profiles])

  if (loading) return <Loader2 className="mx-auto mt-4 size-6 animate-spin text-neutral-400" />

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-neutral-500">
            <th className="py-2 pr-4">Navn</th>
            <th className="py-2 pr-4">E-post</th>
            <th className="py-2">Roller</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b border-neutral-100">
              <td className="py-2 pr-4">{p.display_name}</td>
              <td className="py-2 pr-4 text-neutral-600">{p.email ?? '—'}</td>
              <td className="py-2">
                <div className="flex flex-wrap gap-1">
                  {roles.map((r) => {
                    const active = (map[p.id] ?? []).includes(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setMap((prev) => {
                            const cur = prev[p.id] ?? []
                            return {
                              ...prev,
                              [p.id]: active ? cur.filter((x) => x !== r.id) : [...cur, r.id],
                            }
                          })
                        }
                        className={`rounded border px-2 py-0.5 text-xs font-medium transition ${
                          active
                            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                            : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                        }`}
                      >
                        {r.name}
                      </button>
                    )
                  })}
                </div>
              </td>
              <td className="py-2">
                <Button variant="secondary" size="sm" onClick={() => onSave(p.id, map[p.id] ?? [])}>
                  Lagre
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

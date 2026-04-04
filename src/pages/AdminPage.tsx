import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Loader2, Mail, Plus, Shield, Upload, UserCog, Users } from 'lucide-react'
import { ModulePageIcon } from '../components/ModulePageIcon'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../lib/permissionKeys'
import type { ProfileRow } from '../types/organization'

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

type DelegationRow = {
  id: string
  role_id: string
  from_user_id: string
  to_user_id: string
  starts_at: string
  ends_at: string
  note: string | null
}

const tabs = [
  { id: 'users', label: 'Brukere & invitasjoner', icon: Users },
  { id: 'roles', label: 'Roller & rettigheter', icon: Shield },
  { id: 'delegation', label: 'Delegering', icon: UserCog },
] as const

export function AdminPage() {
  const {
    supabase,
    organization,
    user,
    can,
    refreshPermissions,
  } = useOrgSetupContext()
  const sb = supabase
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'users'
  const setTab = (t: string) => {
    setSearchParams({ tab: t }, { replace: true })
  }

  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [invites, setInvites] = useState<InvitationRow[]>([])
  const [delegations, setDelegations] = useState<DelegationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleIds, setInviteRoleIds] = useState<string[]>([])
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleSlug, setNewRoleSlug] = useState('')
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set())

  const [delTo, setDelTo] = useState('')
  const [delRoleId, setDelRoleId] = useState('')
  const [delEnds, setDelEnds] = useState('')

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [pRes, rRes, iRes, dRes] = await Promise.all([
        sb.from('profiles').select('*').order('display_name'),
        sb.from('role_definitions').select('*').order('name'),
        sb.from('invitations').select('*').order('created_at', { ascending: false }),
        sb.from('role_delegations').select('*').order('ends_at', { ascending: false }),
      ])
      if (pRes.error) throw pRes.error
      if (rRes.error) throw rRes.error
      if (iRes.error) throw iRes.error
      if (dRes.error) throw dRes.error
      setProfiles((pRes.data ?? []) as ProfileRow[])
      setRoles((rRes.data ?? []) as RoleRow[])
      setInvites((iRes.data ?? []) as InvitationRow[])
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

  const openRoleEditor = async (r: RoleRow) => {
    setEditingRole(r)
    if (!sb) return
    const { data } = await sb.from('role_permissions').select('permission_key').eq('role_id', r.id)
    setRolePerms(new Set((data ?? []).map((x: { permission_key: string }) => x.permission_key)))
  }

  const saveRolePermissions = async () => {
    if (!sb || !editingRole) return
    const keys = [...rolePerms]
    await sb.from('role_permissions').delete().eq('role_id', editingRole.id)
    if (keys.length) {
      const { error } = await sb.from('role_permissions').insert(
        keys.map((permission_key) => ({ role_id: editingRole.id, permission_key })),
      )
      if (error) {
        setError(error.message)
        return
      }
    }
    setEditingRole(null)
    await refreshPermissions()
  }

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
    const path = row?.invite_url_path as string | undefined
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
      const { error } = await sb.from('user_roles').insert(
        roleIds.map((role_id) => ({ user_id: userId, role_id, assigned_by: user?.id })),
      )
      if (error) setError(error.message)
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

  const createDelegation = async () => {
    if (!sb || !organization?.id || !delTo.trim() || !delRoleId || !delEnds) return
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
      from_user_id: user!.id,
      to_user_id: toUser.id,
      starts_at: new Date().toISOString(),
      ends_at: new Date(delEnds).toISOString(),
      note: null,
      created_by: user!.id,
    })
    if (err) setError(err.message)
    else {
      setDelTo('')
      setDelRoleId('')
      setDelEnds('')
      void load()
    }
  }

  if (!can('module.view.admin')) {
    return (
      <div className="p-8 text-center text-neutral-600">
        Du har ikke tilgang til administrasjon.
      </div>
    )
  }

  if (!sb || !organization) {
    return <p className="p-8 text-center">Ingen organisasjon.</p>
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start gap-4">
        <ModulePageIcon className="bg-[#1a3d32] text-[#c9a227]">
          <Shield className="size-9 md:size-10" strokeWidth={1.5} aria-hidden />
        </ModulePageIcon>
        <div className="min-w-0">
          <h1
            className="font-serif text-2xl text-[#1a3d32]"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Administrasjon
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Brukere, invitasjoner, roller og delegering for {organization.name} ({organization.organization_number}).
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-neutral-200 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
                active ? 'bg-[#1a3d32] text-white' : 'bg-white text-neutral-700 ring-1 ring-neutral-200'
              }`}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {loading ? (
        <div className="mt-8 flex justify-center gap-2 text-neutral-600">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : null}

      {tab === 'users' && !loading ? (
        <div className="mt-8 space-y-8">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
              <Mail className="size-5 text-[#1a3d32]" />
              Ny invitasjon
            </h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="email"
                placeholder="e-post"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <select
                multiple
                value={inviteRoleIds}
                onChange={(e) =>
                  setInviteRoleIds([...e.target.selectedOptions].map((o) => o.value))
                }
                className="min-h-[42px] min-w-[180px] rounded-lg border border-neutral-200 px-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void createInvite()}
                disabled={!inviteEmail.includes('@')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Plus className="size-4" />
                Opprett lenke
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Lenken kopieres til utklippstavle. Mottaker må registrere/logge inn med samme e-post.
            </p>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Ventende invitasjoner</h2>
            </div>
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
                      <button
                        type="button"
                        onClick={() => void revokeInvite(i.id)}
                        className="text-red-600 hover:underline"
                      >
                        Trekk tilbake
                      </button>
                    </li>
                  ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Brukere i organisasjonen</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportUsersJson}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
                >
                  <Download className="size-4" />
                  Eksporter JSON
                </button>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm">
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
          </section>
        </div>
      ) : null}

      {tab === 'roles' && !loading ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Ny rolle</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                placeholder="Slug (f.eks. hr)"
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Visningsnavn"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!sb || !newRoleSlug.trim() || !newRoleName.trim()) return
                  const { error: err } = await sb.from('role_definitions').insert({
                    organization_id: organization.id,
                    slug: newRoleSlug.trim(),
                    name: newRoleName.trim(),
                    is_system: false,
                  })
                  if (err) setError(err.message)
                  else {
                    setNewRoleSlug('')
                    setNewRoleName('')
                    void load()
                  }
                }}
                className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white"
              >
                Opprett
              </button>
            </div>
          </section>

          <ul className="space-y-2">
            {roles.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 bg-white px-4 py-3"
              >
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-xs text-neutral-500">{r.slug}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void openRoleEditor(r)}
                  className="text-sm font-medium text-[#1a3d32] hover:underline"
                >
                  Rediger rettigheter
                </button>
              </li>
            ))}
          </ul>

          {editingRole ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold">{editingRole.name}</h3>
                <div className="mt-4 grid max-h-64 gap-2 overflow-y-auto">
                  {PERMISSION_KEYS.map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={rolePerms.has(k)}
                        onChange={(e) => {
                          const next = new Set(rolePerms)
                          if (e.target.checked) next.add(k)
                          else next.delete(k)
                          setRolePerms(next)
                        }}
                      />
                      {PERMISSION_LABELS[k]}
                      <span className="text-xs text-neutral-400">{k}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingRole(null)}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveRolePermissions()}
                    className="rounded-lg bg-[#1a3d32] px-4 py-2 text-sm text-white"
                  >
                    Lagre
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'delegation' && !loading ? (
        <div className="mt-8 space-y-6">
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Ny delegering</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Gir mottaker rettigheter fra valgt rolle i perioden (i tillegg til egne roller).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                type="email"
                placeholder="Mottakers e-post (må være bruker i org.)"
                value={delTo}
                onChange={(e) => setDelTo(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={delRoleId}
                onChange={(e) => setDelRoleId(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              >
                <option value="">Velg rolle</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={delEnds}
                onChange={(e) => setDelEnds(e.target.value)}
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void createDelegation()}
                className="sm:col-span-2 rounded-lg bg-[#1a3d32] py-2 text-sm font-medium text-white"
              >
                Opprett delegering
              </button>
            </div>
          </section>
          <ul className="space-y-2">
            {delegations.map((d) => (
              <li key={d.id} className="rounded-lg border border-neutral-100 bg-white px-4 py-3 text-sm">
                Rolle {roles.find((x) => x.id === d.role_id)?.name ?? d.role_id} — til{' '}
                {profiles.find((p) => p.id === d.to_user_id)?.email ?? d.to_user_id} — til{' '}
                {new Date(d.ends_at).toLocaleString('nb-NO')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
        m[row.user_id].push(row.role_id)
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
                <select
                  multiple
                  className="min-h-[36px] w-full max-w-xs rounded border border-neutral-200 px-1 text-xs"
                  value={map[p.id] ?? []}
                  onChange={(e) => {
                    const v = [...e.target.selectedOptions].map((o) => o.value)
                    setMap((prev) => ({ ...prev, [p.id]: v }))
                  }}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => onSave(p.id, map[p.id] ?? [])}
                  className="rounded bg-neutral-100 px-2 py-1 text-xs font-medium hover:bg-neutral-200"
                >
                  Lagre
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

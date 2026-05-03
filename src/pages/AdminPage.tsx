import { useCallback, useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Download, Loader2, Mail, Plus, Shield, Upload, UserCog, Users } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../components/module'
import { Tabs } from '../components/ui/Tabs'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'
import { Button } from '../components/ui/Button'
import { WarningBox } from '../components/ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL } from '../components/layout/WorkplaceStandardFormPanel'
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

const ADMIN_TABS = [
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
  const { pathname } = useLocation()
  const embeddedUnderOrganisation = pathname.startsWith('/organisation/admin')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'users'
  const setTab = (t: string) => {
    setSearchParams({ tab: t }, { replace: true })
  }

  const adminSectionLabel = ADMIN_TABS.find((t) => t.id === tab)?.label ?? 'Administrasjon'

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

  const adminBreadcrumb = embeddedUnderOrganisation
    ? [
        { label: 'Workspace', to: '/' },
        { label: 'Organisasjon', to: '/organisation' },
        { label: adminSectionLabel },
      ]
    : [
        { label: 'Workspace', to: '/' },
        { label: 'Administrasjon' },
        { label: adminSectionLabel },
      ]

  const roleSelectOptions = roles.map((r) => ({ value: r.id, label: r.name }))

  return (
    <ModulePageShell
      breadcrumb={adminBreadcrumb}
      title="Administrasjon"
      description={`Brukere, invitasjoner, roller og delegering for ${organization.name} (${organization.organization_number}).`}
      tabs={
        <Tabs
          items={ADMIN_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
          activeId={tab}
          onChange={setTab}
          overflow="scroll"
        />
      }
    >
      {error ? (
        <WarningBox>{error}</WarningBox>
      ) : null}

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-[#1a3d32]" />
        </div>
      ) : null}

      {tab === 'users' && !loading ? (
        <div className="space-y-6">
          {/* Ny invitasjon */}
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

          {/* Ventende invitasjoner */}
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
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => void revokeInvite(i.id)}
                      >
                        Trekk tilbake
                      </Button>
                    </li>
                  ))
              )}
            </ul>
          </ModuleSectionCard>

          {/* Brukere i organisasjonen */}
          <ModuleSectionCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Brukere i organisasjonen</h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Download className="size-4" />}
                  onClick={exportUsersJson}
                >
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
      ) : null}

      {tab === 'roles' && !loading ? (
        <div className="space-y-6">
          {/* Ny rolle */}
          <ModuleSectionCard className="p-5">
            <h2 className="text-lg font-semibold text-neutral-900">Ny rolle</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StandardInput
                placeholder="Slug (f.eks. hr)"
                value={newRoleSlug}
                onChange={(e) => setNewRoleSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="w-auto min-w-[140px]"
              />
              <StandardInput
                placeholder="Visningsnavn"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                className="w-auto min-w-[180px]"
              />
              <Button
                variant="primary"
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
              >
                Opprett
              </Button>
            </div>
          </ModuleSectionCard>

          <ul className="space-y-2">
            {roles.map((r) => (
              <li key={r.id}>
                <ModuleSectionCard className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" clip="visible">
                  <div>
                    <span className="font-medium text-neutral-900">{r.name}</span>
                    <span className="ml-2 text-xs text-neutral-500">{r.slug}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void openRoleEditor(r)}
                  >
                    Rediger rettigheter
                  </Button>
                </ModuleSectionCard>
              </li>
            ))}
          </ul>

          {editingRole ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-neutral-900">{editingRole.name}</h3>
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
                  <Button variant="secondary" onClick={() => setEditingRole(null)}>
                    Avbryt
                  </Button>
                  <Button variant="primary" onClick={() => void saveRolePermissions()}>
                    Lagre
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'delegation' && !loading ? (
        <div className="space-y-6">
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
      ) : null}
    </ModulePageShell>
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onSave(p.id, map[p.id] ?? [])}
                >
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

// Roller & tilganger — RBAC roller med tillatelseseditor.
//
// Extracted from the `roles` tab of the legacy AdminPage. Lists
// `role_definitions` for the org, lets admins create new roles, and
// opens a modal to edit which `PERMISSION_KEYS` each role grants.
// Persistence is unchanged — `role_permissions` is rewritten on save.

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ModuleSectionCard } from '../../module'
import { StandardInput } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { ToggleSwitch } from '../../ui/FormToggles'
import { WarningBox } from '../../ui/AlertBox'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../../../lib/permissionKeys'

type RoleRow = {
  id: string
  organization_id: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
}

export function RolesAdminPanel() {
  const { supabase: sb, organization, refreshPermissions } = useOrgSetupContext()
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleSlug, setNewRoleSlug] = useState('')
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    try {
      const { data, error: err } = await sb
        .from('role_definitions')
        .select('*')
        .order('name')
      if (err) throw err
      setRoles((data ?? []) as RoleRow[])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste roller')
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
      const { error: err } = await sb.from('role_permissions').insert(
        keys.map((permission_key) => ({ role_id: editingRole.id, permission_key })),
      )
      if (err) {
        setError(err.message)
        return
      }
    }
    setEditingRole(null)
    await refreshPermissions()
  }

  const createRole = async () => {
    if (!sb || !organization?.id || !newRoleSlug.trim() || !newRoleName.trim()) return
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
          <Button variant="primary" onClick={() => void createRole()}>
            Opprett
          </Button>
        </div>
      </ModuleSectionCard>

      <ul className="space-y-2">
        {roles.map((r) => (
          <li key={r.id}>
            <ModuleSectionCard
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              clip="visible"
            >
              <div>
                <span className="font-medium text-neutral-900">{r.name}</span>
                <span className="ml-2 text-xs text-neutral-500">{r.slug}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void openRoleEditor(r)}>
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
                <div key={k} className="flex items-center gap-2 text-sm">
                  <ToggleSwitch
                    checked={rolePerms.has(k)}
                    onChange={(v) => {
                      const next = new Set(rolePerms)
                      if (v) next.add(k)
                      else next.delete(k)
                      setRolePerms(next)
                    }}
                    label={PERMISSION_LABELS[k]}
                  />
                  <span className="text-xs text-neutral-400">{k}</span>
                </div>
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
  )
}

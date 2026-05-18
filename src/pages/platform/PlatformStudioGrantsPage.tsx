// Platform Studio Grants — Phase 3 grant flow UI.
//
// Where: /platform-admin/studio-grants
// Audience: platform_is_admin() only (route already gated by
// PlatformAdminLayout).
//
// Operations:
//   - Search a partner_organizations row + the role inside it
//   - Grant studio.partner_admin (calls grant_studio_partner_admin RPC)
//   - Revoke studio.partner_admin (calls revoke_studio_partner_admin RPC
//     with optional reason → emits compliance_notifications
//     studio_partner_grant_revoked with grace_until)
//
// Conditional UI: the page is functional only on environments where
// partner_console_v0 substrate is applied. Otherwise renders a
// neutral empty state.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'

type Row = {
  partner_id: string
  partner_name: string
  role_id: string
  role_label: string
  has_grant: boolean
  members: number
}

const BREADCRUMB = [
  { label: 'Platform admin', to: '/platform-admin' },
  { label: 'Studio Partner-tilganger' },
]

export function PlatformStudioGrantsPage() {
  const { supabase, isAdmin } = usePlatformAdmin()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const reload = useCallback(async () => {
    if (!supabase || !isAdmin) return
    setLoading(true)
    setError(null)
    // Two-query join: partners × roles, with a per-row grant check.
    type PartnerJoin = {
      id: string
      name: string
      partner_memberships: Array<{
        role_id: string
        active: boolean
        roles: { name: string } | { name: string }[] | null
      }>
    }
    const { data: partnerRows, error: e1 } = await supabase
      .from('partner_organizations')
      .select(`
        id, name,
        partner_memberships ( role_id, active, roles:role_id ( name ) )
      `)
      .order('name')
    if (e1) {
      setError(e1.message)
      setLoading(false)
      return
    }
    const partners = (partnerRows ?? []) as unknown as PartnerJoin[]
    const buckets = new Map<string, Row>()
    for (const p of partners) {
      const byRole = new Map<string, { count: number; label: string }>()
      for (const m of p.partner_memberships ?? []) {
        if (!m.active) continue
        const rolesRef = Array.isArray(m.roles) ? m.roles[0] : m.roles
        const label = rolesRef?.name ?? m.role_id
        const k = `${p.id}::${m.role_id}`
        const prev = byRole.get(k) ?? { count: 0, label }
        byRole.set(k, { count: prev.count + 1, label })
      }
      for (const [key, v] of byRole) {
        const [, roleId] = key.split('::')
        buckets.set(key, {
          partner_id: p.id,
          partner_name: p.name,
          role_id: roleId,
          role_label: v.label,
          has_grant: false,
          members: v.count,
        })
      }
    }
    // Resolve has_grant for each (role_id, 'studio.partner_admin') pair
    if (buckets.size > 0) {
      const roleIds = Array.from(new Set([...buckets.values()].map((b) => b.role_id)))
      const { data: grants } = await supabase
        .from('role_permissions')
        .select('role_id')
        .eq('permission_key', 'studio.partner_admin')
        .in('role_id', roleIds)
      const granted = new Set((grants ?? []).map((g) => (g as { role_id: string }).role_id))
      for (const b of buckets.values()) {
        b.has_grant = granted.has(b.role_id)
      }
    }
    setRows([...buckets.values()].sort((a, b) => a.partner_name.localeCompare(b.partner_name, 'nb')))
    setLoading(false)
  }, [supabase, isAdmin])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount
    void reload()
  }, [reload])

  async function handleGrant(r: Row) {
    if (!supabase) return
    setBusy(`${r.partner_id}::${r.role_id}`)
    setError(null)
    const { error: e } = await supabase.rpc('grant_studio_partner_admin', {
      p_role_id: r.role_id,
      p_partner_id: r.partner_id,
    })
    if (e) setError(e.message)
    setBusy(null)
    await reload()
  }

  async function handleRevoke(r: Row) {
    if (!supabase) return
    const reason = prompt(`Revoke studio.partner_admin for ${r.partner_name} / ${r.role_label}?\n\nValgfri begrunnelse:`)
    if (reason === null) return
    setBusy(`${r.partner_id}::${r.role_id}`)
    setError(null)
    const { error: e } = await supabase.rpc('revoke_studio_partner_admin', {
      p_role_id: r.role_id,
      p_partner_id: r.partner_id,
      p_reason: reason || null,
    })
    if (e) setError(e.message)
    setBusy(null)
    await reload()
  }

  const filtered = rows.filter((r) => {
    if (!filter.trim()) return true
    const q = filter.trim().toLowerCase()
    return r.partner_name.toLowerCase().includes(q) || r.role_label.toLowerCase().includes(q)
  })

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Studio Partner-tilganger"
      description="Plattform-admin grant/revoke av studio.partner_admin per (partner-org, rolle). Revoke utløser 30 dagers utkast-bevaringsfrist."
      loading={loading}
      loadingLabel="Laster partnerskap…"
      headerActions={
        <StandardInput
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Søk partner eller rolle…"
          className="w-64"
          aria-label="Søk"
        />
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            {rows.length === 0
              ? 'Partner-substrat (_20260907123300_partner_console_v0) er ikke aktivert i dette miljøet, eller ingen partner-organisasjoner finnes.'
              : 'Ingen treff for søket.'}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {filtered.map((r) => {
              const busyKey = `${r.partner_id}::${r.role_id}`
              return (
                <li key={busyKey} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {r.partner_name}
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-neutral-500">{r.role_label}</span>
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {r.members} aktive medlemmer · {r.has_grant ? 'studio.partner_admin tildelt' : 'ingen Studio-tilgang'}
                    </p>
                  </div>
                  {r.has_grant ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy === busyKey}
                      onClick={() => void handleRevoke(r)}
                    >
                      {busy === busyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldX className="h-3.5 w-3.5" />}
                      Trekk tilbake
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy === busyKey}
                      onClick={() => void handleGrant(r)}
                    >
                      {busy === busyKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Gi tilgang
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ModulePageShell>
  )
}

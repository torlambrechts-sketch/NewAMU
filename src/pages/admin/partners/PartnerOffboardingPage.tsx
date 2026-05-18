// Partner offboarding admin — Studio Builder Phase 3 Task 3.4.
//
// Lists the org's active partner_memberships and lets an admin revoke
// a consultant's access. Revoke flips active=false; the
// studio_partner_offboard_stamp_drafts trigger then stamps
// revoked_grace_until = now() + 30 days on any draft authored by the
// revoked user. After 30 days, purge_revoked_studio_drafts() reaps
// the rows (cron-driven via workflow-cron-dispatcher).
//
// Only org admins see this page; route gate is checklist.manage or
// the broad admin permAny.
//
// Spec: specs/studio-builder.md §5 Phase 3 Task 3.4.

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserMinus } from 'lucide-react'
import { ModulePageShell } from '../../../components/module/ModulePageShell'
import { Button } from '../../../components/ui/Button'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type MembershipRow = {
  id: string
  user_id: string
  partner_id: string
  role: 'consultant' | 'manager' | 'admin'
  active: boolean
  hourly_rate_override: number | null
  created_at: string
  revoked_at: string | null
  partner_name: string | null
  user_email: string | null
  user_name: string | null
}

const BREADCRUMB = [
  { label: 'Administrasjon', to: '/admin/settings' },
  { label: 'Partner-tilganger' },
]

export function PartnerOffboardingPage() {
  const { supabase, organization, isAdmin } = useOrgSetupContext()
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftCounts, setDraftCounts] = useState<Record<string, number>>({})

  const reload = useCallback(async () => {
    if (!supabase || !organization) return
    setLoading(true)
    setError(null)
    // partner_memberships RLS scopes naturally; join partner names + user
    // names via the explicit FKs. Falls back gracefully if the partner
    // substrate isn't applied on this env.
    const { data, error: e } = await supabase
      .from('partner_memberships')
      .select(`
        id, user_id, partner_id, role, active, hourly_rate_override,
        created_at, revoked_at,
        partner_organizations:partner_id ( name ),
        profiles:user_id ( email, display_name )
      `)
      .order('active', { ascending: false })
      .order('created_at', { ascending: false })
    if (e) {
      setError(e.message)
      setLoading(false)
      return
    }
    // PostgREST embedded selects can return either a single object or
    // an array depending on FK shape; normalize to first element.
    type Joined = {
      id: string
      user_id: string
      partner_id: string
      role: 'consultant' | 'manager' | 'admin'
      active: boolean
      hourly_rate_override: number | null
      created_at: string
      revoked_at: string | null
      partner_organizations: { name: string } | { name: string }[] | null
      profiles: { email: string | null; display_name: string | null } | { email: string | null; display_name: string | null }[] | null
    }
    function pick<T>(v: T | T[] | null | undefined): T | null {
      if (v == null) return null
      return Array.isArray(v) ? (v[0] ?? null) : v
    }
    const rows: MembershipRow[] = ((data ?? []) as unknown as Joined[]).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      partner_id: r.partner_id,
      role: r.role,
      active: r.active,
      hourly_rate_override: r.hourly_rate_override,
      created_at: r.created_at,
      revoked_at: r.revoked_at,
      partner_name: pick(r.partner_organizations)?.name ?? null,
      user_email: pick(r.profiles)?.email ?? null,
      user_name: pick(r.profiles)?.display_name ?? null,
    }))
    setMemberships(rows)

    // Count drafts the revoked-or-soon users own so the admin can see
    // what's at risk.
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
    if (userIds.length > 0) {
      const { data: draftsData } = await supabase
        .from('studio_pack_drafts')
        .select('last_edited_by')
        .in('last_edited_by', userIds)
      const counts: Record<string, number> = {}
      for (const r of draftsData ?? []) {
        const uid = (r as { last_edited_by: string }).last_edited_by
        counts[uid] = (counts[uid] ?? 0) + 1
      }
      setDraftCounts(counts)
    }

    setLoading(false)
  }, [supabase, organization])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical fetch-on-mount
    void reload()
  }, [reload])

  async function handleRevoke(m: MembershipRow) {
    if (!supabase) return
    const draftCount = draftCounts[m.user_id] ?? 0
    const confirmCopy =
      draftCount > 0
        ? `Trekk tilbake tilgangen for ${m.user_name ?? m.user_email}?\n\n` +
          `${draftCount} pakke-utkast vil bli tilgjengelig for klient-admins i 30 dager før de slettes.`
        : `Trekk tilbake tilgangen for ${m.user_name ?? m.user_email}?`
    if (!confirm(confirmCopy)) return
    setBusyId(m.id)
    const { error: e } = await supabase
      .from('partner_memberships')
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq('id', m.id)
    if (e) setError(e.message)
    setBusyId(null)
    await reload()
  }

  if (!isAdmin) {
    return (
      <ModulePageShell breadcrumb={BREADCRUMB} title="Partner-tilganger">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Denne siden er kun for organisasjons-administratorer.
        </div>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Partner-tilganger"
      description="Trekk tilbake tilgang for konsulenter. Utkast forblir tilgjengelige for klient-admins i 30 dager etter tilbakekall, deretter slettes de automatisk."
      loading={loading}
      loadingLabel="Laster partnerskap…"
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}

        {memberships.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
            Ingen aktive eller historiske partner-tilganger registrert.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {memberships.map((m) => {
              const drafts = draftCounts[m.user_id] ?? 0
              return (
                <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900">
                      {m.user_name ?? m.user_email ?? m.user_id}
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      {m.partner_name ?? m.partner_id} · {m.role}
                      {drafts > 0 ? ` · ${drafts} pakke-utkast` : ''}
                      {m.revoked_at ? ` · tilbakekalt ${new Date(m.revoked_at).toLocaleDateString('nb')}` : ''}
                    </p>
                  </div>
                  {m.active ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId === m.id}
                      onClick={() => void handleRevoke(m)}
                    >
                      {busyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
                      Trekk tilbake
                    </Button>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                      Inaktiv
                    </span>
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

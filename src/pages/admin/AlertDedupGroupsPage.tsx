// AlertDedupGroupsPage — platform-admin UI for cross-org alert dedup groups.
//
// Substrate shipped in _126400 / _126700: org_alert_dedup_groups +
// org_alert_dedup_group_members + alert_dedup_admin_create_group RPC.
// The remaining add_org / remove_org / delete_group RPCs ship in
// _127800. This page is the UI on top of all four.
//
// AML § 2A-7 (5) — konsernstrukturer må kunne forvalte dedup-tilhørighet
// uten DBA. Page lives at /admin/varsling/dedup-grupper and is hidden
// from non-platform-admins both at the route (`isAdmin` guard) and in
// AticsShell (sub-link conditional on `usePlatformAdmin().isAdmin`).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, UserMinus, UserPlus, Users, ShieldAlert } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { InfoBox, WarningBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { usePlatformAdmin } from '../../hooks/usePlatformAdmin'
import { ConfirmDialog } from './ConfirmDialog'

type DedupGroupRow = {
  id: string
  name: string
  created_at: string
}

type DedupMemberRow = {
  group_id: string
  organization_id: string
  joined_at: string
}

type OrgLite = {
  id: string
  name: string
}

export function AlertDedupGroupsPage() {
  const supabase = getSupabaseBrowserClient()
  const { isAdmin, loading: authLoading } = usePlatformAdmin()

  const [groups, setGroups] = useState<DedupGroupRow[]>([])
  const [members, setMembers] = useState<DedupMemberRow[]>([])
  const [orgs, setOrgs] = useState<OrgLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  // Section B — create-group form state.
  const [newName, setNewName] = useState('')
  const [newSelected, setNewSelected] = useState<string[]>([])
  const [orgPick, setOrgPick] = useState('')

  // Section C — per-group dialogs.
  const [addOrgFor, setAddOrgFor] = useState<DedupGroupRow | null>(null)
  const [addOrgPick, setAddOrgPick] = useState('')
  const [removeOrg, setRemoveOrg] = useState<{ group: DedupGroupRow; orgId: string } | null>(null)
  const [deleteGroup, setDeleteGroup] = useState<DedupGroupRow | null>(null)

  const orgsById = useMemo(() => {
    const m = new Map<string, OrgLite>()
    for (const o of orgs) m.set(o.id, o)
    return m
  }, [orgs])

  const membersByGroup = useMemo(() => {
    const m = new Map<string, DedupMemberRow[]>()
    for (const row of members) {
      const list = m.get(row.group_id) ?? []
      list.push(row)
      m.set(row.group_id, list)
    }
    return m
  }, [members])

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    try {
      const [gRes, mRes, oRes] = await Promise.all([
        supabase
          .from('org_alert_dedup_groups')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('org_alert_dedup_group_members')
          .select('group_id, organization_id, joined_at')
          .limit(2000),
        supabase
          .from('organizations')
          .select('id, name')
          .order('name', { ascending: true })
          .limit(2000),
      ])
      if (gRes.error) throw gRes.error
      if (mRes.error) throw mRes.error
      if (oRes.error) throw oRes.error
      setGroups((gRes.data ?? []) as DedupGroupRow[])
      setMembers((mRes.data ?? []) as DedupMemberRow[])
      setOrgs((oRes.data ?? []) as OrgLite[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste dedup-grupper.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isAdmin) {
      void refresh()
    } else {
      setLoading(false)
    }
  }, [isAdmin, refresh])

  // ─── Section B handlers ────────────────────────────────────────────────
  const handleAddOrgToNew = () => {
    if (!orgPick) return
    if (newSelected.includes(orgPick)) return
    setNewSelected((prev) => [...prev, orgPick])
    setOrgPick('')
  }

  const handleRemoveOrgFromNew = (orgId: string) => {
    setNewSelected((prev) => prev.filter((id) => id !== orgId))
  }

  const handleCreate = async () => {
    if (!supabase) return
    if (newName.trim().length === 0) {
      setError('Gi gruppen et navn.')
      return
    }
    if (newSelected.length < 2) {
      setError('Velg minst 2 organisasjoner — dedup på tvers krever flere medlemmer.')
      return
    }
    setPending('create')
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('alert_dedup_admin_create_group', {
        p_name: newName.trim(),
        p_member_org_ids: newSelected,
      })
      if (rpcErr) throw rpcErr
      setNewName('')
      setNewSelected([])
      setOrgPick('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette gruppen.')
    } finally {
      setPending(null)
    }
  }

  // ─── Section C handlers ────────────────────────────────────────────────
  const handleAddOrg = async () => {
    if (!supabase || !addOrgFor || !addOrgPick) return
    setPending(`add:${addOrgFor.id}`)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('alert_dedup_admin_add_org', {
        p_group_id: addOrgFor.id,
        p_org_id: addOrgPick,
      })
      if (rpcErr) throw rpcErr
      setAddOrgFor(null)
      setAddOrgPick('')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke legge til org.')
    } finally {
      setPending(null)
    }
  }

  const handleRemoveOrg = async () => {
    if (!supabase || !removeOrg) return
    setPending(`remove:${removeOrg.group.id}:${removeOrg.orgId}`)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('alert_dedup_admin_remove_org', {
        p_group_id: removeOrg.group.id,
        p_org_id: removeOrg.orgId,
      })
      if (rpcErr) throw rpcErr
      setRemoveOrg(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke fjerne org.')
    } finally {
      setPending(null)
    }
  }

  const handleDeleteGroup = async () => {
    if (!supabase || !deleteGroup) return
    setPending(`delete:${deleteGroup.id}`)
    setError(null)
    try {
      const { error: rpcErr } = await supabase.rpc('alert_dedup_admin_delete_group', {
        p_group_id: deleteGroup.id,
      })
      if (rpcErr) throw rpcErr
      setDeleteGroup(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette gruppen.')
    } finally {
      setPending(null)
    }
  }

  // Orgs eligible for a new group: those not already in any group.
  const orgsInAnyGroup = useMemo(() => {
    const s = new Set<string>()
    for (const m of members) s.add(m.organization_id)
    return s
  }, [members])

  const orgsAvailableForNew = orgs.filter(
    (o) => !orgsInAnyGroup.has(o.id) && !newSelected.includes(o.id),
  )

  // Orgs available to ADD to an existing group: those not already in any group.
  const orgsAvailableForAdd = orgs.filter((o) => !orgsInAnyGroup.has(o.id))

  const breadcrumb = [
    { label: 'Admin', to: '/admin/settings/settings' },
    { label: 'Varsling' },
    { label: 'Cross-org dedup-grupper' },
  ]

  if (authLoading) {
    return (
      <ModulePageShell
        breadcrumb={breadcrumb}
        title="Cross-org dedup-grupper"
        description="Laster…"
        loading
      >
        <div />
      </ModulePageShell>
    )
  }

  if (!isAdmin) {
    return (
      <ModulePageShell
        breadcrumb={breadcrumb}
        title="Cross-org dedup-grupper"
        description="Krever platform-admin"
      >
        <ModuleSectionCard>
          <WarningBox>
            Denne siden er kun tilgjengelig for platform-admins. RPC-ene
            <code className="mx-1 rounded bg-neutral-100 px-1 text-[11px]">
              alert_dedup_admin_*
            </code>
            håndhever det samme i databasen.
          </WarningBox>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      title="Cross-org dedup-grupper"
      description="Knytt søsterorg i samme konsern sammen så like varsler (AML § 2A-7 / GDPR Art. 17) dedupes på tvers."
    >
      {error ? <WarningBox>{error}</WarningBox> : null}

      {/* ─── Section A — existing groups ─────────────────────────────────── */}
      <ModuleSectionCard className="space-y-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Eksisterende grupper</h2>
          <p className="text-xs text-neutral-500">{groups.length} totalt</p>
        </div>
        {loading ? (
          <p className="text-sm text-neutral-500">Laster…</p>
        ) : groups.length === 0 ? (
          <InfoBox>
            Ingen dedup-grupper opprettet ennå. Bruk skjemaet under for å lage den første.
          </InfoBox>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => {
              const groupMembers = membersByGroup.get(g.id) ?? []
              const memberNames = groupMembers
                .slice(0, 3)
                .map((m) => orgsById.get(m.organization_id)?.name ?? m.organization_id)
              const extra = groupMembers.length - memberNames.length
              return (
                <div
                  key={g.id}
                  className="rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Users className="h-4 w-4 text-[#1a3d32]" aria-hidden />
                        <h3 className="text-sm font-semibold text-neutral-900">{g.name}</h3>
                        <Badge variant="info">{groupMembers.length} medlemmer</Badge>
                        <Badge variant="neutral">Eierskap: platform-admin</Badge>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        Opprettet {new Date(g.created_at).toLocaleString('nb-NO')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {groupMembers.length === 0 ? (
                          <span className="text-xs text-neutral-400">— ingen medlemmer —</span>
                        ) : (
                          <>
                            {groupMembers.map((m) => {
                              const org = orgsById.get(m.organization_id)
                              return (
                                <span
                                  key={`${g.id}:${m.organization_id}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700"
                                >
                                  {org?.name ?? m.organization_id}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setRemoveOrg({ group: g, orgId: m.organization_id })
                                    }
                                    className="p-0 text-rose-600 hover:bg-transparent hover:text-rose-800"
                                    title="Fjern fra gruppe"
                                    aria-label={`Fjern ${org?.name ?? m.organization_id} fra gruppen`}
                                  >
                                    <UserMinus className="h-3 w-3" aria-hidden />
                                  </Button>
                                </span>
                              )
                            })}
                          </>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-neutral-500">
                        Forhåndsvisning: {memberNames.join(' · ') || '—'}
                        {extra > 0 ? ` +${extra}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<UserPlus className="h-3.5 w-3.5" />}
                        onClick={() => setAddOrgFor(g)}
                        disabled={!!pending}
                      >
                        Legg til org
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => setDeleteGroup(g)}
                        disabled={!!pending}
                      >
                        Slett gruppe
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ModuleSectionCard>

      {/* ─── Section B — create new group ─────────────────────────────────── */}
      <ModuleSectionCard className="space-y-3 p-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Ny gruppe</h2>
          <p className="text-xs text-neutral-500">
            Velg minst 2 organisasjoner. En org kan kun tilhøre én gruppe om gangen.
          </p>
        </div>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              Navn
            </span>
            <StandardInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="f.eks. Konsern Acme AS"
              className="mt-1.5"
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <label className="block text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                  Legg til organisasjon
                </span>
                <SearchableSelect
                  value={orgPick}
                  onChange={setOrgPick}
                  options={[
                    { value: '', label: '— velg org —' },
                    ...orgsAvailableForNew.map((o) => ({ value: o.id, label: o.name })),
                  ]}
                />
              </label>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={handleAddOrgToNew}
              disabled={!orgPick}
            >
              Legg til
            </Button>
          </div>
          {newSelected.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-2">
              {newSelected.map((id) => {
                const org = orgsById.get(id)
                return (
                  <span
                    key={`new:${id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] text-neutral-700 shadow-sm"
                  >
                    {org?.name ?? id}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOrgFromNew(id)}
                      className="p-0 text-rose-600 hover:bg-transparent hover:text-rose-800"
                      aria-label={`Fjern ${org?.name ?? id}`}
                    >
                      <UserMinus className="h-3 w-3" aria-hidden />
                    </Button>
                  </span>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Ingen medlemmer valgt ennå.</p>
          )}
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={pending === 'create' || newName.trim().length === 0 || newSelected.length < 2}
            >
              {pending === 'create' ? 'Oppretter…' : 'Opprett'}
            </Button>
          </div>
          <InfoBox>
            <ShieldAlert className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Gruppen får en delt 32-byte HMAC-nøkkel — service_role-only.
            Medlemsorgene ruter umiddelbart gjennom{' '}
            <code className="rounded bg-neutral-100 px-1 text-[11px]">
              alerts_text_fingerprint_shared
            </code>{' '}
            i stedet for sin per-org nøkkel.
          </InfoBox>
        </div>
      </ModuleSectionCard>

      {/* ─── Section C — per-group action dialogs ─────────────────────────── */}
      {addOrgFor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-org-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        >
          <Button
            variant="ghost"
            aria-label="Lukk"
            className="absolute inset-0 rounded-none p-0 hover:bg-transparent"
            onClick={() => {
              setAddOrgFor(null)
              setAddOrgPick('')
            }}
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <h3 id="add-org-title" className="text-lg font-semibold text-neutral-900">
              Legg til org i «{addOrgFor.name}»
            </h3>
            <p className="mt-2 text-sm text-neutral-700">
              Velg en organisasjon som ikke allerede er medlem av en annen dedup-gruppe.
            </p>
            <div className="mt-4">
              <SearchableSelect
                value={addOrgPick}
                onChange={setAddOrgPick}
                options={[
                  { value: '', label: '— velg org —' },
                  ...orgsAvailableForAdd.map((o) => ({ value: o.id, label: o.name })),
                ]}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAddOrgFor(null)
                  setAddOrgPick('')
                }}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleAddOrg()}
                disabled={!addOrgPick || pending !== null}
              >
                Legg til
              </Button>
            </div>
          </div>
        </div>
      )}

      {removeOrg && (
        <ConfirmDialog
          title="Fjern org fra dedup-gruppen?"
          body={`«${
            orgsById.get(removeOrg.orgId)?.name ?? removeOrg.orgId
          }» mister tilgang til gruppens delte HMAC-nøkkel. Orgen faller tilbake til sin per-org nøkkel og dedup mot søsterorg slutter umiddelbart for nye varsler.`}
          confirmLabel="Fjern"
          tone="danger"
          onConfirm={() => void handleRemoveOrg()}
          onCancel={() => setRemoveOrg(null)}
        />
      )}

      {deleteGroup && (
        <ConfirmDialog
          title="Slett hele dedup-gruppen?"
          body={`Gruppen «${deleteGroup.name}» og alle medlems-koplinger slettes. Den delte HMAC-nøkkelen er borte — søsterorgene slutter å matche dedup mot hverandre fra dette øyeblikket. Skriv gruppenavnet for å bekrefte.`}
          confirmLabel="Slett gruppe"
          tone="danger"
          confirmPhrase={deleteGroup.name}
          confirmPhraseLabel={'Skriv gruppenavnet "{phrase}" for å bekrefte:'}
          onConfirm={() => void handleDeleteGroup()}
          onCancel={() => setDeleteGroup(null)}
        />
      )}
    </ModulePageShell>
  )
}

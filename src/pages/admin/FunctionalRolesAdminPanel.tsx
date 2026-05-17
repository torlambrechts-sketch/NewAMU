// FunctionalRolesAdminPanel — admin-UI for tildeling av funksjonelle
// compliance-roller (verneombud, AMU-leder, DPO m.fl.) til org-medlemmer.
//
// Disse rollene er IKKE permission-roller — de er ansvars-roller som
// styrer signoff, auto-tildeling og dokument-tilgang. En person kan ha
// flere; noen roller er multi-incumbent (verneombud, AMU-medlem),
// andre single (daglig leder, hovedverneombud).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, UserCheck, Users } from 'lucide-react'
import { ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type RoleCatalog = {
  slug: string
  label: string
  description: string
  category: 'ledelse' | 'hms' | 'tillitsvalgt' | 'beredskap' | 'personvern' | 'eksternt'
  legal_basis: string[]
  multi_incumbent: boolean
  required_from_employees: number | null
  sort_order: number
}

type Assignment = {
  id: string
  role_slug: string
  user_id: string
  user_name: string | null
  user_email: string | null
  valid_from: string
  valid_to: string | null
  notes: string | null
}

type Profile = { id: string; display_name: string | null; email: string | null }

const CATEGORY_LABELS: Record<RoleCatalog['category'], string> = {
  ledelse: 'Ledelse',
  hms: 'HMS-roller',
  tillitsvalgt: 'Tillitsvalgt',
  beredskap: 'Beredskap',
  personvern: 'Personvern',
  eksternt: 'Eksternt',
}

const CATEGORY_ORDER: RoleCatalog['category'][] = [
  'ledelse',
  'hms',
  'tillitsvalgt',
  'beredskap',
  'personvern',
  'eksternt',
]

export function FunctionalRolesAdminPanel() {
  const { supabase, organization, profile } = useOrgSetupContext()
  const sb = supabase
  const canManage = profile?.is_org_admin === true
  const [catalog, setCatalog] = useState<RoleCatalog[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingSlug, setSavingSlug] = useState<string | null>(null)
  const [newAssignments, setNewAssignments] = useState<Record<string, string>>({}) // slug → user_id

  const load = useCallback(async () => {
    if (!sb || !organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [cRes, aRes, pRes] = await Promise.all([
        sb.from('functional_roles').select('*').eq('is_active', true).order('sort_order'),
        sb
          .from('org_active_role_holders')
          .select('*')
          .eq('organization_id', organization.id),
        sb.from('profiles').select('id, display_name, email').eq('organization_id', organization.id),
      ])
      if (cRes.error) throw cRes.error
      if (aRes.error) throw aRes.error
      if (pRes.error) throw pRes.error
      setCatalog((cRes.data ?? []) as RoleCatalog[])
      // Map view to Assignment shape (the view doesn't expose all columns we'd need for assignment-id; refetch raw)
      const { data: rawAssign, error: rawErr } = await sb
        .from('org_functional_role_assignments')
        .select('id, role_slug, user_id, valid_from, valid_to, notes')
        .eq('organization_id', organization.id)
        .or('valid_to.is.null,valid_to.gte.' + new Date().toISOString().split('T')[0])
      if (rawErr) throw rawErr
      const profileMap = new Map<string, Profile>(
        ((pRes.data ?? []) as Profile[]).map((p) => [p.id, p]),
      )
      setAssignments(
        ((rawAssign ?? []) as Omit<Assignment, 'user_name' | 'user_email'>[]).map((a) => ({
          ...a,
          user_name: profileMap.get(a.user_id)?.display_name ?? null,
          user_email: profileMap.get(a.user_id)?.email ?? null,
        })),
      )
      setProfiles((pRes.data ?? []) as Profile[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste')
    } finally {
      setLoading(false)
    }
  }, [sb, organization?.id])

  useEffect(() => { void load() }, [load])

  async function addAssignment(slug: string) {
    const userId = newAssignments[slug]
    if (!sb || !organization?.id || !userId) return
    setSavingSlug(slug)
    setError(null)
    try {
      const { error: e } = await sb.from('org_functional_role_assignments').insert({
        organization_id: organization.id,
        role_slug: slug,
        user_id: userId,
        assigned_by: profile?.id,
        valid_from: new Date().toISOString().split('T')[0],
      })
      if (e) throw e
      setNewAssignments((p) => ({ ...p, [slug]: '' }))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke tildele')
    } finally {
      setSavingSlug(null)
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (!sb) return
    setSavingSlug(assignmentId)
    setError(null)
    try {
      const { error: e } = await sb
        .from('org_functional_role_assignments')
        .update({ valid_to: new Date().toISOString().split('T')[0] })
        .eq('id', assignmentId)
      if (e) throw e
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke fjerne')
    } finally {
      setSavingSlug(null)
    }
  }

  const profileOptions: SelectOption[] = useMemo(
    () =>
      profiles.map((p) => ({
        value: p.id,
        label: p.display_name || p.email || p.id,
      })),
    [profiles],
  )

  const assignmentsByRole = useMemo(() => {
    const m = new Map<string, Assignment[]>()
    for (const a of assignments) {
      if (!m.has(a.role_slug)) m.set(a.role_slug, [])
      m.get(a.role_slug)!.push(a)
    }
    return m
  }, [assignments])

  const catalogByCategory = useMemo(() => {
    const m = new Map<RoleCatalog['category'], RoleCatalog[]>()
    for (const r of catalog) {
      if (!m.has(r.category)) m.set(r.category, [])
      m.get(r.category)!.push(r)
    }
    return m
  }, [catalog])

  if (!canManage) {
    return <WarningBox>Du må være org-admin for å tildele funksjonelle roller.</WarningBox>
  }

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-5 w-5 text-[#1a3d32]" aria-hidden />
        <h2 className="text-lg font-semibold text-neutral-900">Funksjonelle compliance-roller</h2>
      </div>
      <p className="mb-5 text-sm text-neutral-600">
        Tildel ansvars-roller som verneombud, AMU-medlem, DPO, varslings­mottak m.fl. Brukes til signoff på dokumenter, auto-tildeling av opplæring og rolle-basert tilgang.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Henter…
        </div>
      ) : null}
      {error ? <WarningBox>{error}</WarningBox> : null}

      <div className="space-y-6">
        {CATEGORY_ORDER.map((cat) => {
          const roles = catalogByCategory.get(cat)
          if (!roles || roles.length === 0) return null
          return (
            <div key={cat}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-3">
                {roles.map((role) => {
                  const current = assignmentsByRole.get(role.slug) ?? []
                  const canAddMore = role.multi_incumbent || current.length === 0
                  return (
                    <div key={role.slug} className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-[#1a3d32]" />
                            <h4 className="text-sm font-semibold text-neutral-900">{role.label}</h4>
                            {role.multi_incumbent ? (
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600">
                                Flere mulig
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                                Én person
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-neutral-600">{role.description}</p>
                          {role.legal_basis.length > 0 ? (
                            <p className="mt-1 text-[11px] text-neutral-500">
                              <strong>Hjemmel:</strong> {role.legal_basis.join(' · ')}
                            </p>
                          ) : null}
                          {role.required_from_employees ? (
                            <p className="mt-0.5 text-[11px] text-neutral-500">
                              <strong>Pliktig fra:</strong> {role.required_from_employees} ansatte
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {current.length > 0 ? (
                        <div className="mt-3 space-y-1.5">
                          {current.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5 text-xs"
                            >
                              <div>
                                <span className="font-medium text-neutral-900">{a.user_name ?? '—'}</span>
                                <span className="ml-2 text-neutral-500">{a.user_email ?? ''}</span>
                                <span className="ml-2 text-neutral-400">
                                  fra {new Date(a.valid_from).toLocaleDateString('nb-NO')}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeAssignment(a.id)}
                                disabled={savingSlug === a.id}
                                icon={<Trash2 className="h-3 w-3" />}
                                className="text-red-700 hover:bg-red-50"
                              >
                                Fjern
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {canAddMore ? (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1">
                            <SearchableSelect
                              value={newAssignments[role.slug] ?? ''}
                              options={profileOptions}
                              onChange={(v) =>
                                setNewAssignments((p) => ({ ...p, [role.slug]: v as string }))
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => addAssignment(role.slug)}
                            disabled={!newAssignments[role.slug] || savingSlug === role.slug}
                          >
                            {savingSlug === role.slug ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="mr-1 h-3 w-3" />
                            )}
                            Tildel
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-neutral-500">
                          Denne rollen tillater bare én person. Fjern eksisterende først for å tildele ny.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </ModuleSectionCard>
  )
}

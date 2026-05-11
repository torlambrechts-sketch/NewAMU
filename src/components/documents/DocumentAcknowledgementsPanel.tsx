// Lists who in the page's audience has and hasn't signed the current
// version. Mirrors the audience-resolution rules used by
// userMustAcknowledgePage() in useDocuments — keeps the two sides in sync.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock } from 'lucide-react'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { Badge } from '../ui/Badge'
import type { AcknowledgementAudience, ComplianceReceipt, WikiPage } from '../../types/documents'

type Props = {
  page: WikiPage
  receipts: ComplianceReceipt[]
}

type AudienceMember = {
  userId: string
  displayName: string
  email: string | null
}

const AUDIENCE_LABEL: Record<AcknowledgementAudience, string> = {
  all_employees: 'Alle ansatte',
  leaders_only: 'Kun ledere',
  safety_reps_only: 'Kun verneombud / HMS-rep',
  department: 'Bestemt avdeling',
}

export function DocumentAcknowledgementsPanel({ page, receipts }: Props) {
  const { supabase, organization, members, orgProfiles, departments } = useOrgSetupContext()
  const audience = (page.acknowledgementAudience ?? 'all_employees') as AcknowledgementAudience
  const orgId = organization?.id ?? null
  const [audienceUsers, setAudienceUsers] = useState<AudienceMember[]>([])
  const [loading, setLoading] = useState(false)

  const department = useMemo(
    () => departments.find((d) => d.id === page.acknowledgementDepartmentId) ?? null,
    [departments, page.acknowledgementDepartmentId],
  )

  const resolveAudience = useCallback(async () => {
    if (!page.requiresAcknowledgement) {
      setAudienceUsers([])
      return
    }
    setLoading(true)
    try {
      const profileMap = new Map(orgProfiles.map((p) => [p.id, p]))
      const baseMembers: AudienceMember[] = members.map((m) => ({
        userId: m.id,
        displayName: profileMap.get(m.id)?.display_name ?? m.display_name,
        email: profileMap.get(m.id)?.email ?? m.email ?? null,
      }))
      if (audience === 'all_employees') {
        setAudienceUsers(baseMembers)
        return
      }
      if (audience === 'department') {
        const deptId = page.acknowledgementDepartmentId
        if (!deptId) {
          setAudienceUsers(baseMembers)
          return
        }
        setAudienceUsers(baseMembers.filter((_m, idx) => members[idx]?.department_id === deptId))
        return
      }
      if ((audience === 'leaders_only' || audience === 'safety_reps_only') && supabase && orgId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, email, is_org_admin, learning_metadata')
          .eq('organization_id', orgId)
        if (error) {
          setAudienceUsers([])
          return
        }
        type ProfileRow = {
          id: string
          display_name: string
          email: string | null
          is_org_admin: boolean | null
          learning_metadata: Record<string, unknown> | null
        }
        const rows = (data ?? []) as ProfileRow[]
        const filtered = rows.filter((r) => {
          if (audience === 'leaders_only') return r.is_org_admin === true
          return r.learning_metadata?.is_safety_rep === true
        })
        setAudienceUsers(
          filtered.map((r) => ({ userId: r.id, displayName: r.display_name, email: r.email })),
        )
        return
      }
      setAudienceUsers(baseMembers)
    } finally {
      setLoading(false)
    }
  }, [audience, page.requiresAcknowledgement, page.acknowledgementDepartmentId, members, orgProfiles, supabase, orgId])

  useEffect(() => {
    void resolveAudience()
  }, [resolveAudience])

  const signedSet = useMemo(() => {
    const set = new Set<string>()
    for (const r of receipts) {
      if (r.pageId === page.id && r.pageVersion === page.version) set.add(r.userId)
    }
    return set
  }, [receipts, page.id, page.version])

  if (!page.requiresAcknowledgement) {
    return (
      <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-500">
        Dette dokumentet krever ikke signatur. Aktiver «Lest og forstått» i Innstillinger for å målrette dokumentet til
        en gruppe.
      </p>
    )
  }

  const signed = audienceUsers.filter((u) => signedSet.has(u.userId))
  const unsigned = audienceUsers.filter((u) => !signedSet.has(u.userId))
  const total = audienceUsers.length
  const signedCount = signed.length
  const ratio = total === 0 ? 0 : Math.round((signedCount / total) * 100)

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={signedCount === total && total > 0 ? 'success' : 'warning'}>
          {signedCount}/{total} signert ({ratio}%)
        </Badge>
        <span className="text-[11px] text-neutral-500">
          Målgruppe: {AUDIENCE_LABEL[audience]}
          {audience === 'department' && department ? ` — ${department.name}` : ''} · v{page.version}
        </span>
      </div>

      {loading ? (
        <p className="text-neutral-500">Laster…</p>
      ) : total === 0 ? (
        <p className="rounded border border-dashed border-neutral-200 bg-neutral-50 p-3 text-neutral-500">
          Ingen i målgruppen ennå — sjekk at avdelingen / rollen er definert.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded border border-emerald-200 bg-emerald-50/40 p-3">
            <h4 className="mb-2 text-[11px] font-semibold text-emerald-900">Signert ({signed.length})</h4>
            {signed.length === 0 ? (
              <p className="text-[11px] text-neutral-500">Ingen ennå.</p>
            ) : (
              <ul className="space-y-1">
                {signed.map((u) => (
                  <li key={u.userId} className="flex items-center gap-1.5 text-neutral-700">
                    <CheckCircle2 className="size-3 text-emerald-600" aria-hidden />
                    {u.displayName}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded border border-amber-200 bg-amber-50/40 p-3">
            <h4 className="mb-2 text-[11px] font-semibold text-amber-900">Mangler signatur ({unsigned.length})</h4>
            {unsigned.length === 0 ? (
              <p className="text-[11px] text-neutral-500">Ingen — gratulerer!</p>
            ) : (
              <ul className="space-y-1">
                {unsigned.map((u) => (
                  <li key={u.userId} className="flex items-center gap-1.5 text-neutral-700">
                    <Clock className="size-3 text-amber-700" aria-hidden />
                    {u.displayName}
                    {u.email ? <span className="text-[10px] text-neutral-400">— {u.email}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

// TrainingMatrix — rolle × kurs matrise med opplærings-status.
//
// Henter fra training_matrix_view som speiler functional_role_assignments
// mot learning_progress. Brukes i HMS-håndbok-templates for å vise live
// compliance-status på opplæring per rolle.

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, GraduationCap, Loader2, XCircle } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

type Props = {
  /** Filter til spesifikke rolle-slugs. Tom = alle aktive roller. */
  roleSlugs?: string[]
  /** Filter til spesifikke kurs-IDs. Tom = alle publiserte kurs. */
  courseIds?: string[]
  /** Vis bare rader med status != completed (default false) */
  onlyGaps?: boolean
}

type Row = {
  role_slug: string
  role_label: string
  user_id: string
  user_name: string | null
  course_id: string
  course_title: string
  completed_at: string | null
  completion_status: 'not_started' | 'completed' | 'expired' | 'expiring_soon'
}

const STATUS_META = {
  completed: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Bestått' },
  expiring_soon: { icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50', label: 'Utløper snart' },
  expired: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50', label: 'Utløpt' },
  not_started: { icon: XCircle, color: 'text-neutral-500', bg: 'bg-neutral-50', label: 'Ikke startet' },
} as const

export function TrainingMatrix({ roleSlugs, courseIds, onlyGaps = false }: Props) {
  const { supabase, organization } = useOrgSetupContext()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || !organization?.id) return
    let q = supabase
      .from('training_matrix_view')
      .select('role_slug, role_label, user_id, user_name, course_id, course_title, completed_at, completion_status')
      .eq('organization_id', organization.id)
    if (roleSlugs && roleSlugs.length > 0) q = q.in('role_slug', roleSlugs)
    if (courseIds && courseIds.length > 0) q = q.in('course_id', courseIds)
    void q.order('role_slug').order('user_name').then(({ data, error: e }) => {
      if (e) setError(e.message)
      else setRows((data ?? []) as Row[])
    })
  }, [supabase, organization?.id, roleSlugs, courseIds])

  // Gruppér rader: rolle → bruker → kurs
  const grouped = useMemo(() => {
    if (!rows) return null
    const byRole = new Map<string, { label: string; users: Map<string, { name: string; courses: Row[] }> }>()
    for (const r of rows) {
      if (onlyGaps && r.completion_status === 'completed') continue
      let g = byRole.get(r.role_slug)
      if (!g) {
        g = { label: r.role_label, users: new Map() }
        byRole.set(r.role_slug, g)
      }
      let u = g.users.get(r.user_id)
      if (!u) {
        u = { name: r.user_name ?? '—', courses: [] }
        g.users.set(r.user_id, u)
      }
      u.courses.push(r)
    }
    return byRole
  }, [rows, onlyGaps])

  return (
    <div className="not-prose my-6 rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-800">
        <GraduationCap className="h-4 w-4" />
        Opplærings-matrise
        {onlyGaps ? <span className="ml-2 text-xs text-amber-700">(viser kun mangler)</span> : null}
      </div>
      {rows === null ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Henter opplærings­data…
        </div>
      ) : error ? (
        <div className="text-xs text-red-700">Kunne ikke laste: {error}</div>
      ) : !grouped || grouped.size === 0 ? (
        <div className="text-xs text-neutral-500">
          Ingen rolle-tildelinger eller kurs funnet. Tildel funksjonelle roller under <strong>Admin → Roller</strong>.
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([slug, group]) => (
            <div key={slug}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {group.label}
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-neutral-600">
                    <tr>
                      <th className="py-1 text-left font-medium">Person</th>
                      <th className="py-1 text-left font-medium">Kurs</th>
                      <th className="py-1 text-left font-medium">Status</th>
                      <th className="py-1 text-left font-medium">Dato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...group.users.entries()].map(([userId, user]) =>
                      user.courses.map((c, i) => {
                        const meta = STATUS_META[c.completion_status]
                        const Icon = meta.icon
                        return (
                          <tr key={`${userId}-${c.course_id}`} className="border-t border-neutral-100">
                            <td className="py-1.5 text-neutral-700">
                              {i === 0 ? user.name : ''}
                            </td>
                            <td className="py-1.5 text-neutral-700">{c.course_title}</td>
                            <td className="py-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${meta.bg} ${meta.color}`}
                              >
                                <Icon className="h-3 w-3" />
                                {meta.label}
                              </span>
                            </td>
                            <td className="py-1.5 text-neutral-500">
                              {c.completed_at
                                ? new Date(c.completed_at).toLocaleDateString('nb-NO')
                                : '—'}
                            </td>
                          </tr>
                        )
                      }),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

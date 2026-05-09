// Public read-only auditor view — accessible via signed token URL.
// No authentication required; the token scopes access to one project.
// Route: /tasks/audit/:token
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getSupabasePublicConfig } from '../../lib/supabaseClient'
import type { TaskItem, TaskPack, TaskProject, TaskProjectEvidence } from '../../types/task'

type TokenPayload = {
  token: string
  organizationId: string
  projectId: string
  pack: TaskPack
  expiresAt: string
  revokedAt?: string
}

type AuditData = {
  orgName: string
  pack: TaskPack
  project: TaskProject
  tasks: TaskItem[]
  evidence: TaskProjectEvidence[]
  generatedAt: string
}

function mapProjectRow(r: Record<string, unknown>): TaskProject {
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    pack: r.pack as TaskPack,
    title: r.title as string,
    description: (r.description as string) ?? '',
    methodology: (r.methodology as TaskProject['methodology']) ?? 'pdca',
    status: (r.status as TaskProject['status']) ?? 'active',
    startDate: (r.start_date as string) ?? undefined,
    endDate: (r.end_date as string) ?? undefined,
    lawRefs: (r.law_refs as string[]) ?? [],
    leadUserId: (r.lead_user_id as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }
}

export function TasksAuditView() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AuditData | null>(null)

  useEffect(() => {
    if (!token) { setError('Ugyldig token'); setLoading(false); return }

    const cfg = getSupabasePublicConfig()
    if (!cfg) { setError('Konfigurasjonsfeil'); setLoading(false); return }
    const supabase = createClient(cfg.url, cfg.anonKey)

    async function load() {
      try {
        // Fetch token row (no RLS bypassing — token is unique index, readable via anon)
        const { data: tokenRow, error: tokenErr } = await supabase
          .from('task_export_tokens')
          .select('*')
          .eq('token', token)
          .is('revoked_at', null)
          .single()

        if (tokenErr || !tokenRow) { setError('Token ikke funnet eller utgått'); return }
        const t = tokenRow as unknown as Record<string, unknown>
        const tok: TokenPayload = {
          token: t.token as string,
          organizationId: t.organization_id as string,
          projectId: t.project_id as string,
          pack: t.pack as TaskPack,
          expiresAt: t.expires_at as string,
          revokedAt: (t.revoked_at as string) ?? undefined,
        }

        if (new Date(tok.expiresAt) < new Date()) { setError('Revisortilgangen er utgått'); return }

        // Fetch project, tasks, evidence using org context from token
        const [projectRes, tasksRes, evidenceRes, orgRes] = await Promise.all([
          supabase.from('task_projects').select('*').eq('id', tok.projectId).single(),
          supabase.from('task_items').select('*').eq('project_id', tok.projectId).is('deleted_at', null),
          supabase.from('task_project_evidence').select('*').eq('project_id', tok.projectId),
          supabase.from('organizations').select('name').eq('id', tok.organizationId).single(),
        ])

        if (projectRes.error || !projectRes.data) { setError('Prosjekt ikke tilgjengelig'); return }

        const project = mapProjectRow(projectRes.data as Record<string, unknown>)

        setData({
          orgName: (orgRes.data as { name: string } | null)?.name ?? 'Organisasjon',
          pack: tok.pack,
          project,
          tasks: (tasksRes.data ?? []) as unknown as TaskItem[],
          evidence: (evidenceRes.data ?? []) as unknown as TaskProjectEvidence[],
          generatedAt: new Date().toISOString(),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ukjent feil')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-sm text-neutral-400">Laster revisordokumentasjon...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="max-w-sm rounded border border-red-200 bg-red-50 p-6 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-red-400" aria-hidden />
          <h1 className="text-base font-semibold text-red-800">Tilgang ikke tilgjengelig</h1>
          <p className="mt-1 text-sm text-red-600">{error ?? 'Ukjent feil'}</p>
        </div>
      </div>
    )
  }

  const { project, tasks, evidence, orgName, pack } = data
  const done = tasks.filter((t) => t.status === 'done').length
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0
  const allLawRefs = [...new Set(tasks.flatMap((t) => t.lawRefs ?? []))].sort()

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-6 rounded border border-neutral-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#c2410c]" aria-hidden />
                <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Revisordokumentasjon · {pack === 'aml-amu' ? 'AML' : 'ISO 45001'}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-semibold text-neutral-900">{project.title}</h1>
              <p className="mt-0.5 text-sm text-neutral-500">
                {orgName} · {new Date().toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              {project.description && (
                <p className="mt-2 text-sm text-neutral-600">{project.description}</p>
              )}
            </div>
            <div className="shrink-0 rounded border border-neutral-200 p-3 text-center">
              <div className="text-2xl font-bold text-neutral-900">{pct}%</div>
              <div className="text-xs text-neutral-400">{done}/{tasks.length} fullført</div>
            </div>
          </div>
          {project.lawRefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {project.lawRefs.map((ref) => (
                <span key={ref} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{ref}</span>
              ))}
            </div>
          )}
        </div>

        {/* Law ref coverage */}
        {allLawRefs.length > 0 && (
          <div className="mb-6 rounded border border-neutral-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Paragrafdekning</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs text-neutral-500">
                  <th className="pb-2 text-left font-semibold">Paragraf</th>
                  <th className="pb-2 text-center font-semibold">Oppgaver</th>
                  <th className="pb-2 text-center font-semibold">Fullført</th>
                  <th className="pb-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {allLawRefs.map((ref) => {
                  const refTasks = tasks.filter((t) => (t.lawRefs ?? []).includes(ref))
                  const refDone = refTasks.filter((t) => t.status === 'done').length
                  return (
                    <tr key={ref}>
                      <td className="py-2 pr-4">
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{ref}</span>
                      </td>
                      <td className="py-2 text-center text-sm text-neutral-700">{refTasks.length}</td>
                      <td className="py-2 text-center text-sm text-neutral-700">{refDone}</td>
                      <td className="py-2 text-center text-xs">
                        {refTasks.length === 0
                          ? <span className="text-red-500">Ingen dekning</span>
                          : refDone === refTasks.length
                          ? <span className="font-medium text-green-700">Fullt dekket</span>
                          : <span className="text-orange-700">{Math.round((refDone / refTasks.length) * 100)}%</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tasks */}
        <div className="mb-6 rounded border border-neutral-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Oppgaver ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <p className="text-sm italic text-neutral-400">Ingen oppgaver.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded border border-neutral-100 p-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    t.status === 'done' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-orange-400' : 'bg-neutral-300'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-800">{t.title}</div>
                    {t.description && (
                      <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{t.description}</div>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(t.lawRefs ?? []).map((ref) => (
                        <span key={ref} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">{ref}</span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-neutral-400">
                    {t.assigneeName && <div>{t.assigneeName}</div>}
                    {t.dueDate && <div>{t.dueDate}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence */}
        {evidence.length > 0 && (
          <div className="mb-6 rounded border border-neutral-200 bg-white p-6">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900">Bevislogg ({evidence.length})</h2>
            <div className="space-y-1">
              {evidence.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 rounded border border-neutral-100 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-neutral-700">{ev.label}</span>
                  <span className="shrink-0 text-xs text-neutral-400">
                    {new Date(ev.createdAt).toLocaleDateString('nb-NO')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-neutral-400">
          Dette dokumentet er generert av Klarert AS og er tidsbegrenset til 30 dager fra utstedelsesdato.
        </p>
      </div>
    </div>
  )
}

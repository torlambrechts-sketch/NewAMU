// Revisorpakke — 04 auditor package tab.
//
// Read-only layout that renders a project-level compliance overview:
// law-refs coverage table, per-project task + evidence summary, and
// the "Del revisorpakke" button that generates a signed 30-day token.
// This same layout is re-used by the public TasksAuditView (/tasks/audit/:token).
import { useMemo, useState } from 'react'
import { CheckCircle, Clock, FileText, Share2, XCircle } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { TaskItem, TaskPack, TaskProject, TaskProjectEvidence } from '../../../src/types/task'
import { useTaskItems } from '../useTaskItems'
import { useTaskProjects } from '../useTaskProjects'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useOrganisation } from '../../../src/hooks/useOrganisation'

type AuditProject = {
  project: TaskProject
  tasks: TaskItem[]
  evidence: TaskProjectEvidence[]
}

type Props = {
  /** When rendering from token URL (public view), pass pre-fetched data */
  tokenData?: {
    orgName: string
    pack: TaskPack
    projects: AuditProject[]
    generatedAt: string
  }
}

const PACK_LABELS: Record<TaskPack, string> = {
  'aml-amu': 'Arbeidsmiljøloven (AML)',
  'iso-45001': 'ISO 45001:2018',
}

function CoverageRow({
  lawRef,
  items,
}: {
  lawRef: string
  items: TaskItem[]
}) {
  const total = items.length
  const done = items.filter((t) => t.status === 'done').length
  const open = items.filter((t) => t.status !== 'done').length

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="py-2 pr-4">
        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">{lawRef}</span>
      </td>
      <td className="py-2 pr-4 text-center text-sm text-neutral-700">{total}</td>
      <td className="py-2 pr-4 text-center">
        <span className="flex items-center justify-center gap-1 text-sm text-green-700">
          <CheckCircle className="h-3.5 w-3.5" aria-hidden />
          {done}
        </span>
      </td>
      <td className="py-2 pr-4 text-center">
        <span className="flex items-center justify-center gap-1 text-sm text-orange-700">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {open}
        </span>
      </td>
      <td className="py-2 text-center">
        {total === 0 ? (
          <span className="flex items-center justify-center gap-1 text-xs text-red-500">
            <XCircle className="h-3.5 w-3.5" aria-hidden />
            Ingen dekning
          </span>
        ) : done === total ? (
          <span className="text-xs font-medium text-green-700">Fullt dekket</span>
        ) : (
          <span className="text-xs text-orange-700">{Math.round((done / total) * 100)}% fullført</span>
        )}
      </td>
    </tr>
  )
}

export function TasksAuditPackTab({ tokenData }: Props = {}) {
  const [searchParams] = useSearchParams()
  const activePack = (searchParams.get('pack') as TaskPack | null) ?? 'aml-amu'
  const { organisation } = useOrganisation()
  const { supabase } = useOrgSetupContext()
  const [shareLoading, setShareLoading] = useState(false)
  const [shareResults, setShareResults] = useState<Record<string, string>>({})

  const { items, loading: itemsLoading } = useTaskItems({ pack: activePack })
  const { projects, loading: projectsLoading } = useTaskProjects(activePack)

  const loading = itemsLoading || projectsLoading

  // Build coverage table: all unique law_refs across items
  const allLawRefs = useMemo(() => {
    const refs = new Set<string>()
    items.forEach((t) => t.lawRefs.forEach((r) => refs.add(r)))
    return Array.from(refs).sort()
  }, [items])

  const itemsByLawRef = useMemo(() => {
    const map = new Map<string, TaskItem[]>()
    for (const ref of allLawRefs) {
      map.set(ref, items.filter((t) => t.lawRefs.includes(ref)))
    }
    return map
  }, [items, allLawRefs])

  const projectItems = useMemo(() => {
    const map = new Map<string, TaskItem[]>()
    for (const p of projects) {
      map.set(p.id, items.filter((t) => t.projectId === p.id))
    }
    return map
  }, [projects, items])

  const handleShare = async (projectId: string) => {
    if (!supabase) return
    setShareLoading(true)
    try {
      const { data, error } = await supabase.rpc('generate_task_export_token', {
        p_project_id: projectId,
      })
      if (!error && data) {
        const url = `${window.location.origin}/tasks/audit/${data as string}`
        setShareResults((prev) => ({ ...prev, [projectId]: url }))
        await navigator.clipboard.writeText(url)
      }
    } finally {
      setShareLoading(false)
    }
  }

  // When rendering from public token URL, use pre-fetched tokenData
  const orgName = tokenData?.orgName ?? organisation?.name ?? 'Organisasjon'
  const pack = tokenData?.pack ?? activePack
  const generatedAt = tokenData?.generatedAt ?? new Date().toISOString()

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="rounded border border-neutral-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Revisordokumentasjon</h1>
            <p className="mt-1 text-sm text-neutral-500">
              {orgName} · {PACK_LABELS[pack]} ·{' '}
              {new Date(generatedAt).toLocaleDateString('nb-NO', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-center">
            <div className="text-2xl font-bold text-blue-900">{items.filter((t) => t.status === 'done').length}</div>
            <div className="text-[10px] text-blue-600">av {items.length} fullført</div>
          </div>
        </div>
      </div>

      {/* Coverage table */}
      <div className="rounded border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          Paragrafdekning
        </h2>
        {loading ? (
          <div className="h-24 animate-pulse rounded bg-neutral-100" />
        ) : allLawRefs.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">Ingen lovhenvisninger registrert.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="pb-2 pr-4 text-xs font-semibold text-neutral-500">Paragraf</th>
                <th className="pb-2 pr-4 text-center text-xs font-semibold text-neutral-500">Totalt</th>
                <th className="pb-2 pr-4 text-center text-xs font-semibold text-neutral-500">Fullført</th>
                <th className="pb-2 pr-4 text-center text-xs font-semibold text-neutral-500">Åpne</th>
                <th className="pb-2 text-center text-xs font-semibold text-neutral-500">Dekning</th>
              </tr>
            </thead>
            <tbody>
              {allLawRefs.map((ref) => (
                <CoverageRow
                  key={ref}
                  lawRef={ref}
                  items={itemsByLawRef.get(ref) ?? []}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-project sections */}
      {projects.length === 0 && !loading ? (
        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-400">
          Ingen prosjekter opprettet ennå.
        </div>
      ) : (
        projects.map((project) => {
          const pItems = projectItems.get(project.id) ?? []
          const done = pItems.filter((t) => t.status === 'done').length
          const pct = pItems.length > 0 ? Math.round((done / pItems.length) * 100) : 0
          const sharedUrl = shareResults[project.id]

          return (
            <div key={project.id} className="rounded border border-neutral-200 bg-white p-6">
              {/* Project header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-neutral-900">{project.title}</h3>
                  {project.description && (
                    <p className="mt-0.5 text-sm text-neutral-500">{project.description}</p>
                  )}
                  {project.lawRefs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {project.lawRefs.map((ref) => (
                        <span key={ref} className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-bold text-neutral-900">{pct}%</div>
                  <div className="text-xs text-neutral-400">{done} / {pItems.length} fullført</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="my-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-[#c2410c]" style={{ width: `${pct}%` }} />
              </div>

              {/* Tasks summary */}
              {pItems.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs font-medium text-neutral-500">Oppgaver</div>
                  <div className="space-y-1">
                    {pItems.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          t.status === 'done' ? 'bg-green-500' : t.status === 'in_progress' ? 'bg-orange-400' : 'bg-neutral-300'
                        }`} />
                        <span className="min-w-0 flex-1 truncate text-neutral-700">{t.title}</span>
                        {t.lawRefs.length > 0 && (
                          <span className="shrink-0 text-[10px] text-neutral-400">{t.lawRefs[0]}</span>
                        )}
                      </div>
                    ))}
                    {pItems.length > 5 && (
                      <div className="text-xs text-neutral-400">+{pItems.length - 5} flere oppgaver</div>
                    )}
                  </div>
                </div>
              )}

              {/* Share button — hidden in token view */}
              {!tokenData && (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  {sharedUrl ? (
                    <div className="flex items-center gap-2 rounded bg-green-50 px-3 py-2 text-xs text-green-800">
                      <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{sharedUrl}</span>
                      <span className="shrink-0 font-medium">Kopiert!</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleShare(project.id)}
                      disabled={shareLoading}
                      className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden />
                      Del revisorpakke (30 dager)
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

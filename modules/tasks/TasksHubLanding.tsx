// TasksHubLanding — neutral hub rendered when /tasks/management has no ?template= or ?project= param.
// Templates are grouped by admin-assigned category into tile sections.
// Projects section is rendered below templates.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KanbanSquare, Plus, Settings, Sparkles } from 'lucide-react'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { FavoriteToggle } from '../../src/components/favorites/FavoriteToggle'
import { TaskKindIcon } from './components/TaskKindIcon'
import type { TaskTemplateRow, TaskCategoryRow } from './useTaskTemplates'
import type { TaskProject } from './useTaskProjects'

type Props = {
  templates: TaskTemplateRow[]
  categories: TaskCategoryRow[]
  loading: boolean
  canManage: boolean
  projects?: TaskProject[]
  onCreateProject?: () => void
  onOpenProject?: (id: string) => void
}

const UNCATEGORISED_KEY = '__uncategorised__'

type Bucket = {
  key: string
  name: string
  description: string
  position: number
  templates: TaskTemplateRow[]
}

function fmtDate(s: string | undefined) {
  if (!s) return null
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return s
  }
}

export function TasksHubLanding({
  templates,
  categories,
  loading,
  canManage,
  projects = [],
  onCreateProject,
  onOpenProject,
}: Props) {
  const navigate = useNavigate()
  const [showAllProjects, setShowAllProjects] = useState(false)

  const buckets = useMemo<Bucket[]>(() => {
    const catBuckets: Bucket[] = categories.map((c) => ({
      key: c.id,
      name: c.name,
      description: c.description,
      position: c.position,
      templates: [],
    }))

    const uncategorised: Bucket = {
      key: UNCATEGORISED_KEY,
      name: 'Uten kategori',
      description: '',
      position: 9999,
      templates: [],
    }

    const byKey = new Map<string, Bucket>([
      ...catBuckets.map((b) => [b.key, b] as const),
      [UNCATEGORISED_KEY, uncategorised],
    ])

    const sortedTemplates = [...templates].sort((a, b) => {
      const tier = (t: TaskTemplateRow) => (t.navPinned ? 0 : t.isSystem ? 1 : 2)
      const d = tier(a) - tier(b)
      return d !== 0 ? d : a.name.localeCompare(b.name, 'nb')
    })

    for (const t of sortedTemplates) {
      const target = (t.categoryId && byKey.get(t.categoryId)) || uncategorised
      target.templates.push(t)
    }

    return [
      ...catBuckets.filter((b) => b.templates.length > 0),
      ...(uncategorised.templates.length > 0 ? [uncategorised] : []),
    ]
  }, [templates, categories])

  if (loading && templates.length === 0) {
    return <p className="py-16 text-center text-sm text-neutral-500">Laster maler…</p>
  }

  if (templates.length === 0) {
    return (
      <ModuleSectionCard className="p-6">
        <p className="text-sm text-neutral-700">
          Ingen oppgavemaler er aktivert for organisasjonen ennå.
        </p>
        {canManage && (
          <p className="mt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate('/tasks/management/admin')}
            >
              Gå til innstillinger
            </Button>
          </p>
        )}
      </ModuleSectionCard>
    )
  }

  return (
    <div className="space-y-5">
      {buckets.map((bucket) => (
        <ModuleSectionCard key={bucket.key} className="p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-baseline gap-2 border-b border-neutral-200/70 pb-2">
            <h2 className="text-sm font-semibold text-neutral-900">{bucket.name}</h2>
            <span className="text-xs text-neutral-500">{bucket.templates.length}</span>
            {bucket.description && (
              <span className="ml-1 text-xs text-neutral-500">· {bucket.description}</span>
            )}
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bucket.templates.map((t) => (
              <li key={t.id} className="relative">
                <FavoriteToggle
                  kind="task"
                  templateRef={t.id}
                  templateName={t.name}
                  size="sm"
                  className="absolute right-1.5 top-1.5 z-10 bg-white/90"
                />
                <Button
                  variant="ghost"
                  onClick={() =>
                    navigate(`/tasks/management?template=${encodeURIComponent(t.slug)}`)
                  }
                  className="group flex h-full w-full flex-col items-start gap-2.5 rounded-lg border border-neutral-200/80 bg-white p-4 text-left font-normal transition-all hover:border-[#c2410c]/30 hover:bg-orange-50/30 hover:shadow-sm"
                >
                  <div className="flex w-full items-start gap-2.5 pr-6">
                    <span className="mt-0.5 shrink-0 text-[#c2410c]/60 transition group-hover:text-[#c2410c]">
                      <TaskKindIcon kind={t.templateKind} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#c2410c]">
                        {t.name}
                      </span>
                      {t.cadenceHint && (
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {t.cadenceHint}
                        </span>
                      )}
                    </span>
                    {t.navPinned && (
                      <Badge variant="success">
                        <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
                        Festet
                      </Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="line-clamp-2 text-xs text-neutral-500">{t.description}</p>
                  )}
                  {t.lawRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.lawRefs.slice(0, 3).map((ref) => (
                        <span
                          key={ref}
                          className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </ModuleSectionCard>
      ))}

      {/* Projects section */}
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200/70 pb-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-neutral-900">Prosjekttavler</h2>
            <span className="text-xs text-neutral-500">{projects.filter((p) => p.status === 'active').length} aktive</span>
          </div>
          <div className="flex items-center gap-2">
            {projects.some((p) => p.status !== 'active') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllProjects((v) => !v)}
                className="px-0 text-xs text-neutral-400 underline-offset-2 hover:bg-transparent hover:text-neutral-600 hover:underline"
              >
                {showAllProjects
                  ? 'Skjul avsluttede'
                  : `Vis avsluttede (${projects.filter((p) => p.status !== 'active').length})`}
              </Button>
            )}
            {onCreateProject && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onCreateProject}
                icon={<Plus className="h-3.5 w-3.5" />}
                className="border-neutral-200 hover:border-[#c2410c]/30 hover:text-[#c2410c]"
              >
                Nytt prosjekt
              </Button>
            )}
          </div>
        </div>

        {projects.filter((p) => showAllProjects || p.status === 'active').length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-500">
            Ingen aktive prosjekttavler.{' '}
            {onCreateProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCreateProject}
                className="px-0 text-[#c2410c] underline-offset-2 hover:bg-transparent hover:underline"
              >
                Opprett det første
              </Button>
            )}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.filter((p) => showAllProjects || p.status === 'active').map((proj) => (
              <li key={proj.id}>
                <Button
                  variant="ghost"
                  onClick={() => (onOpenProject ? onOpenProject(proj.id) : undefined)}
                  className={`group flex h-full w-full flex-col items-start gap-2 rounded-lg border p-4 text-left font-normal transition-all ${
                    proj.status === 'active'
                      ? 'border-neutral-200/80 bg-white hover:border-[#c2410c]/30 hover:bg-orange-50/30 hover:shadow-sm'
                      : 'border-neutral-200/50 bg-neutral-50/60 opacity-60 hover:opacity-80'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-[#c2410c]/60 transition group-hover:text-[#c2410c]">
                      <KanbanSquare className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#c2410c]">
                        {proj.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {proj.methodology}
                        </span>
                        {proj.status !== 'active' && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                            {proj.status === 'closed' ? 'Lukket' : 'Arkivert'}
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                  {proj.description && (
                    <p className="line-clamp-2 text-xs text-neutral-500">{proj.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
                    {proj.startDate && <span>Fra {fmtDate(proj.startDate)}</span>}
                    {proj.endDate && <span>Til {fmtDate(proj.endDate)}</span>}
                  </div>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      {canManage && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tasks/management/admin')}
            icon={<Settings className="h-3.5 w-3.5" />}
            className="px-0 text-xs text-neutral-400 hover:bg-transparent hover:text-neutral-600"
          >
            Administrer maler
          </Button>
        </div>
      )}
    </div>
  )
}

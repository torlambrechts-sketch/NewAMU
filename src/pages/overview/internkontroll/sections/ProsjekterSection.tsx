// Prosjekter — compliance initiatives backed by public.task_projects.
//
// Phase 2 of the Tasks-module alignment: this section is now a thin
// reader over `task_projects` (joined to `compliance_plan_items` via
// the new `project_id` FK). Legacy free-text milestones still surface
// as pseudo-projects with a "Konverter til prosjekt" CTA so old data
// keeps working during the transition.
//
// Writes:
//   - "Nytt prosjekt" creates a `task_projects` row via the canonical
//     `useTaskProjects` hook (single source of truth for project records).
//   - "Konverter til prosjekt" on a legacy card mints a task_projects
//     row from the milestone string and updates every plan-item that
//     shared that string to point at the new project_id.

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  Check,
  FolderKanban,
  Plus,
  ShieldCheck,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { StandardInput } from '../../../../components/ui/Input'
import { StandardTextarea } from '../../../../components/ui/Textarea'
import { SearchableSelect } from '../../../../components/ui/SearchableSelect'
import {
  FwChip,
  Initials,
  SectionBanner,
  StatusDot,
  TiltakStatusPill,
} from './internkontrollShared'
import type { useCompliancePlanItems } from '../useCompliancePlanItems'
import { useTaskProjects } from '../../../../../modules/tasks/useTaskProjects'
import type { IkData, IkProsjekt } from '../useInternkontrollPageData'

type PlanHook = ReturnType<typeof useCompliancePlanItems>

export function ProsjekterSection({
  data,
  plan,
  onProjectsChanged,
  search = '',
}: {
  data: IkData
  plan: PlanHook
  /** Invoked after a project is created / converted so the page-level
   *  data hook refreshes (and the new row appears in `data.prosjekter`
   *  without a remount). */
  onProjectsChanged: () => void
  /** Free-text search from the page-level Søk row. */
  search?: string
}) {
  const filteredProsjekter = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.prosjekter
    return data.prosjekter.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.leader.toLowerCase().includes(q),
    )
  }, [data.prosjekter, search])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? data.prosjekter.find((p) => p.id === openId) : null
  const projects = useTaskProjects()
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftMethodology, setDraftMethodology] = useState<'pdca' | 'kanban'>('pdca')
  const [submitting, setSubmitting] = useState(false)

  const submitProject = async () => {
    if (submitting || !draftTitle.trim()) return
    setSubmitting(true)
    const id = await projects.createProject({
      title: draftTitle.trim(),
      description: draftDescription.trim(),
      methodology: draftMethodology,
      lawRefs: [],
    })
    setSubmitting(false)
    setDraftTitle('')
    setDraftDescription('')
    setDraftMethodology('pdca')
    setComposerOpen(false)
    // Refresh the page-level hook so the new project shows up in
    // data.prosjekter without a full reload.
    onProjectsChanged()
    return id
  }

  if (open) return <ProsjektDetail data={data} p={open} plan={plan} onBack={() => setOpenId(null)} />

  return (
    <div className="space-y-4">
      <SectionBanner
        icon={<FolderKanban className="h-4 w-4" />}
        title="Compliance-prosjekter"
        trailing={
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-3 w-3" />}
            onClick={() => setComposerOpen((v) => !v)}
          >
            Nytt prosjekt
          </Button>
        }
      >
        Større initiativ for å nå ny modenhet — sertifisering, lovendringer, etterlevelse av
        nye rammeverk. Prosjekter lagres i Oppgavestyring (task_projects) og styres herfra.
      </SectionBanner>

      {composerOpen && (
        <div className="rounded-xl border border-neutral-200/80 bg-[#fbf9f3]/40 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Nytt prosjekt
            </h4>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setComposerOpen(false)}
              aria-label="Lukk skjema"
              className="border-0 p-1 hover:bg-neutral-100"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-[11px] font-semibold text-neutral-700">
              Tittel
              <StandardInput
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Eks. ISO 27001-sertifisering"
                className="mt-1 py-1.5"
              />
            </label>
            <label className="block text-[11px] font-semibold text-neutral-700">
              Metodologi
              <SearchableSelect
                value={draftMethodology}
                onChange={(v) => setDraftMethodology(v === 'kanban' ? 'kanban' : 'pdca')}
                className="mt-1"
                options={[
                  { value: 'pdca', label: 'PDCA — Plan/Do/Check/Act' },
                  { value: 'kanban', label: 'Kanban' },
                ]}
              />
            </label>
            <label className="md:col-span-2 block text-[11px] font-semibold text-neutral-700">
              Beskrivelse (valgfri)
              <StandardTextarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                rows={2}
                placeholder="Hva skal prosjektet oppnå?"
                className="mt-1"
              />
            </label>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComposerOpen(false)} disabled={submitting}>
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void submitProject()}
              disabled={submitting || !draftTitle.trim()}
            >
              {submitting ? 'Lagrer…' : 'Opprett prosjekt'}
            </Button>
          </div>
        </div>
      )}

      {filteredProsjekter.length === 0 ? (
        <div className="rounded-xl border border-neutral-200/80 bg-white p-6 text-center text-[12px] italic text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {search.trim()
            ? 'Ingen prosjekter matcher søket.'
            : 'Ingen prosjekter ennå. Bruk «Nytt prosjekt» for å opprette ett — eller knytt et tiltak til et eksisterende prosjekt i Oppgavestyring.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredProsjekter.map((p) => {
            const kravCov = p.krav === 0 ? 0 : Math.round((p.krav_covered / p.krav) * 100)
            return (
              <article
                key={p.id}
                onClick={() => setOpenId(p.id)}
                className={[
                  'cursor-pointer overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:border-[#1a3d32]/40 hover:shadow-md',
                  p.isLegacy ? 'border-dashed border-amber-300/60' : 'border-neutral-200/80',
                ].join(' ')}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className={[
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                        p.isLegacy ? 'bg-amber-50 text-amber-700' : 'bg-[#fbf9f3] text-[#1a3d32]',
                      ].join(' ')}
                    >
                      <FolderKanban className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={[
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            p.isLegacy
                              ? 'bg-amber-100 text-amber-900'
                              : p.methodology === 'kanban'
                                ? 'bg-violet-100 text-violet-800'
                                : 'bg-blue-100 text-blue-800',
                          ].join(' ')}
                        >
                          {p.isLegacy ? 'Eldre (milestone)' : p.phase}
                        </span>
                        {p.projectId && (
                          <a
                            href={`/tasks/management?project=${p.projectId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 rounded border border-[#1a3d32]/20 bg-[#e7efe9]/40 px-1.5 py-0.5 text-[10px] font-semibold text-[#1a3d32] hover:bg-[#e7efe9]"
                            title="Åpne prosjekt-tavle i Oppgavestyring"
                          >
                            <ArrowUpRight className="h-2.5 w-2.5" />
                            Åpne tavle
                          </a>
                        )}
                        {p.isLegacy && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="border-0 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              void convertLegacyToProject(p, plan, projects, onProjectsChanged)
                            }}
                            title="Konverter til et task_projects-prosjekt"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Konverter
                          </Button>
                        )}
                        <span className="text-[10px] tabular-nums text-neutral-500">
                          Frist {p.deadline}
                        </span>
                      </div>
                      <h4
                        className="mt-1 text-base font-semibold text-neutral-900"
                        style={{ fontFamily: "'Libre Baskerville', serif" }}
                      >
                        {p.name}
                      </h4>
                      <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                        {p.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-neutral-900">Framdrift</span>
                      <span className="tabular-nums font-bold text-[#1a3d32]">
                        {Math.round(p.progress * 100)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-full bg-[#1a3d32]"
                        style={{ width: `${p.progress * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Milepæler
                    </h5>
                    <div className="mt-2 flex items-center gap-1">
                      {p.milestones.map((m, i) => (
                        <MilestoneNode
                          key={i}
                          index={i}
                          label={m.label}
                          done={m.done}
                          current={m.current}
                          isLast={i === p.milestones.length - 1}
                          nextDone={p.milestones[i + 1]?.done ?? false}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-3 text-[10px]">
                    <div>
                      <div className="text-neutral-500">Krav dekket</div>
                      <div className="text-sm font-bold tabular-nums text-neutral-900">
                        {p.krav_covered}/{p.krav}{' '}
                        <span className="text-[10px] font-medium text-neutral-500">
                          ({kravCov}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Åpne tiltak</div>
                      <div className="text-sm font-bold tabular-nums text-neutral-900">
                        {p.openTasks}/{p.tasks}
                      </div>
                    </div>
                    <div>
                      <div className="text-neutral-500">Status</div>
                      <div className="text-sm font-bold text-neutral-900">{p.status}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Initials name={p.leader} size={20} />
                      <span className="text-neutral-700">{p.leader}</span>
                    </div>
                    <span className="text-neutral-400">Åpne prosjekt →</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Promote a legacy free-text milestone grouping into a real task_projects
 * row + back-fill every plan-item that referenced the same milestone
 * string with the new project_id. Two-step: create project, then update
 * the plan-items via the existing useCompliancePlanItems write path so
 * the same `project_id_must_match_org` trigger guards the back-fill.
 */
async function convertLegacyToProject(
  p: IkProsjekt,
  plan: PlanHook,
  projectsHook: ReturnType<typeof useTaskProjects>,
  onProjectsChanged: () => void,
) {
  if (!p.isLegacy || !p.name) return
  const id = await projectsHook.createProject({
    title: p.name,
    description: `Konvertert fra fritekst-milepælen «${p.name}».`,
    methodology: 'pdca',
    lawRefs: [],
  })
  if (!id) return
  // Back-fill every plan-item under the legacy bucket.
  await Promise.all(
    p.tiltakIds.map((tiltakId) =>
      plan.updateItem(tiltakId, { project_id: id, milestone: null }),
    ),
  )
  onProjectsChanged()
}

function MilestoneNode({
  index,
  label,
  done,
  current,
  isLast,
  nextDone,
}: {
  index: number
  label: string
  done: boolean
  current?: boolean
  isLast: boolean
  nextDone: boolean
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-0.5" title={label}>
        <span
          className={[
            'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
            done
              ? 'bg-[#1a3d32] text-white'
              : current
              ? 'bg-amber-400 text-amber-900 ring-2 ring-amber-200'
              : 'bg-neutral-200 text-neutral-500',
          ].join(' ')}
        >
          {done ? <Check className="h-3 w-3" /> : index + 1}
        </span>
      </div>
      {!isLast && (
        <div
          className={[
            'h-0.5 flex-1',
            nextDone || done ? 'bg-[#1a3d32]' : 'bg-neutral-200',
          ].join(' ')}
        />
      )}
    </>
  )
}

function ProsjektDetail({
  data,
  p,
  plan,
  onBack,
}: {
  data: IkData
  p: IkProsjekt
  plan: PlanHook
  onBack: () => void
}) {
  const tasksHere = data.tiltak.filter((t) => p.tiltakIds.includes(t.id))
  const kravHere = data.krav.filter((k) => p.kravCodes.includes(k.ref))

  return (
    <div className="space-y-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-3.5 w-3.5" />}
          onClick={onBack}
        >
          Tilbake til prosjekter
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#e7efe9] text-[#1a3d32]">
            <FolderKanban className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                {p.phase}
              </span>
              <span className="rounded bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {p.status}
              </span>
            </div>
            <h2
              className="mt-1 text-2xl font-bold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', serif" }}
            >
              {p.name}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-700">{p.description}</p>
          </div>
          <Button variant="primary" size="sm" icon={<Plus className="h-3 w-3" />}>
            Legg til tiltak
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 text-[12px] md:grid-cols-2 lg:grid-cols-4">
          <Stat label="Prosjektleder" value={p.leader} icon={<User className="h-3 w-3" />} />
          <Stat label="Frist" value={p.deadline} icon={<Calendar className="h-3 w-3" />} tabular />
          <Stat
            label="Budsjett"
            value={`${p.spent} / ${p.budget}`}
            icon={<Wallet className="h-3 w-3" />}
            tabular
          />
          <Stat
            label="Krav-dekning"
            value={`${p.krav_covered}/${p.krav} (${
              p.krav === 0 ? 0 : Math.round((p.krav_covered / p.krav) * 100)
            }%)`}
            icon={<ShieldCheck className="h-3 w-3" />}
            tabular
          />
        </div>

        <div className="mt-5 border-t border-neutral-100 pt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Tidslinje
          </h4>
          <div
            className="mt-3 grid items-center gap-2"
            style={{ gridTemplateColumns: `repeat(${p.milestones.length}, 1fr)` }}
          >
            {p.milestones.map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold',
                    m.done
                      ? 'bg-[#1a3d32] text-white'
                      : m.current
                      ? 'bg-amber-400 text-amber-900 ring-4 ring-amber-100'
                      : 'bg-neutral-200 text-neutral-500',
                  ].join(' ')}
                >
                  {m.done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-neutral-900">{m.label}</div>
                  <div className="text-[10px] tabular-nums text-neutral-500">{m.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              Tiltak i prosjektet ({tasksHere.length})
            </h3>
          </div>
          {tasksHere.length === 0 ? (
            <p className="px-5 py-6 text-center text-[12px] italic text-neutral-500">
              Ingen tiltak gruppert under dette prosjektet ennå.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {tasksHere.map((t) => (
                <li key={t.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <StandardInput
                      type="checkbox"
                      checked={t.status === 'fullført'}
                      onChange={() => {
                        void plan.updateItem(t.id, {
                          status: t.status === 'fullført' ? 'planned' : 'done',
                        })
                      }}
                      className="mt-1 h-4 w-4"
                      aria-label={`Marker «${t.title}» som fullført`}
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TiltakStatusPill status={t.status} />
                        <span className="text-sm font-medium text-neutral-900">{t.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-neutral-500">
                        <Initials name={t.owner} size={16} />
                        <span>{t.owner}</span>
                        <span>·</span>
                        <span className="tabular-nums">Frist {t.deadline}</span>
                        <div className="ml-3 inline-flex items-center gap-1.5">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100">
                            <div
                              className="h-full bg-[#1a3d32]"
                              style={{ width: `${t.progress * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums">{Math.round(t.progress * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900">
              Krav i scope ({kravHere.length})
            </h3>
          </div>
          {kravHere.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] italic text-neutral-500">
              Ingen krav koblet til dette prosjektet.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {kravHere.map((k) => (
                <li key={k.id} className="px-4 py-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <FwChip fw={k.fw} frameworks={data.frameworks} />
                    <span className="font-mono text-[10px] font-bold tabular-nums text-neutral-500">
                      {k.ref}
                    </span>
                    <StatusDot status={k.status} size={6} />
                  </div>
                  <p className="mt-0.5 text-[12px] font-medium text-neutral-900">{k.title}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
  tabular,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tabular?: boolean
}) {
  return (
    <div className="rounded-md border border-neutral-200/80 bg-[#fbf9f3]/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div
        className={['mt-1 text-sm font-semibold text-neutral-900', tabular ? 'tabular-nums' : ''].join(
          ' ',
        )}
      >
        {value}
      </div>
    </div>
  )
}

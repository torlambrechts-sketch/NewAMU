// Tiltak — closure plans grouped by status / priority / owner.
//
// Reads + writes via the existing useCompliancePlanItems hook so a
// status toggle here is immediately visible in the gap analysis (the
// bridge to task_items is already wired in the hook).

import { useMemo, useState } from 'react'
import {
  Calendar,
  FolderKanban,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { StandardInput } from '../../../../components/ui/Input'
import { SearchableSelect } from '../../../../components/ui/SearchableSelect'
import {
  FilterPills,
  FwChip,
  Initials,
  PRIO_TONE,
  SectionBanner,
  TiltakStatusPill,
} from './internkontrollShared'
import type {
  CompliancePlanItemStatus,
  useCompliancePlanItems,
} from '../useCompliancePlanItems'
import type { IkData, IkTiltak } from '../useInternkontrollPageData'
import { FRAMEWORK_IDS, FRAMEWORKS, type FrameworkId } from '../frameworkParagraphs'

type PlanHook = ReturnType<typeof useCompliancePlanItems>
type Grouping = 'status' | 'priority' | 'owner'

const STATUS_ORDER: IkTiltak['status'][] = [
  'forsinket',
  'pågår',
  'planlagt',
  'til-godkjenning',
  'fullført',
]
const PRIO_ORDER: IkTiltak['priority'][] = ['kritisk', 'høy', 'middels', 'lav']

export function TiltakSection({ data, plan }: { data: IkData; plan: PlanHook }) {
  const [statusFilter, setStatusFilter] = useState<IkTiltak['status'] | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<IkTiltak['priority'] | 'all'>('all')
  const [grouping, setGrouping] = useState<Grouping>('status')
  const [composerOpen, setComposerOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftLawRef, setDraftLawRef] = useState('')
  const [draftFramework, setDraftFramework] = useState<FrameworkId>('aml')
  const [draftDue, setDraftDue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // data.tiltak is composed at the page level from the live plan-items
  // hook so writes from `plan.createItem/updateItem/deleteItem` are
  // reflected here immediately without a refetch round-trip.
  const filtered = useMemo(() => {
    return data.tiltak.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      return true
    })
  }, [data.tiltak, statusFilter, priorityFilter])

  const grouped = useMemo(() => {
    const groups = new Map<string, IkTiltak[]>()
    for (const t of filtered) {
      const key =
        grouping === 'status' ? t.status : grouping === 'priority' ? t.priority : t.owner
      const arr = groups.get(key) ?? []
      arr.push(t)
      groups.set(key, arr)
    }
    return groups
  }, [filtered, grouping])

  const sortedKeys = useMemo(() => {
    const keys = [...grouped.keys()]
    if (grouping === 'status')
      return keys.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a as IkTiltak['status']) -
          STATUS_ORDER.indexOf(b as IkTiltak['status']),
      )
    if (grouping === 'priority')
      return keys.sort(
        (a, b) =>
          PRIO_ORDER.indexOf(a as IkTiltak['priority']) -
          PRIO_ORDER.indexOf(b as IkTiltak['priority']),
      )
    return keys.sort((a, b) => a.localeCompare(b, 'nb'))
  }, [grouped, grouping])

  const submitNew = async () => {
    if (submitting || !draftTitle.trim() || !draftLawRef.trim()) return
    setSubmitting(true)
    await plan.createItem({
      law_ref: draftLawRef.trim(),
      framework_id: draftFramework,
      title: draftTitle.trim(),
      status: 'planned',
      due_at: draftDue || null,
    })
    setSubmitting(false)
    setDraftTitle('')
    setDraftLawRef('')
    setDraftDue('')
    setComposerOpen(false)
  }

  const cycleStatus = async (id: string, current: CompliancePlanItemStatus) => {
    const order: CompliancePlanItemStatus[] = ['planned', 'in_progress', 'blocked', 'done']
    const next = order[(order.indexOf(current) + 1) % order.length]
    await plan.updateItem(id, { status: next })
  }

  return (
    <div className="space-y-4">
      <SectionBanner icon={<ListChecks className="h-4 w-4" />} title="Tiltak">
        Konkrete handlinger for å lukke gap eller forbedre kontroll. Hvert tiltak er forankret
        i ett eller flere krav og kan inngå i et prosjekt.
      </SectionBanner>

      <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">{filtered.length} tiltak</h3>
            <p className="text-[11px] text-neutral-500">
              Grupperer etter <span className="font-semibold">{grouping}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SearchableSelect
              value={grouping}
              onChange={(v) => setGrouping(v as Grouping)}
              triggerClassName="py-1.5 text-xs"
              options={[
                { value: 'status', label: 'Grupper: Status' },
                { value: 'priority', label: 'Grupper: Prioritet' },
                { value: 'owner', label: 'Grupper: Eier' },
              ]}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-3 w-3" />}
              onClick={() => setComposerOpen((v) => !v)}
            >
              Nytt tiltak
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-5 py-2.5">
          <FilterPills
            value={statusFilter}
            onChange={setStatusFilter}
            items={[
              { id: 'all', label: 'Alle' },
              { id: 'pågår', label: 'Pågår' },
              { id: 'planlagt', label: 'Planlagt' },
              { id: 'forsinket', label: 'Forsinket' },
              { id: 'fullført', label: 'Fullført' },
            ]}
          />
          <FilterPills
            value={priorityFilter}
            onChange={setPriorityFilter}
            items={[
              { id: 'all', label: 'Alle prioriteter' },
              { id: 'kritisk', label: 'Kritisk' },
              { id: 'høy', label: 'Høy' },
              { id: 'middels', label: 'Middels' },
            ]}
          />
        </div>

        {composerOpen && (
          <div className="border-b border-neutral-100 bg-[#fbf9f3]/40 p-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Nytt tiltak
            </h4>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block text-[11px] font-semibold text-neutral-700">
                Tittel
                <StandardInput
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Eks. Etabler 24/72-timers meldeprosedyre"
                  className="mt-1 py-1.5"
                />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                Lukker krav (paragraf)
                <StandardInput
                  type="text"
                  value={draftLawRef}
                  onChange={(e) => setDraftLawRef(e.target.value)}
                  placeholder="Eks. AML § 4-3"
                  className="mt-1 py-1.5"
                />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                Rammeverk
                <SearchableSelect
                  value={draftFramework}
                  onChange={(v) => setDraftFramework(v as FrameworkId)}
                  className="mt-1"
                  options={FRAMEWORK_IDS.map((id) => ({
                    value: id,
                    label: `${FRAMEWORKS[id].shortLabel} — ${FRAMEWORKS[id].fullLabel}`,
                  }))}
                />
              </label>
              <label className="block text-[11px] font-semibold text-neutral-700">
                Frist (valgfri)
                <StandardInput
                  type="date"
                  value={draftDue}
                  onChange={(e) => setDraftDue(e.target.value)}
                  className="mt-1 py-1.5"
                />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setComposerOpen(false)
                  setDraftTitle('')
                  setDraftLawRef('')
                  setDraftDue('')
                }}
                disabled={submitting}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void submitNew()}
                disabled={submitting || !draftTitle.trim() || !draftLawRef.trim()}
              >
                {submitting ? 'Lagrer…' : 'Lagre tiltak'}
              </Button>
            </div>
          </div>
        )}

        {sortedKeys.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] italic text-neutral-500">
            Ingen tiltak ennå. Bruk «Nytt tiltak» for å registrere et lukke-tiltak per gap.
          </p>
        ) : (
          <div className="space-y-4 p-5">
            {sortedKeys.map((key) => (
              <div key={key}>
                <div className="mb-2 flex items-center gap-2">
                  {grouping === 'status' && (
                    <TiltakStatusPill status={key as IkTiltak['status']} />
                  )}
                  {grouping === 'priority' && (
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        PRIO_TONE[key as IkTiltak['priority']].bg
                      } ${PRIO_TONE[key as IkTiltak['priority']].text}`}
                    >
                      {key}
                    </span>
                  )}
                  {grouping === 'owner' && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                      <Initials name={key} size={22} />
                      {key}
                    </span>
                  )}
                  <span className="text-[11px] text-neutral-500">
                    {(grouped.get(key) ?? []).length} tiltak
                  </span>
                  <div className="ml-2 h-px flex-1 bg-neutral-100" />
                </div>
                <ul className="space-y-2">
                  {(grouped.get(key) ?? []).map((t) => (
                    <TiltakRow
                      key={t.id}
                      t={t}
                      frameworks={data.frameworks}
                      onToggle={() => void cycleStatus(t.id, t.rawStatus)}
                      onDelete={() => {
                        if (window.confirm(`Slett tiltaket «${t.title}»?`)) {
                          void plan.deleteItem(t.id)
                        }
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TiltakRow({
  t,
  frameworks,
  onToggle,
  onDelete,
}: {
  t: IkTiltak
  frameworks: IkData['frameworks']
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <li className="rounded-lg border border-neutral-200/80 bg-white p-3 hover:bg-neutral-50/40">
      <div className="flex items-start gap-3">
        <StandardInput
          type="checkbox"
          checked={t.status === 'fullført'}
          onChange={onToggle}
          className="mt-1 h-4 w-4"
          aria-label={`Toggle status for ${t.title}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[10px] font-bold tabular-nums text-neutral-400">
              {t.id.slice(0, 6)}
            </span>
            <span className="text-sm font-semibold text-neutral-900">{t.title}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                PRIO_TONE[t.priority].bg
              } ${PRIO_TONE[t.priority].text}`}
            >
              {t.priority}
            </span>
            <TiltakStatusPill status={t.status} />
            {t.project && (
              <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-[#fbf9f3] px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                <FolderKanban className="h-2.5 w-2.5" />
                {t.project}
              </span>
            )}
          </div>
          {t.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-600">{t.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-neutral-500">Lukker:</span>
            <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]">
              <FwChip fw={t.fw} frameworks={frameworks} />
              <span className="font-mono font-semibold tabular-nums text-neutral-700">
                {t.krav[0]?.replace(/^k-[^-]+-/, '') ?? ''}
              </span>
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,1fr)_140px_120px]">
            <div className="flex items-center gap-2 text-[10px] text-neutral-600">
              <Initials name={t.owner} size={18} />
              <span>{t.owner}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-2.5 w-2.5" />
                <span className="tabular-nums">Frist {t.deadline}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full"
                  style={{
                    width: `${t.progress * 100}%`,
                    background: t.status === 'forsinket' ? '#b3382a' : '#1a3d32',
                  }}
                />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-neutral-700">
                {Math.round(t.progress * 100)}%
              </span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded border-0 p-1 hover:bg-neutral-100"
                aria-label="Kommentarer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded border-0 p-1 hover:bg-neutral-100"
                aria-label="Vedlegg"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded border-0 p-1 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                aria-label={`Slett tiltak ${t.title}`}
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="rounded border-0 p-1 hover:bg-neutral-100"
                aria-label="Mer"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}


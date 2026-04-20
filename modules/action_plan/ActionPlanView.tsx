import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../../src/components/layout/workplaceModuleSurface'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { WarningBox } from '../../src/components/ui/AlertBox'
import type { ActionPlanItemRow, ActionPlanItemStatus } from './types'
import { useActionPlan, type UseActionPlanState } from './useActionPlan'
import { type SupabaseClient } from '@supabase/supabase-js'

const TH = `${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`

const STATUS_OPTIONS: { value: ActionPlanItemStatus; label: string }[] = [
  { value: 'draft', label: 'Kladd' },
  { value: 'open', label: 'Åpen' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'overdue', label: 'Forfalt' },
  { value: 'resolved', label: 'Løst' },
  { value: 'verified', label: 'Verifisert' },
]

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  open: 'Åpen',
  in_progress: 'Pågår',
  overdue: 'Forfalt',
  resolved: 'Løst',
  verified: 'Verifisert',
}

const PRI_OPTIONS: { value: ActionPlanItemRow['priority']; label: string }[] = [
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

const PRI_LABEL: Record<ActionPlanItemRow['priority'], string> = {
  low: 'Lav',
  medium: 'Middels',
  high: 'Høy',
  critical: 'Kritisk',
}

const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manuelt' },
  { value: 'ros', label: 'ROS' },
  { value: 'inspection', label: 'Inspeksjon' },
  { value: 'avvik', label: 'Avvik' },
  { value: 'action_plan', label: 'Tiltaksplan' },
] as const

const TAB = {
  mine: 'mine',
  open: 'aapen',
  overdue: 'overdue',
  closed: 'lukkede',
} as const
type ListTab = (typeof TAB)[keyof typeof TAB]

function statusBadge(
  row: ActionPlanItemRow,
  isOver: boolean,
): { variant: BadgeVariant; text: string } {
  if (isOver) return { variant: 'critical', text: 'Forfalt' }
  const s = row.status
  if (s === 'open' || s === 'draft' || s === 'in_progress') return { variant: 'info', text: STATUS_LABEL[s] ?? s }
  if (s === 'resolved') return { variant: 'success', text: 'Løst' }
  if (s === 'verified') return { variant: 'success', text: 'Verifisert' }
  if (s === 'overdue') return { variant: 'critical', text: 'Forfalt' }
  return { variant: 'neutral', text: s }
}

function priorityTrClass(p: ActionPlanItemRow['priority']): string {
  switch (p) {
    case 'critical':
      return 'border-l-4 border-l-red-500 bg-red-50/30'
    case 'high':
      return 'border-l-4 border-l-amber-500 bg-amber-50/20'
    case 'medium':
      return 'border-l-4 border-l-amber-400/80 bg-amber-50/10'
    case 'low':
      return 'border-l-4 border-l-sky-400/90 bg-sky-50/20'
    default:
      return 'border-l-4 border-l-neutral-200'
  }
}

type ActionPlanViewProps = {
  supabase: SupabaseClient | null
  /** Sett når innside annen modul, uten topp-overskrift. */
  embedded?: boolean
}

function filterItemsForTab(
  ap: UseActionPlanState,
  listTab: ListTab,
) {
  const { items, currentUserId, isItemOverdue } = ap
  if (listTab === TAB.mine) {
    return items.filter(
      (r) =>
        (r.assigned_to === currentUserId || r.responsible_id === currentUserId) &&
        r.status !== 'resolved' &&
        r.status !== 'verified',
    )
  }
  if (listTab === TAB.open) {
    return items.filter(
      (r) =>
        r.status !== 'resolved' &&
        r.status !== 'verified' &&
        !isItemOverdue(r) &&
        (r.status === 'draft' || r.status === 'open' || r.status === 'in_progress'),
    )
  }
  if (listTab === TAB.overdue) {
    return items.filter((r) => isItemOverdue(r) || r.status === 'overdue')
  }
  return items.filter((r) => r.status === 'resolved' || r.status === 'verified')
}

function emptyMessage(tab: ListTab): string {
  switch (tab) {
    case TAB.mine:
      return 'Du har ingen aktive tiltak. Legg inn et nytt, eller sjekk «Åpne tiltak».'
    case TAB.open:
      return 'Ingen åpne tiltak akkurat nå.'
    case TAB.overdue:
      return 'Ingen forfalte tiltak. Godt jobbet!'
    case TAB.closed:
      return 'Ingen lukkede tiltak i listen ennå.'
    default:
      return 'Ingen data.'
  }
}

type DrawerMode = { type: 'create' } | { type: 'edit'; row: ActionPlanItemRow }

export function ActionPlanView({ supabase, embedded = false }: ActionPlanViewProps) {
  const ap = useActionPlan({ supabase })
  const {
    load,
    items,
    categories,
    assignableUsers,
    loading,
    error,
    canManage,
    isItemOverdue,
    updateItem,
    createItem,
    deleteItem,
    currentUserId,
  } = ap

  const [listTab, setListTab] = useState<ListTab>(TAB.mine)
  const [drawer, setDrawer] = useState<DrawerMode | null>(null)
  const [dTitle, setDTitle] = useState('')
  const [dDesc, setDDesc] = useState('')
  const [dStatus, setDStatus] = useState<ActionPlanItemStatus>('open')
  const [dPri, setDPri] = useState<ActionPlanItemRow['priority']>('medium')
  const [dCat, setDCat] = useState('')
  const [dUser, setDUser] = useState('')
  const [dDate, setDDate] = useState('')
  const [dSourceMod, setDSourceMod] = useState('manual')
  const [dSaving, setDSaving] = useState(false)
  const isLocked =
    drawer?.type === 'edit' && (drawer.row.status === 'resolved' || drawer.row.status === 'verified')

  useEffect(() => {
    void load()
  }, [load])

  const overdueCount = useMemo(() => items.filter((r) => isItemOverdue(r) || r.status === 'overdue').length, [items, isItemOverdue])

  const kpi = useMemo(() => {
    const openN = items.filter(
      (r) =>
        (r.status === 'draft' || r.status === 'open' || r.status === 'in_progress') && !isItemOverdue(r),
    ).length
    const closedN = items.filter((r) => r.status === 'resolved' || r.status === 'verified').length
    const myN = items.filter(
      (r) =>
        (r.assigned_to === currentUserId || r.responsible_id === currentUserId) &&
        r.status !== 'resolved' &&
        r.status !== 'verified',
    ).length
    return [
      { big: String(myN), title: 'Mine aktive', sub: 'Tilordnet deg' },
      { big: String(openN), title: 'Åpne (ikke forfalt)', sub: 'I organisasjonen' },
      { big: String(overdueCount), title: 'Forfalte', sub: 'Frist passert' },
      { big: String(closedN), title: 'Lukkede', sub: 'Løst eller verifisert' },
    ]
  }, [items, currentUserId, isItemOverdue, overdueCount])

  const tabItems: TabItem[] = useMemo(
    () => [
      { id: TAB.mine, label: 'Mine tiltak', icon: ClipboardList },
      { id: TAB.open, label: 'Åpne tiltak' },
      {
        id: TAB.overdue,
        label: 'Forfalte',
        badgeCount: overdueCount > 0 ? overdueCount : undefined,
        badgeVariant: overdueCount > 0 ? 'danger' : undefined,
      },
      { id: TAB.closed, label: 'Lukkede' },
    ],
    [overdueCount],
  )

  const visibleRows = useMemo(() => filterItemsForTab(ap, listTab), [ap, listTab])
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name] as const)),
    [categories],
  )

  const openCreate = useCallback(() => {
    setDrawer({ type: 'create' })
    setDTitle('')
    setDDesc('')
    setDStatus('open')
    setDPri('medium')
    setDCat('')
    setDUser(currentUserId ?? '')
    setDDate(new Date().toISOString().slice(0, 10))
    setDSourceMod('manual')
  }, [currentUserId])

  const openEdit = useCallback(
    (row: ActionPlanItemRow) => {
      setDrawer({ type: 'edit', row })
      setDTitle(row.title)
      setDDesc(row.description)
      setDStatus(row.status === 'overdue' ? 'open' : row.status)
      setDPri(row.priority)
      setDCat(row.category_id ?? '')
      setDUser(row.assigned_to ?? row.responsible_id ?? '')
      const s = (row.deadline ?? row.due_at) as string
      if (s) {
        setDDate(s.slice(0, 10))
      } else {
        setDDate('')
      }
      setDSourceMod(row.source_module ?? 'manual')
    },
    [],
  )

  const submitDrawer = useCallback(async () => {
    if (!dTitle.trim() || !dDate || !drawer) return
    if (isLocked) return
    setDSaving(true)
    if (drawer.type === 'create') {
      const sourceTable: string =
        dSourceMod === 'ros'
          ? 'ros_rows'
          : dSourceMod === 'inspection'
            ? 'inspection_findings'
            : dSourceMod === 'avvik'
              ? 'deviations'
              : 'action_plan'
      await createItem({
        title: dTitle,
        description: dDesc,
        status: dStatus,
        priority: dPri,
        categoryId: dCat || null,
        deadline: dDate,
        assignedTo: dUser || null,
        sourceModule: dSourceMod,
        sourceTable,
      } as import('./types').CreateActionPlanItemInput)
    } else {
      await updateItem({
        id: drawer.row.id,
        title: dTitle,
        description: dDesc,
        status: dStatus,
        priority: dPri,
        categoryId: dCat || null,
        assignedTo: dUser || null,
        deadline: dDate,
        sourceModule: dSourceMod,
      } as import('./types').UpdateActionPlanItemInput)
    }
    setDSaving(false)
    setDrawer(null)
  }, [
    dTitle,
    dDesc,
    dStatus,
    dPri,
    dCat,
    dUser,
    dDate,
    dSourceMod,
    drawer,
    createItem,
    updateItem,
    isLocked,
  ])

  const body = (
    <div className="flex min-h-0 flex-col">
      {error ? (
        <WarningBox>
          {error}
        </WarningBox>
      ) : null}
      {embedded ? null : (
        <div className="px-0 pb-4">
          <WorkplacePageHeading1
            breadcrumb={[{ label: 'HMS' }, { label: 'Tiltaksplan' }]}
            title="Tiltaksplan"
            description="Oppfølging av tiltak frem til lukking, i samsvar med forskriftens krav til retting og forebygging."
          />
        </div>
      )}

      <div className="flex flex-col space-y-6">
        <LayoutScoreStatRow className="pb-0" items={kpi} variant="compact" />

        <div className="border-b border-neutral-200/80 py-2">
          <Tabs items={tabItems} activeId={listTab} onChange={(id) => setListTab(id as ListTab)} />
        </div>

        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <ComplianceBanner
          className="border-b border-[#1a3d32]/20"
          title="IK-forskriften § 5.7 — Feilretting og forebygging"
        >
          Hvert tiltak skal ha tydelig ansvar og frist. Statusendringer logges i revisionsloggen for sporbarhet.
        </ComplianceBanner>
        {loading && (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">Laster…</p>
          )}
        {!loading && (
            <LayoutTable1PostingsShell
              wrap={false}
              titleTypography="sans"
              title="Tiltak"
              description="Følg opp og lukk fortløpende."
              toolbar={<div className="min-w-0 flex-1" aria-hidden />}
              headerActions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={openCreate}
                  >
                    Nytt tiltak
                  </Button>
                </div>
              }
            >
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={TH}>Tittel</th>
                    <th className={TH}>Frist</th>
                    <th className={TH}>Prioritet</th>
                    <th className={TH}>Kategori</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Ansvarlig</th>
                    <th className={`${TH} text-right`}>Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const o = isItemOverdue(row)
                    const b = statusBadge(row, o)
                    const pClass = priorityTrClass(row.priority)
                    const assign = row.assigned_to ?? row.responsible_id
                    const assignLabel = assign ? assignableUsers.find((u) => u.id === assign)?.displayName ?? '—' : '—'
                    return (
                      <tr
                        key={row.id}
                        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} ${pClass} border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/80`}
                      >
                        <td className="min-w-0 max-w-md px-5 py-4">
                          <p className="truncate font-medium text-neutral-900">{row.title}</p>
                          {row.source_module && (
                            <p className="text-[10px] uppercase text-neutral-400">Kilde: {row.source_module}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-neutral-600">
                          {(row.deadline ?? row.due_at)
                            ? new Date(row.deadline ?? row.due_at).toLocaleDateString('nb-NO')
                            : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              row.priority === 'critical' ? 'critical' : row.priority === 'high' ? 'high' : 'medium'
                            }
                            className="text-xs"
                          >
                            {PRI_LABEL[row.priority]}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-neutral-600">
                          {row.category_id ? categoryNameById.get(row.category_id) ?? '—' : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <Badge variant={b.variant} className="text-xs">
                            {b.text}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-xs text-neutral-700">{assignLabel}</td>
                        <td className="px-5 py-4 text-right">
                          {row.status !== 'resolved' && row.status !== 'verified' && (
                            <div className="inline-flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(row)}
                                aria-label="Rediger"
                                icon={<Pencil className="h-4 w-4" />}
                              />
                              {canManage && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (window.confirm('Slette dette tiltaket?')) void deleteItem(row.id)
                                  }}
                                  aria-label="Slett"
                                  icon={<Trash2 className="h-4 w-4 text-red-600" />}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {visibleRows.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center text-sm text-neutral-500">
                        {emptyMessage(listTab)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </LayoutTable1PostingsShell>
          )}
        </div>
      </div>

      {drawer ? (
        <SlidePanel
          open
          onClose={() => setDrawer(null)}
          titleId="action-plan-drawer-title"
          title={drawer.type === 'create' ? 'Nytt tiltak' : 'Rediger tiltak'}
          footer={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                onClick={() => void submitDrawer()}
                disabled={!dTitle.trim() || !dDate || dSaving || isLocked}
              >
                {dSaving ? 'Lagrer…' : 'Lagre'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDrawer(null)} className="font-medium">
                Avbryt
              </Button>
            </div>
          }
        >
          {isLocked ? (
            <p className="text-sm text-amber-800">Løste eller verifiserte tiltak kan ikke endres i klienten.</p>
          ) : null}
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Tittel</span>
            <StandardInput
              value={dTitle}
              onChange={(e) => setDTitle(e.target.value)}
              readOnly={isLocked}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</span>
            <StandardTextarea rows={4} value={dDesc} onChange={(e) => setDDesc(e.target.value)} readOnly={isLocked} className="resize-none" />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
            <SearchableSelect
              value={dStatus}
              onChange={(v) => setDStatus(v as ActionPlanItemStatus)}
              options={STATUS_OPTIONS}
              disabled={isLocked}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Prioritet</span>
            <SearchableSelect
              value={dPri}
              onChange={(v) => setDPri(v as ActionPlanItemRow['priority'])}
              options={PRI_OPTIONS}
              disabled={isLocked}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Kategori</span>
            <SearchableSelect
              value={dCat}
              onChange={setDCat}
              options={[
                { value: '', label: '(Ingen)' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              disabled={isLocked}
            />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Frist (dato)</span>
            <StandardInput type="date" value={dDate} onChange={(e) => setDDate(e.target.value)} readOnly={isLocked} />
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</span>
            <SearchableSelect
              value={dUser}
              onChange={setDUser}
              options={[
                { value: '', label: '(Ingen)' },
                ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
              ]}
              disabled={isLocked}
            />
          </div>
          {drawer.type === 'create' && (
            <div className={WPSTD_FORM_ROW_GRID}>
              <span className={WPSTD_FORM_FIELD_LABEL}>Kilde (modul)</span>
              <SearchableSelect
                value={dSourceMod}
                onChange={setDSourceMod}
                options={SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </div>
          )}
        </SlidePanel>
      ) : null}
    </div>
  )

  if (embedded) {
    return <div className="min-w-0">{body}</div>
  }

  return <div className="min-h-screen bg-[#F9F7F2]">
    <div className="mx-auto max-w-[1400px] space-y-0 px-4 py-6 md:px-8">
      {body}
    </div>
  </div>
}

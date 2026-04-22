import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CheckCircle2, ChevronRight, Circle, Plus, Search, Settings } from 'lucide-react'
import { FormModal } from '../../src/template'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { RecurrencePicker, toDateTimeLocalValue } from '../../src/components/hse/RecurrencePicker'
import type { InspectionRoundRow } from './types'
import { useInspectionModule } from './useInspectionModule'
import { InspeksjonsrunderCreateForm } from './InspeksjonsrunderCreateForm'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'

type Props = {
  supabase: SupabaseClient | null
  /** Optional tabs row passed to `ModulePageShell.tabs`. */
  tabs?: ReactNode
  /**
   * When `true`, skip the ModulePageShell chrome and render the rounds
   * body only. Used when the parent already owns the page shell (e.g. the
   * InspectionModulePage root-tab wrapper renders admin and hub under a
   * single ModulePageShell so root tabs stay visible across tabs).
   */
  bodyOnly?: boolean
  /**
   * When `true`, hide the duplicate "Admin" header button because the page
   * already renders root tabs for Oversikt / Innstillinger.
   */
  hideAdminNav?: boolean
}

const STATUS_LABEL: Record<InspectionRoundRow['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  signed: 'Signert',
}

function formatDate(input: string | null) {
  if (!input) return '—'
  try {
    return new Date(input).toLocaleDateString('nb-NO', { dateStyle: 'short' })
  } catch {
    return input
  }
}

function roundStatusBadgeVariant(status: InspectionRoundRow['status']): 'draft' | 'active' | 'signed' {
  if (status === 'signed') return 'signed'
  if (status === 'active') return 'active'
  return 'draft'
}

export function InspectionModuleView({
  supabase,
  tabs,
  bodyOnly = false,
  hideAdminNav = false,
}: Props) {
  const navigate = useNavigate()
  const inspection = useInspectionModule({ supabase })
  const { load } = inspection
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [newRoundForm, setNewRoundForm] = useState({
    title: '',
    templateId: '',
    locationId: '',
    cronExpression: '',
    scheduledFor: '',
    assignedTo: '',
  })
  const [scheduleDraft, setScheduleDraft] = useState<
    Record<string, { scheduledFor: string; cronExpression: string; assignedTo: string }>
  >({})
  const [deviationCountByRoundId, setDeviationCountByRoundId] = useState<Record<string, number>>({})

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!supabase || inspection.rounds.length === 0) {
      queueMicrotask(() => setDeviationCountByRoundId({}))
      return
    }
    let cancelled = false
    void (async () => {
      const ids = inspection.rounds.map((r) => r.id)
      const { data, error } = await supabase.from('deviations').select('source_id').in('source_id', ids)
      if (cancelled || error) {
        if (!cancelled) setDeviationCountByRoundId({})
        return
      }
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const sid = (row as { source_id?: string | null }).source_id
        if (typeof sid === 'string' && sid) counts[sid] = (counts[sid] ?? 0) + 1
      }
      setDeviationCountByRoundId(counts)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, inspection.rounds])

  const stats = useMemo(() => {
    let draft = 0
    let active = 0
    let signed = 0
    let criticalFindings = 0
    for (const round of inspection.rounds) {
      if (round.status === 'draft') draft++
      if (round.status === 'active') active++
      if (round.status === 'signed') signed++
      const findings = inspection.findingsByRoundId[round.id] ?? []
      criticalFindings += findings.filter((f) => f.severity === 'critical').length
    }
    const open = draft + active
    return { total: inspection.rounds.length, open, signed, criticalFindings }
  }, [inspection.rounds, inspection.findingsByRoundId])

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of inspection.locations) map.set(loc.id, loc.name)
    return map
  }, [inspection.locations])

  const templateById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of inspection.templates) map.set(t.id, t.name)
    return map
  }, [inspection.templates])

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of inspection.assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [inspection.assignableUsers])

  const roundsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inspection.rounds
    return inspection.rounds.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.location_id && locationNameById.get(r.location_id)?.toLowerCase().includes(q)) ||
        (r.assigned_to && userNameById.get(r.assigned_to)?.toLowerCase().includes(q)),
    )
  }, [inspection.rounds, search, locationNameById, userNameById])

  const roundsForSchedule = useMemo(
    () =>
      inspection.rounds
        .slice()
        .sort((a, b) => {
          if (a.scheduled_for && b.scheduled_for) return a.scheduled_for.localeCompare(b.scheduled_for)
          if (a.scheduled_for) return -1
          if (b.scheduled_for) return 1
          return a.created_at.localeCompare(b.created_at)
        })
        .slice(0, 12),
    [inspection.rounds],
  )

  const assignedToOptions = useMemo(
    () => [
      { value: '', label: '(Ingen)' },
      ...inspection.assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
    ],
    [inspection.assignableUsers],
  )

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" onClick={() => setScheduleOpen(true)}>
        Planlegging
      </Button>
      {!hideAdminNav && (
        <Button
          type="button"
          variant="secondary"
          icon={<Settings className="h-4 w-4" />}
          onClick={() => navigate('/inspection-module/admin')}
        >
          <span className="hidden sm:inline">Admin</span>
        </Button>
      )}
      <Button
        type="button"
        variant="primary"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => setCreateOpen(true)}
      >
        Ny inspeksjonsrunde
      </Button>
    </div>
  )

  const body = (
    <>
      {inspection.error ? <WarningBox>{inspection.error}</WarningBox> : null}

      <LayoutScoreStatRow
        items={[
          { big: String(stats.total), title: 'Totalt runder', sub: 'Alle inspeksjonsrunder' },
          { big: String(stats.open), title: 'Åpne', sub: 'Kladd og aktiv' },
          { big: String(stats.signed), title: 'Fullført', sub: 'Signert og arkivert' },
          { big: String(stats.criticalFindings), title: 'Kritiske funn', sub: 'Krever oppfølging' },
        ]}
      />

      <LayoutTable1PostingsShell
        wrap
        titleTypography="sans"
        title="Runder"
        description="Alle inspeksjonsrunder — sortert etter siste aktivitet."
        toolbar={
          <div className="relative min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="inspection-search">
              Søk
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              id="inspection-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, lokasjon, ansvarlig …"
              className="py-2 pl-10"
            />
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() ? `${roundsFiltered.length} treff` : `Viser ${roundsFiltered.length} runder`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm whitespace-nowrap">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Tittel</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Mal</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Lokasjon</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Ansvarlig</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Status</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Planlagt</th>
              <th className={`${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Signaturer</th>
              <th className={`w-24 ${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`}>Avvik</th>
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH} bg-neutral-50`} aria-hidden />
            </tr>
          </thead>
          <tbody>
            {roundsFiltered.map((round) => {
              const findings = inspection.findingsByRoundId[round.id] ?? []
              const critCount = findings.filter((f) => f.severity === 'critical').length
              const nAvvik = deviationCountByRoundId[round.id] ?? 0
              return (
                <tr
                  key={round.id}
                  className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50`}
                  onClick={() => navigate(`/inspection-module/${round.id}`)}
                >
                  <td className="max-w-[14rem] px-5 py-4 align-middle whitespace-normal font-medium text-neutral-900">
                    {round.title}
                    {critCount > 0 && (
                      <Badge variant="critical" className="ml-2 align-middle">
                        {critCount} kritisk
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-600">{templateById.get(round.template_id) ?? '—'}</td>
                  <td className="px-5 py-4 align-middle text-neutral-600">
                    {round.location_id ? (locationNameById.get(round.location_id) ?? '—') : '—'}
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-600">
                    {round.assigned_to ? (userNameById.get(round.assigned_to) ?? '—') : '—'}
                  </td>
                  <td className="px-5 py-4 align-middle">
                    <Badge variant={roundStatusBadgeVariant(round.status)}>{STATUS_LABEL[round.status]}</Badge>
                  </td>
                  <td className="px-5 py-4 align-middle text-neutral-600">{formatDate(round.scheduled_for)}</td>
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center gap-2">
                      <span title="Leder">
                        {round.manager_signed_at ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300" />
                        )}
                      </span>
                      <span title="Verneombud">
                        {round.deputy_signed_at ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300" />
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                    {nAvvik > 0 ? (
                      <Link
                        to={`/avvik?sourceId=${encodeURIComponent(round.id)}`}
                        className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {nAvvik} avvik
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="w-8 px-3 py-4 align-middle text-neutral-300">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              )
            })}
            {roundsFiltered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm whitespace-normal text-neutral-500">
                  {inspection.loading ? 'Laster runder…' : 'Ingen runder matcher søket.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="form-create-round"
        title="Ny inspeksjonsrunde"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                const templateId = newRoundForm.templateId || inspection.templates[0]?.id || ''
                if (!templateId || !newRoundForm.title.trim()) return
                await inspection.createRound({
                  templateId,
                  locationId: newRoundForm.locationId || undefined,
                  title: newRoundForm.title,
                  cronExpression: newRoundForm.cronExpression || undefined,
                  scheduledFor: newRoundForm.scheduledFor || undefined,
                  assignedTo: newRoundForm.assignedTo || undefined,
                })
                setCreateOpen(false)
                setNewRoundForm({
                  title: '',
                  templateId: '',
                  locationId: '',
                  cronExpression: '',
                  scheduledFor: '',
                  assignedTo: '',
                })
              }}
            >
              Opprett runde
            </Button>
          </div>
        }
      >
        <InspeksjonsrunderCreateForm
          form={newRoundForm}
          onChange={(f) => setNewRoundForm(f)}
          templates={inspection.templates}
          locations={inspection.locations}
          users={inspection.assignableUsers}
        />
      </FormModal>

      <FormModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleId="form-scheduling"
        title="Planlegging av runder"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setScheduleOpen(false)}>
              Lukk
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {roundsForSchedule.map((round) => {
            const draft = scheduleDraft[round.id] ?? {
              scheduledFor: round.scheduled_for ?? '',
              cronExpression: round.cron_expression ?? '',
              assignedTo: round.assigned_to ?? '',
            }
            return (
              <div key={round.id} className="rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-900">{round.title}</p>
                <div className="mt-2 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className={WPSTD_FORM_FIELD_LABEL}>Planlagt dato</span>
                      <StandardInput
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.scheduledFor || null)}
                        onChange={(e) =>
                          setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, scheduledFor: e.target.value } }))
                        }
                      />
                    </label>
                    <div className="flex flex-col gap-1">
                      <span className={WPSTD_FORM_FIELD_LABEL}>Ansvarlig</span>
                      <SearchableSelect
                        value={draft.assignedTo}
                        options={assignedToOptions}
                        placeholder="Velg ansvarlig"
                        onChange={(v) =>
                          setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, assignedTo: v } }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={WPSTD_FORM_FIELD_LABEL}>Gjentakelse</span>
                    <RecurrencePicker
                      value={draft.cronExpression}
                      onChange={(cron) =>
                        setScheduleDraft((p) => ({ ...p, [round.id]: { ...draft, cronExpression: cron } }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    void inspection.updateRoundSchedule({
                      roundId: round.id,
                      scheduledFor: draft.scheduledFor || undefined,
                      cronExpression: draft.cronExpression || undefined,
                      assignedTo: draft.assignedTo || undefined,
                      status: round.status === 'draft' ? 'active' : undefined,
                    })
                  }
                >
                  Lagre
                </Button>
              </div>
            )
          })}
          {roundsForSchedule.length === 0 && <p className="text-sm text-neutral-500">Ingen runder. Opprett en runde først.</p>}
        </div>
      </FormModal>
    </>
  )

  if (bodyOnly) {
    return <>{body}</>
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Inspeksjonsrunder' }]}
      title="Inspeksjonsrunder"
      description="Planlegg, gjennomfør og signer vernerunder i henhold til Internkontrollforskriften § 5."
      tabs={tabs}
      headerActions={headerActions}
    >
      {body}
    </ModulePageShell>
  )
}

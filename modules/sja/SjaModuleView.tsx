import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CheckCircle2, ChevronRight, Circle, Search, Settings } from 'lucide-react'
import { FormModal } from '../../src/template'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { WorkplacePageHeading1 } from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutScoreStatRow } from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'
import { RecurrencePicker, toDateTimeLocalValue } from '../../src/components/hse/RecurrencePicker'
import { useSja } from './useSja'
import type { SjaAnalysis, SjaJobType } from './types'

const JOB_TYPE_LABEL: Record<SjaJobType, string> = {
  hot_work: 'Varmt arbeid',
  confined_space: 'Arbeid i trange rom',
  work_at_height: 'Arbeid i høyden',
  electrical: 'Elektrisk arbeid',
  lifting: 'Løft / rigging',
  excavation: 'Graving',
  custom: 'Annet',
}

function sjaListStatusBadgeVariant(status: SjaAnalysis['status']): BadgeVariant {
  switch (status) {
    case 'draft':
    case 'archived':
      return 'neutral'
    case 'active':
    case 'approved':
    case 'in_execution':
      return 'info'
    case 'completed':
      return 'success'
    case 'stopped':
      return 'critical'
    default:
      return 'neutral'
  }
}

const STATUS_LABEL: Record<SjaAnalysis['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  approved: 'Godkjent',
  in_execution: 'Under utførelse',
  completed: 'Fullført',
  archived: 'Arkivert',
  stopped: 'Stoppet',
}

function formatDateTimeShort(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function SjaModuleView({ supabase }: { supabase: SupabaseClient | null }) {
  const navigate = useNavigate()
  const sja = useSja({ supabase })
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [newSjaForm, setNewSjaForm] = useState({
    title: '',
    templateId: '',
    jobType: 'custom' as SjaJobType,
    locationId: '',
    scheduledStart: '',
    scheduledEnd: '',
    responsibleId: '',
    cronExpression: '',
  })
  const [scheduleDraft, setScheduleDraft] = useState<
    Record<string, { scheduledStart: string; scheduledEnd: string; responsibleId: string; cronExpression: string }>
  >({})
  const [deviationCountBySjaId, setDeviationCountBySjaId] = useState<Record<string, number>>({})
  const [participantSigBySjaId, setParticipantSigBySjaId] = useState<
    Record<string, { total: number; signed: number }>
  >({})

  useEffect(() => {
    void sja.load()
  }, [sja.load])

  const analyses = useMemo(
    () => sja.analyses.filter((a) => a.deleted_at == null || String(a.deleted_at).trim() === ''),
    [sja.analyses],
  )

  useEffect(() => {
    if (!supabase || analyses.length === 0) {
      setDeviationCountBySjaId({})
      return
    }
    let cancelled = false
    void (async () => {
      const ids = analyses.map((a) => a.id)
      const { data, error } = await supabase
        .from('deviations')
        .select('source_id')
        .in('source_id', ids)
        .is('deleted_at', null)
      if (cancelled || error) {
        if (!cancelled) setDeviationCountBySjaId({})
        return
      }
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const sid = (row as { source_id?: string | null }).source_id
        if (typeof sid === 'string' && sid) counts[sid] = (counts[sid] ?? 0) + 1
      }
      setDeviationCountBySjaId(counts)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, analyses])

  useEffect(() => {
    if (!supabase || analyses.length === 0) {
      setParticipantSigBySjaId({})
      return
    }
    let cancelled = false
    void (async () => {
      const ids = analyses.map((a) => a.id)
      const { data, error } = await supabase.from('sja_participants').select('sja_id, signed_at').in('sja_id', ids)
      if (cancelled || error) {
        if (!cancelled) setParticipantSigBySjaId({})
        return
      }
      const map: Record<string, { total: number; signed: number }> = {}
      for (const row of data ?? []) {
        const r = row as { sja_id?: string; signed_at?: string | null }
        if (typeof r.sja_id !== 'string') continue
        const cur = map[r.sja_id] ?? { total: 0, signed: 0 }
        cur.total += 1
        if (r.signed_at) cur.signed += 1
        map[r.sja_id] = cur
      }
      setParticipantSigBySjaId(map)
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, analyses])

  const stats = useMemo(() => {
    let inProgress = 0
    let stopped = 0
    let done = 0
    for (const a of analyses) {
      if (a.status === 'stopped') stopped++
      if (a.status === 'draft' || a.status === 'active' || a.status === 'approved' || a.status === 'in_execution') {
        inProgress++
      }
      if (a.status === 'completed' || a.status === 'archived') done++
    }
    return { inProgress, stopped, done }
  }, [analyses])

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const loc of sja.locations) map.set(loc.id, loc.name)
    return map
  }, [sja.locations])

  const templateById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of sja.templates) map.set(t.id, t.name)
    return map
  }, [sja.templates])

  const templateJobTypeById = useMemo(() => {
    const map = new Map<string, SjaJobType>()
    for (const t of sja.templates) map.set(t.id, t.job_type as SjaJobType)
    return map
  }, [sja.templates])

  const userNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of sja.assignableUsers) map.set(u.id, u.displayName)
    return map
  }, [sja.assignableUsers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return analyses
    return analyses.filter((a) => {
      const loc = a.location_id ? locationNameById.get(a.location_id) ?? '' : a.location_text ?? ''
      const resp = a.responsible_id ? userNameById.get(a.responsible_id) ?? '' : ''
      return (
        a.title.toLowerCase().includes(q) ||
        a.job_description.toLowerCase().includes(q) ||
        loc.toLowerCase().includes(q) ||
        resp.toLowerCase().includes(q)
      )
    })
  }, [analyses, search, locationNameById, userNameById])

  const analysesForSchedule = useMemo(
    () =>
      analyses
        .slice()
        .sort((a, b) => {
          if (a.scheduled_start && b.scheduled_start) return a.scheduled_start.localeCompare(b.scheduled_start)
          if (a.scheduled_start) return -1
          if (b.scheduled_start) return 1
          return a.created_at.localeCompare(b.created_at)
        })
        .slice(0, 12),
    [analyses],
  )

  const defaultTemplateId = sja.templates[0]?.id ?? ''

  return (
    <div className="space-y-6">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Sikker jobbanalyse' }]}
        title="Sikker jobbanalyse"
        description="Planlegg, gjennomfør og signer sikker jobbanalyse i henhold til arbeidsmiljøloven og internkontroll."
        headerActions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setScheduleOpen(true)} className="font-medium">
              Planlegging
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                const tid = defaultTemplateId
                setNewSjaForm({
                  title: '',
                  templateId: tid,
                  jobType: (tid ? templateJobTypeById.get(tid) : undefined) ?? 'custom',
                  locationId: '',
                  scheduledStart: '',
                  scheduledEnd: '',
                  responsibleId: '',
                  cronExpression: '',
                })
                setCreateOpen(true)
              }}
              className="bg-[#2D403A] font-bold uppercase tracking-wide hover:bg-[#243830]"
            >
              Ny analyse
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 font-normal text-neutral-600"
              icon={<Settings className="w-4 h-4" aria-hidden />}
              onClick={() => navigate('/sja/admin')}
              aria-label="SJA-innstillinger"
            />
          </div>
        }
      />

      <LayoutScoreStatRow
        items={[
          {
            big: String(stats.inProgress),
            title: 'Aktive analyser',
            sub: 'Fra kladd til under utførelse',
          },
          {
            big: String(stats.stopped),
            title: 'Stoppet',
            sub: 'Krever oppfølging',
          },
          {
            big: String(stats.done),
            title: 'Fullført / arkivert',
            sub: 'Avsluttet flyt',
          },
        ]}
      />

      <LayoutTable1PostingsShell
        wrap
        title="Analyser"
        description="Alle SJA-er — sortert etter siste aktivitet."
        headerActions={sja.error ? <span className="text-xs text-red-600">{sja.error}</span> : undefined}
        toolbar={
          <div className="relative min-w-[200px] flex-1">
            <label className="sr-only" htmlFor="sja-search">
              Søk
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <StandardInput
              id="sja-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søk i tittel, lokasjon, ansvarlig …"
              className="rounded-lg py-2 pl-10 pr-3 shadow-sm focus:ring-2 focus:ring-[#1a3d32]/25"
            />
          </div>
        }
        footer={
          <span className="text-neutral-500">
            {search.trim() ? `${filtered.length} treff` : `Viser ${filtered.length} analyser`}
          </span>
        }
      >
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mal</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Lokasjon</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Planlagt</th>
              <th className={LAYOUT_TABLE1_POSTINGS_TH}>Signaturer</th>
              <th className={`w-24 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
              <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const locName = a.location_id ? locationNameById.get(a.location_id) ?? '—' : a.location_text ?? '—'
              const nAvvik = deviationCountBySjaId[a.id] ?? 0
              const sig = participantSigBySjaId[a.id]
              const sigLabel = sig && sig.total > 0 ? `${sig.signed}/${sig.total}` : '—'
              const allSigned = sig && sig.total > 0 && sig.signed === sig.total
              return (
                <tr
                  key={a.id}
                  className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                  onClick={() => navigate(`/sja/${a.id}`)}
                >
                  <td className="px-5 py-3 font-medium text-neutral-900">{a.title}</td>
                  <td className="px-5 py-3 text-neutral-600">{a.template_id ? templateById.get(a.template_id) ?? '—' : '—'}</td>
                  <td className="px-5 py-3 text-neutral-600">{locName}</td>
                  <td className="px-5 py-3 text-neutral-600">
                    {a.responsible_id ? userNameById.get(a.responsible_id) ?? '—' : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={sjaListStatusBadgeVariant(a.status)} className="text-xs">
                      {STATUS_LABEL[a.status]}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-neutral-600">{formatDateTimeShort(a.scheduled_start)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 text-xs text-neutral-600" title="Deltakere signert / totalt">
                      {sig && sig.total > 0 ? (
                        allSigned ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden />
                        ) : (
                          <Circle className="h-4 w-4 text-neutral-300" aria-hidden />
                        )
                      ) : (
                        <Circle className="h-4 w-4 text-neutral-200" aria-hidden />
                      )}
                      <span>{sigLabel}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {nAvvik > 0 ? (
                      <Link to={`/avvik?sourceId=${encodeURIComponent(a.id)}`} onClick={(e) => e.stopPropagation()}>
                        <Badge variant="medium" className="cursor-pointer text-[11px] hover:opacity-90">
                          {nAvvik} avvik
                        </Badge>
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-300">—</span>
                    )}
                  </td>
                  <td className="w-8 px-3 py-3 text-neutral-300">
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm text-neutral-500">
                  {sja.loading ? 'Laster…' : 'Ingen analyser matcher søket.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </LayoutTable1PostingsShell>

      <FormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleId="form-create-sja"
        title="Ny sikker jobbanalyse"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() =>
                void (async () => {
                  if (!newSjaForm.title.trim()) return
                  const templateId = newSjaForm.templateId || defaultTemplateId || undefined
                  const jobType =
                    (templateId ? templateJobTypeById.get(templateId) : undefined) ?? newSjaForm.jobType ?? 'custom'
                  const created = await sja.createAnalysis({
                    title: newSjaForm.title.trim(),
                    templateId: templateId || null,
                    jobType,
                    scheduledStart: newSjaForm.scheduledStart || null,
                    scheduledEnd: newSjaForm.scheduledEnd || null,
                    responsibleId: newSjaForm.responsibleId || null,
                    locationId: newSjaForm.locationId || null,
                  })
                  if (!created) return
                  setCreateOpen(false)
                  setNewSjaForm({
                    title: '',
                    templateId: defaultTemplateId,
                    jobType: (defaultTemplateId ? templateJobTypeById.get(defaultTemplateId) : undefined) ?? 'custom',
                    locationId: '',
                    scheduledStart: '',
                    scheduledEnd: '',
                    responsibleId: '',
                    cronExpression: '',
                  })
                  navigate(`/sja/${created.id}`)
                })()
              }
            >
              Opprett
            </Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Tittel</span>
            <StandardInput
              value={newSjaForm.title}
              onChange={(e) => setNewSjaForm((p) => ({ ...p, title: e.target.value }))}
              className="rounded-lg"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Mal</span>
            {sja.templates.length === 0 ? (
              <StandardInput
                disabled
                readOnly
                value="Ingen maler (bruk jobbtype under)"
                className="rounded-lg opacity-70"
              />
            ) : (
              <SearchableSelect
                value={newSjaForm.templateId || defaultTemplateId}
                options={sja.templates.map((t) => ({ value: t.id, label: t.name }))}
                onChange={(id) =>
                  setNewSjaForm((p) => ({
                    ...p,
                    templateId: id,
                    jobType: templateJobTypeById.get(id) ?? p.jobType,
                  }))
                }
              />
            )}
          </label>
          {sja.templates.length === 0 ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-neutral-500">Jobbtype</span>
              <SearchableSelect
                value={newSjaForm.jobType}
                options={(Object.keys(JOB_TYPE_LABEL) as SjaJobType[]).map((k) => ({ value: k, label: JOB_TYPE_LABEL[k] }))}
                onChange={(v) => setNewSjaForm((p) => ({ ...p, jobType: v as SjaJobType }))}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Lokasjon</span>
            <SearchableSelect
              value={newSjaForm.locationId}
              options={[{ value: '', label: '(Valgfri)' }, ...sja.locations.map((loc) => ({ value: loc.id, label: loc.name }))]}
              onChange={(v) => setNewSjaForm((p) => ({ ...p, locationId: v }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Planlagt start</span>
            <StandardInput
              type="datetime-local"
              value={newSjaForm.scheduledStart}
              onChange={(e) => setNewSjaForm((p) => ({ ...p, scheduledStart: e.target.value }))}
              className="rounded-lg"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-neutral-500">Planlagt slutt</span>
            <StandardInput
              type="datetime-local"
              value={newSjaForm.scheduledEnd}
              onChange={(e) => setNewSjaForm((p) => ({ ...p, scheduledEnd: e.target.value }))}
              className="rounded-lg"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-xs text-neutral-500">Ansvarlig</span>
            <SearchableSelect
              value={newSjaForm.responsibleId}
              options={[{ value: '', label: '(Valgfri)' }, ...sja.assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))]}
              onChange={(v) => setNewSjaForm((p) => ({ ...p, responsibleId: v }))}
            />
          </label>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-neutral-500">Påminnelse / gjentakelse (valgfri)</span>
            <RecurrencePicker
              value={newSjaForm.cronExpression}
              onChange={(cron) => setNewSjaForm((p) => ({ ...p, cronExpression: cron }))}
            />
            <p className="text-xs text-neutral-500">
              Lagres foreløpig ikke i databasen; brukes som referanse ved manuell planlegging.
            </p>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleId="form-sja-scheduling"
        title="Planlegging av analyser"
        footer={
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setScheduleOpen(false)}>
              Lukk
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {analysesForSchedule.map((analysis) => {
            const draft =
              scheduleDraft[analysis.id] ?? {
                scheduledStart: analysis.scheduled_start ?? '',
                scheduledEnd: analysis.scheduled_end ?? '',
                responsibleId: analysis.responsible_id ?? '',
                cronExpression: '',
              }
            return (
              <div key={analysis.id} className="rounded-lg border border-neutral-200 p-3">
                <p className="text-sm font-medium text-neutral-900">{analysis.title}</p>
                <div className="mt-2 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-neutral-500">Planlagt start</span>
                      <StandardInput
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.scheduledStart || null)}
                        onChange={(e) =>
                          setScheduleDraft((p) => ({
                            ...p,
                            [analysis.id]: { ...draft, scheduledStart: e.target.value },
                          }))
                        }
                        className="rounded-lg py-1.5 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="text-neutral-500">Planlagt slutt</span>
                      <StandardInput
                        type="datetime-local"
                        value={toDateTimeLocalValue(draft.scheduledEnd || null)}
                        onChange={(e) =>
                          setScheduleDraft((p) => ({
                            ...p,
                            [analysis.id]: { ...draft, scheduledEnd: e.target.value },
                          }))
                        }
                        className="rounded-lg py-1.5 text-xs"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                      <span className="text-neutral-500">Ansvarlig</span>
                      <SearchableSelect
                        value={draft.responsibleId}
                        options={[
                          { value: '', label: '(Ingen)' },
                          ...sja.assignableUsers.map((u) => ({ value: u.id, label: u.displayName })),
                        ]}
                        onChange={(v) =>
                          setScheduleDraft((p) => ({
                            ...p,
                            [analysis.id]: { ...draft, responsibleId: v },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-neutral-500">Påminnelse / gjentakelse</span>
                    <RecurrencePicker
                      value={draft.cronExpression}
                      onChange={(cron) =>
                        setScheduleDraft((p) => ({
                          ...p,
                          [analysis.id]: { ...draft, cronExpression: cron },
                        }))
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-2 font-medium"
                  onClick={() =>
                    void (async () => {
                      const startIso =
                        draft.scheduledStart?.trim() && !Number.isNaN(new Date(draft.scheduledStart).getTime())
                          ? new Date(draft.scheduledStart).toISOString()
                          : null
                      const endIso =
                        draft.scheduledEnd?.trim() && !Number.isNaN(new Date(draft.scheduledEnd).getTime())
                          ? new Date(draft.scheduledEnd).toISOString()
                          : null
                      await sja.saveAnalysisPatch(analysis.id, {
                        scheduled_start: startIso,
                        scheduled_end: endIso,
                        responsible_id: draft.responsibleId || null,
                      })
                      if (analysis.status === 'draft') {
                        await sja.advanceStatus(analysis.id, 'active')
                      }
                    })()
                  }
                >
                  Lagre
                </Button>
              </div>
            )
          })}
          {analysesForSchedule.length === 0 && (
            <p className="text-sm text-neutral-500">Ingen analyser. Opprett en analyse først.</p>
          )}
        </div>
      </FormModal>
    </div>
  )
}

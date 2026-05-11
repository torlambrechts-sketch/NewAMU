// Møter — hub body. Canonical primitives only.
//
// Two render modes:
//   - default: template gallery grouped by category + upcoming meetings list.
//   - ?template=ID: drilldown card for that template + meetings using it.
//
// The orchestrator (`MeetingsHubPage`) wraps this in `ModulePageShell` when
// rendering at the root; the embedded admin tab swaps the body for
// `MeetingsAdminPage embedded`.

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Clock,
  ListChecks,
  Plus,
  Scale,
  Users,
} from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { ModuleLegalBanner } from '../../src/components/module/ModuleLegalBanner'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useMeetings } from './useMeetings'
import { MEETINGS_LEGAL_REFERENCES } from './meetingsLegalReferences'
import {
  MEETING_CADENCE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_STATUS_LABEL,
  frameworkLabel,
} from './meetingsLabels'
import type {
  MeetingConfidentialityLevel,
  MeetingRow,
  MeetingStatus,
  ResolvedMeetingTemplate,
} from './types'

type MeetingsHookValue = ReturnType<typeof useMeetings>

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function templateCadenceLabel(t: ResolvedMeetingTemplate): string {
  return t.cadenceHint ? MEETING_CADENCE_LABEL[t.cadenceHint] : 'Ved behov'
}

function isRestrictedTemplate(t: ResolvedMeetingTemplate): boolean {
  // Reads the template-level `defaultConfidentialityLevel` field (DB column
  // populated by H7 migration). Slug-based heuristic removed — admins can
  // now control the default per template in the editor.
  return t.defaultConfidentialityLevel !== 'standard'
}

const STATUS_BADGE: Record<MeetingStatus, 'draft' | 'active' | 'signed' | 'neutral'> = {
  planned: 'active',
  in_progress: 'active',
  completed: 'signed',
  cancelled: 'neutral',
}

export interface MeetingsHubViewProps {
  /** Tabs rendered as the secondary heading row (root-tab strip from orchestrator). */
  tabs?: ReactNode
  /** When true, the orchestrator owns the shell — render body only. */
  bodyOnly?: boolean
  /** Suppress the in-header "Innstillinger" shortcut (orchestrator already shows root tabs). */
  hideAdminNav?: boolean
}

export function MeetingsHubView({ tabs, bodyOnly = false, hideAdminNav = false }: MeetingsHubViewProps) {
  const meetings = useMeetings()
  const orgSetup = useOrgSetupContext()
  const orgHeadcount = orgSetup.members?.length ?? 0
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTemplateId = searchParams.get('template')
  const [createOpen, setCreateOpen] = useState(false)
  const [presetTemplateId, setPresetTemplateId] = useState<string | null>(null)

  const activeTemplate = useMemo(
    () =>
      meetings.templates.find(
        (t) => t.systemTemplateId === activeTemplateId || t.orgTemplateId === activeTemplateId,
      ) ?? null,
    [meetings.templates, activeTemplateId],
  )

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        icon={<BarChart3 className="h-4 w-4" />}
        onClick={() => navigate('/meetings/analyse')}
      >
        <span className="hidden sm:inline">Analyse</span>
      </Button>
      {meetings.canManage ? (
        <Button
          type="button"
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => {
            setPresetTemplateId(activeTemplate?.systemTemplateId ?? activeTemplate?.orgTemplateId ?? null)
            setCreateOpen(true)
          }}
        >
          Nytt møte
        </Button>
      ) : null}
    </div>
  )

  const body = (
    <>
      {meetings.error ? <WarningBox>{meetings.error}</WarningBox> : null}

      <ModuleLegalBanner
        title="Møter — lovpålagte fora og styringssystem"
        intro="Møteregisteret samler AMU, drøftingsmøter, ledelsens gjennomgang og GDPR-fora med protokoll, vedtak og oppfølging i én tråd."
        references={MEETINGS_LEGAL_REFERENCES}
      />

      {activeTemplate ? (
        <TemplateDrilldown
          meetings={meetings}
          template={activeTemplate}
          onBack={() => setSearchParams({})}
          onCreate={() => {
            setPresetTemplateId(activeTemplate.systemTemplateId ?? activeTemplate.orgTemplateId ?? null)
            setCreateOpen(true)
          }}
        />
      ) : (
        <TemplateGallery
          templates={meetings.templates}
          categories={meetings.categories}
          orgHeadcount={orgHeadcount}
          onSelect={(t) =>
            setSearchParams({ template: t.systemTemplateId ?? t.orgTemplateId ?? '' })
          }
        />
      )}

      <UpcomingMeetingsCard meetings={meetings.meetings} />

      <CreateMeetingSlidePanel
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        meetings={meetings}
        presetTemplateId={presetTemplateId}
      />
    </>
  )

  if (bodyOnly) return body

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: 'Møter' }]}
      title="Møter"
      description="Planlegg, gjennomfør og dokumenter lovpålagte møter på tvers av AML, IK-forskriften, ISO og GDPR."
      tabs={tabs}
      headerActions={headerActions}
      loading={meetings.loading && meetings.templates.length === 0}
      loadingLabel="Laster møter…"
    >
      {body}
    </ModulePageShell>
  )

  // Local helpers below silence unused-var when bodyOnly=false. (No-op.)
  void hideAdminNav
}

// ── Template gallery card ─────────────────────────────────────────────────

function TemplateGallery({
  templates,
  categories,
  orgHeadcount,
  onSelect,
}: {
  templates: ResolvedMeetingTemplate[]
  categories: ReturnType<typeof useMeetings>['categories']
  orgHeadcount: number
  onSelect: (t: ResolvedMeetingTemplate) => void
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, ResolvedMeetingTemplate[]>()
    for (const t of templates) {
      if (!t.isActive) continue
      const key = t.categoryId ?? '__uncat__'
      const list = buckets.get(key) ?? []
      list.push(t)
      buckets.set(key, list)
    }
    const cats = categories.slice().sort((a, b) => a.position - b.position)
    const ordered: Array<{ id: string; name: string; templates: ResolvedMeetingTemplate[] }> = []
    for (const cat of cats) {
      const list = buckets.get(cat.id)
      if (list?.length) ordered.push({ id: cat.id, name: cat.name, templates: list })
    }
    const uncat = buckets.get('__uncat__')
    if (uncat?.length) ordered.push({ id: '__uncat__', name: 'Uten kategori', templates: uncat })
    return ordered
  }, [templates, categories])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#1a3d32]" />
          <h2 className="text-lg font-semibold text-neutral-900">Maler</h2>
        </div>
        <span className="text-xs text-neutral-500">
          {templates.filter((t) => t.isActive).length} aktive
        </span>
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Velg en mal for å planlegge eller dokumentere et møte. Hver mal bærer obligatoriske
        saker, kadens og lovreferanser som lander på protokollen.
      </p>

      <div className="mt-5 space-y-6">
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen maler tilgjengelig ennå.</p>
        ) : (
          grouped.map((group) => (
            <div key={group.id}>
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                {group.name}
              </h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((t) => {
                  const belowThreshold =
                    t.minimumEmployeeCount != null && orgHeadcount < t.minimumEmployeeCount
                  return (
                    <li
                      key={t.key}
                      className="flex flex-col gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(t)}
                        className="flex flex-col gap-2 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-neutral-900">{t.name}</span>
                          <Badge variant="info">{frameworkLabel(t.framework)}</Badge>
                        </div>
                        {t.description ? (
                          <p className="line-clamp-3 text-xs text-neutral-600">{t.description}</p>
                        ) : null}
                        {belowThreshold ? (
                          <div>
                            <Badge variant="warning">
                              Krever {t.minimumEmployeeCount}+ ansatte
                            </Badge>
                          </div>
                        ) : null}
                        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-neutral-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {templateCadenceLabel(t)}
                          </span>
                          {t.definition.agendaItems.length ? (
                            <span className="inline-flex items-center gap-1">
                              <ListChecks className="h-3 w-3" />
                              {t.definition.agendaItems.length} saker
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </ModuleSectionCard>
  )
}

// ── Template drilldown card ───────────────────────────────────────────────

function TemplateDrilldown({
  meetings,
  template,
  onBack,
  onCreate,
}: {
  meetings: MeetingsHookValue
  template: ResolvedMeetingTemplate
  onBack: () => void
  onCreate: () => void
}) {
  const templateMeetings = useMemo(() => {
    const id = template.systemTemplateId ?? template.orgTemplateId
    return meetings.meetings
      .filter((m) => m.system_template_id === id || m.org_template_id === id)
      .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))
      .slice(0, 20)
  }, [meetings.meetings, template])

  return (
    <>
      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
            >
              ← Tilbake til alle maler
            </button>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">{template.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="info">{frameworkLabel(template.framework)}</Badge>
              <Badge variant="neutral">{templateCadenceLabel(template)}</Badge>
              {isRestrictedTemplate(template) ? (
                <Badge variant="warning">Begrenset som standard</Badge>
              ) : null}
            </div>
            {template.description ? (
              <p className="mt-3 text-sm leading-relaxed text-neutral-700">{template.description}</p>
            ) : null}
          </div>
          {meetings.canManage ? (
            <Button
              type="button"
              variant="primary"
              icon={<Plus className="h-4 w-4" />}
              onClick={onCreate}
            >
              Nytt møte fra malen
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Obligatoriske saker</h3>
            {template.definition.agendaItems.length === 0 ? (
              <p className="text-sm text-neutral-600">Ingen saker i malen.</p>
            ) : (
              <ol className="space-y-3">
                {template.definition.agendaItems
                  .slice()
                  .sort((a, b) => a.defaultPosition - b.defaultPosition)
                  .map((item) => (
                    <li
                      key={item.key}
                      className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                        {item.isMandatory ? <Badge variant="critical">Obligatorisk</Badge> : null}
                      </div>
                      {item.description ? (
                        <p className="mt-2 text-xs text-neutral-600">{item.description}</p>
                      ) : null}
                      {item.lawRef ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-neutral-500">
                          <Scale className="h-3 w-3" /> {item.lawRef}
                        </p>
                      ) : null}
                    </li>
                  ))}
              </ol>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Krav</p>
              <dl className="mt-2 space-y-1.5 text-xs text-neutral-700">
                <div className="flex justify-between gap-3">
                  <dt>Kadens</dt>
                  <dd className="font-semibold">{templateCadenceLabel(template)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Varighet</dt>
                  <dd className="font-semibold">
                    {template.defaultDurationMinutes ? `${template.defaultDurationMinutes} min` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Innkallingsfrist</dt>
                  <dd className="font-semibold">
                    {template.definition.invitationLeadDays
                      ? `${template.definition.invitationLeadDays} dager`
                      : '—'}
                  </dd>
                </div>
              </dl>
              {template.definition.requiredAttendees.length ? (
                <div className="mt-3 border-t border-neutral-200/80 pt-3">
                  <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    <Users className="h-3 w-3" /> Påkrevde roller
                  </p>
                  <ul className="space-y-0.5 text-xs text-neutral-700">
                    {template.definition.requiredAttendees.map((r, idx) => (
                      <li key={idx}>
                        {r.role}
                        {r.count ? ` × ${r.count}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            {template.lawRefs.length ? (
              <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
                <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  <Scale className="h-3 w-3" /> Lovreferanser
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-neutral-700">
                  {template.lawRefs.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-900">Møter med denne malen</h3>
          <span className="text-xs text-neutral-500">{templateMeetings.length}</span>
        </div>
        {templateMeetings.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">
            Ingen møter har brukt malen ennå. «Nytt møte fra malen» oppretter det første.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {templateMeetings.map((m) => (
              <MeetingListItem key={m.id} meeting={m} />
            ))}
          </ul>
        )}
      </ModuleSectionCard>
    </>
  )
}

// ── Upcoming meetings card ────────────────────────────────────────────────

function UpcomingMeetingsCard({ meetings }: { meetings: MeetingRow[] }) {
  const upcoming = useMemo(
    () =>
      meetings
        .filter((m) => m.status === 'planned' || m.status === 'in_progress')
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
        .slice(0, 8),
    [meetings],
  )

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Kommende og pågående møter</h2>
        <span className="text-xs text-neutral-500">{upcoming.length}</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Ingen planlagte eller pågående møter.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {upcoming.map((m) => (
            <MeetingListItem key={m.id} meeting={m} />
          ))}
        </ul>
      )}
    </ModuleSectionCard>
  )
}

function MeetingListItem({ meeting }: { meeting: MeetingRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
      <div className="min-w-0 flex-1">
        <Link
          to={`/meetings/${meeting.id}`}
          className="text-sm font-semibold text-neutral-900 hover:underline"
        >
          {meeting.title}
        </Link>
        <p className="mt-0.5 text-xs text-neutral-600">{fmtDate(meeting.scheduled_at)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={STATUS_BADGE[meeting.status]}>{MEETING_STATUS_LABEL[meeting.status]}</Badge>
        {meeting.confidentiality_level !== 'standard' ? (
          <Badge variant="warning">
            {MEETING_CONFIDENTIALITY_LABEL[meeting.confidentiality_level]}
          </Badge>
        ) : null}
        <Link
          to={`/meetings/${meeting.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
          aria-label={`Åpne ${meeting.title}`}
        >
          Åpne <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  )
}

// ── Slide-panel: create meeting ───────────────────────────────────────────

function CreateMeetingSlidePanel({
  open,
  onClose,
  meetings,
  presetTemplateId,
}: {
  open: boolean
  onClose: () => void
  meetings: MeetingsHookValue
  presetTemplateId: string | null
}) {
  const navigate = useNavigate()
  const [templateId, setTemplateId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [confidentiality, setConfidentiality] = useState<MeetingConfidentialityLevel>('standard')
  const [busy, setBusy] = useState(false)

  // Sync local state with preset when panel opens.
  useEffect(() => {
    if (!open) return
    const preset = presetTemplateId ?? ''
    setTemplateId(preset)
    const tpl = meetings.templates.find(
      (t) => t.systemTemplateId === preset || t.orgTemplateId === preset,
    )
    setTitle(tpl?.name ?? '')
    setConfidentiality(tpl?.defaultConfidentialityLevel ?? 'standard')
    setScheduledAt('')
  }, [open, presetTemplateId, meetings.templates])

  const templateOptions = useMemo(
    () =>
      meetings.templates
        .filter((t) => t.isActive)
        .map((t) => ({
          value: t.systemTemplateId ?? t.orgTemplateId ?? '',
          label: t.name,
        })),
    [meetings.templates],
  )

  const selectedTemplate = useMemo(
    () =>
      meetings.templates.find(
        (t) => t.systemTemplateId === templateId || t.orgTemplateId === templateId,
      ) ?? null,
    [meetings.templates, templateId],
  )

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (busy || !templateId || !title.trim()) return
    setBusy(true)
    try {
      const created = await meetings.createMeeting({
        title: title.trim(),
        templateId: selectedTemplate?.systemTemplateId ?? undefined,
        orgTemplateId: selectedTemplate?.orgTemplateId ?? undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        confidentialityLevel: confidentiality,
      })
      if (created) {
        onClose()
        navigate(`/meetings/${created.id}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="meetings-new-panel-title"
      title="Nytt møte"
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => {
              void handleCreate(new Event('submit') as unknown as FormEvent)
            }}
            disabled={busy || !templateId || !title.trim()}
          >
            Opprett
          </Button>
        </div>
      }
    >
      <form onSubmit={handleCreate} className="space-y-5">
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-template">
            Mal
          </label>
          <SearchableSelect
            value={templateId}
            options={templateOptions}
            onChange={(val) => {
              setTemplateId(val)
              const tpl = meetings.templates.find(
                (t) => t.systemTemplateId === val || t.orgTemplateId === val,
              )
              if (tpl) {
                setTitle(tpl.name)
                setConfidentiality(tpl.defaultConfidentialityLevel ?? 'standard')
              }
            }}
            placeholder="Velg en mal …"
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Malens agenda blir kopiert til møtet og kan ikke endres etter signering.
          </p>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-title">
            Tittel
          </label>
          <StandardInput
            id="meetings-new-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-when">
            Planlagt tidspunkt
          </label>
          <StandardInput
            id="meetings-new-when"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="meetings-new-confidentiality">
            Konfidensialitet
          </label>
          <SearchableSelect
            value={confidentiality}
            options={[
              { value: 'standard', label: MEETING_CONFIDENTIALITY_LABEL.standard },
              { value: 'restricted', label: MEETING_CONFIDENTIALITY_LABEL.restricted },
              { value: 'confidential', label: MEETING_CONFIDENTIALITY_LABEL.confidential },
            ]}
            onChange={(val) => setConfidentiality(val as MeetingConfidentialityLevel)}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Drøftingsmøter og varslingssaker er begrenset som standard.
          </p>
        </div>
      </form>
    </SlidePanel>
  )
}

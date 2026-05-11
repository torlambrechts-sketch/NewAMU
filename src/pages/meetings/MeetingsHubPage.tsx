// Møter — hub landing.
//
// Two modes driven by ?template=ID:
//  - no param: gallery of resolved templates grouped by category + a list
//    of upcoming/recent meetings (default landing).
//  - ?template=ID: detail card for that template (description, law refs,
//    mandatory agenda items, required attendees, cadence) + a "schedule
//    new meeting" inline form + the list of meetings of that template.
//
// Detail of a single meeting lives in `MeetingsDetailView` at
// /meetings/:meetingId — this page only links to it.

import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  ClipboardList,
  Clock,
  ExternalLink,
  Plus,
  Scale,
  Settings,
  Users,
} from 'lucide-react'
import { useMeetings } from '../../../modules/meetings'
import {
  MEETING_CADENCE_LABEL,
  MEETING_CONFIDENTIALITY_LABEL,
  MEETING_STATUS_LABEL,
  frameworkLabel,
} from '../../../modules/meetings/meetingsLabels'
import { MeetingsLegalReferences } from '../../../modules/meetings/meetingsLegalReferences'
import type {
  MeetingConfidentialityLevel,
  ResolvedMeetingTemplate,
} from '../../../modules/meetings/types'

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
  // Drøfting, varsling and MUS templates default to a higher confidentiality
  // level per the senior-architect decision (see CLAUDE.md + answer thread).
  const slug = t.systemTemplateId ?? ''
  return /^(drofting-|varslingsutvalg|mus)/.test(slug)
}

export function MeetingsHubPage() {
  const meetings = useMeetings()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTemplateId = searchParams.get('template')

  const activeTemplate = useMemo(
    () =>
      meetings.templates.find(
        (t) => t.systemTemplateId === activeTemplateId || t.orgTemplateId === activeTemplateId,
      ) ?? null,
    [meetings.templates, activeTemplateId],
  )

  if (meetings.loading && meetings.templates.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-neutral-600">
        Laster møter…
      </div>
    )
  }

  if (activeTemplate) {
    return (
      <TemplateDetailView
        meetings={meetings}
        template={activeTemplate}
        onBack={() => setSearchParams({})}
      />
    )
  }

  return <HubGalleryView meetings={meetings} />
}

type MeetingsHookValue = ReturnType<typeof useMeetings>

function HubGalleryView({ meetings }: { meetings: MeetingsHookValue }) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, { categoryId: string | null; templates: ResolvedMeetingTemplate[] }>()
    for (const t of meetings.templates) {
      if (!t.isActive) continue
      const key = t.categoryId ?? '__uncat__'
      const bucket = buckets.get(key) ?? { categoryId: t.categoryId, templates: [] }
      bucket.templates.push(t)
      buckets.set(key, bucket)
    }
    const cats = meetings.categories.slice().sort((a, b) => a.position - b.position)
    const ordered: Array<{ id: string; name: string; templates: ResolvedMeetingTemplate[] }> = []
    for (const cat of cats) {
      const bucket = buckets.get(cat.id)
      if (bucket?.templates.length) {
        ordered.push({ id: cat.id, name: cat.name, templates: bucket.templates })
      }
    }
    const uncat = buckets.get('__uncat__')
    if (uncat?.templates.length) {
      ordered.push({ id: '__uncat__', name: 'Uten kategori', templates: uncat.templates })
    }
    return ordered
  }, [meetings.templates, meetings.categories])

  const upcoming = useMemo(
    () =>
      meetings.meetings
        .filter((m) => m.status === 'planned' || m.status === 'in_progress')
        .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''))
        .slice(0, 8),
    [meetings.meetings],
  )

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            HMS · Møter
          </p>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">
            Møteregister
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-700">
            Lovpålagte møter på tvers av AMU, drøfting, ISO og GDPR.
            Velg en mal for å planlegge eller dokumentere et møte.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/meetings/analyse"
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <BarChart3 className="h-4 w-4" />
            Analyse
          </Link>
          {meetings.canManage ? (
            <Link
              to="/meetings/admin"
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <Settings className="h-4 w-4" />
              Innstillinger
            </Link>
          ) : null}
        </div>
      </header>

      <MeetingsLegalReferences />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Maler
        </h2>
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen maler tilgjengelig ennå.</p>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.id}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {group.name}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.templates.map((t) => (
                    <Link
                      key={t.key}
                      to={`/meetings?template=${encodeURIComponent(t.systemTemplateId ?? t.orgTemplateId ?? '')}`}
                      className="group flex flex-col gap-2 border border-neutral-200 bg-white p-4 hover:border-neutral-900"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-neutral-900">{t.name}</h4>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
                          {frameworkLabel(t.framework)}
                        </span>
                      </div>
                      {t.description ? (
                        <p className="line-clamp-3 text-xs text-neutral-600">{t.description}</p>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-[11px] text-neutral-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {templateCadenceLabel(t)}
                        </span>
                        {t.definition.agendaItems.length ? (
                          <span className="inline-flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {t.definition.agendaItems.length} saker
                          </span>
                        ) : null}
                        {t.lawRefs.length ? (
                          <span className="inline-flex items-center gap-1">
                            <Scale className="h-3 w-3" />
                            {t.lawRefs.slice(0, 2).join(', ')}
                            {t.lawRefs.length > 2 ? '…' : ''}
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Kommende og pågående møter
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-600">Ingen planlagte eller pågående møter.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {upcoming.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="text-sm font-semibold text-neutral-900 hover:underline"
                  >
                    {m.title}
                  </Link>
                  <p className="text-xs text-neutral-600">
                    {fmtDate(m.scheduled_at)} · {MEETING_STATUS_LABEL[m.status]} ·{' '}
                    {MEETING_CONFIDENTIALITY_LABEL[m.confidentiality_level]}
                  </p>
                </div>
                <Link
                  to={`/meetings/${m.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
                >
                  Åpne <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function TemplateDetailView({
  meetings,
  template,
  onBack,
}: {
  meetings: MeetingsHookValue
  template: ResolvedMeetingTemplate
  onBack: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState(template.name)
  const [scheduledAt, setScheduledAt] = useState('')
  const [confidentiality, setConfidentiality] = useState<MeetingConfidentialityLevel>(
    isRestrictedTemplate(template) ? 'restricted' : 'standard',
  )
  const [busy, setBusy] = useState(false)

  const templateMeetings = useMemo(() => {
    const id = template.systemTemplateId ?? template.orgTemplateId
    return meetings.meetings
      .filter((m) => m.system_template_id === id || m.org_template_id === id)
      .sort((a, b) => (b.scheduled_at ?? '').localeCompare(a.scheduled_at ?? ''))
      .slice(0, 20)
  }, [meetings.meetings, template])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const result = await meetings.createMeeting({
        title: title.trim() || template.name,
        templateId: template.systemTemplateId ?? undefined,
        orgTemplateId: template.orgTemplateId ?? undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        confidentialityLevel: confidentiality,
      })
      if (result) {
        setCreating(false)
        setTitle(template.name)
        setScheduledAt('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500 hover:text-neutral-900"
          >
            ← Tilbake til alle maler
          </button>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">
            {template.name}
          </h1>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-700">
            {frameworkLabel(template.framework)} · {templateCadenceLabel(template)}
          </p>
          {template.description ? (
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-700">
              {template.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          <CalendarPlus className="h-4 w-4" />
          {creating ? 'Avbryt' : 'Planlegg møte'}
        </button>
      </header>

      {creating ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 grid gap-3 border border-neutral-300 bg-[#f7f6f2] p-4 sm:grid-cols-3"
        >
          <label className="text-xs text-neutral-700">
            Tittel
            <input
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="text-xs text-neutral-700">
            Planlagt tidspunkt
            <input
              type="datetime-local"
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label className="text-xs text-neutral-700">
            Konfidensialitet
            <select
              className="mt-1 w-full border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              value={confidentiality}
              onChange={(e) => setConfidentiality(e.target.value as MeetingConfidentialityLevel)}
            >
              <option value="standard">{MEETING_CONFIDENTIALITY_LABEL.standard}</option>
              <option value="restricted">{MEETING_CONFIDENTIALITY_LABEL.restricted}</option>
              <option value="confidential">{MEETING_CONFIDENTIALITY_LABEL.confidential}</option>
            </select>
          </label>
          <div className="sm:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 bg-neutral-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Opprett
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
            Obligatoriske saker
          </h2>
          {template.definition.agendaItems.length === 0 ? (
            <p className="text-sm text-neutral-600">Ingen saker i malen.</p>
          ) : (
            <ol className="space-y-2">
              {template.definition.agendaItems
                .slice()
                .sort((a, b) => a.defaultPosition - b.defaultPosition)
                .map((item) => (
                  <li
                    key={item.key}
                    className="border border-neutral-200 bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold text-neutral-900">{item.title}</p>
                      {item.isMandatory ? (
                        <span className="inline-flex items-center gap-1 border border-cyan-700 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700">
                          Obligatorisk
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="mt-1 text-xs text-neutral-600">{item.description}</p>
                    ) : null}
                    {item.lawRef ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-neutral-500">
                        <Scale className="h-3 w-3" /> {item.lawRef}
                      </p>
                    ) : null}
                  </li>
                ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          <div className="border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Krav
            </h3>
            <dl className="space-y-1 text-xs text-neutral-700">
              <div className="flex justify-between gap-3">
                <dt>Kadens</dt>
                <dd className="font-semibold">{templateCadenceLabel(template)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Varighet</dt>
                <dd className="font-semibold">
                  {template.defaultDurationMinutes
                    ? `${template.defaultDurationMinutes} min`
                    : '—'}
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
              {template.definition.requiredAttendees.length ? (
                <div className="mt-2 border-t border-neutral-200 pt-2">
                  <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                    <Users className="h-3 w-3" /> Påkrevde roller
                  </p>
                  <ul className="space-y-0.5">
                    {template.definition.requiredAttendees.map((r, idx) => (
                      <li key={idx}>
                        {r.role}
                        {r.count ? ` × ${r.count}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </dl>
          </div>
          {template.lawRefs.length ? (
            <div className="border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                <Scale className="h-3 w-3" /> Lovreferanser
              </h3>
              <ul className="space-y-0.5 text-xs text-neutral-700">
                {template.lawRefs.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-neutral-600">
          Møter med denne malen
        </h2>
        {templateMeetings.length === 0 ? (
          <p className="text-sm text-neutral-600">
            Ingen møter har brukt malen ennå. Trykk «Planlegg møte» for å opprette det første.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 border border-neutral-200 bg-white">
            {templateMeetings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/meetings/${m.id}`}
                    className="text-sm font-semibold text-neutral-900 hover:underline"
                  >
                    {m.title}
                  </Link>
                  <p className="text-xs text-neutral-600">
                    {fmtDate(m.scheduled_at)} · {MEETING_STATUS_LABEL[m.status]} ·{' '}
                    {MEETING_CONFIDENTIALITY_LABEL[m.confidentiality_level]}
                  </p>
                </div>
                <Link
                  to={`/meetings/${m.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
                >
                  Åpne <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

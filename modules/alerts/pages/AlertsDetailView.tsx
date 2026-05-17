// Per-case detail — tabs: Informasjon, Tidslinje, Notater, Vedlegg, Lukking.
// Committee-only surface. Read RLS does most of the gating; this view
// surfaces what the row reveals + the committee actions.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock, AlertTriangle, Download, Trash2, Upload } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { YesNoToggle } from '../../../src/components/ui/FormToggles'
import { useAlerts } from '../useAlerts'
import { AlertAcknowledgementBadge, AlertGdprDeadlineBadge } from '../components/AlertDeadlineBadges'
import {
  ALERT_KIND_LABEL,
  ALERT_STATUS_LABEL,
  ALERT_CONFIDENTIALITY_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_TIMELINE_EVENT_LABEL,
  ALERT_NOTE_KIND_LABEL,
} from '../alertsLabels'
import type { AlertClosingOutcome, AlertSeverity, AlertStatus } from '../types'
import { deriveAnonymityTier } from '../types'

const STATUS_OPTIONS: AlertStatus[] = ['received', 'triage', 'investigation', 'internal_review', 'closed', 'dismissed']
const SEVERITY_OPTIONS: AlertSeverity[] = ['low', 'medium', 'high', 'critical']
const OUTCOME_OPTIONS: AlertClosingOutcome[] = ['substantiated', 'unsubstantiated', 'inconclusive', 'referred']

type Tab = 'info' | 'timeline' | 'notes' | 'attachments' | 'close'

export function AlertsDetailView() {
  const { caseId } = useParams<{ caseId: string }>()
  const alerts = useAlerts()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('info')
  const [newNote, setNewNote] = useState('')
  const [noteVisible, setNoteVisible] = useState(false)
  const [closingSummary, setClosingSummary] = useState('')
  const [closingOutcome, setClosingOutcome] = useState<AlertClosingOutcome>('substantiated')
  const [busy, setBusy] = useState(false)

  const loadDetail = alerts.loadDetail
  useEffect(() => {
    if (caseId) void loadDetail(caseId)
  }, [caseId, loadDetail])

  const c = alerts.detail.caseRow
  const anonymity = useMemo(() => (c ? deriveAnonymityTier(c) : null), [c])
  const tpl = useMemo(
    () => alerts.resolvedTemplates.find((t) => t.id === c?.system_template_id || t.id === c?.org_template_id) ?? null,
    [alerts.resolvedTemplates, c]
  )
  const isClosed = !!c?.closed_at

  async function doStatus(s: AlertStatus) {
    if (!caseId) return
    setBusy(true); await alerts.setStatus(caseId, s); setBusy(false)
  }
  async function doSeverity(s: AlertSeverity) {
    if (!caseId) return
    setBusy(true); await alerts.setSeverity(caseId, s); setBusy(false)
  }
  async function doAddNote() {
    if (!caseId || !newNote.trim()) return
    setBusy(true)
    const ok = await alerts.addNote(caseId, newNote.trim(), { visibleToReporter: noteVisible })
    setBusy(false)
    if (ok) { setNewNote(''); setNoteVisible(false) }
  }
  async function doClose() {
    if (!caseId || !closingSummary.trim()) return
    setBusy(true)
    const ok = await alerts.closeCase(caseId, { closingSummary: closingSummary.trim(), closingOutcome })
    setBusy(false)
    if (ok) navigate('/alerts')
  }

  if (alerts.detailLoading || !c) {
    return (
      <ModulePageShell breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Sak' }]} title="Sak" loading={true}>
        {null}
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: c.title }]}
      title={c.title}
      description={
        <span>
          {tpl?.name ?? c.system_template_id ?? c.org_template_id} · Mottatt {new Date(c.received_at).toLocaleString('no-NO')}
        </span>
      }
      headerActions={
        <Link to="/alerts"><Button variant="ghost" icon={<ArrowLeft className="size-4" />}>Tilbake</Button></Link>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isClosed ? 'neutral' : c.status === 'received' || c.status === 'triage' ? 'warning' : 'info'}>
          {ALERT_STATUS_LABEL[c.status]}
        </Badge>
        <Badge variant={c.confidentiality_level === 'confidential' ? 'critical' : c.confidentiality_level === 'restricted' ? 'warning' : 'neutral'}>
          {ALERT_CONFIDENTIALITY_LABEL[c.confidentiality_level]}
        </Badge>
        {c.severity ? <Badge variant={c.severity === 'critical' || c.severity === 'high' ? 'high' : 'info'}>{ALERT_SEVERITY_LABEL[c.severity]}</Badge> : null}
        <Badge variant="neutral">{ALERT_KIND_LABEL[c.kind]}</Badge>
        {!isClosed ? <AlertAcknowledgementBadge case_={c} /> : null}
        {!isClosed ? <AlertGdprDeadlineBadge case_={c} /> : null}
        <span className="ml-2 flex items-center gap-1 text-xs text-neutral-500">
          <Lock className="size-3" /> {anonymity === 'full_anonymous' ? 'Anonym' : anonymity === 'pseudonymous' ? 'Pseudonymt' : 'Identifisert'}
        </span>
      </div>

      {isClosed ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <AlertTriangle className="size-3" />
          Saken er lukket {new Date(c.closed_at!).toLocaleDateString('no-NO')}. Identitetsfelt og lukkenotater er låst.
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-neutral-200">
        {(['info', 'timeline', 'notes', 'attachments', 'close'] as Tab[]).map((t) => (
          <Button
            key={t}
            variant="ghost"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`rounded-none border-b-2 px-3 py-2 text-sm font-medium hover:bg-transparent ${tab === t ? 'border-[#b91c1c] text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
          >
            {t === 'info' ? 'Informasjon' : t === 'timeline' ? `Tidslinje (${alerts.detail.timeline.length})` : t === 'notes' ? `Notater (${alerts.detail.notes.length})` : t === 'attachments' ? `Vedlegg (${alerts.detail.attachments.length})` : 'Lukk'}
          </Button>
        ))}
      </div>

      {tab === 'info' ? (
        <section className="space-y-4">
          <ModuleSectionCard className="p-6">
            <h3 className="text-sm font-semibold">Beskrivelse</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{c.description || '—'}</p>
            {c.occurred_at_text ? <p className="mt-3 text-xs text-neutral-500">Tidspunkt (fritekst): {c.occurred_at_text}</p> : null}
          </ModuleSectionCard>

          {!isClosed && alerts.canManage ? (
            <ModuleSectionCard className="p-6">
              <h3 className="text-sm font-semibold">Saksbehandling</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-600">Status</label>
                  <SearchableSelect
                    value={c.status}
                    onChange={(v) => void doStatus(v as AlertStatus)}
                    options={STATUS_OPTIONS.map((s) => ({ value: s, label: ALERT_STATUS_LABEL[s] }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-600">Alvorlighet</label>
                  <SearchableSelect
                    value={c.severity ?? ''}
                    onChange={(v) => void doSeverity(v as AlertSeverity)}
                    options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: ALERT_SEVERITY_LABEL[s] }))}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs text-neutral-500">
                Bekreftelse forventes innen: <strong>{new Date(c.acknowledgement_due_at).toLocaleString('no-NO')}</strong>
                {c.investigation_due_at ? <> · Etterforskning-frist: <strong>{new Date(c.investigation_due_at).toLocaleString('no-NO')}</strong></> : null}
              </p>
            </ModuleSectionCard>
          ) : null}

          {c.kind === 'gdpr_breach' ? (
            <ModuleSectionCard className="p-6">
              <h3 className="text-sm font-semibold">GDPR-detaljer</h3>
              <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-neutral-500">Brudd-type</dt><dd>{c.breach_type ?? '—'}</dd></div>
                <div><dt className="text-neutral-500">Berørte (estimat)</dt><dd>{c.affected_subjects_estimate ?? '—'}</dd></div>
                <div><dt className="text-neutral-500">Berørte (faktisk)</dt><dd>{c.affected_subjects_actual ?? '—'}</dd></div>
                <div><dt className="text-neutral-500">Meldt Datatilsynet</dt><dd>{c.datatilsynet_reported_at ? new Date(c.datatilsynet_reported_at).toLocaleString('no-NO') : '—'}</dd></div>
                <div><dt className="text-neutral-500">Berørte varslet</dt><dd>{c.data_subjects_notified_at ? new Date(c.data_subjects_notified_at).toLocaleString('no-NO') : '—'}</dd></div>
                <div><dt className="text-neutral-500">Referanse hos DT</dt><dd>{c.datatilsynet_reference ?? '—'}</dd></div>
              </dl>
            </ModuleSectionCard>
          ) : null}
        </section>
      ) : null}

      {tab === 'timeline' ? (
        <ModuleSectionCard>
          {alerts.detail.timeline.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-neutral-500">Ingen hendelser.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {alerts.detail.timeline.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span>{ALERT_TIMELINE_EVENT_LABEL[ev.event_kind]}</span>
                  <span className="text-xs text-neutral-500">{new Date(ev.created_at).toLocaleString('no-NO')}</span>
                </li>
              ))}
            </ul>
          )}
        </ModuleSectionCard>
      ) : null}

      {tab === 'notes' ? (
        <section className="space-y-3">
          <ModuleSectionCard>
            {alerts.detail.notes.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-neutral-500">Ingen notater.</p>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {alerts.detail.notes.map((n) => (
                  <li key={n.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-neutral-500">{ALERT_NOTE_KIND_LABEL[n.note_kind]}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(n.created_at).toLocaleString('no-NO')}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p>
                    {n.visible_to_reporter ? <p className="mt-1 text-[10px] text-amber-700">Synlig for varsler</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </ModuleSectionCard>

          {alerts.canManage ? (
            <ModuleSectionCard className="p-4">
              <StandardTextarea
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Skriv et notat …"
              />
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <div>
                  <label className="text-[10px] font-bold uppercase text-neutral-600">Synlig for varsler ved statusoppslag</label>
                  <YesNoToggle value={noteVisible} onChange={setNoteVisible} />
                </div>
                <Button onClick={() => void doAddNote()} disabled={busy || !newNote.trim()}>
                  Legg til notat
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-neutral-500">Notater er uforanderlige etter publisering (AML § 2A-7 (5) revisjonsspor).</p>
            </ModuleSectionCard>
          ) : null}
        </section>
      ) : null}

      {tab === 'attachments' ? (
        <AttachmentsTab caseId={c.id} canManage={alerts.canManage && !isClosed} />
      ) : null}

      {tab === 'close' && !isClosed && alerts.canManage ? (
        <ModuleSectionCard className="p-6">
          <h3 className="text-sm font-semibold">Lukk saken</h3>
          <p className="mt-1 text-xs text-neutral-500">Etter lukking er identitet og lukke-felt låst. Korreksjoner skjer som nye notater.</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Utfall</label>
              <SearchableSelect
                value={closingOutcome}
                onChange={(v) => setClosingOutcome(v as AlertClosingOutcome)}
                options={OUTCOME_OPTIONS.map((o) => ({ value: o, label: o }))}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-600">Oppsummering</label>
              <StandardTextarea
                rows={4}
                value={closingSummary}
                onChange={(e) => setClosingSummary(e.target.value)}
              />
            </div>
            <Button variant="danger" onClick={() => void doClose()} disabled={busy || !closingSummary.trim()}>
              Lukk sak
            </Button>
          </div>
        </ModuleSectionCard>
      ) : tab === 'close' && isClosed ? (
        <ModuleSectionCard className="p-6">
          <p className="text-sm">Saken er lukket {new Date(c.closed_at!).toLocaleString('no-NO')}.</p>
          {c.closing_outcome ? <p className="mt-1 text-sm text-neutral-700">Utfall: {c.closing_outcome}</p> : null}
          {c.closing_summary ? <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{c.closing_summary}</p> : null}
          {c.retention_until ? <p className="mt-3 text-xs text-neutral-500">Oppbevaringsfrist: {new Date(c.retention_until).toLocaleDateString('no-NO')}</p> : null}
        </ModuleSectionCard>
      ) : null}
    </ModulePageShell>
  )
}

// ── Attachments sub-component ─────────────────────────────────────────────
// Owns its own busy state so the parent doesn't re-render the whole
// detail view on every file pick.

function AttachmentsTab({ caseId, canManage }: { caseId: string; canManage: boolean }) {
  const alerts = useAlerts()
  const [busy, setBusy] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      window.alert('Filen er større enn 20 MB. Bruk en mindre fil eller komprimer den først.')
      return
    }
    setBusy(true)
    await alerts.uploadAttachment(caseId, file)
    setBusy(false)
  }

  async function openSignedUrl(attachmentId: string, storagePath: string | null) {
    if (!storagePath) return
    setOpeningId(attachmentId)
    const url = await alerts.getAttachmentSignedUrl(storagePath, 60)
    setOpeningId(null)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleDelete(attachmentId: string, filename: string) {
    if (!window.confirm(`Slette vedlegget «${filename}»? Filen fjernes fra lagring og kan ikke gjenopprettes.`)) return
    setBusy(true)
    await alerts.deleteAttachment(attachmentId)
    setBusy(false)
  }

  return (
    <div className="space-y-3">
      <ModuleSectionCard>
        {alerts.detail.attachments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-neutral-500">Ingen vedlegg.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {alerts.detail.attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-900">{a.filename}</p>
                  <p className="text-xs text-neutral-500">
                    {a.is_redacted
                      ? 'Slettet ved oppbevaringsfrist'
                      : a.content_type ?? 'Ukjent type'}
                    {a.size_bytes ? ` · ${Math.round(a.size_bytes / 1024)} kB` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!a.is_redacted && a.storage_path ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Download className="size-3.5" />}
                      onClick={() => void openSignedUrl(a.id, a.storage_path)}
                      disabled={openingId === a.id}
                    >
                      {openingId === a.id ? 'Åpner…' : 'Åpne'}
                    </Button>
                  ) : null}
                  {canManage && !a.is_redacted ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(a.id, a.filename)}
                      className="h-auto w-auto rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-700"
                      title="Slett vedlegg"
                      aria-label="Slett vedlegg"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ModuleSectionCard>

      {canManage ? (
        <ModuleSectionCard className="p-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50/50 px-4 py-8 text-center transition-colors hover:border-[#b91c1c]/40 hover:bg-neutral-50">
            <Upload className="size-5 text-neutral-400" />
            <span className="text-sm font-medium text-neutral-900">
              {busy ? 'Laster opp …' : 'Last opp vedlegg'}
            </span>
            <span className="text-xs text-neutral-500">
              Maks 20 MB. PDF / Office / bilde / video. Privat lagring; nedlasting krever signert URL (60 s).
            </span>
            {/* eslint-disable-next-line no-restricted-syntax -- hidden native file picker; no primitive exists */}
            <input
              type="file"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                e.target.value = ''
                void handleFile(file)
              }}
            />
          </label>
          <p className="mt-2 text-[10px] text-neutral-500">
            Vedlegg lagres i privat bucket (alert-attachments) under {`${'{org_id}/{case_id}/'}`}. RLS gjelder — kun varslingsutvalget kan åpne filen.
          </p>
        </ModuleSectionCard>
      ) : null}
    </div>
  )
}

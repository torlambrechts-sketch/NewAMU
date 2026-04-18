import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  GripVertical,
  History,
  Loader2,
  PenLine,
  Trash2,
  Users,
} from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../../src/components/layout/HubMenu1Bar'
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import { WorkplacePageHeading1, WorkplaceSerifSectionTitle } from '../../src/components/layout/WorkplacePageHeading1'
import {
  WORKPLACE_MODULE_CANVAS_BG,
  WORKPLACE_MODULE_CARD_SHADOW,
  WORKPLACE_MODULE_FIELD,
  WORKPLACE_MODULE_SUBTLE_PANEL,
  WORKPLACE_MODULE_SUBTLE_PANEL_STYLE,
} from '../../src/components/layout/workplaceModuleSurface'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'
import { RiskMatrix, riskColorClass, riskLabel, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'
import type {
  SjaAnalysis,
  SjaControlType,
  SjaDetail,
  SjaHazard,
  SjaHazardCategory,
  SjaJobType,
  SjaMeasure,
  SjaParticipantRole,
  SjaTask,
  SjaTemplate,
} from './types'
import { SJA_PPE_OPTIONS } from './types'
import { useSja } from './useSja'

export const JOB_TYPE_LABEL: Record<SjaJobType, string> = {
  hot_work: 'Varmt arbeid',
  confined_space: 'Arbeid i trange rom',
  work_at_height: 'Arbeid i høyden',
  electrical: 'Elektrisk arbeid',
  lifting: 'Løft / rigging',
  excavation: 'Graving',
  custom: 'Annet',
}

const TRIGGER_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'routine_change', label: 'Endring i rutine / ikke dagligdagse arbeidsoperasjoner' },
  { value: 'non_routine', label: 'Ikke-rutinepreget arbeid' },
  { value: 'coordination', label: 'Behov for koordinering mellom arbeidsgivere' },
  { value: 'serious_injury_history', label: 'Alvorlige skader / nestenulykker tidligere på tilsvarende arbeid' },
  { value: 'other', label: 'Annet (beskriv i notat)' },
]

const STATUS_ORDER: SjaAnalysis['status'][] = [
  'draft',
  'active',
  'approved',
  'in_execution',
  'completed',
  'archived',
]

const STATUS_LABEL: Record<SjaAnalysis['status'], string> = {
  draft: 'Kladd',
  active: 'Aktiv',
  approved: 'Godkjent',
  in_execution: 'Under utførelse',
  completed: 'Fullført',
  archived: 'Arkivert',
  stopped: 'Stoppet',
}

export const CONTROL_TYPE_LABEL: Record<SjaControlType, string> = {
  eliminate: '1. Eliminering',
  substitute: '2. Substitusjon',
  engineering: '3. Tekniske tiltak',
  administrative: '4. Administrative tiltak',
  ppe: '5. Personlig verneutstyr',
}

export const CONTROL_TYPE_COLOR: Record<SjaControlType, string> = {
  eliminate: 'bg-green-100 text-green-800',
  substitute: 'bg-teal-100 text-teal-800',
  engineering: 'bg-blue-100 text-blue-800',
  administrative: 'bg-amber-100 text-amber-800',
  ppe: 'bg-neutral-100 text-neutral-600',
}

const CONTROL_TYPE_LETTER: Record<SjaControlType, string> = {
  eliminate: 'E',
  substitute: 'S',
  engineering: 'T',
  administrative: 'A',
  ppe: 'V',
}

export const HAZARD_CATEGORY_LABEL: Record<SjaHazardCategory, string> = {
  fall: 'Fall fra høyde',
  chemical: 'Kjemikalier / gasser',
  electrical: 'Elektrisk fare',
  mechanical: 'Mekanisk fare',
  fire: 'Brann / eksplosjon',
  ergonomic: 'Ergonomi / belastning',
  dropped_object: 'Fallende gjenstander',
  other: 'Annet',
}

const HAZARD_CATEGORY_COLOR: Record<SjaHazardCategory, string> = {
  fall: 'bg-orange-100 text-orange-900',
  chemical: 'bg-purple-100 text-purple-900',
  electrical: 'bg-yellow-100 text-yellow-900',
  mechanical: 'bg-slate-200 text-slate-800',
  fire: 'bg-red-100 text-red-900',
  ergonomic: 'bg-cyan-100 text-cyan-900',
  dropped_object: 'bg-indigo-100 text-indigo-900',
  other: 'bg-neutral-200 text-neutral-800',
}

type SjaTab =
  | 'grunnlag'
  | 'deltakere'
  | 'oppgaver'
  | 'risikovurdering'
  | 'signaturer'
  | 'etterarbeid'
  | 'historikk'

function residualScore(h: SjaHazard): number | null {
  return riskScoreFromProbCons(h.residual_probability, h.residual_consequence)
}

function highResidualRiskCount(hazards: SjaHazard[]): number {
  return hazards.filter((h) => {
    const s = residualScore(h)
    return s != null && s >= 15
  }).length
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalToIso(local: string): string | null {
  if (!local || local.trim() === '') return null
  const d = new Date(local)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function roleBadgeClass(role: SjaParticipantRole): string {
  switch (role) {
    case 'responsible':
      return 'bg-purple-100 text-purple-800'
    case 'worker':
      return 'bg-blue-100 text-blue-800'
    case 'contractor':
      return 'bg-amber-100 text-amber-800'
    case 'observer':
      return 'bg-neutral-100 text-neutral-600'
    default:
      return 'bg-neutral-100 text-neutral-600'
  }
}

const ROLE_LABEL: Record<SjaParticipantRole, string> = {
  responsible: 'Ansvarlig',
  worker: 'Utførende',
  contractor: 'Entreprenør',
  observer: 'Observatør',
}

const PANEL_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-700'
const PANEL_INPUT = WORKPLACE_MODULE_FIELD

function StatusStepIndicator({ status }: { status: SjaAnalysis['status'] }) {
  const stopped = status === 'stopped'
  let currentIdx: number
  if (stopped) {
    currentIdx = -1
  } else if (status === 'archived') {
    currentIdx = STATUS_ORDER.length - 1
  } else {
    const ix = STATUS_ORDER.indexOf(status)
    currentIdx = ix >= 0 ? ix : 0
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      {STATUS_ORDER.map((st, i) => {
        const completed = !stopped && currentIdx > i
        const isCurrent = !stopped && status === st
        return (
          <div key={st} className="flex items-center gap-1">
            {i > 0 ? <span className="text-neutral-300">→</span> : null}
            <span
              className={`rounded px-2 py-1 font-medium ${
                completed
                  ? 'bg-[#1a3d32] text-white'
                  : isCurrent
                    ? 'border-2 border-[#1a3d32] bg-white text-[#1a3d32]'
                    : 'border border-transparent bg-neutral-100 text-neutral-500'
              }`}
            >
              {STATUS_LABEL[st]}
            </span>
          </div>
        )
      })}
      {stopped ? (
        <>
          <span className="text-neutral-300">→</span>
          <span className="rounded bg-red-600 px-2 py-1 font-medium text-white">{STATUS_LABEL.stopped}</span>
        </>
      ) : null}
    </div>
  )
}

type GrunnlagDraft = {
  title: string
  job_type: SjaJobType
  job_description: string
  trigger_reason: string
  location_id: string | null
  location_text: string
  responsible_id: string | null
  scheduled_start: string
  scheduled_end: string
}

export function SjaPage({ supabase }: { supabase: SupabaseClient | null }) {
  const { sjaId } = useParams<{ sjaId: string }>()
  const navigate = useNavigate()
  const sja = useSja({ supabase })
  const { load, loadDetail, getDetail } = sja

  const [activeTab, setActiveTab] = useState<SjaTab>('grunnlag')
  const [detailStarted, setDetailStarted] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [stopFormOpen, setStopFormOpen] = useState(false)
  const [stopReasonDraft, setStopReasonDraft] = useState('')
  const allSignedPromptedRef = useRef(false)

  const [draft, setDraft] = useState<GrunnlagDraft | null>(null)

  useEffect(() => {
    if (!sjaId) return
    let cancelled = false
    void (async () => {
      await load()
      if (cancelled) return
      await loadDetail(sjaId)
      if (!cancelled) setDetailStarted(true)
    })()
    return () => {
      cancelled = true
    }
  }, [sjaId, load, loadDetail])

  const detail = useMemo(
    () => (sjaId ? getDetail(sjaId) : null),
    [sjaId, getDetail, sja.participants, sja.tasks, sja.hazards, sja.measures, sja.analyses],
  )

  const analysis = detail?.analysis ?? null
  const template = analysis?.template_id ? sja.templates.find((t) => t.id === analysis.template_id) ?? null : null

  useEffect(() => {
    if (!analysis) return
    setDraft({
      title: analysis.title,
      job_type: analysis.job_type,
      job_description: analysis.job_description,
      trigger_reason: analysis.trigger_reason,
      location_id: analysis.location_id,
      location_text: analysis.location_text ?? '',
      responsible_id: analysis.responsible_id,
      scheduled_start: toDatetimeLocalValue(analysis.scheduled_start),
      scheduled_end: toDatetimeLocalValue(analysis.scheduled_end),
    })
  }, [analysis?.id, analysis?.updated_at])

  const highRisk = detail ? highResidualRiskCount(detail.hazards) : 0
  const signedCount = detail?.participants.filter((p) => p.signed_at != null && String(p.signed_at).trim() !== '').length ?? 0
  const participantTotal = detail?.participants.length ?? 0

  const hubMenuItems: HubMenu1Item[] = useMemo(() => {
    if (!detail) return []
    const pCount = detail.participants.length
    return [
      {
        key: 'grunnlag',
        label: 'Grunnlag',
        icon: FileText,
        active: activeTab === 'grunnlag',
        onClick: () => setActiveTab('grunnlag'),
      },
      {
        key: 'deltakere',
        label: pCount > 0 ? `Deltakere (${pCount})` : 'Deltakere',
        icon: Users,
        active: activeTab === 'deltakere',
        badgeCount: pCount > 0 ? pCount : undefined,
        onClick: () => setActiveTab('deltakere'),
      },
      {
        key: 'oppgaver',
        label: 'Oppgaver',
        icon: ClipboardList,
        active: activeTab === 'oppgaver',
        onClick: () => setActiveTab('oppgaver'),
      },
      {
        key: 'risikovurdering',
        label: 'Risikovurdering',
        icon: AlertTriangle,
        active: activeTab === 'risikovurdering',
        badgeCount: highRisk > 0 ? highRisk : undefined,
        badgeVariant: highRisk > 0 ? 'danger' : undefined,
        onClick: () => setActiveTab('risikovurdering'),
      },
      {
        key: 'signaturer',
        label: `Signaturer (${signedCount}/${participantTotal})`,
        icon: PenLine,
        active: activeTab === 'signaturer',
        disabled: highRisk > 0,
        onClick: () => {
          if (highRisk > 0) return
          setActiveTab('signaturer')
        },
      },
      {
        key: 'etterarbeid',
        label: 'Etterarbeid',
        icon: CheckCircle2,
        active: activeTab === 'etterarbeid',
        onClick: () => setActiveTab('etterarbeid'),
      },
      {
        key: 'historikk',
        label: 'Historikk',
        icon: History,
        active: activeTab === 'historikk',
        onClick: () => setActiveTab('historikk'),
      },
    ]
  }, [detail, activeTab, highRisk, signedCount, participantTotal])

  const locationName =
    analysis?.location_id != null ? sja.locations.find((l) => l.id === analysis.location_id)?.name ?? null : null
  const responsibleName = analysis?.responsible_id
    ? sja.assignableUsers.find((u) => u.id === analysis.responsible_id)?.displayName ?? null
    : null

  const canRequestApproval = useMemo(() => {
    if (!detail) return false
    if (detail.participants.length < 2) return false
    if (highResidualRiskCount(detail.hazards) > 0) return false
    const tasks = detail.tasks
    if (tasks.length === 0) return false
    for (const t of tasks) {
      const th = detail.hazards.filter((h) => h.task_id === t.id)
      if (th.length === 0) return false
      const ok = th.some(
        (h) =>
          h.residual_probability != null &&
          h.residual_consequence != null &&
          h.residual_probability >= 1 &&
          h.residual_consequence >= 1,
      )
      if (!ok) return false
    }
    return true
  }, [detail])

  const hasResponsibleParticipant = useMemo(() => {
    if (!detail) return false
    return (
      detail.participants.some((p) => p.role === 'responsible') ||
      (analysis?.responsible_id != null && detail.participants.some((p) => p.user_id === analysis.responsible_id))
    )
  }, [detail, analysis?.responsible_id])

  const allParticipantsSigned = useMemo(() => {
    if (!detail || detail.participants.length === 0) return false
    return detail.participants.every((p) => p.signed_at != null && String(p.signed_at).trim() !== '')
  }, [detail])

  useEffect(() => {
    if (!analysis || !detail || highRisk > 0) return
    if (analysis.status !== 'approved' || !allParticipantsSigned || allSignedPromptedRef.current) return
    allSignedPromptedRef.current = true
    const ok = window.confirm(
      'Alle deltakere har signert. Vil du starte arbeidet nå? Status settes til «Under utførelse» og faktisk start registreres.',
    )
    if (ok) {
      void sja.advanceStatus(analysis.id, 'in_execution')
    }
  }, [analysis, detail, highRisk, allParticipantsSigned, sja])

  useEffect(() => {
    allSignedPromptedRef.current = false
  }, [analysis?.id, analysis?.status, participantTotal])

  const handleSaveGrunnlag = useCallback(async () => {
    if (!sjaId || !draft || !analysis) return
    await sja.saveAnalysisPatch(sjaId, {
      title: draft.title.trim(),
      job_type: draft.job_type,
      job_description: draft.job_description.trim(),
      trigger_reason: draft.trigger_reason.trim(),
      location_id: draft.location_id,
      location_text: draft.location_text.trim() || null,
      responsible_id: draft.responsible_id,
      scheduled_start: fromDatetimeLocalToIso(draft.scheduled_start),
      scheduled_end: fromDatetimeLocalToIso(draft.scheduled_end),
    })
    setSavedAt(new Date().toLocaleString('nb-NO'))
  }, [sjaId, draft, analysis, sja])

  const showSpinner = !analysis && (!detailStarted || sja.loading)
  const showNotFound = detailStarted && !sja.loading && sjaId && !analysis

  if (!sjaId) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-neutral-600"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        Mangler SJA-ID.
      </div>
    )
  }

  if (showSpinner) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster SJA…</p>
      </div>
    )
  }

  if (showNotFound) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-4"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <p className="text-lg font-semibold text-neutral-900">SJA ikke funnet</p>
        <button
          type="button"
          onClick={() => navigate('/sja')}
          className="rounded border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
        >
          ← Tilbake
        </button>
      </div>
    )
  }

  if (!analysis || !detail || !draft) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3"
        style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#1a3d32]" aria-hidden />
        <p className="text-sm text-neutral-600">Laster SJA…</p>
      </div>
    )
  }

  const readOnly = analysis.status === 'archived'
  const jobTypeLocked = analysis.status !== 'draft'

  return (
    <div className="min-h-full pb-10" style={{ backgroundColor: WORKPLACE_MODULE_CANVAS_BG }}>
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#F9F7F2]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
          <WorkplacePageHeading1
            breadcrumb={[
              { label: 'HMS' },
              { label: 'Sikker jobbanalyse', to: '/sja' },
              { label: 'Detaljer' },
            ]}
            title={draft.title || 'Uten tittel'}
            description={
              <p className="max-w-3xl text-sm text-neutral-600">
                <button
                  type="button"
                  onClick={() => navigate('/sja')}
                  className="mr-2 font-medium text-[#1a3d32] underline decoration-neutral-300 underline-offset-2 hover:text-neutral-900"
                >
                  ← Tilbake til oversikt
                </button>
                <span className="text-neutral-400">·</span>{' '}
                {JOB_TYPE_LABEL[draft.job_type]} · {locationName ?? (draft.location_text.trim() || '—')} ·{' '}
                {responsibleName ?? 'Ingen ansvarlig'} · Planlagt start:{' '}
                {analysis.scheduled_start
                  ? new Date(analysis.scheduled_start).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
                  : '—'}
              </p>
            }
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-800 shadow-sm">
                  {STATUS_LABEL[analysis.status]}
                </span>
                {analysis.status === 'stopped' ? (
                  <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">STOPPET</span>
                ) : null}
              </div>
            }
            menu={<HubMenu1Bar ariaLabel="SJA-faner" items={hubMenuItems} />}
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        <div
          className="space-y-6 overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm md:p-6"
          style={WORKPLACE_MODULE_CARD_SHADOW}
        >
        {sja.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sja.error}</div>
        ) : null}

        {highRisk > 0 ? (
          <div className="w-full rounded-xl border border-red-800 bg-red-600 px-4 py-4 text-white shadow-sm">
            <p className="text-sm font-bold">⛔ STOPPET — {highRisk} farekilder har gjenværende risiko i rød sone.</p>
            <p className="mt-2 text-sm font-medium">
              Arbeidet kan IKKE igangsettes. Revider tiltak.
            </p>
          </div>
        ) : null}

        {activeTab === 'grunnlag' && (
          <GrunnlagTab
            analysis={analysis}
            draft={draft}
            setDraft={setDraft}
            readOnly={readOnly}
            jobTypeLocked={jobTypeLocked}
            locations={sja.locations}
            assignableUsers={sja.assignableUsers}
            savedAt={savedAt}
            onSave={handleSaveGrunnlag}
            canRequestApproval={canRequestApproval}
            onAdvance={(next, payload) => void sja.advanceStatus(analysis.id, next, payload)}
            onGoEtterarbeid={() => setActiveTab('etterarbeid')}
            stopFormOpen={stopFormOpen}
            setStopFormOpen={setStopFormOpen}
            stopReasonDraft={stopReasonDraft}
            setStopReasonDraft={setStopReasonDraft}
          />
        )}

        {activeTab === 'deltakere' && (
          <DeltakereTab detail={detail} template={template} sja={sja} readOnly={readOnly} analysis={analysis} />
        )}

        {activeTab === 'oppgaver' && <OppgaverTab detail={detail} sja={sja} readOnly={readOnly} />}

        {activeTab === 'risikovurdering' && (
          <RisikovurderingTab
            detail={detail}
            template={template}
            sja={sja}
            readOnly={readOnly}
            assignableUsers={sja.assignableUsers}
          />
        )}

        {activeTab === 'signaturer' && highRisk === 0 && (
          <SignaturerTab
            detail={detail}
            sja={sja}
            analysis={analysis}
            canRequestApproval={canRequestApproval}
            hasResponsibleParticipant={hasResponsibleParticipant}
            onApproved={() => void sja.advanceStatus(analysis.id, 'approved')}
          />
        )}
        {activeTab === 'signaturer' && highRisk > 0 && (
          <PlaceholderTab
            title="Signaturer"
            body="Fanen er blokkert: restrisiko i rød sone (P×C ≥ 15). Revider tiltak i Risikovurdering først."
          />
        )}
        {activeTab === 'etterarbeid' && <EtterarbeidTab sja={sja} analysis={analysis} />}
        {activeTab === 'historikk' && supabase && (
          <LayoutTable1PostingsShell
            wrap={false}
            titleTypography="sans"
            title="Historikk"
            description="Endringer loggført for denne SJA-en."
            toolbar={<span className="text-sm text-neutral-600">Revisjonsspor</span>}
          >
            <HseAuditLogViewer supabase={supabase} recordId={analysis.id} tableName="sja_analyses" />
          </LayoutTable1PostingsShell>
        )}
        </div>
      </div>
    </div>
  )
}

function SignaturerTab({
  detail,
  sja,
  analysis,
  canRequestApproval,
  hasResponsibleParticipant,
  onApproved,
}: {
  detail: SjaDetail
  sja: ReturnType<typeof useSja>
  analysis: SjaAnalysis
  hasResponsibleParticipant: boolean
  canRequestApproval: boolean
  onApproved: () => void
}) {
  const [signingId, setSigningId] = useState<string | null>(null)
  const currentUserId = sja.currentUserId

  const removedMandatory = useMemo(
    () =>
      detail.measures.filter(
        (m) => m.is_mandatory && m.deleted_at != null && String(m.deleted_at).trim() !== '',
      ),
    [detail.measures],
  )

  const tasksOk = useMemo(() => {
    if (detail.tasks.length === 0) return false
    for (const t of detail.tasks) {
      if (detail.hazards.filter((h) => h.task_id === t.id).length === 0) return false
    }
    return true
  }, [detail.tasks, detail.hazards])

  const noRedResidual = highResidualRiskCount(detail.hazards) === 0
  const minParticipants = detail.participants.length >= 2
  const statusApproved = analysis.status === 'approved'
  const statusActive = analysis.status === 'active'
  const showApproveButton = canRequestApproval && statusActive

  const userNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const u of sja.assignableUsers) m.set(u.id, u.displayName)
    return m
  }, [sja.assignableUsers])

  const signerName = (p: (typeof detail.participants)[0]) => {
    if (p.user_id && userNameById.has(p.user_id)) return userNameById.get(p.user_id)!
    return p.name
  }

  return (
    <div className="space-y-6">
      {removedMandatory.length > 0 ? (
        <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">
            ⚠ {removedMandatory.length} obligatorisk tiltak fjernet
          </p>
          <ul className="mt-2 space-y-1">
            {removedMandatory.map((m) => (
              <li key={m.id} className="text-xs text-amber-700">
                <strong>{m.description}</strong>
                {m.deletion_justification ? ` — «${m.deletion_justification}»` : null}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            Ved å signere bekrefter du at du har lest og akseptert disse avvikene.
          </p>
        </div>
      ) : null}

      <div className={WORKPLACE_MODULE_SUBTLE_PANEL} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
        <p className="text-xs font-semibold text-neutral-700">AML § 4-2 — felles forståelse</p>
        <p className="mt-1 text-xs text-neutral-600">
          Alle deltakere skal ha lest og forstått SJA-en og bekreftet at de er kjent med risikoene og tiltakene (AML § 4-2).
        </p>
      </div>

      <div className={`space-y-1.5 ${WORKPLACE_MODULE_SUBTLE_PANEL}`} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
        <p className={PANEL_LABEL}>Sjekkliste før signering</p>
        {[
          { ok: tasksOk, label: 'Alle deloppgaver har definerte farekilder' },
          { ok: noRedResidual, label: 'Ingen farekilder i rød restrisiko-sone' },
          { ok: minParticipants, label: 'Minimum 2 deltakere (inkl. ansvarlig)' },
          { ok: hasResponsibleParticipant, label: 'SJA-ansvarlig er utpekt' },
          { ok: statusApproved, label: 'Status er «Godkjent»' },
        ].map(({ ok, label }) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-neutral-300" />}
            <span className={ok ? 'text-neutral-700' : 'text-neutral-400'}>{label}</span>
          </div>
        ))}
      </div>

      {showApproveButton ? (
        <button
          type="button"
          onClick={() => onApproved()}
          className="rounded border border-[#1a3d32] bg-[#1a3d32] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Godkjenn SJA
        </button>
      ) : null}

      <div className="space-y-3">
        {detail.participants.map((p) => (
          <div key={p.id} className={`${WORKPLACE_MODULE_SUBTLE_PANEL}`} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-neutral-900">{p.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(p.role)}`}>
                    {ROLE_LABEL[p.role]}
                  </span>
                  {p.company ? <span className="text-xs text-neutral-500">{p.company}</span> : null}
                </div>
                <div className="mt-2">
                  {p.certs_verified ? (
                    <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                      <Check className="h-3.5 w-3.5" /> Sertifikater verifisert
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                      <AlertTriangle className="h-3.5 w-3.5" /> Sertifikater ikke verifisert
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                {p.signed_at ? (
                  <div className="inline-flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>
                      Signert {new Date(p.signed_at).toLocaleDateString('nb-NO', { dateStyle: 'medium' })} av{' '}
                      {signerName(p)}
                    </span>
                  </div>
                ) : p.user_id && currentUserId && p.user_id === currentUserId ? (
                  <button
                    type="button"
                    disabled={signingId !== null}
                    onClick={async () => {
                      setSigningId(p.id)
                      await sja.signParticipant(p.id)
                      setSigningId(null)
                    }}
                    className="rounded border border-[#1a3d32] bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {signingId === p.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signerer…
                      </span>
                    ) : (
                      'Signer'
                    )}
                  </button>
                ) : (
                  <p className="text-xs text-neutral-400">Venter på signatur</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DebriefAvvikBanner({ sjaId, sja }: { sjaId: string; sja: ReturnType<typeof useSja> }) {
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (createdId) {
    return (
      <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        Avvik opprettet —{' '}
        <Link to="/avvik" className="font-semibold underline">
          åpne avvik-modulen
        </Link>
      </div>
    )
  }
  return (
    <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="font-semibold">Uventede hendelser ble rapportert. Opprett avvik for videre oppfølging.</p>
      <button
        type="button"
        disabled={busy}
        className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        onClick={async () => {
          setBusy(true)
          const id = await sja.createAvvikFromDebrief(sjaId)
          if (id) setCreatedId(id)
          setBusy(false)
        }}
      >
        {busy ? 'Oppretter…' : 'Opprett avvik'}
      </button>
    </div>
  )
}

function EtterarbeidTab({
  sja,
  analysis,
}: {
  sja: ReturnType<typeof useSja>
  analysis: SjaAnalysis
}) {
  const [unexpected, setUnexpected] = useState<boolean | null>(analysis.unexpected_hazards)
  const [notes, setNotes] = useState(analysis.debrief_notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [avvikBanner, setAvvikBanner] = useState(false)
  const debriefDone = analysis.debrief_completed_at != null && String(analysis.debrief_completed_at).trim() !== ''

  useEffect(() => {
    setUnexpected(analysis.unexpected_hazards)
    setNotes(analysis.debrief_notes ?? '')
  }, [analysis.id, analysis.updated_at, analysis.unexpected_hazards, analysis.debrief_notes])

  const interactive = analysis.status === 'completed'

  if (!interactive && !debriefDone) {
    return (
      <div className="space-y-4">
        <div className="rounded border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Etterarbeid (debrief) låses opp når SJA er merket som <strong>fullført</strong>. Gå til Grunnlag og fullfør
          utførelsen først.
        </div>
        <p className="text-xs text-neutral-500">Forhåndsvisning — feltene er skrivebeskyttet.</p>
        <DebriefFormFields unexpected={unexpected} setUnexpected={setUnexpected} notes={notes} setNotes={setNotes} disabled />
      </div>
    )
  }

  if (debriefDone) {
    return (
      <div className="space-y-4">
        <div className={WORKPLACE_MODULE_SUBTLE_PANEL} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
          <p className="text-xs font-semibold text-neutral-700">IK-forskriften § 5</p>
          <p className="mt-1 text-xs text-neutral-600">
            Erfaringsoverføring er obligatorisk etter gjennomføring (IK-forskriften § 5). Uventede hendelser skal
            registreres som avvik.
          </p>
        </div>
        <p className="text-sm text-neutral-800">
          <span className="font-semibold">Uventede farekilder:</span>{' '}
          {analysis.unexpected_hazards === true ? 'Ja' : analysis.unexpected_hazards === false ? 'Nei' : '—'}
        </p>
        <div>
          <p className={PANEL_LABEL}>Notater</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{analysis.debrief_notes ?? '—'}</p>
        </div>
        <p className="text-xs text-neutral-500">
          Arkivert / fullført etterarbeid{' '}
          {analysis.debrief_completed_at
            ? new Date(analysis.debrief_completed_at).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
            : ''}
        </p>
        {analysis.unexpected_hazards === true && !analysis.avvik_created ? (
          <DebriefAvvikBanner sjaId={analysis.id} sja={sja} />
        ) : null}
        {analysis.avvik_created ? (
          <p className="text-sm font-medium text-green-800">
            Avvik ble knyttet til denne debriefen.{' '}
            <Link to="/avvik" className="underline">
              Gå til avvik
            </Link>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className={WORKPLACE_MODULE_SUBTLE_PANEL} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
        <p className="text-xs font-semibold text-neutral-700">IK-forskriften § 5</p>
        <p className="mt-1 text-xs text-neutral-600">
          Erfaringsoverføring er obligatorisk etter gjennomføring (IK-forskriften § 5). Uventede hendelser skal
          registreres som avvik.
        </p>
      </div>

      <DebriefFormFields unexpected={unexpected} setUnexpected={setUnexpected} notes={notes} setNotes={setNotes} disabled={false} />

      {unexpected === true && avvikBanner && !analysis.avvik_created ? <DebriefAvvikBanner sjaId={analysis.id} sja={sja} /> : null}

      <button
        type="button"
        disabled={submitting || unexpected === null}
        onClick={async () => {
          if (unexpected === null) return
          setSubmitting(true)
          await sja.completeDebrief({
            sjaId: analysis.id,
            unexpectedHazards: unexpected,
            debriefNotes: notes,
          })
          setSubmitting(false)
          if (unexpected) setAvvikBanner(true)
          await sja.loadDetail(analysis.id)
        }}
        className="rounded border border-[#1a3d32] bg-[#1a3d32] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {submitting ? 'Lagrer…' : 'Fullfør etterarbeid og arkiver'}
      </button>
    </div>
  )
}

function DebriefFormFields({
  unexpected,
  setUnexpected,
  notes,
  setNotes,
  disabled,
}: {
  unexpected: boolean | null
  setUnexpected: (v: boolean | null) => void
  notes: string
  setNotes: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className={`${PANEL_LABEL} mb-3`}>Ble det oppdaget uventede farekilder?</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {[
            { v: false as const, label: 'Nei' },
            { v: true as const, label: 'Ja' },
          ].map(({ v, label }) => (
            <label
              key={String(v)}
              className={`flex min-h-[3rem] flex-1 cursor-pointer items-center justify-center rounded-lg border-2 px-4 py-3 text-base font-semibold transition ${
                unexpected === v ? 'border-[#1a3d32] bg-[#1a3d32]/10 text-[#1a3d32]' : 'border-neutral-200 bg-neutral-50 text-neutral-600'
              } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                type="radio"
                className="sr-only"
                checked={unexpected === v}
                disabled={disabled}
                onChange={() => setUnexpected(v)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className={PANEL_LABEL}>Beskriv erfaringer og avvik</label>
        <textarea
          className={`${PANEL_INPUT} min-h-[8rem]`}
          rows={6}
          disabled={disabled}
          placeholder="Hva fungerte? Hva gikk galt? Hva bør forbedres?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </div>
  )
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <WorkplaceSerifSectionTitle variant="compact">{title}</WorkplaceSerifSectionTitle>
      <p className="text-sm text-neutral-600">{body}</p>
    </div>
  )
}

function GrunnlagTab({
  analysis,
  draft,
  setDraft,
  readOnly,
  jobTypeLocked,
  locations,
  assignableUsers,
  savedAt,
  onSave,
  canRequestApproval,
  onAdvance,
  onGoEtterarbeid,
  stopFormOpen,
  setStopFormOpen,
  stopReasonDraft,
  setStopReasonDraft,
}: {
  analysis: SjaAnalysis
  draft: GrunnlagDraft
  setDraft: Dispatch<SetStateAction<GrunnlagDraft | null>>
  readOnly: boolean
  jobTypeLocked: boolean
  locations: { id: string; name: string }[]
  assignableUsers: { id: string; displayName: string }[]
  savedAt: string | null
  onSave: () => void
  canRequestApproval: boolean
  onAdvance: (next: SjaAnalysis['status'], payload?: { stop_reason?: string }) => void
  onGoEtterarbeid: () => void
  stopFormOpen: boolean
  setStopFormOpen: (v: boolean) => void
  stopReasonDraft: string
  setStopReasonDraft: (v: string) => void
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className={PANEL_LABEL}>Tittel</label>
          <input
            className={PANEL_INPUT}
            disabled={readOnly}
            value={draft.title}
            onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
          />
        </div>
        <div>
          <label className={PANEL_LABEL}>Jobb-type</label>
          <select
            className={PANEL_INPUT}
            disabled={readOnly || jobTypeLocked}
            value={draft.job_type}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, job_type: e.target.value as SjaJobType } : d))
            }
          >
            {(Object.keys(JOB_TYPE_LABEL) as SjaJobType[]).map((k) => (
              <option key={k} value={k}>
                {JOB_TYPE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={PANEL_LABEL}>Beskrivelse av jobben</label>
          <textarea
            className={`${PANEL_INPUT} min-h-[6rem]`}
            rows={4}
            disabled={readOnly}
            value={draft.job_description}
            onChange={(e) => setDraft((d) => (d ? { ...d, job_description: e.target.value } : d))}
          />
        </div>
        <div className="md:col-span-2">
          <label className={PANEL_LABEL}>Årsak til SJA</label>
          <select
            className={PANEL_INPUT}
            disabled={readOnly}
            value={
              TRIGGER_REASON_OPTIONS.some((o) => o.value === draft.trigger_reason)
                ? draft.trigger_reason
                : 'other'
            }
            onChange={(e) => setDraft((d) => (d ? { ...d, trigger_reason: e.target.value } : d))}
          >
            {TRIGGER_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={PANEL_LABEL}>Arbeidssted</label>
          {draft.location_id ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-neutral-800">
                {locations.find((l) => l.id === draft.location_id)?.name ?? 'Lokasjon'}
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-[#1a3d32] underline"
                  onClick={() => setDraft((d) => (d ? { ...d, location_id: null } : d))}
                >
                  Endre (tekst)
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                className={PANEL_INPUT}
                disabled={readOnly}
                placeholder="Adresse / sted (fritekst)"
                value={draft.location_text}
                onChange={(e) => setDraft((d) => (d ? { ...d, location_text: e.target.value } : d))}
              />
              {!readOnly ? (
                <select
                  className={PANEL_INPUT}
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) return
                    setDraft((d) => (d ? { ...d, location_id: id, location_text: '' } : d))
                  }}
                >
                  <option value="">Velg lokasjon fra register…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={PANEL_LABEL}>Ansvarlig</label>
          <select
            className={PANEL_INPUT}
            disabled={readOnly}
            value={draft.responsible_id ?? ''}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, responsible_id: e.target.value || null } : d))
            }
          >
            <option value="">—</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={PANEL_LABEL}>Planlagt start</label>
          <input
            type="datetime-local"
            className={PANEL_INPUT}
            disabled={readOnly}
            value={draft.scheduled_start}
            onChange={(e) => setDraft((d) => (d ? { ...d, scheduled_start: e.target.value } : d))}
          />
        </div>
        <div>
          <label className={PANEL_LABEL}>Planlagt slutt</label>
          <input
            type="datetime-local"
            className={PANEL_INPUT}
            disabled={readOnly}
            value={draft.scheduled_end}
            onChange={(e) => setDraft((d) => (d ? { ...d, scheduled_end: e.target.value } : d))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onSave()}
          className="rounded border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40"
        >
          Lagre
        </button>
        {savedAt ? <span className="text-xs text-neutral-500">Lagret {savedAt}</span> : null}
      </div>

      <div className="border-t border-neutral-200 pt-8">
        <p className={PANEL_LABEL}>Status</p>
        <div className="mt-3">
          <StatusStepIndicator status={analysis.status} />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <WorkflowActions
            analysis={analysis}
            canRequestApproval={canRequestApproval}
            onAdvance={onAdvance}
            onGoEtterarbeid={onGoEtterarbeid}
            stopFormOpen={stopFormOpen}
            setStopFormOpen={setStopFormOpen}
            stopReasonDraft={stopReasonDraft}
            setStopReasonDraft={setStopReasonDraft}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  )
}

function WorkflowActions({
  analysis,
  canRequestApproval,
  onAdvance,
  onGoEtterarbeid,
  stopFormOpen,
  setStopFormOpen,
  stopReasonDraft,
  setStopReasonDraft,
  readOnly,
}: {
  analysis: SjaAnalysis
  canRequestApproval: boolean
  onAdvance: (next: SjaAnalysis['status'], payload?: { stop_reason?: string }) => void
  onGoEtterarbeid: () => void
  stopFormOpen: boolean
  setStopFormOpen: (v: boolean) => void
  stopReasonDraft: string
  setStopReasonDraft: (v: string) => void
  readOnly: boolean
}) {
  if (readOnly) {
    return <p className="text-sm text-neutral-500">Arkivert — ingen statusendringer.</p>
  }

  if (analysis.status === 'draft') {
    return (
      <button
        type="button"
        onClick={() => onAdvance('active')}
        className="w-fit rounded border border-[#1a3d32] bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white"
      >
        Aktiver SJA
      </button>
    )
  }

  if (analysis.status === 'active') {
    if (!canRequestApproval) {
      return (
        <div className="space-y-2">
          <button
            type="button"
            disabled
            className="w-full max-w-xl cursor-not-allowed rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-left text-sm font-medium text-neutral-500"
          >
            Venter på deltakere og risikovurdering
          </button>
          <p className="text-xs text-neutral-500">
            Krever minst to deltakere, minst én farekilde per oppgave med utfylt restrisiko, og ingen rød restrisiko (P×C ≥ 15).
          </p>
        </div>
      )
    }
    return (
      <div className="max-w-xl rounded border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
        <p className="font-medium">Forutsetningene for godkjenning er oppfylt.</p>
        <p className="mt-1 text-xs text-emerald-900/90">
          Gå til fanen <span className="font-semibold">Signaturer</span> for å gjennomføre sjekklisten og trykke «Godkjenn SJA».
        </p>
      </div>
    )
  }

  if (analysis.status === 'approved') {
    return (
      <button
        type="button"
        onClick={() => onAdvance('in_execution')}
        className="w-fit rounded border border-[#1a3d32] bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white"
      >
        Start arbeidet
      </button>
    )
  }

  if (analysis.status === 'in_execution') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onAdvance('completed')}
          className="w-fit rounded border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
        >
          Merk som fullført
        </button>
        {!stopFormOpen ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStopFormOpen(true)}
              className="rounded border border-red-700 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              STOPP ARBEIDET
            </button>
          </div>
        ) : (
          <div className="max-w-lg space-y-2 rounded border border-red-200 bg-red-50 p-4">
            <label className="text-xs font-semibold text-red-900">Årsak til stopp</label>
            <textarea
              className="w-full border border-red-300 bg-white px-2 py-2 text-sm"
              rows={2}
              value={stopReasonDraft}
              onChange={(e) => setStopReasonDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void onAdvance('stopped', { stop_reason: stopReasonDraft })
                  setStopFormOpen(false)
                  setStopReasonDraft('')
                }}
                className="rounded bg-red-700 px-3 py-1.5 text-xs font-bold text-white"
              >
                Bekreft stopp
              </button>
              <button type="button" onClick={() => setStopFormOpen(false)} className="text-xs text-neutral-600 underline">
                Avbryt
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (analysis.status === 'completed') {
    return (
      <button type="button" onClick={onGoEtterarbeid} className="text-sm font-semibold text-[#1a3d32] underline">
        Gå til Etterarbeid-fanen for debrief
      </button>
    )
  }

  if (analysis.status === 'stopped') {
    return (
      <button
        type="button"
        onClick={() => onAdvance('active')}
        className="w-fit rounded border border-neutral-900 bg-white px-4 py-2 text-sm font-semibold text-neutral-900"
      >
        Oppdater og gjenstart
      </button>
    )
  }

  if (analysis.status === 'archived') {
    return null
  }

  return null
}

function DeltakereTab({
  detail,
  template,
  sja,
  readOnly,
  analysis,
}: {
  detail: SjaDetail
  template: SjaTemplate | null
  sja: ReturnType<typeof useSja>
  readOnly: boolean
  analysis: SjaAnalysis
}) {
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState<SjaParticipantRole>('worker')
  const [userId, setUserId] = useState<string | null>(null)
  const [company, setCompany] = useState('')
  const [certsNotes, setCertsNotes] = useState('')
  const [certsVerified, setCertsVerified] = useState(false)
  const [certChecks, setCertChecks] = useState<Record<string, boolean>>({})

  const requiredCerts = template?.required_certs ?? []
  const canDelete = analysis.status === 'draft' || analysis.status === 'active'

  const unverifiedWithTemplateCerts =
    requiredCerts.length > 0
      ? detail.participants.filter((p) => !p.certs_verified).length
      : 0

  const onSubmit = async () => {
    if (!name.trim()) return
    await sja.addParticipant({
      sjaId: detail.analysis.id,
      name: name.trim(),
      role,
      userId,
      company: role === 'contractor' ? company.trim() || null : null,
      certsVerified,
      certsNotes: certsNotes.trim() || null,
    })
    setName('')
    setUserId(null)
    setCompany('')
    setCertsNotes('')
    setCertsVerified(false)
    setCertChecks({})
    setExpanded(false)
  }

  return (
    <div className="space-y-6">
      <div className="rounded border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        Arbeidstakerne og deres representanter skal involveres og delta aktivt i kartleggingen og risikovurderingen (AML §
        4-2 og § 7-2).
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200/80">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase text-neutral-600">
            <tr>
              <th className="px-4 py-3">Navn</th>
              <th className="px-4 py-3">Rolle</th>
              <th className="px-4 py-3">Selskap</th>
              <th className="px-4 py-3">Sertifikater</th>
              <th className="px-4 py-3">Signert</th>
              <th className="w-10 px-2" />
            </tr>
          </thead>
          <tbody>
            {detail.participants.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.user_id ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-700">
                        {(p.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    ) : null}
                    <span className="font-medium text-neutral-900">{p.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(p.role)}`}>
                    {ROLE_LABEL[p.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-600">{p.company ?? '—'}</td>
                <td className="px-4 py-3">
                  <span
                    title={p.certs_notes ?? ''}
                    className="inline-flex items-center gap-1"
                  >
                    {p.certs_verified ? (
                      <Check className="h-4 w-4 text-green-600" aria-label="Verifisert" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Ikke verifisert" />
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.signed_at ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs">{new Date(p.signed_at).toLocaleDateString('nb-NO')}</span>
                    </span>
                  ) : (
                    <Circle className="h-4 w-4 text-neutral-300" />
                  )}
                </td>
                <td className="px-2 py-3">
                  {canDelete && !readOnly ? (
                    <button
                      type="button"
                      aria-label="Slett"
                      onClick={() => void sja.deleteParticipant(p.id)}
                      className="text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-sm font-semibold text-[#1a3d32] underline"
          >
            {expanded ? 'Skjul' : '+ Legg til deltaker'}
          </button>
          {expanded ? (
            <div className="mt-4 space-y-3 rounded border border-neutral-200 bg-neutral-50/80 p-4">
              <div>
                <label className={PANEL_LABEL}>Navn</label>
                <input className={PANEL_INPUT} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className={PANEL_LABEL}>Rolle</label>
                <select
                  className={PANEL_INPUT}
                  value={role}
                  onChange={(e) => setRole(e.target.value as SjaParticipantRole)}
                >
                  {(Object.keys(ROLE_LABEL) as SjaParticipantRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={PANEL_LABEL}>Bruker (valgfritt)</label>
                <select
                  className={PANEL_INPUT}
                  value={userId ?? ''}
                  onChange={(e) => {
                    const v = e.target.value || null
                    setUserId(v)
                    const u = sja.assignableUsers.find((x) => x.id === v)
                    if (u) setName(u.displayName)
                  }}
                >
                  <option value="">—</option>
                  {sja.assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </div>
              {role === 'contractor' ? (
                <div>
                  <label className={PANEL_LABEL}>Selskap</label>
                  <input className={PANEL_INPUT} value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              ) : null}
              {requiredCerts.length > 0 ? (
                <div>
                  <p className={PANEL_LABEL}>Påkrevde sertifikater (kryss av når kontrollert)</p>
                  <div className="mt-2 space-y-2">
                    {requiredCerts.map((c) => (
                      <label key={c} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={certChecks[c] ?? false}
                          onChange={(e) => setCertChecks((prev) => ({ ...prev, [c]: e.target.checked }))}
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <label className={PANEL_LABEL}>Notat sertifikater</label>
                <textarea className={PANEL_INPUT} rows={2} value={certsNotes} onChange={(e) => setCertsNotes(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={certsVerified}
                  onChange={(e) => setCertsVerified(e.target.checked)}
                />
                Sertifikater verifisert
              </label>
              <button
                type="button"
                onClick={() => void onSubmit()}
                className="rounded bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white"
              >
                Legg til
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {requiredCerts.length > 0 && unverifiedWithTemplateCerts > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950">
          ⚠ {unverifiedWithTemplateCerts} deltakere mangler verifiserte sertifikater. Kontroller dokumentasjon før arbeidet
          starter.
        </div>
      ) : null}
    </div>
  )
}

function OppgaverTab({
  detail,
  sja,
  readOnly,
}: {
  detail: SjaDetail
  sja: ReturnType<typeof useSja>
  readOnly: boolean
}) {
  const sortedTasks = useMemo(
    () => [...detail.tasks].sort((a, b) => a.position - b.position),
    [detail.tasks],
  )
  const [newTitle, setNewTitle] = useState('')
  const dragSourceRef = useRef<string | null>(null)
  const dragTargetRef = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const finishDrag = useCallback(() => {
    const from = dragSourceRef.current
    const to = dragTargetRef.current
    dragSourceRef.current = null
    dragTargetRef.current = null
    setDragOverId(null)
    if (!from || !to || from === to) return
    const ids = sortedTasks.map((t) => t.id)
    const fi = ids.indexOf(from)
    const ti = ids.indexOf(to)
    if (fi < 0 || ti < 0) return
    const next = [...ids]
    next.splice(fi, 1)
    next.splice(ti, 0, from)
    void sja.reorderTasks(detail.analysis.id, next)
  }, [sortedTasks, sja, detail.analysis.id])

  const hazardCount = (taskId: string) => detail.hazards.filter((h) => h.task_id === taskId).length

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Del jobben opp i kronologiske deloppgaver. For hver deloppgave identifiseres farekilder i Risikovurdering-fanen.
      </p>
      <div className="space-y-3">
        {sortedTasks.map((task) => (
          <div
            key={task.id}
            onMouseEnter={() => {
              if (dragSourceRef.current && dragSourceRef.current !== task.id) {
                dragTargetRef.current = task.id
                setDragOverId(task.id)
              }
            }}
            className={`flex gap-3 rounded border border-neutral-200 bg-white p-4 shadow-sm ${
              dragOverId === task.id ? 'ring-2 ring-[#1a3d32]/40' : ''
            }`}
          >
            <button
              type="button"
              disabled={readOnly}
              className="mt-1 cursor-grab text-neutral-400 hover:text-neutral-700 disabled:cursor-not-allowed"
              aria-label="Flytt"
              onMouseDown={(e) => {
                e.preventDefault()
                dragSourceRef.current = task.id
                dragTargetRef.current = task.id
                setDragOverId(null)
                const up = () => {
                  finishDrag()
                  window.removeEventListener('mouseup', up)
                }
                window.addEventListener('mouseup', up)
              }}
            >
              <GripVertical className="h-5 w-5" />
            </button>
            <div className="text-3xl font-light text-neutral-300">{task.position + 1}</div>
            <div className="min-w-0 flex-1 space-y-2">
              <input
                className="w-full border-b border-transparent text-base font-semibold text-neutral-900 outline-none focus:border-neutral-400"
                disabled={readOnly}
                defaultValue={task.title}
                key={task.id + task.title}
                onBlur={(e) => {
                  if (e.target.value !== task.title) void sja.updateTask(task.id, { title: e.target.value })
                }}
              />
              <textarea
                className="w-full resize-none border border-transparent bg-neutral-50/50 px-2 py-1 text-sm text-neutral-700 outline-none focus:border-neutral-300"
                rows={2}
                disabled={readOnly}
                placeholder="Valgfri beskrivelse…"
                defaultValue={task.description ?? ''}
                key={task.id + '-d' + (task.description ?? '')}
                onBlur={(e) => {
                  const v = e.target.value || null
                  if (v !== (task.description ?? null)) void sja.updateTask(task.id, { description: v })
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                  {hazardCount(task.id)} farekilder
                </span>
                {hazardCount(task.id) === 0 && !readOnly ? (
                  <button
                    type="button"
                    onClick={() => void sja.deleteTask(task.id)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Slett oppgave"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!readOnly ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newTitle.trim()) return
            void (async () => {
              await sja.addTask(detail.analysis.id, newTitle.trim())
              setNewTitle('')
            })()
          }}
        >
          <input
            className={PANEL_INPUT + ' max-w-md flex-1'}
            placeholder="Ny deloppgave…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="rounded bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white">
            Legg til
          </button>
        </form>
      ) : null}
    </div>
  )
}

function RisikovurderingTab({
  detail,
  template,
  sja,
  readOnly,
  assignableUsers,
}: {
  detail: SjaDetail
  template: SjaTemplate | null
  sja: ReturnType<typeof useSja>
  readOnly: boolean
  assignableUsers: { id: string; displayName: string }[]
}) {
  const sortedTasks = useMemo(
    () => [...detail.tasks].sort((a, b) => a.position - b.position),
    [detail.tasks],
  )

  const chemicalMissing = detail.hazards.filter((h) => h.category === 'chemical' && (h.chemical_ref == null || h.chemical_ref.trim() === ''))

  if (sortedTasks.length === 0) {
    return (
      <p className="rounded border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
        Ingen oppgaver definert. Gå til Oppgaver-fanen og legg til deloppgaver først.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {template?.required_ppe && template.required_ppe.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="mr-2 text-xs font-bold uppercase tracking-wider text-neutral-500">Standard PPE</span>
          {template.required_ppe.map((key) => {
            const opt = SJA_PPE_OPTIONS.find((o) => o.key === key)
            return opt ? (
              <span
                key={key}
                className="rounded border border-neutral-300 bg-white px-2 py-0.5 text-xs font-medium text-neutral-700"
              >
                {opt.label}
              </span>
            ) : null
          })}
        </div>
      ) : null}

      {chemicalMissing.length > 0 ? (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          ⚠ {chemicalMissing.length} farekilder med kjemikalier mangler HMS-datablad referanse. Fyll inn referanse per
          farekilde (Stoffkartotekforskriften).
        </div>
      ) : null}

      {sortedTasks.map((task) => (
        <TaskRiskAccordion
          key={task.id}
          task={task}
          detail={detail}
          sja={sja}
          readOnly={readOnly}
          assignableUsers={assignableUsers}
          onAfterMeasureChange={() => void sja.loadDetail(detail.analysis.id)}
        />
      ))}
    </div>
  )
}

function TaskRiskAccordion({
  task,
  detail,
  sja,
  readOnly,
  assignableUsers,
  onAfterMeasureChange,
}: {
  task: SjaTask
  detail: SjaDetail
  sja: ReturnType<typeof useSja>
  readOnly: boolean
  assignableUsers: { id: string; displayName: string }[]
  onAfterMeasureChange: () => void
}) {
  const [open, setOpen] = useState(true)
  const [addHazardOpen, setAddHazardOpen] = useState(false)
  const taskHazards = detail.hazards.filter((h) => h.task_id === task.id)

  return (
    <div className="rounded border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 text-left"
      >
        <span className="font-semibold text-neutral-900">
          {task.title}
        </span>
        <span className="text-xs text-neutral-500">{open ? 'Skjul ▲' : 'Vis ▼'}</span>
      </button>
      {open ? (
        <div className="space-y-4 p-4">
          {taskHazards.map((h) => (
            <HazardCard
              key={h.id}
              hazard={h}
              measures={detail.measures.filter((m) => m.hazard_id === h.id && m.deleted_at == null)}
              sja={sja}
              sjaId={detail.analysis.id}
              readOnly={readOnly}
              assignableUsers={assignableUsers}
              onAfterMeasureChange={onAfterMeasureChange}
            />
          ))}
          {!readOnly ? (
            <AddHazardInline
              taskId={task.id}
              sjaId={detail.analysis.id}
              sja={sja}
              open={addHazardOpen}
              onOpenChange={setAddHazardOpen}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MandatoryMeasureDeleteDialog({
  onConfirm,
}: {
  onConfirm: (justification: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-red-500 hover:text-red-700"
      >
        Fjern
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-semibold text-red-800">⚠ Obligatorisk tiltak — oppgi begrunnelse for fjerning</p>
      <textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Begrunn hvorfor dette tiltaket ikke gjelder her…"
        className="w-full rounded border border-red-300 bg-white px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={reason.trim().length < 10 || saving}
          onClick={async () => {
            setSaving(true)
            await onConfirm(reason.trim())
            setOpen(false)
            setSaving(false)
            setReason('')
          }}
          className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          Bekreft fjerning
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
          className="rounded border border-neutral-300 px-3 py-1 text-xs"
        >
          Avbryt
        </button>
      </div>
    </div>
  )
}

function HazardCard({
  hazard,
  measures,
  sja,
  sjaId,
  readOnly,
  assignableUsers,
  onAfterMeasureChange,
}: {
  hazard: SjaHazard
  measures: SjaMeasure[]
  sja: ReturnType<typeof useSja>
  sjaId: string
  readOnly: boolean
  assignableUsers: { id: string; displayName: string }[]
  onAfterMeasureChange: () => void
}) {
  const [descDraft, setDescDraft] = useState(hazard.description)
  useEffect(() => {
    setDescDraft(hazard.description)
  }, [hazard.description, hazard.id])

  const resScore = residualScore(hazard)
  const colBorder =
    resScore != null && resScore >= 15
      ? 'border-red-500 ring-1 ring-red-200'
      : resScore != null && resScore >= 10
        ? 'border-orange-400 ring-1 ring-orange-100'
        : 'border-neutral-200'

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-100 pb-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {hazard.category ? (
            <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${HAZARD_CATEGORY_COLOR[hazard.category]}`}>
              {HAZARD_CATEGORY_LABEL[hazard.category]}
            </span>
          ) : null}
          <input
            className="min-w-0 flex-1 border-b border-transparent font-medium text-neutral-900 outline-none focus:border-neutral-400"
            disabled={readOnly}
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => {
              if (descDraft.trim() !== hazard.description) void sja.updateHazard(hazard.id, { description: descDraft.trim() })
            }}
          />
        </div>
        {!readOnly ? (
          <button type="button" className="text-neutral-400 hover:text-red-600" onClick={() => void sja.deleteHazard(hazard.id)}>
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded border border-neutral-200 p-3">
          <p className={PANEL_LABEL}>Initialrisiko</p>
          <RiskMatrix
            size="sm"
            probability={hazard.initial_probability}
            consequence={hazard.initial_consequence}
            readOnly={readOnly}
            onChange={
              readOnly
                ? undefined
                : (p, c) => void sja.updateHazard(hazard.id, { initial_probability: p, initial_consequence: c })
            }
          />
          <p className={`mt-2 text-center text-xs font-semibold ${riskColorClass(riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence))} rounded px-2 py-1`}>
            P[{hazard.initial_probability ?? '—'}] × C[{hazard.initial_consequence ?? '—'}] ={' '}
            {riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence) ?? '—'}{' '}
            {riskLabel(riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence))}
          </p>
        </div>

        <div className="rounded border border-neutral-200 p-3">
          <p className={PANEL_LABEL}>Tiltak</p>
          <p className="mb-2 text-[10px] text-neutral-500">
            E Eliminering · S Substitusjon · T Teknisk · A Administrativt · V PVU
          </p>
          <ul className="space-y-2">
            {measures.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-start gap-2 text-sm">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-bold ${CONTROL_TYPE_COLOR[m.control_type]}`}
                  >
                    {CONTROL_TYPE_LETTER[m.control_type]}
                  </span>
                  <span className="flex-1 text-neutral-800">
                    {m.description}
                    {m.is_mandatory ? (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                        Obligatorisk
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {m.assigned_to_name ?? assignableUsers.find((u) => u.id === m.assigned_to_id)?.displayName ?? '—'}
                  </span>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      disabled={readOnly}
                      checked={m.completed}
                      onChange={(e) => void sja.updateMeasure(m.id, { completed: e.target.checked })}
                    />
                    Utført
                  </label>
                  {!readOnly ? (
                    m.is_mandatory ? (
                      <MandatoryMeasureDeleteDialog
                        onConfirm={async (justification) => {
                          await sja.deleteMeasure(m.id, { justification })
                          onAfterMeasureChange()
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void sja.hardDeleteMeasure(m.id).then(() => onAfterMeasureChange())}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {!readOnly ? <AddMeasureInline sjaId={sjaId} hazardId={hazard.id} sja={sja} assignableUsers={assignableUsers} /> : null}
        </div>

        <div className={`rounded border p-3 ${colBorder}`}>
          {resScore != null && resScore >= 15 ? (
            <p className="mb-2 flex items-center gap-1 text-xs font-bold text-red-700">
              <span>⛔</span> Uakseptabel
            </p>
          ) : resScore != null && resScore >= 10 ? (
            <p className="mb-2 text-xs font-semibold text-orange-700">⚠ Høy</p>
          ) : null}
          <p className={PANEL_LABEL}>Restrisiko</p>
          <RiskMatrix
            size="sm"
            probability={hazard.residual_probability}
            consequence={hazard.residual_consequence}
            readOnly={readOnly}
            onChange={
              readOnly
                ? undefined
                : (p, c) => void sja.updateHazard(hazard.id, { residual_probability: p, residual_consequence: c })
            }
          />
          <p className={`mt-2 text-center text-xs font-semibold ${riskColorClass(resScore)} rounded px-2 py-1`}>
            P[{hazard.residual_probability ?? '—'}] × C[{hazard.residual_consequence ?? '—'}] = {resScore ?? '—'}{' '}
            {riskLabel(resScore)}
          </p>
        </div>
      </div>
    </div>
  )
}

function AddMeasureInline({
  sjaId,
  hazardId,
  sja,
  assignableUsers,
}: {
  sjaId: string
  hazardId: string
  sja: ReturnType<typeof useSja>
  assignableUsers: { id: string; displayName: string }[]
}) {
  const [description, setDescription] = useState('')
  const [controlType, setControlType] = useState<SjaControlType>('eliminate')
  const [assignId, setAssignId] = useState('')

  return (
    <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
      <textarea
        className={PANEL_INPUT}
        rows={2}
        placeholder="Beskriv tiltaket…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select className={PANEL_INPUT} value={controlType} onChange={(e) => setControlType(e.target.value as SjaControlType)}>
        {(Object.keys(CONTROL_TYPE_LABEL) as SjaControlType[]).map((k) => (
          <option key={k} value={k}>
            {CONTROL_TYPE_LABEL[k]}
          </option>
        ))}
      </select>
      <select className={PANEL_INPUT} value={assignId} onChange={(e) => setAssignId(e.target.value)}>
        <option value="">Ingen tildelt</option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
        onClick={() => {
          if (!description.trim()) return
          const u = assignableUsers.find((x) => x.id === assignId)
          void sja.addMeasure({
            sjaId,
            hazardId,
            description: description.trim(),
            controlType,
            assignedToId: assignId || null,
            assignedToName: u?.displayName ?? null,
          })
          setDescription('')
          setAssignId('')
        }}
      >
        + Legg til tiltak
      </button>
    </div>
  )
}

function AddHazardInline({
  taskId,
  sjaId,
  sja,
  open,
  onOpenChange,
}: {
  taskId: string
  sjaId: string
  sja: ReturnType<typeof useSja>
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SjaHazardCategory>('other')
  const [chem, setChem] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="text-sm font-semibold text-[#1a3d32] underline"
      >
        + Legg til farekilde
      </button>
    )
  }

  return (
    <div className="rounded border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
      <textarea
        className={PANEL_INPUT}
        rows={2}
        placeholder="Beskriv farekilden…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <select className={PANEL_INPUT} value={category} onChange={(e) => setCategory(e.target.value as SjaHazardCategory)}>
        {(Object.keys(HAZARD_CATEGORY_LABEL) as SjaHazardCategory[]).map((k) => (
          <option key={k} value={k}>
            {HAZARD_CATEGORY_LABEL[k]}
          </option>
        ))}
      </select>
      {category === 'chemical' ? (
        <div>
          <label className={PANEL_LABEL}>HMS-datablad referanse</label>
          <input className={PANEL_INPUT} value={chem} onChange={(e) => setChem(e.target.value)} />
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-[#1a3d32] px-3 py-1.5 text-xs font-semibold text-white"
          onClick={() => {
            if (!description.trim()) return
            void sja.addHazard(sjaId, taskId, description.trim(), category, category === 'chemical' ? chem : null)
            setDescription('')
            setChem('')
            onOpenChange(false)
          }}
        >
          Lagre farekilde
        </button>
        <button type="button" className="text-xs text-neutral-600 underline" onClick={() => onOpenChange(false)}>
          Avbryt
        </button>
      </div>
    </div>
  )
}

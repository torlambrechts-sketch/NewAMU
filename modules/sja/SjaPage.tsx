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
import { LayoutTable1PostingsShell } from '../../src/components/layout/LayoutTable1PostingsShell'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { WorkplacePageHeading1, WorkplaceSerifSectionTitle } from '../../src/components/layout/WorkplacePageHeading1'
import {
  WORKPLACE_MODULE_CANVAS_BG,
  WORKPLACE_MODULE_CARD,
  WORKPLACE_MODULE_CARD_SHADOW,
  WORKPLACE_MODULE_SUBTLE_PANEL,
  WORKPLACE_MODULE_SUBTLE_PANEL_STYLE,
} from '../../src/components/layout/workplaceModuleSurface'
import { Badge, type BadgeVariant } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { StandardInput, standardFieldClassName } from '../../src/components/ui/Input'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { HseAuditLogViewer } from '../../src/components/hse/HseAuditLogViewer'
import { RiskMatrix, riskLabel, riskScoreFromProbCons } from '../../src/components/hse/RiskMatrix'
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

function riskScoreBadgeVariant(score: number | null): BadgeVariant {
  if (score == null) return 'neutral'
  if (score <= 4) return 'success'
  if (score <= 9) return 'medium'
  if (score <= 14) return 'high'
  return 'critical'
}

const ROLE_LABEL: Record<SjaParticipantRole, string> = {
  responsible: 'Ansvarlig',
  worker: 'Utførende',
  contractor: 'Entreprenør',
  observer: 'Observatør',
}

const PANEL_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-700'

function sjaStatusBadgeVariant(status: SjaAnalysis['status']): BadgeVariant {
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

function participantRoleBadgeVariant(role: SjaParticipantRole): BadgeVariant {
  switch (role) {
    case 'responsible':
      return 'high'
    case 'worker':
      return 'info'
    case 'contractor':
      return 'medium'
    case 'observer':
      return 'neutral'
    default:
      return 'neutral'
  }
}

function hazardCategoryBadgeVariant(cat: SjaHazardCategory): BadgeVariant {
  switch (cat) {
    case 'fall':
    case 'fire':
      return 'high'
    case 'chemical':
    case 'electrical':
    case 'dropped_object':
      return 'warning'
    case 'mechanical':
    case 'ergonomic':
      return 'medium'
    case 'other':
    default:
      return 'neutral'
  }
}

function controlTypeBadgeVariant(ct: SjaControlType): BadgeVariant {
  switch (ct) {
    case 'eliminate':
      return 'success'
    case 'substitute':
      return 'info'
    case 'engineering':
      return 'info'
    case 'administrative':
      return 'medium'
    case 'ppe':
    default:
      return 'neutral'
  }
}

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
            <Badge
              variant={isCurrent ? 'info' : 'neutral'}
              className={
                completed
                  ? 'rounded-md border-[#1a3d32] bg-[#1a3d32] px-2 py-1 text-xs font-medium text-white shadow-none'
                  : isCurrent
                    ? 'rounded-md border-2 border-[#1a3d32] bg-white px-2 py-1 text-xs font-medium text-[#1a3d32] shadow-none'
                    : 'rounded-md border border-transparent bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-500 shadow-none'
              }
            >
              {STATUS_LABEL[st]}
            </Badge>
          </div>
        )
      })}
      {stopped ? (
        <>
          <span className="text-neutral-300">→</span>
          <Badge variant="critical" className="rounded bg-red-600 px-2 py-1 font-medium text-white shadow-none border-red-600">
            {STATUS_LABEL.stopped}
          </Badge>
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

  const tabItems: TabItem[] = useMemo(() => {
    if (!detail) return []
    const pCount = detail.participants.length
    return [
      { id: 'grunnlag', label: 'Grunnlag', icon: FileText },
      {
        id: 'deltakere',
        label: pCount > 0 ? `Deltakere (${pCount})` : 'Deltakere',
        icon: Users,
        badgeCount: pCount > 0 ? pCount : undefined,
      },
      { id: 'oppgaver', label: 'Oppgaver', icon: ClipboardList },
      {
        id: 'risikovurdering',
        label: 'Risikovurdering',
        icon: AlertTriangle,
        badgeCount: highRisk > 0 ? highRisk : undefined,
        badgeVariant: highRisk > 0 ? 'danger' : undefined,
      },
      {
        id: 'signaturer',
        label: `Signaturer (${signedCount}/${participantTotal})`,
        icon: PenLine,
        disabled: highRisk > 0,
      },
      { id: 'etterarbeid', label: 'Etterarbeid', icon: CheckCircle2 },
      { id: 'historikk', label: 'Historikk', icon: History },
    ]
  }, [detail, highRisk, signedCount, participantTotal])

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
        <Button type="button" variant="secondary" onClick={() => navigate('/sja')} className="font-medium text-neutral-800">
          ← Tilbake
        </Button>
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
      <header className="sticky top-0 z-30 bg-[#F9F7F2]/95 backdrop-blur-sm">
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/sja')}
                  className="mr-2 h-auto min-h-0 p-0 font-medium text-[#1a3d32] underline decoration-neutral-300 underline-offset-2 hover:bg-transparent hover:text-neutral-900"
                >
                  ← Tilbake til oversikt
                </Button>
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
                <Badge variant={sjaStatusBadgeVariant(analysis.status)} className="px-3 py-1 text-xs">
                  {STATUS_LABEL[analysis.status]}
                </Badge>
                {analysis.status === 'stopped' ? (
                  <Badge variant="critical" className="px-3 py-1 text-xs font-bold">
                    STOPPET
                  </Badge>
                ) : null}
              </div>
            }
            menu={
              <Tabs items={tabItems} activeId={activeTab} onChange={(id) => setActiveTab(id as SjaTab)} />
            }
          />
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
        <div className={`${WORKPLACE_MODULE_CARD} overflow-hidden`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        <div className="space-y-6 p-5 md:p-6">
        {sja.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{sja.error}</div>
        ) : null}

        {highRisk > 0 ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 md:px-5">
            <WarningBox>
              <span className="font-bold">⛔ STOPPET — {highRisk} farekilder har gjenværende risiko i rød sone.</span>
              <span className="mt-2 block text-sm font-medium">
                Arbeidet kan IKKE igangsettes. Revider tiltak.
              </span>
            </WarningBox>
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
        <div className="mb-4">
          <WarningBox>
            <span className="font-semibold">⚠ {removedMandatory.length} obligatorisk tiltak fjernet</span>
            <ul className="mt-2 list-inside space-y-1 text-xs">
              {removedMandatory.map((m) => (
                <li key={m.id} className="text-amber-900">
                  <strong>{m.description}</strong>
                  {m.deletion_justification ? ` — «${m.deletion_justification}»` : null}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800">
              Ved å signere bekrefter du at du har lest og akseptert disse avvikene.
            </p>
          </WarningBox>
        </div>
      ) : null}

      <ComplianceBanner title="AML § 4-2 — felles forståelse" className="rounded-md">
        Alle deltakere skal ha lest og forstått SJA-en og bekreftet at de er kjent med risikoene og tiltakene (AML § 4-2).
      </ComplianceBanner>

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
        <Button type="button" variant="primary" onClick={() => onApproved()}>
          Godkjenn SJA
        </Button>
      ) : null}

      <div className="space-y-3">
        {detail.participants.map((p) => (
          <div key={p.id} className={`${WORKPLACE_MODULE_SUBTLE_PANEL}`} style={WORKPLACE_MODULE_SUBTLE_PANEL_STYLE}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-neutral-900">{p.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={participantRoleBadgeVariant(p.role)} className="text-xs">
                    {ROLE_LABEL[p.role]}
                  </Badge>
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
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={signingId !== null}
                    onClick={async () => {
                      setSigningId(p.id)
                      await sja.signParticipant(p.id)
                      setSigningId(null)
                    }}
                  >
                    {signingId === p.id ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Signerer…
                      </span>
                    ) : (
                      'Signer'
                    )}
                  </Button>
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
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={busy}
        className="mt-3 bg-amber-700 hover:bg-amber-800"
        onClick={async () => {
          setBusy(true)
          const id = await sja.createAvvikFromDebrief(sjaId)
          if (id) setCreatedId(id)
          setBusy(false)
        }}
      >
        {busy ? 'Oppretter…' : 'Opprett avvik'}
      </Button>
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
        <InfoBox>
          Etterarbeid (debrief) låses opp når SJA er merket som <strong>fullført</strong>. Gå til Grunnlag og fullfør
          utførelsen først.
        </InfoBox>
        <p className="text-xs text-neutral-500">Forhåndsvisning — feltene er skrivebeskyttet.</p>
        <DebriefFormFields unexpected={unexpected} setUnexpected={setUnexpected} notes={notes} setNotes={setNotes} disabled />
      </div>
    )
  }

  if (debriefDone) {
    return (
      <div className="space-y-4">
        <ComplianceBanner title="IK-forskriften § 5" className="rounded-md">
          Erfaringsoverføring er obligatorisk etter gjennomføring (IK-forskriften § 5). Uventede hendelser skal
          registreres som avvik.
        </ComplianceBanner>
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
      <ComplianceBanner title="IK-forskriften § 5" className="rounded-md">
        Erfaringsoverføring er obligatorisk etter gjennomføring (IK-forskriften § 5). Uventede hendelser skal
        registreres som avvik.
      </ComplianceBanner>

      <DebriefFormFields unexpected={unexpected} setUnexpected={setUnexpected} notes={notes} setNotes={setNotes} disabled={false} />

      {unexpected === true && avvikBanner && !analysis.avvik_created ? <DebriefAvvikBanner sjaId={analysis.id} sja={sja} /> : null}

      <Button
        type="button"
        variant="primary"
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
      >
        {submitting ? 'Lagrer…' : 'Fullfør etterarbeid og arkiver'}
      </Button>
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
            <Button
              key={String(v)}
              type="button"
              variant={unexpected === v ? 'primary' : 'secondary'}
              disabled={disabled}
              className={`min-h-[3rem] flex-1 border-2 py-3 text-base font-semibold ${
                unexpected === v ? 'border-[#1a3d32]' : 'border-neutral-200'
              }`}
              onClick={() => setUnexpected(v)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <label className={PANEL_LABEL} htmlFor="sja-debrief-notes">
          Beskriv erfaringer og avvik
        </label>
        <StandardTextarea
          id="sja-debrief-notes"
          rows={6}
          disabled={disabled}
          placeholder="Hva fungerte? Hva gikk galt? Hva bør forbedres?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="min-h-[8rem]"
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
  const jobTypeOptions = (Object.keys(JOB_TYPE_LABEL) as SjaJobType[]).map((k) => ({ value: k, label: JOB_TYPE_LABEL[k] }))

  return (
    <div className="space-y-8">
      <div className="space-y-0">
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-title">
            Tittel
          </label>
          <StandardInput
            id="sja-grunnlag-title"
            disabled={readOnly}
            value={draft.title}
            onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))}
          />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-jobtype">
            Jobb-type
          </label>
          {readOnly || jobTypeLocked ? (
            <select
              id="sja-grunnlag-jobtype"
              disabled
              value={draft.job_type}
              className={standardFieldClassName}
            >
              {jobTypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <SearchableSelect
              value={draft.job_type}
              options={jobTypeOptions}
              onChange={(v) => setDraft((d) => (d ? { ...d, job_type: v as SjaJobType } : d))}
            />
          )}
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-desc">
            Beskrivelse av jobben
          </label>
          <StandardTextarea
            id="sja-grunnlag-desc"
            rows={4}
            disabled={readOnly}
            value={draft.job_description}
            onChange={(e) => setDraft((d) => (d ? { ...d, job_description: e.target.value } : d))}
            className="min-h-[6rem]"
          />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-trigger">
            Årsak til SJA
          </label>
          {readOnly ? (
            <select
              id="sja-grunnlag-trigger"
              disabled
              value={
                TRIGGER_REASON_OPTIONS.some((o) => o.value === draft.trigger_reason)
                  ? draft.trigger_reason
                  : 'other'
              }
              className={standardFieldClassName}
            >
              {TRIGGER_REASON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <SearchableSelect
              value={
                TRIGGER_REASON_OPTIONS.some((o) => o.value === draft.trigger_reason)
                  ? draft.trigger_reason
                  : 'other'
              }
              options={TRIGGER_REASON_OPTIONS}
              onChange={(v) => setDraft((d) => (d ? { ...d, trigger_reason: v } : d))}
            />
          )}
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <span className={WPSTD_FORM_FIELD_LABEL}>Arbeidssted</span>
          <div>
            {draft.location_id ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-neutral-800">
                  {locations.find((l) => l.id === draft.location_id)?.name ?? 'Lokasjon'}
                </span>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-0 p-0 text-xs font-semibold text-[#1a3d32] underline"
                    onClick={() => setDraft((d) => (d ? { ...d, location_id: null } : d))}
                  >
                    Endre (tekst)
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <StandardInput
                  disabled={readOnly}
                  placeholder="Adresse / sted (fritekst)"
                  value={draft.location_text}
                  onChange={(e) => setDraft((d) => (d ? { ...d, location_text: e.target.value } : d))}
                />
                {!readOnly ? (
                  <SearchableSelect
                    value=""
                    options={[{ value: '', label: 'Velg lokasjon fra register…' }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
                    placeholder="Velg lokasjon fra register…"
                    onChange={(v) => {
                      if (!v) return
                      setDraft((d) => (d ? { ...d, location_id: v, location_text: '' } : d))
                    }}
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-responsible">
            Ansvarlig
          </label>
          {readOnly ? (
            <select
              id="sja-grunnlag-responsible"
              disabled
              value={draft.responsible_id ?? ''}
              className={standardFieldClassName}
            >
              <option value="">—</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          ) : (
            <SearchableSelect
              value={draft.responsible_id ?? ''}
              options={[{ value: '', label: '—' }, ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))]}
              onChange={(v) => setDraft((d) => (d ? { ...d, responsible_id: v || null } : d))}
            />
          )}
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-start">
            Planlagt start
          </label>
          <StandardInput
            id="sja-grunnlag-start"
            type="datetime-local"
            disabled={readOnly}
            value={draft.scheduled_start}
            onChange={(e) => setDraft((d) => (d ? { ...d, scheduled_start: e.target.value } : d))}
          />
        </div>
        <div className={WPSTD_FORM_ROW_GRID}>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sja-grunnlag-end">
            Planlagt slutt
          </label>
          <StandardInput
            id="sja-grunnlag-end"
            type="datetime-local"
            disabled={readOnly}
            value={draft.scheduled_end}
            onChange={(e) => setDraft((d) => (d ? { ...d, scheduled_end: e.target.value } : d))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-6">
        <Button type="button" variant="primary" disabled={readOnly} onClick={() => onSave()} className="bg-neutral-900 hover:bg-neutral-800">
          Lagre
        </Button>
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
      <Button type="button" variant="primary" onClick={() => onAdvance('active')} className="w-fit">
        Aktiver SJA
      </Button>
    )
  }

  if (analysis.status === 'active') {
    if (!canRequestApproval) {
      return (
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            disabled
            className="h-auto w-full max-w-xl cursor-not-allowed justify-start py-2 text-left font-medium text-neutral-500"
          >
            Venter på deltakere og risikovurdering
          </Button>
          <p className="text-xs text-neutral-500">
            Krever minst to deltakere, minst én farekilde per oppgave med utfylt restrisiko, og ingen rød restrisiko (P×C ≥ 15).
          </p>
        </div>
      )
    }
    return (
      <InfoBox>
        <span className="font-medium text-amber-900">Forutsetningene for godkjenning er oppfylt.</span>
        <p className="mt-1 text-xs text-amber-900/90">
          Gå til fanen <span className="font-semibold">Signaturer</span> for å gjennomføre sjekklisten og trykke «Godkjenn SJA».
        </p>
      </InfoBox>
    )
  }

  if (analysis.status === 'approved') {
    return (
      <Button type="button" variant="primary" onClick={() => onAdvance('in_execution')} className="w-fit">
        Start arbeidet
      </Button>
    )
  }

  if (analysis.status === 'in_execution') {
    return (
      <div className="space-y-4">
        <Button type="button" variant="secondary" onClick={() => onAdvance('completed')} className="w-fit border-neutral-900 font-semibold text-neutral-900">
          Merk som fullført
        </Button>
        {!stopFormOpen ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={() => setStopFormOpen(true)} className="border-red-700 bg-white text-red-700 hover:bg-red-50">
              STOPP ARBEIDET
            </Button>
          </div>
        ) : (
          <div className="max-w-lg space-y-2 rounded border border-red-200 bg-red-50 p-4">
            <label className="text-xs font-semibold text-red-900" htmlFor="sja-stop-reason">
              Årsak til stopp
            </label>
            <StandardTextarea
              id="sja-stop-reason"
              rows={2}
              value={stopReasonDraft}
              onChange={(e) => setStopReasonDraft(e.target.value)}
              className="border-red-300"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  void onAdvance('stopped', { stop_reason: stopReasonDraft })
                  setStopFormOpen(false)
                  setStopReasonDraft('')
                }}
              >
                Bekreft stopp
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto min-h-0 p-0 text-xs text-neutral-600 underline"
                onClick={() => setStopFormOpen(false)}
              >
                Avbryt
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (analysis.status === 'completed') {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-0 p-0 text-sm font-semibold text-[#1a3d32] underline"
        onClick={onGoEtterarbeid}
      >
        Gå til Etterarbeid-fanen for debrief
      </Button>
    )
  }

  if (analysis.status === 'stopped') {
    return (
      <Button type="button" variant="secondary" onClick={() => onAdvance('active')} className="w-fit border-neutral-900 font-semibold text-neutral-900">
        Oppdater og gjenstart
      </Button>
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
      <ComplianceBanner title="AML § 4-2 og § 7-2 — deltakelse" className="rounded-md">
        Arbeidstakerne og deres representanter skal involveres og delta aktivt i kartleggingen og risikovurderingen (AML §
        4-2 og § 7-2).
      </ComplianceBanner>

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
                  <Badge variant={participantRoleBadgeVariant(p.role)} className="text-xs">
                    {ROLE_LABEL[p.role]}
                  </Badge>
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Slett"
                      onClick={() => void sja.deleteParticipant(p.id)}
                      className="text-neutral-400 hover:text-red-600"
                      icon={<Trash2 className="h-4 w-4" />}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-0 p-0 text-sm font-semibold text-[#1a3d32] underline"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? 'Skjul' : '+ Legg til deltaker'}
          </Button>
          {expanded ? (
            <div className="mt-4 space-y-3 rounded border border-neutral-200 bg-neutral-50/80 p-4">
              <div>
                <label className={PANEL_LABEL} htmlFor="sja-new-participant-name">
                  Navn
                </label>
                <StandardInput id="sja-new-participant-name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label className={PANEL_LABEL} htmlFor="sja-new-participant-role">
                  Rolle
                </label>
                <SearchableSelect
                  value={role}
                  options={(Object.keys(ROLE_LABEL) as SjaParticipantRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
                  onChange={(v) => setRole(v as SjaParticipantRole)}
                />
              </div>
              <div>
                <label className={PANEL_LABEL} htmlFor="sja-new-participant-user">
                  Bruker (valgfritt)
                </label>
                <SearchableSelect
                  value={userId ?? ''}
                  options={[{ value: '', label: '—' }, ...sja.assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))]}
                  onChange={(v) => {
                    const val = v || null
                    setUserId(val)
                    const u = sja.assignableUsers.find((x) => x.id === val)
                    if (u) setName(u.displayName)
                  }}
                />
              </div>
              {role === 'contractor' ? (
                <div>
                  <label className={PANEL_LABEL} htmlFor="sja-new-participant-company">
                    Selskap
                  </label>
                  <StandardInput id="sja-new-participant-company" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
              ) : null}
              {requiredCerts.length > 0 ? (
                <div>
                  <p className={PANEL_LABEL}>Påkrevde sertifikater (kryss av når kontrollert)</p>
                  <div className="mt-2 space-y-2">
                    {requiredCerts.map((c) => {
                      const checked = certChecks[c] ?? false
                      return (
                        <div key={c} className="flex flex-wrap items-center gap-2 text-sm">
                          <Button
                            type="button"
                            variant={checked ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setCertChecks((prev) => ({ ...prev, [c]: !checked }))}
                          >
                            {checked ? '✓' : '○'} {c}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
              <div>
                <label className={PANEL_LABEL} htmlFor="sja-new-participant-certs-notes">
                  Notat sertifikater
                </label>
                <StandardTextarea id="sja-new-participant-certs-notes" rows={2} value={certsNotes} onChange={(e) => setCertsNotes(e.target.value)} />
              </div>
              <Button
                type="button"
                variant={certsVerified ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCertsVerified((v) => !v)}
              >
                Sertifikater verifisert
              </Button>
              <Button type="button" variant="primary" onClick={() => void onSubmit()}>
                Legg til
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {requiredCerts.length > 0 && unverifiedWithTemplateCerts > 0 ? (
        <WarningBox>
          ⚠ {unverifiedWithTemplateCerts} deltakere mangler verifiserte sertifikater. Kontroller dokumentasjon før arbeidet
          starter.
        </WarningBox>
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
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={readOnly}
              className="mt-1 cursor-grab text-neutral-400 hover:bg-transparent hover:text-neutral-700 disabled:cursor-not-allowed"
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
              icon={<GripVertical className="h-5 w-5" />}
            />
            <div className="text-3xl font-light text-neutral-300">{task.position + 1}</div>
            <div className="min-w-0 flex-1 space-y-2">
              <StandardInput
                className="border-0 border-b border-transparent px-0 text-base font-semibold text-neutral-900 shadow-none focus:border-neutral-400 focus:ring-0"
                disabled={readOnly}
                defaultValue={task.title}
                key={task.id + task.title}
                onBlur={(e) => {
                  if (e.target.value !== task.title) void sja.updateTask(task.id, { title: e.target.value })
                }}
              />
              <StandardTextarea
                className="resize-none border border-transparent bg-neutral-50/50 px-2 py-1 text-sm text-neutral-700 shadow-none focus:border-neutral-300 focus:ring-0"
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
                <Badge variant="neutral" className="text-xs font-medium">
                  {hazardCount(task.id)} farekilder
                </Badge>
                {hazardCount(task.id) === 0 && !readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void sja.deleteTask(task.id)}
                    className="text-neutral-400 hover:text-red-600"
                    aria-label="Slett oppgave"
                    icon={<Trash2 className="h-4 w-4" />}
                  />
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
          <StandardInput
            className="max-w-md flex-1"
            placeholder="Ny deloppgave…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button type="submit" variant="primary">
            Legg til
          </Button>
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
        <WarningBox>
          ⚠ {chemicalMissing.length} farekilder med kjemikalier mangler HMS-datablad referanse. Fyll inn referanse per
          farekilde (Stoffkartotekforskriften).
        </WarningBox>
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
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        className="h-auto w-full justify-between rounded-none border-0 border-b border-neutral-100 px-4 py-3 text-left font-normal hover:bg-neutral-50"
      >
        <span className="font-semibold text-neutral-900">{task.title}</span>
        <span className="text-xs text-neutral-500">{open ? 'Skjul ▲' : 'Vis ▼'}</span>
      </Button>
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
      <Button type="button" variant="ghost" size="sm" className="h-auto min-h-0 p-0 text-xs text-red-500 hover:text-red-700" onClick={() => setOpen(true)}>
        Fjern
      </Button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-semibold text-red-800">⚠ Obligatorisk tiltak — oppgi begrunnelse for fjerning</p>
      <StandardTextarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Begrunn hvorfor dette tiltaket ikke gjelder her…"
        className="border-red-300 text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={reason.trim().length < 10 || saving}
          onClick={async () => {
            setSaving(true)
            await onConfirm(reason.trim())
            setOpen(false)
            setSaving(false)
            setReason('')
          }}
        >
          Bekreft fjerning
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
        >
          Avbryt
        </Button>
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
            <Badge variant={hazardCategoryBadgeVariant(hazard.category)} className="shrink-0 text-xs">
              {HAZARD_CATEGORY_LABEL[hazard.category]}
            </Badge>
          ) : null}
          <StandardInput
            className="min-w-0 flex-1 border-0 border-b border-transparent px-0 font-medium shadow-none focus:border-neutral-400 focus:ring-0"
            disabled={readOnly}
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={() => {
              if (descDraft.trim() !== hazard.description) void sja.updateHazard(hazard.id, { description: descDraft.trim() })
            }}
          />
        </div>
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-neutral-400 hover:text-red-600"
            onClick={() => void sja.deleteHazard(hazard.id)}
            icon={<Trash2 className="h-4 w-4" />}
          />
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
          <div className="mt-2 flex justify-center">
            <Badge variant={riskScoreBadgeVariant(riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence))} className="text-xs">
              P[{hazard.initial_probability ?? '—'}] × C[{hazard.initial_consequence ?? '—'}] ={' '}
              {riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence) ?? '—'}{' '}
              {riskLabel(riskScoreFromProbCons(hazard.initial_probability, hazard.initial_consequence))}
            </Badge>
          </div>
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
                  <Badge
                    variant={controlTypeBadgeVariant(m.control_type)}
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded p-0 text-[10px] font-bold shadow-none"
                  >
                    {CONTROL_TYPE_LETTER[m.control_type]}
                  </Badge>
                  <span className="flex-1 text-neutral-800">
                    {m.description}
                    {m.is_mandatory ? (
                      <Badge variant="medium" className="ml-1.5 text-[10px] shadow-none">
                        Obligatorisk
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {m.assigned_to_name ?? assignableUsers.find((u) => u.id === m.assigned_to_id)?.displayName ?? '—'}
                  </span>
                  <Button
                    type="button"
                    variant={m.completed ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={readOnly}
                    className="text-xs"
                    onClick={() => void sja.updateMeasure(m.id, { completed: !m.completed })}
                  >
                    Utført
                  </Button>
                  {!readOnly ? (
                    m.is_mandatory ? (
                      <MandatoryMeasureDeleteDialog
                        onConfirm={async (justification) => {
                          await sja.deleteMeasure(m.id, { justification })
                          onAfterMeasureChange()
                        }}
                      />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-0 p-0 text-xs text-red-500 hover:text-red-700"
                        onClick={() => void sja.hardDeleteMeasure(m.id).then(() => onAfterMeasureChange())}
                      >
                        ×
                      </Button>
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
          <div className="mt-2 flex justify-center">
            <Badge variant={riskScoreBadgeVariant(resScore)} className="text-xs">
              P[{hazard.residual_probability ?? '—'}] × C[{hazard.residual_consequence ?? '—'}] = {resScore ?? '—'}{' '}
              {riskLabel(resScore)}
            </Badge>
          </div>
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
      <StandardTextarea rows={2} placeholder="Beskriv tiltaket…" value={description} onChange={(e) => setDescription(e.target.value)} />
      <SearchableSelect
        value={controlType}
        options={(Object.keys(CONTROL_TYPE_LABEL) as SjaControlType[]).map((k) => ({ value: k, label: CONTROL_TYPE_LABEL[k] }))}
        onChange={(v) => setControlType(v as SjaControlType)}
      />
      <SearchableSelect
        value={assignId}
        options={[{ value: '', label: 'Ingen tildelt' }, ...assignableUsers.map((u) => ({ value: u.id, label: u.displayName }))]}
        onChange={(v) => setAssignId(v)}
      />
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="bg-neutral-900 hover:bg-neutral-800"
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
      </Button>
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
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-0 p-0 text-sm font-semibold text-[#1a3d32] underline"
        onClick={() => onOpenChange(true)}
      >
        + Legg til farekilde
      </Button>
    )
  }

  return (
    <div className="rounded border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
      <StandardTextarea rows={2} placeholder="Beskriv farekilden…" value={description} onChange={(e) => setDescription(e.target.value)} />
      <SearchableSelect
        value={category}
        options={(Object.keys(HAZARD_CATEGORY_LABEL) as SjaHazardCategory[]).map((k) => ({ value: k, label: HAZARD_CATEGORY_LABEL[k] }))}
        onChange={(v) => setCategory(v as SjaHazardCategory)}
      />
      {category === 'chemical' ? (
        <div>
          <label className={PANEL_LABEL} htmlFor="sja-add-hazard-chem">
            HMS-datablad referanse
          </label>
          <StandardInput id="sja-add-hazard-chem" value={chem} onChange={(e) => setChem(e.target.value)} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            if (!description.trim()) return
            void sja.addHazard(sjaId, taskId, description.trim(), category, category === 'chemical' ? chem : null)
            setDescription('')
            setChem('')
            onOpenChange(false)
          }}
        >
          Lagre farekilde
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-auto min-h-0 p-0 text-xs text-neutral-600 underline" onClick={() => onOpenChange(false)}>
          Avbryt
        </Button>
      </div>
    </div>
  )
}

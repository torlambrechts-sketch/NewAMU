import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertCircle, ArrowLeft, BarChart2, BarChart3, Bell, Calendar, CheckCircle2, ChevronRight, CircleDot, ClipboardList, Copy, Download, Eye, EyeOff, Gauge, Ghost, GitBranch, Globe, GripVertical, Hash, HelpCircle, LayoutDashboard, Link2, List, Lock, Mail, MessageCircle, Play, Plus, Scan, Save, Send, Settings, ShieldCheck, SlidersHorizontal, ToggleLeft, Trash2, TrendingUp, Type as TypeIcon, Users2 } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import {
  ModulePageShell,
  ModulePageEmpty,
  ModuleSectionCard,
} from '../../src/components/module'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { Tabs, type TabItem } from '../../src/components/ui/Tabs'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useSurvey } from './useSurvey'
import type { UseSurveyState } from './useSurvey'
import { useSurveyOrgTemplates } from './useSurveyOrgTemplates'
import { SurveyMetadataPanel } from './components/SurveyMetadataPanel'
import { SurveyAttestasjonCard } from './SurveyAttestasjonCard'
import { SurveyResponseReadPanel } from './SurveyResponseReadPanel'
import { surveyStatusBadgeVariant, surveyStatusLabel } from './surveyLabels'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'
import { SurveyQuestionFormFields, type QuestionDraft } from './SurveyQuestionFormFields'
import { defaultQuestionPayload } from './surveyQuestionDefaults'
import { SurveyAmuTab } from './tabs/SurveyAmuTab'
import { SurveyDistribusjonTab } from './tabs/SurveyDistribusjonTab'
import { SurveyTiltakTab } from './tabs/SurveyTiltakTab'
import { orgQuestionToCatalogQuestion } from './surveyTemplateCatalogHelpers'
import { suggestionsForSurveyPurpose, type PurposeSuggestion } from './surveyPurposeSuggestions'
import { SurveyAnalyseTab } from './SurveyAnalyseTab'
import { SURVEY_TYPE_LABEL } from './types'
import type { OrgSurveyQuestionRow, OrgSurveyResponseRow, SurveyAmuReviewRow, SurveyQuestionType, SurveyRow } from './types'
import { buildAnalyticsByQuestionId } from './surveyAnalytics'

function mergeQuestionConfig(
  baseConfig: Record<string, unknown>,
  extraJson: string,
): { config: Record<string, unknown>; error: string | null } {
  let extra: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(extraJson || '{}') as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      extra = parsed as Record<string, unknown>
    }
  } catch {
    return { config: baseConfig, error: 'Ugyldig JSON i teknisk konfigurasjon.' }
  }
  const cfg = { ...baseConfig, ...extra }
  return { config: cfg, error: null }
}

/** Fjerner felter som lagres i sidens JSON-sløyfe (showIf, logic_jump, validation_rules). */
function configForQuestionForm(base: Record<string, unknown>): Record<string, unknown> {
  const c = { ...base }
  delete c.showIf
  delete c.logic_jump
  delete c.validation_rules
  return c
}

function extraJsonFromStoredQuestionConfig(cfg: Record<string, unknown> | undefined): string {
  if (!cfg || typeof cfg !== 'object') return '{}'
  const o: Record<string, unknown> = {}
  if (cfg.showIf != null) o.showIf = cfg.showIf
  if (cfg.logic_jump != null) o.logic_jump = cfg.logic_jump
  if (cfg.validation_rules != null) o.validation_rules = cfg.validation_rules
  try {
    return JSON.stringify(o, null, 2)
  } catch {
    return '{}'
  }
}

type DetailTab = 'oversikt' | 'bygger' | 'distribusjon' | 'svar' | 'analyse' | 'amu' | 'tiltak' | 'resultater' | 'innstillinger'


function buildTabs(
  responseCount: number,
  actionCount: number,
  amuReview: SurveyAmuReviewRow | null,
  pendingInvites: number,
  questionCount: number,
  hideAmuAndTiltak: boolean,
): TabItem[] {
  const items: TabItem[] = [
    { id: 'oversikt', label: 'Oversikt', icon: LayoutDashboard },
    {
      id: 'bygger',
      label: 'Spørsmål',
      icon: HelpCircle,
      badgeCount: questionCount > 0 ? questionCount : undefined,
    },
    {
      id: 'distribusjon',
      label: 'Distribusjon',
      icon: Send,
      badgeCount: pendingInvites > 0 ? pendingInvites : undefined,
    },
    {
      id: 'resultater',
      label: 'Resultater',
      icon: BarChart3,
      badgeCount: responseCount > 0 ? responseCount : undefined,
    },
    { id: 'innstillinger', label: 'Innstillinger', icon: Settings },
    {
      id: 'amu',
      label: 'AMU-gjennomgang',
      icon: ShieldCheck,
      badgeCount: amuReview && !amuReview.amu_chair_signed_at ? 1 : undefined,
    },
    {
      id: 'tiltak',
      label: 'Handlingsplan',
      icon: ClipboardList,
      badgeCount: actionCount > 0 ? actionCount : undefined,
    },
  ]
  if (hideAmuAndTiltak) {
    return items.filter((t) => t.id !== 'amu' && t.id !== 'tiltak')
  }
  return items
}

// ─── Innstillinger tab ────────────────────────────────────────────────────────

function ToggleRow({ label, desc, value }: { label: string; desc: string; value: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{desc}</div>
      </div>
      <div className={['relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors', value ? 'bg-[#1a3d32]' : 'bg-neutral-300'].join(' ')}>
        <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', value ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
      </div>
    </div>
  )
}

function InnstillingerTab({
  survey,
  s,
  easy,
  templateLawRefs,
}: {
  survey: UseSurveyState
  s: SurveyRow
  easy: boolean
  templateLawRefs: string[]
}) {
  const [closing, setClosing] = useState(false)

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {/* ── Left column: access + GDPR ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900">Tilgang &amp; anonymitet</h3>
        <div className="rounded-md border border-neutral-200/80 p-4">
          {/* Anonymisert — functional */}
          <div className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900">Anonymisert</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">Svar lagres uten kobling til respondent. Kan ikke endres når svar er mottatt.</div>
            </div>
            <button
              type="button"
              disabled={!survey.canManage || s.status !== 'draft'}
              onClick={() => {
                if (!survey.canManage || s.status !== 'draft') return
                void survey.updateSurvey(s.id, { is_anonymous: !s.is_anonymous })
              }}
              className={['relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors', s.is_anonymous ? 'bg-[#1a3d32]' : 'bg-neutral-300', (!survey.canManage || s.status !== 'draft') ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'].join(' ')}
            >
              <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', s.is_anonymous ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
            </button>
          </div>
          <ToggleRow label="Krev innlogging" desc="Respondenten må logge inn med SSO før svar lagres." value={true} />
          {!easy && (
            <>
              <ToggleRow label="Tillat delvis lagring" desc="Respondent kan lukke og fortsette senere." value={true} />
              <ToggleRow label="Vis fremdriftslinje" desc="Respondent ser hvor langt de er kommet." value={true} />
            </>
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-900">Lovverk &amp; retensjon</h3>
        <div className="rounded-md border border-neutral-200/80 p-4 text-sm">
          {!easy && templateLawRefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 pb-3">
              {templateLawRefs.map((l) => (
                <span
                  key={l}
                  className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
          <dl className={[!easy && templateLawRefs.length > 0 ? 'mt-3' : '', 'space-y-2 text-xs'].join(' ')}>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Lagringstid</dt>
              <dd className="text-neutral-900">5 år (i tråd med IK § 5)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Behandlingsgrunnlag</dt>
              <dd className="text-neutral-900">GDPR Art. 6 (1) c</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Anonym</dt>
              <dd className="text-neutral-900">{s.is_anonymous ? 'Ja — ingen bruker-ID' : 'Nei — identifisert'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Eksport</dt>
              <dd className="text-neutral-900">CSV · PDF · API</dd>
            </div>
          </dl>
          {!easy && (
            <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">
              {s.is_anonymous
                ? 'Anonyme undersøkelser lagrer ikke bruker-ID. Rådata slettes etter 3 år (GDPR Art. 5(1)(e)).'
                : 'Identifiserte undersøkelser lagrer bruker-ID. Informer deltakerne i forkant (AML § 4-1, GDPR Art. 6(1)(c)).'}
            </p>
          )}
        </div>
      </section>

      {/* ── Right column: result sharing + danger zone ── */}
      <section className="space-y-3">
        {!easy && (
          <>
            <h3 className="text-sm font-semibold text-neutral-900">Resultatdeling</h3>
            <div className="rounded-md border border-neutral-200/80 p-4">
              <ToggleRow label="Del live-dashboard med HMS-leder" desc="Aggregert status vises mens undersøkelsen pågår." value={true} />
              <ToggleRow label="Send sammendrag automatisk ved lukking" desc="PDF til eier + verneombud etter lukking." value={true} />
              <ToggleRow label="Tillat ledere å se sitt teams resultater" desc="Kun aggregert · minimum 5 svar." value={false} />
            </div>
          </>
        )}

        {survey.canManage && (
          <>
            <h3 className="text-sm font-semibold text-neutral-900">Faresone</h3>
            <div className="rounded-md border border-red-200 bg-red-50/50 p-4">
              <ul className="space-y-2 text-xs">
                {s.status === 'active' && (
                  <li className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-red-900">Lukk undersøkelse nå</div>
                      <div className="text-[11px] text-red-700">Stenger for nye svar. Kan ikke åpnes igjen.</div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={closing}
                      onClick={async () => {
                        if (!window.confirm('Vil du lukke undersøkelsen? Ingen nye svar kan sendes inn etter lukking.')) return
                        setClosing(true)
                        await survey.updateSurvey(s.id, { status: 'closed' })
                        setClosing(false)
                      }}
                    >
                      {closing ? 'Lukker…' : 'Lukk'}
                    </Button>
                  </li>
                )}
                <li className={['flex items-center justify-between', s.status === 'active' ? 'border-t border-red-100 pt-2' : ''].join(' ')}>
                  <div>
                    <div className="font-medium text-red-900">Slett undersøkelse</div>
                    <div className="text-[11px] text-red-700">Alle svar slettes permanent. Krever bekreftelse.</div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="!text-red-700 hover:bg-red-100" disabled>
                    Slett
                  </Button>
                </li>
              </ul>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = { supabase: SupabaseClient | null }

function TabEmpty({ message, footer }: { message: string; footer?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Ghost className="h-12 w-12 text-neutral-300" strokeWidth={1.25} aria-hidden />
      <p className="max-w-md text-sm text-neutral-500">{message}</p>
      {footer}
    </div>
  )
}

function amuComplianceSteps(s: SurveyRow, amu: SurveyAmuReviewRow | null) {
  return [
    { ok: s.status === 'closed', label: 'Undersøkelsen er lukket' },
    { ok: Boolean(amu?.meeting_date?.trim()), label: 'Møtedato for AMU-gjennomgang er registrert' },
    { ok: Boolean(amu?.amu_chair_signed_at), label: 'AMU-leder har signert protokoll' },
    { ok: Boolean(amu?.vo_signed_at), label: 'Verneombud har signert protokoll' },
  ]
}

function OversiktTab({
  survey,
  s,
  onOpenAmuTab,
  isOrgAdmin,
  nameByUserId,
  onTabChange,
}: {
  survey: UseSurveyState
  s: SurveyRow
  onOpenAmuTab: () => void
  isOrgAdmin: boolean
  nameByUserId: Record<string, string>
  onTabChange: (tab: DetailTab) => void
}) {
  const [titleEdit, setTitleEdit] = useState(s.title)
  const [descEdit, setDescEdit] = useState(s.description ?? '')
  const [purposeEdit, setPurposeEdit] = useState(s.survey_purpose ?? '')
  const [amuSummaryEdit, setAmuSummaryEdit] = useState(s.survey_amu_summary ?? '')
  const [savingMeta, setSavingMeta] = useState(false)

  // ── Dashboard metrics ──────────────────────────────────────────────────────
  const responseCount = s.response_count
  const invitationCount = s.invitation_count
  const svarprosent = invitationCount > 0 ? responseCount / invitationCount : null

  const avgScore = useMemo(() => {
    const ratingQs = survey.questions.filter((q) => q.question_type === 'rating_1_to_5')
    const ratingIds = new Set(ratingQs.map((q) => q.id))
    const vals = survey.answers
      .filter((a) => ratingIds.has(a.question_id) && a.answer_value != null)
      .map((a) => a.answer_value!)
    return vals.length > 0 ? vals.reduce((acc, v) => acc + v, 0) / vals.length : null
  }, [survey.questions, survey.answers])

  const npsData = useMemo(() => {
    const npsQs = survey.questions.filter((q) => q.question_type === 'nps')
    if (npsQs.length === 0) return null
    const npsIds = new Set(npsQs.map((q) => q.id))
    const vals = survey.answers
      .filter((a) => npsIds.has(a.question_id) && a.answer_value != null)
      .map((a) => a.answer_value!)
    if (vals.length === 0) return null
    const promoters = vals.filter((v) => v >= 9).length
    const detractors = vals.filter((v) => v <= 6).length
    const passives = vals.length - promoters - detractors
    const score = Math.round(((promoters - detractors) / vals.length) * 100)
    return { promoters, passives, detractors, total: vals.length, score }
  }, [survey.questions, survey.answers])

  const responseTimeline = useMemo(() => {
    if (survey.responses.length === 0) return null
    const byDay: Record<string, number> = {}
    for (const r of survey.responses) {
      const day = r.submitted_at.slice(0, 10)
      byDay[day] = (byDay[day] || 0) + 1
    }
    const days = Object.keys(byDay).sort()
    let cum = 0
    const points = days.map((d) => { cum += byDay[d]; return { day: d, count: cum } })
    return { points, max: cum }
  }, [survey.responses])

  const insights = useMemo(() => {
    const list: { tone: 'positive' | 'warning' | 'critical'; text: string }[] = []
    if (svarprosent !== null) {
      if (svarprosent >= 0.7) list.push({ tone: 'positive', text: `Høy svarprosent (${Math.round(svarprosent * 100)}%) — bra engasjement.` })
      else if (svarprosent < 0.4 && s.status === 'active') list.push({ tone: 'warning', text: `Lav svarprosent (${Math.round(svarprosent * 100)}%). Vurder å sende påminnelse til deltakere som ikke har svart.` })
    }
    if (npsData) {
      if (npsData.score >= 30) list.push({ tone: 'positive', text: `eNPS på +${npsData.score} er over benchmark (+25).` })
      else if (npsData.score < 0) list.push({ tone: 'critical', text: `Negativt eNPS (${npsData.score}) — bør adresseres i AMU-møte.` })
    }
    if (avgScore !== null && avgScore < 3.5) list.push({ tone: 'warning', text: `Gjennomsnittsscore ${avgScore.toFixed(1)}/5 er under terskel 3,5. Se per-spørsmål i Resultater.` })
    return list
  }, [svarprosent, npsData, avgScore, s.status])

  const respondentNames = useMemo(() => {
    if (s.is_anonymous) return []
    return Object.values(nameByUserId).slice(0, 5)
  }, [s.is_anonymous, nameByUserId])

  const amuGate = useMemo(() => {
    if (s.survey_type !== 'internal' || !s.amu_review_required) return null
    const steps = amuComplianceSteps(s, survey.amuReview)
    const complete = steps.every((x) => x.ok)
    return { steps, complete }
  }, [s, survey.amuReview])

  const saveMetadata = useCallback(async () => {
    if (!titleEdit.trim()) return
    setSavingMeta(true)
    const ok = await survey.updateSurvey(s.id, {
      title: titleEdit.trim(),
      description: descEdit.trim() || null,
      survey_purpose: purposeEdit.trim() || null,
      survey_amu_summary: amuSummaryEdit.trim() || null,
    })
    setSavingMeta(false)
    if (ok) void survey.loadSurveyDetail(s.id)
  }, [s.id, titleEdit, descEdit, purposeEdit, amuSummaryEdit, survey])

  const amuBriefingText = useMemo(() => {
    const lines: string[] = []
    lines.push(`Undersøkelse: ${s.title}`)
    if (purposeEdit.trim()) lines.push(`Formål: ${purposeEdit.trim()}`)
    if (amuSummaryEdit.trim()) lines.push(`Oppsummering til AMU: ${amuSummaryEdit.trim()}`)
    lines.push('')
    lines.push('Status i portalen:')
    for (const step of amuComplianceSteps(s, survey.amuReview)) {
      lines.push(`${step.ok ? '✓' : '○'} ${step.label}`)
    }
    lines.push('')
    lines.push(
      'Personvern: presenter kun aggregerte tall for AMU. Ikke del enkeltvise fritekstsvar uten egen vurdering.',
    )
    return lines.join('\n')
  }, [s, survey.amuReview, purposeEdit, amuSummaryEdit])

  return (
    <div className="space-y-6">
      {/* ── Dashboard section ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_288px]">
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Svarprosent</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums" style={{ color: svarprosent === null ? '#a3a3a3' : svarprosent >= 0.7 ? '#1a3d32' : svarprosent >= 0.4 ? '#c98a2b' : '#b3382a' }}>
                {svarprosent !== null ? `${Math.round(svarprosent * 100)}%` : '—'}
              </div>
              {svarprosent !== null && (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-1.5 rounded-full transition-[width]" style={{ width: `${Math.min(100, Math.round(svarprosent * 100))}%`, background: svarprosent >= 0.7 ? '#1a3d32' : svarprosent >= 0.4 ? '#c98a2b' : '#b3382a' }} />
                </div>
              )}
            </div>
            <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Svar</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
                {responseCount}<span className="text-base font-normal text-neutral-400">/{invitationCount}</span>
              </div>
              <div className="text-[10px] text-neutral-500">{Math.max(0, invitationCount - responseCount)} gjenstår</div>
            </div>
            <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Snittscore</div>
              <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900">
                {avgScore !== null ? avgScore.toFixed(1) : <span className="text-lg text-neutral-400">—</span>}
              </div>
              <div className="text-[10px] text-neutral-500">av 5,0</div>
            </div>
            <div className="rounded-md bg-[#fbf9f3] px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">eNPS</div>
              <div className={`mt-0.5 text-2xl font-bold tabular-nums ${npsData ? (npsData.score >= 30 ? 'text-green-700' : npsData.score >= 0 ? 'text-amber-700' : 'text-red-700') : 'text-neutral-400'}`}>
                {npsData ? (npsData.score > 0 ? `+${npsData.score}` : String(npsData.score)) : '—'}
              </div>
              {npsData ? <div className="text-[10px] text-neutral-500">benchmark +25</div> : <div className="text-[10px] text-neutral-400">ingen NPS-spørsmål</div>}
            </div>
          </div>

          {/* Response over time */}
          {responseTimeline && responseTimeline.points.length > 1 && (
            <div className="rounded-md border border-neutral-200/80 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-neutral-900">Svar over tid</h4>
                <span className="text-[11px] text-neutral-500">Daglig akkumulert</span>
              </div>
              <svg className="mt-3" width="100%" height="120" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden>
                <defs>
                  <linearGradient id="ovRespFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a3d32" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1a3d32" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((y) => (
                  <line key={y} x1="0" x2="300" y1={110 - y * 90} y2={110 - y * 90} stroke="#E5E5E5" strokeDasharray="2 3" />
                ))}
                {(() => {
                  const pts = responseTimeline.points
                  const max = responseTimeline.max
                  const xs = pts.map((_, i) => (i / Math.max(pts.length - 1, 1)) * 290 + 5)
                  const ys = pts.map((p) => 110 - (p.count / max) * 90)
                  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ')
                  const areaPath = `${linePath} L${xs[xs.length - 1]},115 L${xs[0]},115 Z`
                  return (
                    <>
                      <path d={areaPath} fill="url(#ovRespFill)" />
                      <path d={linePath} fill="none" stroke="#1a3d32" strokeWidth="2" />
                      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="3" fill="#1a3d32" />)}
                    </>
                  )
                })()}
              </svg>
              <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
                <span>{responseTimeline.points[0]?.day ?? ''}</span>
                <span>{responseTimeline.points[responseTimeline.points.length - 1]?.day ?? ''}</span>
              </div>
            </div>
          )}

          {/* Key insights */}
          {insights.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">Nøkkelfunn</h4>
              <ul className="mt-2 space-y-2">
                {insights.map((ins, i) => (
                  <li key={i} className={['flex items-start gap-3 rounded-md border px-3 py-2.5 text-xs', ins.tone === 'positive' ? 'border-green-200 bg-green-50/60' : ins.tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'].join(' ')}>
                    {ins.tone === 'positive'
                      ? <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" aria-hidden />
                      : <AlertCircle className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${ins.tone === 'warning' ? 'text-amber-700' : 'text-red-700'}`} aria-hidden />}
                    <span className={ins.tone === 'positive' ? 'text-green-900' : ins.tone === 'warning' ? 'text-amber-900' : 'text-red-900'}>{ins.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick links */}
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onTabChange('bygger')} className="flex items-center gap-2 rounded-md border border-neutral-200/80 bg-white p-3 text-left transition-colors hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]"><HelpCircle className="h-4 w-4" aria-hidden /></span>
              <div><div className="text-xs font-semibold text-neutral-900">Spørsmål</div><div className="text-[10px] text-neutral-500">Se og rediger</div></div>
            </button>
            <button type="button" onClick={() => onTabChange('distribusjon')} className="flex items-center gap-2 rounded-md border border-neutral-200/80 bg-white p-3 text-left transition-colors hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]"><Send className="h-4 w-4" aria-hidden /></span>
              <div><div className="text-xs font-semibold text-neutral-900">Distribusjon</div><div className="text-[10px] text-neutral-500">Mottakere &amp; påminnelser</div></div>
            </button>
            <button type="button" onClick={() => onTabChange('resultater')} className="flex items-center gap-2 rounded-md border border-neutral-200/80 bg-white p-3 text-left transition-colors hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]"><BarChart3 className="h-4 w-4" aria-hidden /></span>
              <div><div className="text-xs font-semibold text-neutral-900">Resultater</div><div className="text-[10px] text-neutral-500">Diagrammer &amp; innsikt</div></div>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden space-y-3 xl:block">
          <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <h3 className="text-sm font-semibold text-neutral-900">Detaljer</h3>
            <dl className="mt-2 space-y-2 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Type</dt>
                <dd className="text-right text-neutral-900">{SURVEY_TYPE_LABEL[s.survey_type] ?? s.survey_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Anonym</dt>
                <dd className="text-neutral-900">{s.is_anonymous ? 'Ja' : 'Nei'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Spørsmål</dt>
                <dd className="tabular-nums text-neutral-900">{survey.questions.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Pack</dt>
                <dd className="text-neutral-900">{s.pack}</dd>
              </div>
              {s.start_date && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Start</dt>
                  <dd className="tabular-nums text-neutral-900">{new Date(s.start_date).toLocaleDateString('nb-NO', { dateStyle: 'short' })}</dd>
                </div>
              )}
              {s.end_date && (
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Slutt</dt>
                  <dd className="tabular-nums text-neutral-900">{new Date(s.end_date).toLocaleDateString('nb-NO', { dateStyle: 'short' })}</dd>
                </div>
              )}
            </dl>
          </div>

          {!s.is_anonymous && respondentNames.length > 0 ? (
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold text-neutral-900">Deltakere</h3>
              <p className="mt-0.5 text-[11px] text-neutral-500">{invitationCount} invitert · {responseCount} svart</p>
              <ul className="mt-2 space-y-2">
                {respondentNames.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7efe9] text-[10px] font-bold text-[#1a3d32]">
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate font-medium text-neutral-900">{name}</span>
                  </li>
                ))}
                {Object.keys(nameByUserId).length > 5 && (
                  <li className="text-[11px] text-neutral-500">+{Object.keys(nameByUserId).length - 5} til</li>
                )}
              </ul>
            </div>
          ) : s.is_anonymous && invitationCount > 0 ? (
            <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              <h3 className="text-sm font-semibold text-neutral-900">Deltakere</h3>
              <p className="mt-1 text-[11px] text-neutral-500">{invitationCount} invitert · anonym undersøkelse — navn vises ikke.</p>
            </div>
          ) : null}
        </aside>
      </div>

      {/* ── Admin / workflow sections (collapsed by default per design) ─────── */}
      <details className="group rounded-lg border border-neutral-200/80 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50/60 [&::-webkit-details-marker]:hidden">
          <span>Administrasjon og arbeidsflyt</span>
          <ChevronRight className="h-4 w-4 text-neutral-400 transition-transform group-open:rotate-90" aria-hidden />
        </summary>
        <div className="space-y-5 border-t border-neutral-100 px-4 py-5">
      <SurveyAttestasjonCard
        s={s}
        invitations={survey.invitations}
        responseCount={survey.responses.length}
      />
      <ModuleSectionCard className="p-5 md:p-6">
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <p className="text-sm font-medium text-neutral-800">Innhold</p>
            <p className="mt-1 text-sm text-neutral-600">
              Tittel og beskrivelse vises for administratorer. Publisering låser spørsmålene.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-title">
                Tittel
              </label>
              <StandardInput
                id="sv-title"
                value={titleEdit}
                onChange={(e) => setTitleEdit(e.target.value)}
                disabled={!survey.canManage || s.status === 'closed'}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-desc">
                Beskrivelse
              </label>
              <StandardTextarea
                id="sv-desc"
                value={descEdit}
                onChange={(e) => setDescEdit(e.target.value)}
                rows={4}
                disabled={!survey.canManage || s.status === 'closed'}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-purpose">
                Formål med undersøkelsen
              </label>
              <p className="text-xs text-neutral-500">
                Skriv kort hva dere vil finne ut av — brukes til forslag når dere legger til spørsmål i byggeren (for
                eksempel «psykososialt klima», «AML», «leverandør»).
              </p>
              <StandardTextarea
                id="sv-purpose"
                value={purposeEdit}
                onChange={(e) => setPurposeEdit(e.target.value)}
                rows={2}
                disabled={!survey.canManage || s.status === 'closed'}
                placeholder="F.eks. Kartlegge trivsel og belastning før årsrapport til AMU"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-amu-sum">
                Kort tekst til AMU / årsrapport (valgfritt)
              </label>
              <p className="text-xs text-neutral-500">
                Kan limes inn som innledning når dere presenter tall — ikke personidentifiserende.
              </p>
              <StandardTextarea
                id="sv-amu-sum"
                value={amuSummaryEdit}
                onChange={(e) => setAmuSummaryEdit(e.target.value)}
                rows={3}
                disabled={!survey.canManage || s.status === 'closed'}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="sv-anon">
                Anonym undersøkelse
              </label>
              <p className="text-xs text-neutral-500">Når aktivt lagres ingen bruker-ID på svar (personvern).</p>
              <div className="mt-2 max-w-xs">
                <YesNoToggle
                  value={s.is_anonymous}
                  onChange={(v) => {
                    if (!survey.canManage) return
                    if (s.status !== 'draft') {
                      return
                    }
                    void survey.updateSurvey(s.id, { is_anonymous: v })
                  }}
                />
              </div>
            </div>
            {survey.canManage && s.status === 'draft' ? (
              <Button type="button" variant="secondary" disabled={savingMeta} onClick={() => void saveMetadata()}>
                {savingMeta ? 'Lagrer…' : 'Lagre endringer'}
              </Button>
            ) : null}
          </div>
        </div>
      </ModuleSectionCard>

      {amuGate ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-800">AMU og dokumentasjon (AML § 7-2)</p>
              <p className="mt-1 text-sm text-neutral-600">
                Resultatene regnes som fullstendig fulgt opp i AMU når alle punktene under er oppfylt. Aggregerte tall
                leveres til AMU — ikke enkelt svar.
              </p>
            </div>
            <Badge variant={amuGate.complete ? 'success' : 'warning'}>
              {amuGate.complete ? 'Oppfylt' : 'Mangler'}
            </Badge>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {amuGate.steps.map((step) => (
              <li key={step.label} className="flex items-start gap-2">
                <span className={step.ok ? 'text-emerald-600' : 'text-neutral-400'} aria-hidden>
                  {step.ok ? '✓' : '○'}
                </span>
                <span className={step.ok ? 'text-neutral-800' : 'text-neutral-600'}>{step.label}</span>
              </li>
            ))}
          </ul>
          {!amuGate.complete ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onOpenAmuTab}>
                Gå til AMU-gjennomgang
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(amuBriefingText)
                }}
              >
                Kopier AMU-utkast til utklippstavlen
              </Button>
            </div>
          ) : (
            <div className="mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(amuBriefingText)
                }}
              >
                Kopier AMU-utkast til utklippstavlen
              </Button>
            </div>
          )}
        </ModuleSectionCard>
      ) : s.survey_type === 'internal' && !s.amu_review_required ? (
        <InfoBox>
          AMU-gjennomgang er ikke påkrevd for denne undersøkelsen. Dokumenter likevel behandling i AMU dersom dere bruker
          resultatene i årsrapport eller tiltaksplan.
        </InfoBox>
      ) : null}

      {survey.canManage && s.status === 'draft' ? (
        <ModuleSectionCard className="p-5 md:p-6">
          <p className="text-sm font-medium text-neutral-800">Publisering</p>
          <p className="mt-1 text-sm text-neutral-600">
            Når du publiserer, låses spørsmålene. Svar kan samles inn mens undersøkelsen er aktiv.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    'Vil du publisere undersøkelsen? Spørsmålene låses og kan ikke endres etterpå.',
                  )
                ) {
                  return
                }
                void survey.publishSurvey(s.id)
              }}
            >
              Publiser
            </Button>
            {isOrgAdmin ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void survey.dispatchOnSurveyPublished(s.id)
                }}
              >
                Kjør arbeidsflyt (publisert)
              </Button>
            ) : null}
          </div>
        </ModuleSectionCard>
      ) : null}

      {survey.canManage && s.status === 'active' ? (
        <ModuleSectionCard className="border-amber-200 bg-amber-50/60 p-5 md:p-6">
          <p className="text-sm font-medium text-amber-950">Lukk undersøkelsen</p>
          <p className="mt-1 text-sm text-amber-900/80">Lukk når innsamlingen er ferdig. Nye svar stoppes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (
                  typeof window !== 'undefined' &&
                  !window.confirm(
                    'Vil du lukke undersøkelsen? Ingen nye svar kan sendes inn etter lukking.',
                  )
                ) {
                  return
                }
                void survey.closeSurvey(s.id)
              }}
            >
              Lukk undersøkelse
            </Button>
            {isOrgAdmin ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  void survey.dispatchOnSurveyClosed(s.id)
                }}
              >
                Kjør arbeidsflyt (lukket)
              </Button>
            ) : null}
          </div>
        </ModuleSectionCard>
      ) : null}
        </div>
      </details>
    </div>
  )
}

function SvarTab({
  survey,
  s,
  nameByUserId,
  onOpenResponse,
}: {
  survey: UseSurveyState
  s: SurveyRow
  nameByUserId: Record<string, string>
  onOpenResponse: (r: OrgSurveyResponseRow) => void
}) {
  const canViewIndividual = !s.is_anonymous

  return (
    <div>
      {survey.responses.length === 0 ? (
        <TabEmpty message="Ingen besvarelser mottatt ennå. Svar vises når deltakere har sendt inn." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Mottatte besvarelser</h2>
              <p className="mt-1 text-sm text-neutral-600">
                {canViewIndividual
                  ? 'Identifiserte undersøkelser: åpne en rad for å se alle svar i sidefeltet.'
                  : 'Anonyme undersøkelser viser ikke sammenheng med navn eller enkeltvise svar.'}
              </p>
            </div>
            <span className="text-xs text-neutral-500">{survey.responses.length} svar</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <th className="py-3 pl-5 pr-4">#</th>
                  <th className="py-3 pr-4">Innsendt</th>
                  <th className="py-3 pr-4">Deltaker</th>
                  <th className="py-3 pr-5 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {survey.responses.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-neutral-50/80">
                    <td className="py-3.5 pl-5 pr-4 tabular-nums text-neutral-600">{idx + 1}</td>
                    <td className="py-3.5 pr-4 text-neutral-700">
                      {new Date(r.submitted_at).toLocaleString('nb-NO')}
                    </td>
                    <td className="py-3.5 pr-4">
                      {s.is_anonymous || r.user_id == null ? (
                        <span className="text-neutral-500">Anonym besvarelse</span>
                      ) : (
                        <span className="font-medium text-neutral-900">{nameByUserId[r.user_id!] ?? 'Bruker'}</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 text-right">
                      {canViewIndividual && r.user_id != null ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onOpenResponse(r)}
                          icon={<Eye className="h-3.5 w-3.5" aria-hidden />}
                          className="uppercase tracking-wide"
                        >
                          Se svar
                        </Button>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Design Resultater section ─────────────────────────────────────────────────
// eNPS donut + per-question stacked bars + fritekst excerpts from design.

function ResultaterDesignSection({ survey, easy }: { survey: UseSurveyState; s: SurveyRow; easy: boolean }) {
  const analyticsByQuestion = useMemo(
    () => buildAnalyticsByQuestionId(survey.questions, survey.answers),
    [survey.questions, survey.answers],
  )

  const npsData = useMemo(() => {
    const npsQs = survey.questions.filter((q) => q.question_type === 'nps')
    if (npsQs.length === 0) return null
    const npsIds = new Set(npsQs.map((q) => q.id))
    const vals = survey.answers
      .filter((a) => npsIds.has(a.question_id) && a.answer_value != null)
      .map((a) => a.answer_value!)
    if (vals.length === 0) return null
    const promoters = vals.filter((v) => v >= 9).length
    const detractors = vals.filter((v) => v <= 6).length
    const passives = vals.length - promoters - detractors
    const score = Math.round(((promoters - detractors) / vals.length) * 100)
    return { promoters, passives, detractors, total: vals.length, score }
  }, [survey.questions, survey.answers])

  const ratingQsWithData = useMemo(() => {
    return survey.questions
      .filter((q) => q.question_type === 'rating_1_to_5')
      .map((q) => {
        const bucket = analyticsByQuestion[q.id]
        const nums = bucket?.numbers ?? []
        const dist = [1, 2, 3, 4, 5].map((v) => nums.filter((n) => Math.round(n) === v).length)
        const total = dist.reduce((acc, v) => acc + v, 0)
        if (total === 0) return null
        const avg = nums.reduce((acc, v) => acc + v, 0) / nums.length
        return { id: q.id, label: q.question_text, dist, total, avg }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }, [survey.questions, analyticsByQuestion])

  const fritekstExcerpts = useMemo(() => {
    const textTypes = new Set<SurveyQuestionType>(['text', 'long_text', 'short_text'])
    const textQs = survey.questions.filter((q) => textTypes.has(q.question_type))
    const textQIds = new Set(textQs.map((q) => q.id))
    return survey.answers
      .filter((a) => textQIds.has(a.question_id) && a.answer_text && a.answer_text.trim().length > 5)
      .slice(0, 6)
      .map((a) => ({
        text: a.answer_text!,
        questionLabel: textQs.find((q) => q.id === a.question_id)?.question_text ?? 'Spørsmål',
      }))
  }, [survey.questions, survey.answers])

  if (survey.responses.length === 0) return null

  const hasVisuals = npsData != null || ratingQsWithData.length > 0

  return (
    <div className="space-y-5">
      {hasVisuals && (
        <div className={['grid grid-cols-1 gap-4', npsData ? 'md:grid-cols-[240px_minmax(0,1fr)]' : ''].join(' ')}>
          {npsData && (
            <div className="rounded-md border border-neutral-200/80 p-4">
              <h4 className="text-sm font-semibold text-neutral-900">eNPS-fordeling</h4>
              <div className="mt-3 flex items-center justify-center">
                <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden>
                  {(() => {
                    const segs = [
                      { v: npsData.promoters / npsData.total, color: '#2F7757' },
                      { v: npsData.passives / npsData.total, color: '#C98A2B' },
                      { v: npsData.detractors / npsData.total, color: '#B3382A' },
                    ]
                    const cx = 80, cy = 80, r = 60, sw = 22
                    let start = -Math.PI / 2
                    return segs.map((seg, i) => {
                      if (seg.v === 0) return null
                      const end = start + seg.v * 2 * Math.PI
                      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
                      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
                      const large = seg.v > 0.5 ? 1 : 0
                      const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
                      start = end
                      return <path key={i} d={path} stroke={seg.color} strokeWidth={sw} fill="none" />
                    })
                  })()}
                  <text x="80" y="76" textAnchor="middle" style={{ fontSize: 22, fontWeight: 700, fill: npsData.score >= 0 ? '#1a3d32' : '#b3382a' }}>
                    {npsData.score > 0 ? `+${npsData.score}` : String(npsData.score)}
                  </text>
                  <text x="80" y="94" textAnchor="middle" style={{ fontSize: 10, fill: '#737373', letterSpacing: 1 }}>eNPS</text>
                </svg>
              </div>
              <ul className="mt-3 space-y-1 text-[11px]">
                <li className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#2F7757]" />Promotere (9–10)</span><span className="tabular-nums font-semibold text-neutral-900">{npsData.promoters}</span></li>
                <li className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#C98A2B]" />Passive (7–8)</span><span className="tabular-nums font-semibold text-neutral-900">{npsData.passives}</span></li>
                <li className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#B3382A]" />Detraktorer (0–6)</span><span className="tabular-nums font-semibold text-neutral-900">{npsData.detractors}</span></li>
              </ul>
            </div>
          )}

          {ratingQsWithData.length > 0 && (
            <div className="rounded-md border border-neutral-200/80 p-4">
              <h4 className="text-sm font-semibold text-neutral-900">Per spørsmål — skala 1–5</h4>
              <ul className="mt-3 space-y-3">
                {ratingQsWithData.map((q) => (
                  <li key={q.id}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="min-w-0 truncate pr-2 font-medium text-neutral-900">{q.label}</span>
                      <span className="shrink-0 tabular-nums text-neutral-700">snitt <span className={`font-bold ${q.avg >= 4 ? 'text-green-700' : q.avg >= 3.5 ? 'text-neutral-900' : 'text-amber-700'}`}>{q.avg.toFixed(1)}</span></span>
                    </div>
                    <div className="mt-1 flex h-3 overflow-hidden rounded-sm">
                      {q.dist.map((v, i) => {
                        const colors = ['#B3382A', '#D67849', '#C98A2B', '#5A9C76', '#1a3d32']
                        const pct = q.total > 0 ? (v / q.total) * 100 : 0
                        return pct > 0 ? <span key={i} style={{ width: `${pct}%`, background: colors[i] }} title={`${i + 1}: ${v} svar`} /> : null
                      })}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-2 text-[10px] text-neutral-500">
                {['#B3382A', '#D67849', '#C98A2B', '#5A9C76', '#1a3d32'].map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1"><span className="h-2 w-2" style={{ background: c }} />{i + 1}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!easy && fritekstExcerpts.length > 0 && (
        <div className="rounded-md border border-neutral-200/80 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-neutral-900">Fritekst — utdrag</h4>
            <span className="text-[11px] text-neutral-500">{fritekstExcerpts.length} svar vist</span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fritekstExcerpts.map((c, i) => (
              <li key={i} className="rounded-md border border-neutral-200/80 bg-neutral-50/60 p-2.5 text-[12px]">
                <p className="italic text-neutral-800">"{c.text.length > 120 ? c.text.slice(0, 120) + '…' : c.text}"</p>
                <div className="mt-1.5 truncate text-[10px] font-semibold text-neutral-500">{c.questionLabel}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Distribusjon — channel visual + QR sidebar wrapper ──────────────────────

const ALL_CHANNELS = ['e-post', 'SMS', 'Slack', 'intranett', 'QR-plakat', 'lenke'] as const
const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  'e-post':    Mail,
  'SMS':       MessageCircle,
  'Slack':     Hash,
  'intranett': Globe,
  'QR-plakat': Scan,
  'lenke':     Link2,
}

function DistribusjonWrapper({
  s,
  easy,
  children,
}: {
  s: SurveyRow
  easy: boolean
  children: ReactNode
}) {
  const [copied, setCopied] = useState(false)
  // Shareable link — best approximation without a token
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/u/${s.id.slice(-8)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {/* 6-channel toggle grid — visual, no DB persistence yet */}
        <section>
          <h3 className="text-sm font-semibold text-neutral-900">Kanaler</h3>
          <p className="mt-0.5 text-[11px] text-neutral-500">Velg hvor undersøkelsen distribueres. Aktive kanaler markert grønt.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_CHANNELS.map((ch) => {
              const Icon = CHANNEL_ICON_MAP[ch] ?? Send
              const active = ch === 'e-post'
              return (
                <div
                  key={ch}
                  className={['flex items-center justify-between rounded-md border p-3 transition-colors',
                    active ? 'border-[#1a3d32] bg-[#e7efe9]' : 'border-neutral-200 bg-white'].join(' ')}
                >
                  <div className="flex items-center gap-2">
                    <span className={['flex h-7 w-7 items-center justify-center rounded-md', active ? 'bg-white text-[#1a3d32]' : 'bg-neutral-100 text-neutral-500'].join(' ')}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-neutral-900">{ch}</div>
                      {!easy && <div className="text-[10px] text-neutral-500">{active ? 'Aktiv' : 'Inaktiv'}</div>}
                    </div>
                  </div>
                  <div className={['relative h-5 w-9 cursor-pointer rounded-full transition-colors', active ? 'bg-[#1a3d32]' : 'bg-neutral-300'].join(' ')}>
                    <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform', active ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Existing functional distribusjon tab content */}
        {children}
      </div>

      {/* Sidebar: shareable link + QR code */}
      <aside className="space-y-3">
        <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold text-neutral-900">Delbar lenke</h3>
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px]">
            <Link2 className="h-3 w-3 shrink-0 text-neutral-400" aria-hidden />
            <code className="min-w-0 flex-1 truncate font-mono text-neutral-700">{shareUrl}</code>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="rounded p-1 text-neutral-500 hover:bg-white hover:text-neutral-900"
              title="Kopier lenke"
            >
              <Copy className="h-3 w-3" aria-hidden />
            </button>
          </div>
          {copied && <p className="mt-1 text-[10px] text-[#1a3d32]">Kopiert!</p>}
          {s.is_anonymous && (
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#1a3d32]">
              <EyeOff className="h-3 w-3" aria-hidden /> Lenke gir anonym tilgang
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200/80 bg-white p-4" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold text-neutral-900">QR-kode</h3>
          <p className="mt-1 text-[11px] text-neutral-500">Skriv ut for verksted / lager / pauserom.</p>
          <div className="mt-2 flex h-36 items-center justify-center rounded-md bg-[#fbf9f3] ring-1 ring-neutral-200">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
              <rect width="80" height="80" fill="#fff" />
              {Array.from({ length: 64 }).map((_, i) => {
                const r = ((i * 9301 + 49297) % 233280) / 233280
                if (r < 0.45) return null
                const x = (i % 8) * 10
                const y = Math.floor(i / 8) * 10
                return <rect key={i} x={x} y={y} width="10" height="10" fill="#1a3d32" />
              })}
              <rect x="0" y="0" width="20" height="20" fill="none" stroke="#1a3d32" strokeWidth="3" />
              <rect x="60" y="0" width="20" height="20" fill="none" stroke="#1a3d32" strokeWidth="3" />
              <rect x="0" y="60" width="20" height="20" fill="none" stroke="#1a3d32" strokeWidth="3" />
            </svg>
          </div>
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Last ned PNG
          </button>
        </div>
      </aside>
    </div>
  )
}

// ─── ModeToggle — Enkel / Avansert switcher ───────────────────────────────────

type DetailMode = 'easy' | 'advanced'

function ModeToggle({
  mode,
  onChange,
  compact = false,
}: {
  mode: DetailMode
  onChange: (m: DetailMode) => void
  compact?: boolean
}) {
  const items: { id: DetailMode; label: string; sub: string; Icon: LucideIcon }[] = [
    { id: 'easy', label: 'Enkel', sub: 'For alle i felt', Icon: CircleDot },
    { id: 'advanced', label: 'Avansert', sub: 'HMS-ansvarlig', Icon: SlidersHorizontal },
  ]
  return (
    <div
      role="tablist"
      aria-label="Visningsmodus"
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200/80 bg-white p-1"
      style={{ boxShadow: '0 1px 1px rgba(0,0,0,0.03)' }}
    >
      {items.map(({ id, label, sub, Icon }) => {
        const active = id === mode
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(id)}
            className={[
              'flex items-center gap-2 rounded-[5px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
              active ? 'bg-[#1a3d32] text-white' : 'text-neutral-600 hover:text-neutral-900',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{label}</span>
            {!compact ? (
              <span
                className={['hidden text-[10px] font-medium md:inline', active ? 'text-white/70' : 'text-neutral-400'].join(' ')}
              >
                · {sub}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// ─── Spørsmål design view — section-grouped list + preview sidebar ────────────

const QTYPE_GROUPS: Record<string, { Icon: LucideIcon; label: string }> = {
  skala:    { Icon: BarChart2,  label: 'Skala' },
  nps:      { Icon: Gauge,      label: 'NPS' },
  yesno:    { Icon: ToggleLeft, label: 'Ja/Nei' },
  fritekst: { Icon: TypeIcon,   label: 'Fritekst' },
  flervalg: { Icon: List,       label: 'Flervalg' },
}

function questionTypeGroup(t: SurveyQuestionType): keyof typeof QTYPE_GROUPS {
  if (t === 'nps') return 'nps'
  if (t === 'yes_no') return 'yesno'
  if (t === 'rating_1_to_5' || t === 'rating_1_to_10' || t === 'likert_scale' || t === 'slider' || t === 'rating_visual') return 'skala'
  if (t === 'text' || t === 'short_text' || t === 'long_text' || t === 'email' || t === 'number') return 'fritekst'
  return 'flervalg'
}

function questionRangeLabel(t: SurveyQuestionType, cfg: Record<string, unknown>): string | null {
  if (t === 'rating_1_to_5') return '1–5'
  if (t === 'rating_1_to_10') return '0–10'
  if (t === 'likert_scale') return 'Likert'
  if (t === 'nps') return '0–10'
  if (t === 'slider') {
    const min = (cfg.min as number | undefined) ?? 0
    const max = (cfg.max as number | undefined) ?? 100
    return `${min}–${max}`
  }
  return null
}

function isConditional(q: OrgSurveyQuestionRow): boolean {
  const c = q.config as { showIf?: unknown; logic_jump?: unknown } | undefined
  return Boolean(c?.showIf || c?.logic_jump)
}

function branchingLabel(q: OrgSurveyQuestionRow): string | null {
  const c = q.config as { showIf?: unknown; logic_jump?: { jumps?: unknown[] } } | undefined
  if (c?.logic_jump?.jumps && Array.isArray(c.logic_jump.jumps) && c.logic_jump.jumps.length > 0) {
    return `${c.logic_jump.jumps.length} forgrening${c.logic_jump.jumps.length > 1 ? 'er' : ''}`
  }
  if (c?.showIf) return 'Betinget visning'
  return null
}

function SporsmalDesignView({
  survey,
  surveyId,
  isLocked,
  easy,
  openNewQuestion,
  openEditQuestion,
  onSaveAsTemplate,
  templateSaving,
}: {
  survey: UseSurveyState
  surveyId: string
  isLocked: boolean
  easy: boolean
  openNewQuestion: (sectionId: string | null, typeHint?: SurveyQuestionType) => void
  openEditQuestion: (q: OrgSurveyQuestionRow) => void
  onSaveAsTemplate: (() => void) | null
  templateSaving: boolean
}) {
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [creatingSection, setCreatingSection] = useState(false)
  const [showNewSection, setShowNewSection] = useState(false)

  const sortedSections = useMemo(
    () => [...survey.surveySections].sort((a, b) => a.order_index - b.order_index),
    [survey.surveySections],
  )

  type SectionGroup = { id: string | null; title: string; questions: OrgSurveyQuestionRow[] }
  const groups: SectionGroup[] = useMemo(() => {
    const out: SectionGroup[] = []
    // First, sections in order
    for (const sec of sortedSections) {
      out.push({
        id: sec.id,
        title: sec.title,
        questions: survey.questions
          .filter((q) => q.section_id === sec.id)
          .sort((a, b) => a.order_index - b.order_index),
      })
    }
    // Then, "Uten seksjon" group if any unattached questions
    const orphans = survey.questions
      .filter((q) => q.section_id == null)
      .sort((a, b) => a.order_index - b.order_index)
    if (orphans.length > 0 || sortedSections.length === 0) {
      out.push({ id: null, title: sortedSections.length === 0 ? 'Spørsmål' : 'Uten seksjon', questions: orphans })
    }
    return out
  }, [sortedSections, survey.questions])

  const previewQuestion = useMemo(() => {
    return (
      survey.questions.find((q) => q.question_type === 'rating_1_to_5') ??
      survey.questions[0] ??
      null
    )
  }, [survey.questions])

  const previewIsScale =
    previewQuestion?.question_type === 'rating_1_to_5' || previewQuestion?.question_type === 'likert_scale'

  if (!survey.canManage) {
    return <TabEmpty message="Du har ikke tilgang til å redigere spørsmål. Kontakt en administrator med survey.manage." />
  }

  const createSection = async () => {
    const title = newSectionTitle.trim()
    if (!title) return
    setCreatingSection(true)
    const nextOrder = sortedSections.length > 0 ? Math.max(...sortedSections.map((s) => s.order_index)) + 1 : 0
    await survey.upsertSection({ surveyId, title, orderIndex: nextOrder })
    setCreatingSection(false)
    setNewSectionTitle('')
    setShowNewSection(false)
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        {isLocked ? (
          <InfoBox>
            Undersøkelsen er publisert eller lukket — spørsmål kan ikke legges til eller endres.
          </InfoBox>
        ) : null}

        {groups.length === 0 || groups.every((g) => g.questions.length === 0) ? (
          <div className="rounded-md border border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500">
            Ingen spørsmål ennå. Klikk «Nytt spørsmål» nederst for å begynne.
          </div>
        ) : null}

        {groups.map((g, si) => (
          <section key={g.id ?? 'orphans'}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-neutral-900" style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}>
                {si + 1}. {g.title}
              </h3>
              <span className="text-[11px] tabular-nums text-neutral-400">{g.questions.length} spørsmål</span>
              {g.id != null && !isLocked ? (() => {
                const sectionId = g.id
                return (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = window.prompt('Nytt navn på seksjon:', g.title)
                      if (next == null) return
                      const trimmed = next.trim()
                      if (!trimmed || trimmed === g.title) return
                      const idx = sortedSections.find((x) => x.id === sectionId)?.order_index ?? si
                      await survey.upsertSection({ id: sectionId, surveyId, title: trimmed, orderIndex: idx })
                    }}
                    className="text-[10px] font-medium text-neutral-500 hover:text-neutral-900"
                  >
                    Rediger
                  </button>
                )
              })() : null}
              {g.id != null && !isLocked && g.questions.length === 0 ? (() => {
                const sectionId = g.id
                return (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Slett seksjonen «${g.title}»?`)) return
                      await survey.deleteSection(sectionId, surveyId)
                    }}
                    className="text-[10px] font-medium text-red-600 hover:text-red-800"
                  >
                    Slett
                  </button>
                )
              })() : null}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => openNewQuestion(g.id)}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-[#1a3d32]"
                >
                  <Plus className="h-3 w-3" aria-hidden /> Legg til
                </button>
              )}
            </div>

            {g.questions.length === 0 ? (
              <div className="rounded-md border border-dashed border-neutral-200 px-3 py-4 text-center text-[11px] text-neutral-400">
                Ingen spørsmål i denne seksjonen ennå.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {g.questions.map((q, qi) => {
                  const grp = questionTypeGroup(q.question_type)
                  const T = QTYPE_GROUPS[grp]
                  const range = questionRangeLabel(q.question_type, (q.config as Record<string, unknown>) ?? {})
                  const conditional = isConditional(q)
                  const branchLabel = branchingLabel(q)
                  return (
                    <li
                      key={q.id}
                      className="group flex items-start gap-2 rounded-md border border-neutral-200/80 bg-white p-2.5 transition-colors hover:border-[#1a3d32]/40 hover:bg-[#fbf9f3]"
                    >
                      <GripVertical
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-neutral-300 group-hover:text-neutral-500"
                        aria-hidden
                      />
                      <button
                        type="button"
                        onClick={() => !isLocked && openEditQuestion(q)}
                        disabled={isLocked}
                        className="min-w-0 flex-1 text-left disabled:cursor-default"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-[11px] font-bold tabular-nums text-neutral-400">{qi + 1}</span>
                          <span className="text-sm text-neutral-900">
                            {q.question_text}
                            {q.is_required && <span className="ml-1 text-red-600">*</span>}
                            {!easy && conditional && (
                              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                                (betinget)
                              </span>
                            )}
                          </span>
                        </div>
                        {!easy && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-5">
                            <span className="inline-flex items-center gap-1 rounded border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-700">
                              <T.Icon className="h-2.5 w-2.5" aria-hidden /> {T.label}
                              {range ? ` · ${range}` : ''}
                            </span>
                            {q.is_mandatory && q.mandatory_law ? (
                              <span className="inline-flex items-center rounded border border-[#c5d3c8] bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]">
                                {q.mandatory_law.replace(/_/g, ' ')}
                              </span>
                            ) : null}
                            {branchLabel ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                                <GitBranch className="h-2.5 w-2.5" aria-hidden /> {branchLabel}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}

        {!isLocked && (
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={() => openNewQuestion(null)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
            >
              <Plus className="h-3 w-3" aria-hidden /> Nytt spørsmål
            </button>
            {!easy &&
              (Object.entries(QTYPE_GROUPS) as [keyof typeof QTYPE_GROUPS, { Icon: LucideIcon; label: string }][]).map(
                ([k, v]) => {
                  const typeForGroup: Record<keyof typeof QTYPE_GROUPS, SurveyQuestionType> = {
                    skala: 'rating_1_to_5',
                    nps: 'nps',
                    yesno: 'yes_no',
                    fritekst: 'long_text',
                    flervalg: 'multiple_choice',
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => openNewQuestion(null, typeForGroup[k])}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                    >
                      <v.Icon className="h-3 w-3" aria-hidden /> {v.label}
                    </button>
                  )
                },
              )}
            <span className="mx-2 h-4 w-px bg-neutral-200" aria-hidden />
            {showNewSection ? (
              <span className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Seksjonsnavn"
                  className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-[#1a3d32]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createSection()
                    if (e.key === 'Escape') {
                      setShowNewSection(false)
                      setNewSectionTitle('')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => void createSection()}
                  disabled={creatingSection || !newSectionTitle.trim()}
                  className="rounded bg-[#1a3d32] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                >
                  {creatingSection ? '…' : 'Lagre'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewSection(false)
                    setNewSectionTitle('')
                  }}
                  className="rounded px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  Avbryt
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewSection(true)}
                className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:border-[#1a3d32] hover:text-[#1a3d32]"
              >
                <Plus className="h-3 w-3" aria-hidden /> Ny seksjon
              </button>
            )}
            {onSaveAsTemplate && survey.questions.length > 0 && (
              <button
                type="button"
                onClick={onSaveAsTemplate}
                disabled={templateSaving}
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-neutral-500 hover:text-[#1a3d32] disabled:opacity-50"
              >
                <Save className="h-3 w-3" aria-hidden />
                {templateSaving ? 'Lagrer mal…' : 'Lagre som organisasjonsmal'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sidebar preview */}
      <aside>
        <div
          className="rounded-xl border border-neutral-200/80 bg-white p-4"
          style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <h3 className="text-sm font-semibold text-neutral-900">Forhåndsvisning</h3>
          <p className="mt-1 text-[11px] text-neutral-500">Slik ser ett spørsmål ut for respondenten:</p>
          <div className="mt-3 rounded-md border border-neutral-200 bg-[#fbf9f3] p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Spørsmål 1 av {survey.questions.length || 1}
            </div>
            <div className="mt-1.5 text-sm text-neutral-900">
              {previewQuestion?.question_text ?? 'Jeg trives på jobben.'}
            </div>
            {previewIsScale || previewQuestion == null ? (
              <>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled
                      className={[
                        'rounded-md border py-2 text-center text-sm font-semibold transition-colors',
                        n === 4
                          ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                          : 'border-neutral-200 bg-white text-neutral-700',
                      ].join(' ')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
                  <span>Helt uenig</span>
                  <span>Helt enig</span>
                </div>
              </>
            ) : previewQuestion.question_type === 'yes_no' ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" disabled className="rounded-md border border-[#1a3d32] bg-[#1a3d32] py-2 text-sm font-semibold text-white">Ja</button>
                <button type="button" disabled className="rounded-md border border-neutral-200 bg-white py-2 text-sm font-semibold text-neutral-700">Nei</button>
              </div>
            ) : previewQuestion.question_type === 'nps' ? (
              <div className="mt-3 grid grid-cols-11 gap-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled
                    className={[
                      'rounded border py-1 text-center text-[10px] font-semibold',
                      i === 9 ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 bg-white text-neutral-600',
                    ].join(' ')}
                  >
                    {i}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-md border border-neutral-200 bg-white px-2 py-2 text-[11px] text-neutral-400">
                Skriv ditt svar her…
              </div>
            )}
          </div>

          {!easy && (
            <div className="mt-3 rounded-md border border-neutral-200/80 bg-neutral-50/60 p-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Statistikk</div>
              <dl className="mt-1.5 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Totalt</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{survey.questions.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Påkrevd</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">
                    {survey.questions.filter((q) => q.is_required).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Lovkrav</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">
                    {survey.questions.filter((q) => q.is_mandatory).length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-500">Seksjoner</dt>
                  <dd className="font-semibold tabular-nums text-neutral-900">{sortedSections.length}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ─── SurveyDetailView ─────────────────────────────────────────────────────────

export function SurveyDetailView({ supabase }: Props) {
  const { surveyId } = useParams<{ surveyId: string }>()
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { organization, profile } = orgSetup
  const isOrgAdmin = profile?.is_org_admin === true
  const orgId = organization?.id
  const survey = useSurvey({ supabase })
  const orgTemplates = useSurveyOrgTemplates({ supabase })
  const [tab, setTab] = useState<DetailTab>('oversikt')
  const [nameByUserId, setNameByUserId] = useState<Record<string, string>>({})
  const profileFetchId = useRef(0)

  const [panelOpen, setPanelOpen] = useState(false)
  const [responsePanelOpen, setResponsePanelOpen] = useState(false)
  const [viewingResponse, setViewingResponse] = useState<OrgSurveyResponseRow | null>(null)
  const [editingQ, setEditingQ] = useState<OrgSurveyQuestionRow | null>(null)
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({
    questionText: '',
    questionType: 'rating_1_to_5',
    orderIndex: 0,
    isRequired: true,
    sectionId: null,
    config: {},
  })
  const [qOptionsLines, setQOptionsLines] = useState('')
  const [qConfigExtraJson, setQConfigExtraJson] = useState('{}')
  const [qSaving, setQSaving] = useState(false)
  const [questionPanelError, setQuestionPanelError] = useState<string | null>(null)
  const [templateSaving, setTemplateSaving] = useState(false)

  const { loadSurveyDetail } = survey
  useEffect(() => {
    if (surveyId) void loadSurveyDetail(surveyId)
  }, [surveyId, loadSurveyDetail])

  const s: SurveyRow | null = survey.selectedSurvey

  const pendingInviteCount = useMemo(
    () => survey.invitations.filter((i) => i.status === 'pending').length,
    [survey.invitations],
  )

  const hideAmuAndTiltak =
    s?.survey_type !== 'internal' || Boolean((s?.vendor_name ?? '').trim()) || Boolean((s?.vendor_org_number ?? '').trim())

  const tabs = useMemo(
    () =>
      buildTabs(
        survey.responses.length,
        survey.actionPlans.filter((p) => p.status !== 'closed').length,
        survey.amuReview,
        pendingInviteCount,
        survey.questions.length,
        hideAmuAndTiltak,
      ),
    [
      survey.responses.length,
      survey.actionPlans,
      survey.amuReview,
      pendingInviteCount,
      survey.questions.length,
      hideAmuAndTiltak,
    ],
  )


  useEffect(() => {
    if (!supabase || !orgId || !surveyId) return
    const uids = [...new Set(survey.responses.map((r) => r.user_id).filter((x): x is string => x != null))]
    const requestId = ++profileFetchId.current
    if (uids.length === 0) {
      queueMicrotask(() => {
        if (requestId === profileFetchId.current) setNameByUserId({})
      })
      return
    }
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('organization_id', orgId)
        .in('id', uids)
      if (requestId !== profileFetchId.current) return
      if (error) {
        return
      }
      const next: Record<string, string> = {}
      for (const row of data ?? []) {
        const p = row as { id: string; display_name: string }
        next[p.id] = p.display_name
      }
      setNameByUserId(next)
    })()
  }, [supabase, orgId, surveyId, survey.responses])

  const responseParticipantLabel = useMemo(() => {
    if (!viewingResponse) return ''
    if (!s || s.is_anonymous || viewingResponse.user_id == null) return 'Anonym besvarelse'
    return nameByUserId[viewingResponse.user_id] ?? 'Bruker'
  }, [viewingResponse, s, nameByUserId])

  const sectionSelectOptions = useMemo(
    () => survey.surveySections.map((sec) => ({ value: sec.id, label: sec.title })),
    [survey.surveySections],
  )

  const nextQuestionOrderIndex = useCallback(
    (sectionId: string | null) => {
      const list = survey.questions.filter(
        (q) => q.survey_id === surveyId && (sectionId === null ? q.section_id == null : q.section_id === sectionId),
      )
      if (list.length === 0) return 0
      return Math.max(...list.map((q) => q.order_index)) + 1
    },
    [survey.questions, surveyId],
  )

  const openNewQuestion = useCallback(
    (sectionId: string | null = null, typeHint?: SurveyQuestionType) => {
      if (!s || !surveyId) return
      const baseType: SurveyQuestionType = typeHint ?? 'rating_1_to_5'
      const defaults = defaultQuestionPayload(baseType)
      setEditingQ(null)
      setQuestionDraft({
        questionText: defaults.questionText,
        questionType: baseType,
        orderIndex: nextQuestionOrderIndex(sectionId),
        isRequired: true,
        sectionId,
        config: defaults.config,
      })
      const opts = (defaults.config as { options?: string[] }).options
      setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
      setQConfigExtraJson('{}')
      setPanelOpen(true)
    },
    [s, surveyId, nextQuestionOrderIndex],
  )

  const openEditQuestion = useCallback((q: OrgSurveyQuestionRow) => {
    setEditingQ(q)
    const rawCfg =
      q.config && typeof q.config === 'object' && !Array.isArray(q.config)
        ? { ...(q.config as Record<string, unknown>) }
        : {}
    setQuestionDraft({
      questionText: q.question_text,
      questionType: q.question_type,
      orderIndex: q.order_index,
      isRequired: q.is_required,
      sectionId: q.section_id ?? null,
      config: configForQuestionForm(rawCfg),
    })
    const opts = (q.config as { options?: string[] } | undefined)?.options
    setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    setQConfigExtraJson(extraJsonFromStoredQuestionConfig(rawCfg))
    setPanelOpen(true)
  }, [])

  const closeResponsePanel = useCallback(() => {
    setResponsePanelOpen(false)
    setViewingResponse(null)
  }, [])

  const openResponsePanel = useCallback((r: OrgSurveyResponseRow) => {
    setViewingResponse(r)
    setResponsePanelOpen(true)
  }, [])

  const closePanel = useCallback(() => {
    setQuestionPanelError(null)
    setPanelOpen(false)
    setEditingQ(null)
  }, [])

  const saveQuestion = useCallback(async () => {
    if (!s || !surveyId || !questionDraft.questionText.trim()) return
    let baseConfig = configForQuestionForm({ ...questionDraft.config })
    const needsOpts = (
      ['multiple_choice', 'single_select', 'multi_select', 'dropdown'] as SurveyQuestionType[]
    ).includes(questionDraft.questionType)
    if (needsOpts) {
      const opts = qOptionsLines
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
      baseConfig = { ...baseConfig, options: opts.length > 0 ? opts : ['Alternativ 1', 'Alternativ 2'] }
    }
    const merged = mergeQuestionConfig(baseConfig, qConfigExtraJson)
    if (merged.error) {
      setQuestionPanelError(merged.error)
      return
    }
    setQuestionPanelError(null)
    setQSaving(true)
    const row = await survey.upsertQuestion({
      id: editingQ?.id,
      surveyId,
      questionText: questionDraft.questionText.trim(),
      questionType: questionDraft.questionType,
      orderIndex: questionDraft.orderIndex,
      isRequired: questionDraft.isRequired,
      isMandatory: editingQ?.is_mandatory,
      mandatoryLaw: editingQ?.mandatory_law,
      config: merged.config,
      sectionId: questionDraft.sectionId,
    })
    setQSaving(false)
    if (row) closePanel()
  }, [
    s,
    surveyId,
    questionDraft,
    qOptionsLines,
    qConfigExtraJson,
    editingQ,
    survey,
    closePanel,
  ])

  const saveAsOrgTemplate = useCallback(async () => {
    if (!s || !surveyId || !survey.canManage) return
    if (s.status !== 'draft') return
    if (survey.questions.length === 0) return
    const defaultName = s.title.trim() || 'Organisasjonsmal'
    const nameInput =
      typeof window !== 'undefined' ? window.prompt('Navn på organisasjonsmal:', defaultName) : defaultName
    if (nameInput == null) return
    const name = nameInput.trim()
    if (!name) return
    setTemplateSaving(true)
    const sorted = [...survey.questions].sort((a, b) => a.order_index - b.order_index)
    const body = {
      version: 1 as const,
      questions: sorted.map((q, i) => orgQuestionToCatalogQuestion(q, i)),
    }
    const row = await survey.saveOrgTemplate({
      name,
      shortName: null,
      description: s.description,
      category: 'custom',
      audience: s.survey_type === 'external' ? 'external' : 'internal',
      body,
    })
    setTemplateSaving(false)
    if (row) navigate(`/survey/templates/org/${row.id}`)
  }, [s, surveyId, survey, navigate])

  const purposeSuggestions = useMemo(
    () =>
      suggestionsForSurveyPurpose(
        survey.selectedSurvey?.survey_purpose ?? null,
        survey.selectedSurvey?.survey_type ?? 'internal',
      ),
    [survey.selectedSurvey?.survey_purpose, survey.selectedSurvey?.survey_type],
  )

  const conditionQuestionOptions = useMemo(() => {
    if (!surveyId) return []
    const order = globalQuestionIdOrder(survey.questions, surveyId, survey.surveySections)
    const m = new Map(survey.questions.map((q) => [q.id, q]))
    return order
      .map((id) => m.get(id))
      .filter((q): q is OrgSurveyQuestionRow => q != null)
      .map((q) => ({ id: q.id, label: q.question_text || 'Uten tittel' }))
  }, [survey.questions, survey.surveySections, surveyId])

  const applyPurposeSuggestion = useCallback((p: PurposeSuggestion) => {
    const payload = defaultQuestionPayload(p.questionType)
    setQuestionDraft((d) => ({
      ...d,
      questionText: p.questionText,
      questionType: p.questionType,
      config: payload.config,
    }))
    if (['multiple_choice', 'single_select', 'multi_select', 'dropdown'].includes(p.questionType)) {
      const opts = (payload.config as { options?: string[] }).options
      setQOptionsLines(Array.isArray(opts) ? opts.join('\n') : '')
    } else {
      setQOptionsLines('')
    }
  }, [])

  const isLocked = !!(s && (s.status === 'active' || s.status === 'closed'))
  const panelTitleId = 'survey-question-panel-title'
  const responsePanelTitleId = 'survey-response-read-panel-title'

  const [detailMode, setDetailMode] = useState<DetailMode>('advanced')
  const easy = detailMode === 'easy'

  const templateRow = useMemo(() => {
    if (!s?.catalog_id) return null
    return survey.templateCatalog.find((t) => t.id === s.catalog_id) ?? null
  }, [s?.catalog_id, survey.templateCatalog])

  const templateLawRefs = useMemo(() => {
    const refs: string[] = []
    const tplLaw = templateRow?.law_ref?.trim()
    if (tplLaw) refs.push(tplLaw)
    // Augment with packs's first legal reference code if any
    return refs
  }, [templateRow])

  const audienceLabel = useMemo(() => {
    if (!s) return ''
    return SURVEY_TYPE_LABEL[s.survey_type] ?? s.survey_type
  }, [s])

  const periodLabel = useMemo(() => {
    if (!s) return ''
    if (!s.start_date && !s.end_date) return ''
    const from = s.start_date ? new Date(s.start_date).toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—'
    const to = s.end_date ? new Date(s.end_date).toLocaleDateString('nb-NO', { dateStyle: 'short' }) : '—'
    return `${from} – ${to}`
  }, [s])

  const sendRemindersForAllDistributions = useCallback(async () => {
    if (!s) return
    if (typeof window !== 'undefined' && !window.confirm('Send påminnelse til alle som ikke har svart?')) return
    let totalSent = 0
    let totalFailed = 0
    for (const dist of survey.distributions) {
      const res = await survey.sendInvitationReminders(dist.id, s.id)
      if (res) {
        totalSent += res.sent
        totalFailed += res.failed
      }
    }
    if (typeof window !== 'undefined') {
      window.alert(`Påminnelser sendt: ${totalSent}. Feilet: ${totalFailed}.`)
    }
  }, [s, survey])

  const exportReport = useCallback(async () => {
    if (!s) return
    if (survey.distributions.length === 0) {
      if (typeof window !== 'undefined') window.alert('Ingen distribusjoner å eksportere fra.')
      return
    }
    // Export the most recent (first) distribution's CSV
    const dist = survey.distributions[0]
    await survey.exportDistributionCsv(s.id, dist.id)
  }, [s, survey])

  if (!surveyId) {
    return <ModulePageEmpty title="Mangler undersøkelses-ID" onBack={() => navigate('/survey')} backLabel="Tilbake til listen" />
  }

  if (!s && !survey.loading) {
    return (
      <ModulePageEmpty
        title="Undersøkelsen finnes ikke, eller du har ikke tilgang."
        onBack={() => navigate('/survey')}
        backLabel="Tilbake til listen"
      />
    )
  }

  if (!s) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: 'Laster' }]}
        title="Laster…"
        description="Henter detaljer."
        headerActions={
          <Button type="button" variant="secondary" onClick={() => navigate('/survey')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Tilbake
          </Button>
        }
        loading
        loadingLabel="Laster undersøkelse…"
      >
        {null}
      </ModulePageShell>
    )
  }

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: 'Undersøkelser', to: '/survey' }, { label: s.title.length > 40 ? s.title.slice(0, 38) + '…' : s.title }]}
        title={s.title}
        description={
          easy
            ? audienceLabel
            : [
                templateRow ? `Mal: ${templateRow.name}` : null,
                audienceLabel,
                s.invitation_count > 0 ? `${s.invitation_count} mottakere` : null,
                periodLabel ? `åpen ${periodLabel}` : null,
              ]
                .filter(Boolean)
                .join(' · ') + '.'
        }
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/survey')}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tilbake
            </Button>
            <ModeToggle mode={detailMode} onChange={setDetailMode} />
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.open(`/survey-respond/${s.id}?preview=1`, '_blank')}
            >
              <Eye className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Forhåndsvis</span>
            </Button>
            {survey.canManage && (
              <Button
                type="button"
                variant="secondary"
                disabled={survey.distributions.length === 0 || s.invitation_count === 0}
                title={survey.distributions.length === 0 ? 'Ingen distribusjon å sende påminnelse for' : undefined}
                onClick={() => void sendRemindersForAllDistributions()}
              >
                <Bell className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Send påminnelse</span>
              </Button>
            )}
            {survey.canManage && s.status === 'draft' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (typeof window !== 'undefined' && !window.confirm('Vil du publisere undersøkelsen? Spørsmålene låses og kan ikke endres etterpå.')) return
                  void survey.publishSurvey(s.id)
                }}
              >
                <Send className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Publiser &amp; send ut</span>
              </Button>
            )}
            {survey.canManage && s.status === 'active' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  if (typeof window !== 'undefined' && !window.confirm('Vil du lukke undersøkelsen? Ingen nye svar kan sendes inn etter lukking.')) return
                  void survey.closeSurvey(s.id)
                }}
              >
                <Lock className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Lukk undersøkelse</span>
              </Button>
            )}
            {survey.canManage && s.status === 'closed' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => void exportReport()}
              >
                <Download className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Eksporter rapport</span>
              </Button>
            )}
            {survey.canManage && (s.status as string) === 'planlagt' && (
              <Button
                type="button"
                variant="primary"
                onClick={() => void survey.publishSurvey(s.id)}
              >
                <Play className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Start nå</span>
              </Button>
            )}
          </div>
        }
        loading={false}
      >
        <div className="w-full space-y-4">
          {/* Status strip — status + anonym + law refs + period + recipients */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 bg-white px-5 py-3" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={surveyStatusBadgeVariant(s.status)}>{surveyStatusLabel(s.status)}</Badge>
              {s.is_anonymous && (
                <span className="inline-flex items-center gap-1 rounded border border-[#c5d3c8] bg-[#e7efe9] px-2 py-0.5 text-[11px] font-semibold text-[#14312a]">
                  <EyeOff className="h-3 w-3" aria-hidden /> Anonym
                </span>
              )}
              {!easy && templateLawRefs.map((l) => (
                <span
                  key={l}
                  className="rounded border border-[#c5d3c8] bg-[#e7efe9] px-1.5 py-0.5 text-[10px] font-semibold text-[#14312a]"
                >
                  {l}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-600">
              {(s.start_date || s.end_date) && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                  <span className="tabular-nums">{periodLabel}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users2 className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                <span className="tabular-nums">{s.invitation_count} mottakere</span>
              </span>
              {s.invitation_count > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                  <span className="tabular-nums">{Math.round((s.response_count / s.invitation_count) * 100)}% svart</span>
                </span>
              )}
            </div>
          </div>

          {survey.error ? <WarningBox>{survey.error}</WarningBox> : null}

          {/* Tabs + content wrapped in a single white card per design (SurveyDetail.jsx) */}
          <div className="rounded-xl border border-neutral-200/80 bg-white" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
            <div className="overflow-x-auto border-b border-neutral-100 px-5 py-2.5">
              <Tabs
                className="w-full md:w-auto"
                overflow="scroll"
                items={tabs}
                activeId={tab}
                onChange={(id) => {
                  const next = id as DetailTab
                  if (hideAmuAndTiltak && (next === 'amu' || next === 'tiltak')) {
                    setTab('oversikt')
                    return
                  }
                  setTab(next)
                }}
              />
            </div>
            <div className="space-y-5 p-5">

          {tab === 'oversikt' && (
            <SurveyMetadataPanel
              survey={s}
              templateMetadataSchema={
                s.catalog_id
                  ? orgTemplates.templates.find((t) => t.catalogId === s.catalog_id)
                      ?.metadataSchema ?? null
                  : null
              }
              locations={orgSetup.locations}
              departments={orgSetup.departments}
              teams={orgSetup.teams}
              members={orgSetup.members}
              hideUniversalFields
              onSave={async (payload) => {
                await survey.updateSurvey(s.id, payload)
              }}
            />
          )}

          {tab === 'oversikt' && (
            <OversiktTab
              key={`${s.id}:${s.updated_at}`}
              survey={survey}
              s={s}
              onOpenAmuTab={() => setTab('amu')}
              isOrgAdmin={isOrgAdmin}
              nameByUserId={nameByUserId}
              onTabChange={(nextTab) => setTab(nextTab)}
            />
          )}

          {tab === 'bygger' && (
            <SporsmalDesignView
              survey={survey}
              surveyId={s.id}
              isLocked={isLocked}
              easy={easy}
              openNewQuestion={openNewQuestion}
              openEditQuestion={openEditQuestion}
              onSaveAsTemplate={
                survey.canManage && s.status === 'draft' && !easy
                  ? () => void saveAsOrgTemplate()
                  : null
              }
              templateSaving={templateSaving}
            />
          )}

          {tab === 'distribusjon' && (
            <DistribusjonWrapper s={s} easy={easy}>
              <SurveyDistribusjonTab survey={survey} s={s} />
            </DistribusjonWrapper>
          )}

          {/* Legacy URL compat: redirect old ?tab=svar / ?tab=analyse to resultater */}
          {(tab === 'svar' || tab === 'analyse') && (() => { setTab('resultater'); return null })()}

          {tab === 'resultater' && (
            <div className="space-y-6">
              <ResultaterDesignSection survey={survey} s={s} easy={easy} />
              <SvarTab survey={survey} s={s} nameByUserId={nameByUserId} onOpenResponse={openResponsePanel} />
              {!easy && survey.responses.length > 0 && (
                <div className="border-t border-neutral-200 pt-6">
                  <h3 className="mb-4 text-sm font-semibold text-neutral-800">Detaljert analyse</h3>
                  <SurveyAnalyseTab survey={survey} s={s} supabase={supabase} />
                </div>
              )}
            </div>
          )}

          {tab === 'innstillinger' && (
            <InnstillingerTab survey={survey} s={s} easy={easy} templateLawRefs={templateLawRefs} />
          )}

          {tab === 'amu' && <SurveyAmuTab survey={survey} s={s} />}

          {tab === 'tiltak' && <SurveyTiltakTab survey={survey} s={s} />}
            </div>
          </div>
        </div>
      </ModulePageShell>

      <SlidePanel
        open={panelOpen}
        onClose={() => {
          setQuestionPanelError(null)
          closePanel()
        }}
        titleId={panelTitleId}
        title={editingQ ? 'Rediger spørsmål' : 'Nytt spørsmål'}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closePanel} disabled={qSaving}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveQuestion()}
              disabled={qSaving || !questionDraft.questionText.trim()}
            >
              {qSaving ? 'Lagrer…' : 'Lagre'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {questionPanelError ? <WarningBox>{questionPanelError}</WarningBox> : null}
          <SurveyQuestionFormFields
            draft={questionDraft}
            onChange={(patch) => setQuestionDraft((d) => ({ ...d, ...patch }))}
            sectionOptions={sectionSelectOptions}
            optionsLines={qOptionsLines}
            onOptionsLinesChange={setQOptionsLines}
            configJson={qConfigExtraJson}
            onConfigJsonChange={setQConfigExtraJson}
            purposeSuggestions={purposeSuggestions}
            onApplySuggestion={applyPurposeSuggestion}
            conditionQuestionOptions={conditionQuestionOptions}
            currentQuestionId={editingQ?.id ?? null}
            showAdvancedJson={isOrgAdmin}
          />

          {editingQ && survey.canManage && !editingQ.is_mandatory ? (
            <div className="border-t border-neutral-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-800"
                onClick={() => {
                  void survey.deleteQuestion(editingQ.id, surveyId!)
                  closePanel()
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Slett spørsmål
              </Button>
            </div>
          ) : null}
        </div>
      </SlidePanel>

      <SlidePanel
        open={responsePanelOpen && viewingResponse != null}
        onClose={closeResponsePanel}
        titleId={responsePanelTitleId}
        title="Besvarelse"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={closeResponsePanel}>
              Lukk
            </Button>
          </div>
        }
      >
        {viewingResponse ? (
          <SurveyResponseReadPanel
            response={viewingResponse}
            questions={survey.questions}
            sections={survey.surveySections}
            answers={survey.answers}
            participantLabel={responseParticipantLabel}
          />
        ) : null}
      </SlidePanel>
    </>
  )
}

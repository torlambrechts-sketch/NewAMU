// AmlWalkthroughPage — seksjonsbasert veiviser for `aml-fullgjennomgang`.
//
// Hvorfor: Eksisterende ChecklistExecutionPage gjengir items[] som én lang
// liste — funksjonelt OK for små maler, men ubrukelig for 109-element AML-
// gjennomgangen. Denne siden leser definition.sections[] og navigerer én
// seksjon om gangen, med framdriftsindikator per kapittel og resume-state
// via compliance_wizard_runs (delt med Compliance Studio).
//
// Wizard-key-mønster: `compliance.aml-fullgjennomgang.<execution_id>`.
// Sesjonstilstand (current_step + payload) er kun navigasjons-state;
// de faktiske svarene ligger som vanlig i compliance_checklist_responses.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ListPlus, Lock, MessageCircle, ShieldCheck } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { useActivePack } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useWizardRun } from '../../src/hooks/useWizardRun'
import { useChecklistModule } from './useChecklistModule'
import { parseChecklistDefinition } from './schema'
import { SeverityBadge } from './components/SeverityBadge'
import { ExecutionMetadataPanel } from './components/ExecutionMetadataPanel'
import { ExecutionCommentThread } from './components/ExecutionCommentThread'
import { ResolutionPointerChip } from './components/ResolutionPointerChip'
import { CreateTaskFromItemPanel } from './components/CreateTaskFromItemPanel'
import { packAccentFor } from './dashboards/packAccents'
import type { WorkplaceBreadcrumbItem } from '../../src/components/layout/WorkplacePageHeading1'
import type {
  ChecklistItem,
  ChecklistSection,
  ComplianceResponseRow,
  ComplianceSeverity,
} from './types'

type YesNoNa = 'yes' | 'no' | 'na'
type Applicability = 'applicable' | 'not_applicable'

const SEVERITIES: ComplianceSeverity[] = ['low', 'medium', 'high', 'critical']

const ANSWER_LABEL: Record<YesNoNa, string> = {
  yes: 'I orden',
  no: 'Mangler',
  na: 'Ikke aktuelt',
}

/** Localstorage key for an in-progress comment draft, scoped per execution+item. */
const draftStorageKey = (execId: string, itemKey: string) =>
  `aml-walkthrough.draft.${execId}.${itemKey}`

/**
 * Terskelgating — leser organisations-metadata fra Section 0 og avgjør
 * om et item er pålagt for denne organisasjonen. Greys ut spørsmål som
 * lover under terskel — viser dem fortsatt (transparens) men i deaktivert
 * form med en chip som forklarer hvorfor.
 *
 * Reglene baseres på terskler i AML:
 *  - § 2A-7: skriftlige varslingsrutiner pålagt fra 5 ansatte
 *  - § 6-1 (verneombud): pålagt fra 5 ansatte; under 5 kan unntak avtales
 *  - § 6-1 (4) hovedverneombud: ≥50 ansatte
 *  - § 7-1 AMU: ≥50 ansatte (10–49 med partsenighet)
 *  - § 8-1/8-2/8-3 info+drøfting: ≥50 ansatte
 *  - § 14-12 og kap. 14A: kun ved innleie
 */
function applicabilityFor(
  item: ChecklistItem,
  metadata: Record<string, unknown> | null | undefined,
): { state: Applicability; reason?: string } {
  const m = metadata ?? {}
  const antall = Number(m.antall_ansatte ?? 0)
  const tariff = m.tariffavtale === 'ja'
  const innleide = Number(m.antall_innleide ?? 0)

  // No metadata filled yet → assume applicable so the user sees everything.
  if (!antall) return { state: 'applicable' }

  switch (item.key) {
    case 'k2a_7_rutiner':
      return antall >= 5
        ? { state: 'applicable' }
        : { state: 'not_applicable', reason: 'Påkrevd kun fra 5 ansatte' }
    case 'k6_1_valgt':
      // <5 ansatte + tariffenighet = lovlig unntak; alle andre tilfeller pålagt.
      return antall >= 5 || !tariff
        ? { state: 'applicable' }
        : { state: 'not_applicable', reason: 'Lovlig unntak (≤5 ansatte + tariffavtale)' }
    case 'k6_1_4_hvo':
    case 'k7_1_etablert':
    case 'k7_2_oppgaver':
    case 'k7_3_lokalt':
    case 'k7_4_arsrapport':
    case 'k8_1_info':
    case 'k8_2_drofting':
    case 'k8_3_fortrolighet':
      return antall >= 50
        ? { state: 'applicable' }
        : { state: 'not_applicable', reason: 'Påkrevd kun fra 50 ansatte' }
    case 'k14_12_innleie':
    case 'k14_12a_likebehandling':
    case 'k14_12c_solidaransvar':
    case 'k14a_1_drofting':
    case 'k14a_2_avtale':
    case 'k14a_3_godkjenning':
      return innleide > 0
        ? { state: 'applicable' }
        : { state: 'not_applicable', reason: 'Gjelder kun ved bruk av innleide' }
    default:
      return { state: 'applicable' }
  }
}

function readAnswer(response: ComplianceResponseRow | undefined): YesNoNa | null {
  if (!response) return null
  const v = response.value as { ok?: boolean | null } | null
  if (!v || typeof v !== 'object') return null
  if (v.ok === true) return 'yes'
  if (v.ok === false) return 'no'
  if (v.ok === null) return 'na'
  return null
}

function answerToValue(answer: YesNoNa): { ok: boolean | null } {
  if (answer === 'yes') return { ok: true }
  if (answer === 'no') return { ok: false }
  return { ok: null }
}

function sectionProgress(
  section: ChecklistSection,
  responses: ComplianceResponseRow[],
  metadata: Record<string, unknown> | null | undefined,
) {
  const required = section.items.filter(
    (i) => i.required && applicabilityFor(i, metadata).state === 'applicable',
  )
  const answeredKeys = new Set(responses.map((r) => r.item_key))
  const answered = required.filter((i) => answeredKeys.has(i.key)).length
  return { answered, required: required.length }
}

export function AmlWalkthroughPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug ?? 'aml-fullgjennomgang'
  const navigate = useNavigate()
  const pack = useActivePack()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const {
    load,
    loadDetail,
    templates,
    executions,
    responsesByExecutionId,
    commentsByExecutionId,
    currentUserId,
    loadComments,
    addComment,
    updateComment,
    deleteComment,
    saveResponse,
    createExecution,
    signExecution,
    assignableUsers,
    updateExecutionMetadata,
  } = cl

  const [executionId, setExecutionId] = useState<string | null>(null)
  const [creatingExecution, setCreatingExecution] = useState(false)
  const [taskPanelKey, setTaskPanelKey] = useState<string | null>(null)
  const [expandedThreadKey, setExpandedThreadKey] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [draftsHydrated, setDraftsHydrated] = useState(false)

  /** Brand-fargen til pakken — overstyr emerald-fallback for primær-CTA og progress-bar. */
  const brandAccent = useMemo(() => packAccentFor(pack.slug) ?? '#1a3d32', [pack.slug])

  useEffect(() => {
    void load()
  }, [load])

  const template = useMemo(
    () => templates.find((t) => t.slug === slug && t.is_active) ?? null,
    [templates, slug],
  )

  // Pick or create draft execution for this user × template
  useEffect(() => {
    if (!template || executionId || creatingExecution) return
    const existing = executions.find(
      (e) => e.template_id === template.id && e.status === 'draft' && e.deleted_at === null,
    )
    if (existing) {
      setExecutionId(existing.id)
      return
    }
    setCreatingExecution(true)
    void createExecution({
      templateId: template.id,
      title: `${template.name} — ${new Date().toLocaleDateString('nb-NO')}`,
    }).then((id) => {
      setCreatingExecution(false)
      if (id) setExecutionId(id)
    })
  }, [template, executions, executionId, creatingExecution, createExecution])

  useEffect(() => {
    if (executionId) void loadDetail(executionId)
  }, [executionId, loadDetail])

  // Hydrate any in-progress comment drafts from localStorage on first mount
  // per execution. Server-loaded comments (via loadDetail) take precedence,
  // so the hydrated drafts only show for items the user had typed into but
  // not yet blurred — i.e. lost mid-edit on a reload.
  useEffect(() => {
    if (!executionId || draftsHydrated || typeof window === 'undefined') return
    const drafts: Record<string, string> = {}
    const prefix = `aml-walkthrough.draft.${executionId}.`
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i)
      if (!k || !k.startsWith(prefix)) continue
      const itemKey = k.slice(prefix.length)
      const v = window.localStorage.getItem(k)
      if (v) drafts[itemKey] = v
    }
    if (Object.keys(drafts).length > 0) {
      setCommentDrafts((prev) => ({ ...drafts, ...prev }))
    }
    setDraftsHydrated(true)
  }, [executionId, draftsHydrated])

  const updateDraft = useCallback(
    (itemKey: string, value: string) => {
      setCommentDrafts((p) => ({ ...p, [itemKey]: value }))
      if (executionId && typeof window !== 'undefined') {
        const k = draftStorageKey(executionId, itemKey)
        if (value) window.localStorage.setItem(k, value)
        else window.localStorage.removeItem(k)
      }
    },
    [executionId],
  )

  const wizardKey = useMemo(
    () => (executionId ? `compliance.${slug}.${executionId}` : ''),
    [slug, executionId],
  )
  const wizardRun = useWizardRun(wizardKey)

  const execution = useMemo(
    () => executions.find((e) => e.id === executionId) ?? null,
    [executions, executionId],
  )

  const definition = useMemo(
    () => parseChecklistDefinition(template?.definition),
    [template?.definition],
  )

  const sections = definition.sections ?? []
  const responses = (executionId && responsesByExecutionId[executionId]) || []

  const currentStep = wizardRun.run?.current_step ?? 0
  const safeStep = Math.min(Math.max(0, currentStep), Math.max(0, sections.length - 1))
  const section = sections[safeStep] ?? null
  const isLast = safeStep === sections.length - 1

  // Overall progress (across all required + applicable items in all sections).
  // Items the org isn't subject to (e.g. § 7-1 AMU when <50 ansatte) are
  // excluded from the required count so they don't block signing.
  const overall = useMemo(() => {
    let req = 0
    let ans = 0
    const answered = new Set(responses.map((r) => r.item_key))
    const meta = execution?.metadata ?? null
    for (const s of sections) {
      for (const it of s.items) {
        if (!it.required) continue
        if (applicabilityFor(it, meta).state === 'not_applicable') continue
        req += 1
        if (answered.has(it.key)) ans += 1
      }
    }
    return { req, ans, percent: req > 0 ? Math.round((ans / req) * 100) : 0 }
  }, [sections, responses, execution?.metadata])

  function jumpTo(step: number) {
    if (!wizardKey) return
    void wizardRun.save({ currentStep: step })
  }

  async function setAnswer(item: ChecklistItem, answer: YesNoNa) {
    if (!executionId) return
    const existing = responses.find((r) => r.item_key === item.key)
    await saveResponse({
      executionId,
      itemKey: item.key,
      value: answerToValue(answer),
      comment: existing?.comment ?? commentDrafts[item.key] ?? undefined,
      severity:
        answer === 'no' && existing?.severity == null
          ? (item.severity_default ?? undefined)
          : existing?.severity ?? undefined,
    })
  }

  async function setSeverity(item: ChecklistItem, severity: ComplianceSeverity | null) {
    if (!executionId) return
    const existing = responses.find((r) => r.item_key === item.key)
    await saveResponse({
      executionId,
      itemKey: item.key,
      value: existing?.value ?? { ok: false },
      comment: existing?.comment ?? commentDrafts[item.key] ?? undefined,
      severity: severity ?? undefined,
    })
  }

  async function commitComment(item: ChecklistItem) {
    if (!executionId) return
    const existing = responses.find((r) => r.item_key === item.key)
    const draft = commentDrafts[item.key] ?? existing?.comment ?? ''
    if ((existing?.comment ?? '') === draft) return
    await saveResponse({
      executionId,
      itemKey: item.key,
      value: existing?.value ?? { ok: null },
      comment: draft,
      severity: existing?.severity ?? undefined,
    })
    // Once the server has accepted the value, drop the local draft — the
    // next load will re-hydrate `comment` from the server.
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftStorageKey(executionId, item.key))
    }
  }

  /** Append an audit line to the response's comment when a task is spawned
   *  from this item — gives the signed execution a self-contained trail
   *  even if the tasks table is later filtered. */
  async function appendTaskAuditLine(item: ChecklistItem, taskId: string) {
    if (!executionId) return
    const existing = responses.find((r) => r.item_key === item.key)
    const ts = new Date().toLocaleDateString('nb-NO')
    const line = `[${ts}] Oppgave opprettet: ${taskId}`
    const nextComment = existing?.comment ? `${existing.comment}\n${line}` : line
    await saveResponse({
      executionId,
      itemKey: item.key,
      value: existing?.value ?? { ok: null },
      comment: nextComment,
      severity: existing?.severity ?? undefined,
    })
  }

  async function handleSign() {
    if (!executionId) return
    await signExecution(executionId)
    await wizardRun.complete()
    navigate(`/compliance/checklists/${executionId}`)
  }

  const breadcrumb: WorkplaceBreadcrumbItem[] = [
    { label: 'Sjekklister', to: `/compliance/checklists?pack=${pack.slug}` },
    { label: template?.name ?? slug },
  ]

  if (!template) {
    return (
      <ModulePageShell title="AML-fullgjennomgang" breadcrumb={breadcrumb}>
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Laster mal…</h2>
          <p className="mt-1 text-sm text-neutral-600">Henter sjekklistemal «{slug}».</p>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  if (sections.length === 0) {
    return (
      <ModulePageShell title={template.name} breadcrumb={breadcrumb}>
        <WarningBox>
          Denne malen har ingen seksjoner definert. Bruk standardvisningen i stedet.
        </WarningBox>
      </ModulePageShell>
    )
  }

  if (!executionId || !execution) {
    return (
      <ModulePageShell title={template.name} breadcrumb={breadcrumb}>
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">Klargjør sesjon…</h2>
          <p className="mt-1 text-sm text-neutral-600">Oppretter eller henter aktiv sesjon.</p>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  const signed = execution.status === 'signed'

  return (
    <ModulePageShell
      title={template.name}
      description="Seksjonsbasert veiviser gjennom arbeidsmiljøloven. Roller og terskler fylles inn først; videre seksjoner viser bare krav som er pålagt for din organisasjon. Sesjonen lagres automatisk og kan fortsettes senere."
      breadcrumb={breadcrumb}
    >
      {/* Overall progress strip */}
      <div className="mb-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-neutral-800">
            Framdrift: {overall.ans} / {overall.req} obligatoriske svar
          </div>
          <Badge variant={signed ? 'signed' : overall.percent >= 100 ? 'active' : 'draft'}>
            {signed ? 'Signert' : `${overall.percent}%`}
          </Badge>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full transition-all"
            style={{ width: `${overall.percent}%`, backgroundColor: brandAccent }}
          />
        </div>

        {/* Section dots */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sections.map((s, i) => {
            const { answered, required } = sectionProgress(s, responses, execution.metadata)
            const complete = required > 0 && answered >= required
            const current = i === safeStep
            return (
              <button
                key={s.key}
                onClick={() => jumpTo(i)}
                disabled={signed}
                title={`${s.title} (${answered}/${required})`}
                aria-label={`Gå til seksjon ${i + 1}: ${s.title}. ${answered} av ${required} besvart.`}
                aria-current={current ? 'step' : undefined}
                className={[
                  'inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs transition-colors',
                  current
                    ? 'text-white'
                    : complete
                      ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
                ].join(' ')}
                style={current ? { backgroundColor: brandAccent } : undefined}
              >
                {complete ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                <span>{i + 1}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 0 — metadata (always shown above the current section so the
          user can adjust roles at any step). */}
      {safeStep === 0 && (
        <ModuleSectionCard className="mb-4 p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">0. Roller og organisering</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Fyll ut roller, antall ansatte og tariffstatus først. Disse svarene avgjør hvilke krav som er pålagt.
          </p>
          <div className="mt-4">
            <ExecutionMetadataPanel
              execution={execution}
              templateMetadataSchema={template.metadata_schema ?? null}
              assignableUsers={assignableUsers}
              locations={orgSetup.locations}
              departments={orgSetup.departments}
              teams={orgSetup.teams}
              members={orgSetup.members}
              onSave={(payload) => updateExecutionMetadata({ executionId, ...payload })}
            />
          </div>
        </ModuleSectionCard>
      )}

      {/* Current section */}
      {section && (
        <ModuleSectionCard className="p-5 md:p-6">
          <h2 className="text-lg font-semibold text-neutral-900">{section.title}</h2>
          {section.chapter && (
            <p className="mt-1 text-sm text-neutral-600">{section.chapter} · {section.items.length} krav</p>
          )}
          {section.intro && (
            <div className="mt-3">
              <InfoBox>{section.intro}</InfoBox>
            </div>
          )}

          <div className="space-y-3">
            {section.items.map((item) => {
              const response = responses.find((r) => r.item_key === item.key)
              const answer = readAnswer(response)
              const commentDraft = commentDrafts[item.key] ?? response?.comment ?? ''
              const showTaskPanel = taskPanelKey === item.key
              const showThread = expandedThreadKey === item.key
              const applic = applicabilityFor(item, execution.metadata)
              const notApplicable = applic.state === 'not_applicable'
              const itemComments = (commentsByExecutionId[executionId] ?? []).filter(
                (c) => c.item_key === item.key,
              )

              return (
                <div
                  key={item.key}
                  className={[
                    'rounded-lg border p-3 transition-colors',
                    notApplicable
                      ? 'border-neutral-200 bg-neutral-50 opacity-60'
                      : answer === 'yes'
                        ? 'border-emerald-200 bg-emerald-50/30'
                        : answer === 'no'
                          ? 'border-red-200 bg-red-50/30'
                          : answer === 'na'
                            ? 'border-neutral-200 bg-neutral-50'
                            : 'border-neutral-200 bg-white',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {item.law_ref && (
                          <Badge variant="neutral" className="text-xs">{item.law_ref}</Badge>
                        )}
                        {item.required && !notApplicable && (
                          <span className="text-xs font-medium text-red-700">*</span>
                        )}
                        {notApplicable && (
                          <Badge variant="neutral" className="text-xs">
                            Ikke aktuelt · {applic.reason ?? 'under terskel'}
                          </Badge>
                        )}
                        <span className="text-sm font-medium text-neutral-900">{item.prompt}</span>
                      </div>
                      {item.help && (
                        <p className="mt-1 text-xs text-neutral-600">{item.help}</p>
                      )}
                      {item.status_hint && !notApplicable && (
                        <p className="mt-1 text-xs italic text-neutral-500">{item.status_hint}</p>
                      )}
                      {item.resolutions && item.resolutions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.resolutions.map((res, i) => (
                            <ResolutionPointerChip key={`${item.key}-r-${i}`} resolution={res} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Answer buttons — only for yes_no_na items (today's AML
                        template is entirely yes_no_na; future templates that
                        use other types fall through to a placeholder below). */}
                    {item.type === 'yes_no_na' && !notApplicable && (
                      <div className="flex shrink-0 gap-1">
                        {(['yes', 'no', 'na'] as YesNoNa[]).map((a) => (
                          <button
                            key={a}
                            disabled={signed}
                            onClick={() => void setAnswer(item, a)}
                            aria-label={`Marker som ${ANSWER_LABEL[a]}`}
                            aria-pressed={answer === a}
                            className={[
                              'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                              answer === a
                                ? a === 'yes'
                                  ? 'text-white'
                                  : a === 'no'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-neutral-600 text-white'
                                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
                            ].join(' ')}
                            style={
                              answer === a && a === 'yes' ? { backgroundColor: brandAccent } : undefined
                            }
                          >
                            {ANSWER_LABEL[a]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Item-type fallback — keep the wizard usable when a future
                      walkthrough adds text/number/photo/signature/date items. */}
                  {item.type !== 'yes_no_na' && !notApplicable && (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs text-amber-900">
                      Denne posten har type «{item.type}» som krever standard sjekklistevisning.
                      <button
                        type="button"
                        className="ml-1 underline"
                        onClick={() => navigate(`/compliance/checklists/${executionId}`)}
                      >
                        Åpne standardvisning
                      </button>
                    </div>
                  )}

                  {/* Severity (only when 'no' + applicable) */}
                  {!notApplicable && answer === 'no' && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-neutral-600">Alvorlighetsgrad:</span>
                      {SEVERITIES.map((sev) => (
                        <button
                          key={sev}
                          disabled={signed}
                          onClick={() => void setSeverity(item, sev)}
                          aria-label={`Sett alvorlighetsgrad til ${sev}`}
                          aria-pressed={response?.severity === sev}
                          className={[
                            'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                            response?.severity === sev
                              ? 'ring-2 ring-offset-1 ring-amber-400'
                              : 'opacity-60 hover:opacity-100',
                          ].join(' ')}
                        >
                          <SeverityBadge severity={sev} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Comment + create-task + thread */}
                  {!notApplicable && (answer === 'no' || (commentDraft ?? '').length > 0) && (
                    <div className="mt-2">
                      <StandardTextarea
                        value={commentDraft}
                        onChange={(e) => updateDraft(item.key, e.target.value)}
                        onBlur={() => void commitComment(item)}
                        placeholder="Beskriv hva som mangler / hva som er gjort…"
                        rows={2}
                        disabled={signed}
                      />
                    </div>
                  )}

                  {!notApplicable && (
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedThreadKey(showThread ? null : item.key)}
                      >
                        <MessageCircle className="mr-1 h-3.5 w-3.5" />
                        {showThread
                          ? 'Skjul diskusjon'
                          : itemComments.length > 0
                            ? `Diskusjon (${itemComments.length})`
                            : 'Diskusjon'}
                      </Button>
                      {!signed && (answer === 'no' || answer === 'na') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTaskPanelKey(showTaskPanel ? null : item.key)}
                        >
                          <ListPlus className="mr-1 h-3.5 w-3.5" />
                          {showTaskPanel ? 'Skjul' : 'Opprett oppgave'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Per-item comment thread — full @mention + threaded reuse
                      of the same component the standard execution page uses. */}
                  {showThread && executionId && (
                    <div className="mt-2 rounded-md border border-neutral-200 bg-white p-2">
                      <ExecutionCommentThread
                        executionId={executionId}
                        itemKey={item.key}
                        currentUserId={currentUserId}
                        comments={itemComments}
                        members={orgSetup.members}
                        onLoad={() => loadComments(executionId)}
                        onAdd={addComment}
                        onUpdate={updateComment}
                        onDelete={deleteComment}
                      />
                    </div>
                  )}

                  {showTaskPanel && executionId && (
                    <CreateTaskFromItemPanel
                      item={item}
                      executionId={executionId}
                      pack={template.pack}
                      assignableUsers={assignableUsers}
                      onCreated={(taskId) => void appendTaskAuditLine(item, taskId)}
                      onClose={() => setTaskPanelKey(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Navigation */}
          <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-4">
            <Button
              variant="ghost"
              onClick={() => jumpTo(Math.max(0, safeStep - 1))}
              disabled={safeStep === 0}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Forrige
            </Button>

            <div className="text-xs text-neutral-500">
              Seksjon {safeStep + 1} av {sections.length}
            </div>

            {isLast ? (
              <Button
                variant="primary"
                onClick={() => void handleSign()}
                disabled={signed || overall.ans < overall.req}
                title={
                  overall.ans < overall.req
                    ? `Svar på ${overall.req - overall.ans} obligatoriske krav igjen før signering`
                    : undefined
                }
              >
                <ShieldCheck className="mr-1 h-4 w-4" />
                {signed ? 'Signert' : 'Signer gjennomgangen'}
              </Button>
            ) : (
              <Button onClick={() => jumpTo(Math.min(sections.length - 1, safeStep + 1))}>
                Neste
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </ModuleSectionCard>
      )}

      {signed && (
        <div className="mt-4">
          <InfoBox>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4" />
              Gjennomgangen er signert {execution.signed_at ? `den ${new Date(execution.signed_at).toLocaleDateString('nb-NO')}` : ''}. Svarene er låst.
            </span>
          </InfoBox>
        </div>
      )}
    </ModulePageShell>
  )
}

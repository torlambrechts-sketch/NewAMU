// ChecklistWalkthroughPage — generic sectioned wizard for any compliance
// checklist template that uses definition.sections[]. Today's AML
// fullgjennomgang is the first consumer; ISO 45001 fullgjennomgang and
// GDPR-walkthroughs will plug in by adding a template with sections[]
// and a matching pack slug. No code changes per template required.
//
// Hvorfor: Eksisterende ChecklistExecutionPage gjengir items[] som én lang
// liste — funksjonelt OK for små maler, men ubrukelig for 100+ posters
// gjennomganger. Denne siden leser definition.sections[] og navigerer én
// seksjon om gangen, med framdriftsindikator per kapittel og resume-state
// via compliance_wizard_runs (delt med Compliance Studio).
//
// Wizard-key-mønster: `compliance.{template.slug}.<execution_id>`.
// Sesjonstilstand (current_step + payload) er kun navigasjons-state;
// de faktiske svarene ligger som vanlig i compliance_checklist_responses.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock, Keyboard, ListPlus, Lock, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { ComplianceBanner } from '../../src/components/ui/ComplianceBanner'
import { Button } from '../../src/components/ui/Button'
import { Badge } from '../../src/components/ui/Badge'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { InfoBox, WarningBox } from '../../src/components/ui/AlertBox'
import { useActivePack } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useWizardRun } from '../../src/hooks/useWizardRun'
import { useChecklistModule } from './useChecklistModule'
import { useFreshArtefacts, lookupFresh, type FreshArtefactMap } from './useFreshArtefacts'
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

/**
 * Auto-mark — find a fresh signed artefact that resolves this item.
 *
 * Walks the item's resolutions[] in declaration order, returning the
 * first one for which the server-supplied freshArtefacts map has a
 * matching (kind, ref) entry. Server has already filtered by 12-month
 * cutoff so any hit is "fresh enough" by definition. Today's covered
 * kinds: checklist_template, document, learning. Register / meeting /
 * workflow / manual are intentionally skipped (no signed-at equivalent).
 */
type AutoMarkHit = {
  artefactLabel: string
  artefactType: 'checklist_template' | 'document' | 'learning' | 'meeting' | 'register'
  artefactId: string
  signedAt: string
}

// Resolution kinds the server-side fresh-artefacts RPC supports.
// Stays in sync with compliance_walkthrough_fresh_artefacts() branches.
const AUTO_MARK_KINDS = new Set(['checklist_template', 'document', 'learning', 'meeting', 'register'])

/** Verb the auto-mark chip uses per artefact kind — keeps the wording
 *  honest. Registers aren't "signed", they're "updated"; courses
 *  aren't "signed", they're "completed". */
const AUTO_MARK_VERB: Record<AutoMarkHit['artefactType'], string> = {
  checklist_template: 'signert',
  document: 'bekreftet',
  learning: 'fullført',
  meeting: 'signert protokoll',
  register: 'oppdatert',
}

function findFreshArtefact(
  item: ChecklistItem,
  freshArtefacts: FreshArtefactMap,
): AutoMarkHit | null {
  if (!item.resolutions) return null
  for (const res of item.resolutions) {
    if (!res.ref || !AUTO_MARK_KINDS.has(res.kind)) continue
    const hit = lookupFresh(freshArtefacts, res.kind, res.ref)
    if (!hit) continue
    return {
      artefactLabel: res.label ?? hit.label,
      artefactType: res.kind as AutoMarkHit['artefactType'],
      artefactId: hit.source_id,
      signedAt: hit.signed_at,
    }
  }
  return null
}

export function ChecklistWalkthroughPage() {
  const params = useParams<{ slug: string }>()
  // No default — slug must come from the URL. The hub routes templates
  // with definition.sections[] here; direct hits without a slug 404.
  const slug = params.slug ?? ''
  const navigate = useNavigate()
  const pack = useActivePack()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const {
    load,
    loading,
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

  // Org-wide map of fresh signed artefacts (checklist + document +
  // learning). Loaded once per page mount; refreshed when the wizard
  // signs the execution so the next walkthrough can pick up the new
  // signature.
  const freshArtefacts = useFreshArtefacts(12)

  // Tracks whether the first `load()` cycle has completed. Without this,
  // the auto-create-execution effect can fire against an empty
  // `executions` array (before the first fetch returns) and create a
  // duplicate draft alongside one already in the DB.
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  const [executionId, setExecutionId] = useState<string | null>(null)
  const [creatingExecution, setCreatingExecution] = useState(false)
  const [taskPanelKey, setTaskPanelKey] = useState<string | null>(null)
  const [expandedThreadKey, setExpandedThreadKey] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [draftsHydrated, setDraftsHydrated] = useState(false)
  /** Toast text shown briefly after a server save — purely visual feedback
   *  so the user trusts the auto-save (no spinner during the upsert). */
  const [savedToast, setSavedToast] = useState<string | null>(null)
  const savedToastTimer = useRef<number | null>(null)
  /** Container for the focusable items in the current section — used to
   *  move keyboard focus after navigation. */
  const sectionFirstFocusable = useRef<HTMLButtonElement | null>(null)

  const flashSaved = useCallback((label = 'Lagret') => {
    setSavedToast(label)
    if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current)
    savedToastTimer.current = window.setTimeout(() => setSavedToast(null), 1800)
  }, [])

  useEffect(() => {
    return () => {
      if (savedToastTimer.current) window.clearTimeout(savedToastTimer.current)
    }
  }, [])

  /** Brand-fargen til pakken — overstyr emerald-fallback for primær-CTA og progress-bar. */
  const brandAccent = useMemo(() => packAccentFor(pack.slug) ?? '#1a3d32', [pack.slug])

  useEffect(() => {
    void load().then(() => setInitialLoadComplete(true))
  }, [load])

  const template = useMemo(
    () => templates.find((t) => t.slug === slug && t.is_active) ?? null,
    [templates, slug],
  )

  // Pick or create draft execution for this user × template. The
  // `initialLoadComplete` guard prevents a race where the effect fires
  // against an empty `executions` array (before load() returns) and
  // creates a duplicate draft alongside one that already exists in DB.
  useEffect(() => {
    if (!initialLoadComplete || loading) return
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
  }, [initialLoadComplete, loading, template, executions, executionId, creatingExecution, createExecution])

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

  // Total step count = real sections + one virtual "Oppsummering" step
  // appended after the last section. The summary surfaces a section-by-
  // section status table, finding count and the sign button — gives the
  // user a deliberate review checkpoint before locking the execution.
  const totalSteps = sections.length + 1
  const summaryStep = sections.length
  const currentStep = wizardRun.run?.current_step ?? 0
  const safeStep = Math.min(Math.max(0, currentStep), Math.max(0, totalSteps - 1))
  const onSummary = safeStep === summaryStep
  const section = onSummary ? null : sections[safeStep] ?? null
  const isLastSection = safeStep === sections.length - 1

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

  // Move keyboard focus into the new section's body when the step changes.
  // Helps screen-reader + power-user keyboard navigation feel intentional.
  useEffect(() => {
    const t = window.setTimeout(() => {
      sectionFirstFocusable.current?.focus({ preventScroll: false })
    }, 50)
    return () => window.clearTimeout(t)
  }, [safeStep])

  // Y/N/A keyboard shortcuts. When a focused element has data-item-key,
  // pressing 'y'/'n'/'a' triggers the matching answer on that item.
  // Skipped if the user is typing in a form field (textareas, inputs).
  useEffect(() => {
    const isSigned = execution?.status === 'signed'
    if (isSigned || !section) return
    function isEditableTarget(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false
      if (t.isContentEditable) return true
      const tag = t.tagName.toLowerCase()
      return tag === 'textarea' || tag === 'input' || tag === 'select'
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditableTarget(document.activeElement)) return
      const k = e.key.toLowerCase()
      const map: Record<string, YesNoNa> = { y: 'yes', j: 'yes', n: 'no', a: 'na', i: 'na' }
      const answer = map[k]
      if (!answer) return
      const focused = document.activeElement as HTMLElement | null
      const itemKey = focused?.closest<HTMLElement>('[data-item-key]')?.dataset.itemKey
      if (!itemKey) return
      const item = section?.items.find((it) => it.key === itemKey)
      if (!item || item.type !== 'yes_no_na') return
      const applic = applicabilityFor(item, execution?.metadata)
      if (applic.state === 'not_applicable') return
      e.preventDefault()
      void setAnswer(item, answer)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execution?.status, section, execution?.metadata])

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
    flashSaved()
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
    flashSaved()
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
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(draftStorageKey(executionId, item.key))
    }
    flashSaved('Kommentar lagret')
  }

  /** Bulk-mark every still-unanswered (and applicable) item in the
   *  current section as Ikke aktuelt. Used when an org confirms a whole
   *  chapter doesn't apply (e.g. no innleie → all of kap. 14A is N/A). */
  async function markSectionNotApplicable(section: ChecklistSection) {
    if (!executionId || execution?.status === 'signed') return
    const ok = window.confirm(
      `Marker alle ubesvarte krav i «${section.title}» som Ikke aktuelt? Du kan endre svar enkeltvis etterpå.`,
    )
    if (!ok) return
    const meta = execution?.metadata ?? null
    const answeredKeys = new Set(responses.map((r) => r.item_key))
    for (const item of section.items) {
      if (answeredKeys.has(item.key)) continue
      if (applicabilityFor(item, meta).state === 'not_applicable') continue
      if (item.type !== 'yes_no_na') continue
      await saveResponse({
        executionId,
        itemKey: item.key,
        value: { ok: null },
        comment: `[${new Date().toLocaleDateString('nb-NO')}] Bulk-markert som ikke aktuelt for seksjon`,
      })
    }
    flashSaved(`Seksjon markert (${section.items.length} krav)`)
  }

  /** Accept an auto-mark suggestion — sets answer to "yes" and writes a
   *  provenance comment with the source artefact's id + sign timestamp. */
  async function acceptAutoMark(item: ChecklistItem, hit: AutoMarkHit) {
    if (!executionId || execution?.status === 'signed') return
    const existing = responses.find((r) => r.item_key === item.key)
    const verb = AUTO_MARK_VERB[hit.artefactType] ?? 'oppdatert'
    const provenance = `[${new Date().toLocaleDateString('nb-NO')}] Autodekket fra ${verb} ${hit.artefactLabel} (${new Date(hit.signedAt).toLocaleDateString('nb-NO')})`
    const nextComment = existing?.comment ? `${existing.comment}\n${provenance}` : provenance
    await saveResponse({
      executionId,
      itemKey: item.key,
      value: { ok: true },
      comment: nextComment,
      severity: existing?.severity ?? undefined,
    })
    flashSaved('Autodekket')
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
    // Refresh the fresh-artefacts map so the next walkthrough in this
    // org picks up the new signature without a page reload.
    void freshArtefacts.reload()
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

  // Banner text is template-driven so this page works for any pack
  // (AML, ISO 45001, GDPR, …). Falls back to a neutral pack label when
  // the template doesn't ship a description of its own.
  const bannerTitle = pack.shortName
    ? `Forankret i ${pack.pluralLabel ?? pack.shortName}`
    : 'Forankret i regelverket'
  const bannerBody =
    template.description ??
    'Seksjonsbasert veiviser som kryssreferer sjekklister, dokumenter, registre, kurs og møter i pakken. Signert gjennomgang fryser svarene og gir et revisorklart spor.'

  return (
    <ModulePageShell
      title={template.name}
      description="Seksjonsbasert veiviser. Roller og terskler fylles inn først; videre seksjoner viser bare krav som er pålagt for din organisasjon. Sesjonen lagres automatisk og kan fortsettes senere."
      breadcrumb={breadcrumb}
    >
      <ComplianceBanner title={bannerTitle} className="mb-4 rounded-xl">
        {bannerBody}
      </ComplianceBanner>
      {/* Overall progress strip — sticky so the user always sees position +
          completion while scrolling a long section. Background is the same
          cream as ModulePageShell so it visually merges with the page band. */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-y border-neutral-200 bg-[#F9F7F2]/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-neutral-800">
            Framdrift: {overall.ans} / {overall.req} obligatoriske svar
          </div>
          <div className="flex items-center gap-2">
            {savedToast && (
              <span
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                role="status"
                aria-live="polite"
              >
                {savedToast}
              </span>
            )}
            <Badge variant={signed ? 'signed' : overall.percent >= 100 ? 'active' : 'draft'}>
              {signed ? 'Signert' : `${overall.percent}%`}
            </Badge>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full transition-all"
            style={{ width: `${overall.percent}%`, backgroundColor: brandAccent }}
          />
        </div>

        {/* Section dots — horizontal scroll on small screens so 22 dots
            never wrap to 4 rows on a phone. scroll-snap keeps each chip
            cleanly aligned when swiping. */}
        <div
          className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible"
          role="tablist"
          aria-label="Seksjoner"
        >
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
                role="tab"
                className={[
                  'inline-flex h-7 shrink-0 snap-start items-center gap-1 rounded-full px-2 text-xs transition-colors',
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
          {/* Summary step dot — always last, no completion math. */}
          <button
            onClick={() => jumpTo(summaryStep)}
            disabled={signed}
            aria-label="Gå til oppsummering og signering"
            aria-current={onSummary ? 'step' : undefined}
            role="tab"
            className={[
              'inline-flex h-7 shrink-0 snap-start items-center gap-1 rounded-full px-2 text-xs transition-colors',
              onSummary
                ? 'text-white'
                : 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
            ].join(' ')}
            style={onSummary ? { backgroundColor: brandAccent } : undefined}
          >
            <ShieldCheck className="h-3 w-3" />
            <span>Signer</span>
          </button>
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
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">{section.title}</h2>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              {section.chapter && <span>{section.chapter}</span>}
              <span>{section.items.length} krav</span>
              {section.estimatedMinutes ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden />
                  ~{section.estimatedMinutes} min
                </span>
              ) : null}
            </div>
          </div>
          {!signed && section.items.some((i) => i.type === 'yes_no_na') && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <Keyboard className="h-3 w-3" aria-hidden />
                Tastatur: <kbd className="rounded border border-neutral-300 bg-neutral-50 px-1">Y</kbd> i orden ·
                <kbd className="ml-1 rounded border border-neutral-300 bg-neutral-50 px-1">N</kbd> mangler ·
                <kbd className="ml-1 rounded border border-neutral-300 bg-neutral-50 px-1">A</kbd> ikke aktuelt
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void markSectionNotApplicable(section)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Marker hele seksjonen som ikke aktuelt
              </Button>
            </div>
          )}
          {section.intro && (
            <div className="mt-3">
              <InfoBox>{section.intro}</InfoBox>
            </div>
          )}

          <div className="space-y-3">
            {section.items.map((item, itemIdx) => {
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
              // First answer button in the section gets the focus ref so the
              // section-change effect can move keyboard focus there.
              const isFirstFocusable = itemIdx === 0 && item.type === 'yes_no_na' && !notApplicable
              // Auto-mark: only show suggestion when the item is still
              // unanswered AND applicable AND we have a fresh signed source.
              const autoMarkHit =
                !notApplicable && !response
                  ? findFreshArtefact(item, freshArtefacts.map)
                  : null

              return (
                <div
                  key={item.key}
                  data-item-key={item.key}
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
                      {autoMarkHit && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-2 py-1.5 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-emerald-900">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden />
                            Forslag fra {AUTO_MARK_VERB[autoMarkHit.artefactType] ?? 'oppdatert'} {autoMarkHit.artefactLabel} ({new Date(autoMarkHit.signedAt).toLocaleDateString('nb-NO')})
                          </span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => void acceptAutoMark(item, autoMarkHit)}
                          >
                            Bekreft som dekket
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Answer buttons — only for yes_no_na items (today's AML
                        template is entirely yes_no_na; future templates that
                        use other types fall through to a placeholder below). */}
                    {item.type === 'yes_no_na' && !notApplicable && (
                      <div className="flex shrink-0 gap-1">
                        {(['yes', 'no', 'na'] as YesNoNa[]).map((a, ai) => (
                          <button
                            key={a}
                            ref={isFirstFocusable && ai === 0 ? sectionFirstFocusable : undefined}
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

            <Button
              onClick={() =>
                jumpTo(isLastSection ? summaryStep : Math.min(summaryStep, safeStep + 1))
              }
            >
              {isLastSection ? 'Til oppsummering' : 'Neste'}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </ModuleSectionCard>
      )}

      {/* Summary + sign step (virtual section after the last real one) */}
      {onSummary && (
        <ModuleSectionCard className="p-5 md:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">Oppsummering og signering</h2>
            <Badge variant={signed ? 'signed' : overall.percent >= 100 ? 'active' : 'draft'}>
              {signed ? 'Signert' : `${overall.ans} / ${overall.req} besvart`}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            Gå gjennom statusen per kapittel før signering. Etter signering
            låses alle svar og kan ikke endres — opprett gjerne oppfølgings­oppgaver
            fra seksjonene først.
          </p>

          {/* Critical finding callout (any 'critical' severity response). */}
          {(() => {
            const crit = responses.filter((r) => r.severity === 'critical').length
            return crit > 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50/60 p-3 text-sm text-red-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>{crit} kritisk{crit === 1 ? 't' : 'e'} funn</strong> er
                  registrert. Vurder å opprette oppgaver før du signerer.
                </span>
              </div>
            ) : null
          })()}

          <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
            {sections.map((s, i) => {
              const { answered, required } = sectionProgress(s, responses, execution.metadata)
              const complete = required > 0 && answered >= required
              const noneRequired = required === 0
              return (
                <li
                  key={s.key}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    className="flex flex-1 items-center gap-2 text-left hover:underline"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">
                      {i + 1}
                    </span>
                    <span className="font-medium text-neutral-900">{s.title}</span>
                    {s.chapter && (
                      <span className="text-xs text-neutral-500">· {s.chapter}</span>
                    )}
                  </button>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-neutral-500">
                      {answered} / {required}
                    </span>
                    {noneRequired ? (
                      <Badge variant="neutral">Ingen pålagte</Badge>
                    ) : complete ? (
                      <Badge variant="success">Ferdig gjennomgått</Badge>
                    ) : (
                      <Badge variant="warning">Uferdig</Badge>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-neutral-200 pt-4">
            <Button
              variant="ghost"
              onClick={() => jumpTo(Math.max(0, summaryStep - 1))}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Tilbake til siste seksjon
            </Button>

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

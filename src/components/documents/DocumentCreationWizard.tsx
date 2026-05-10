// DocumentCreationWizard — multi-step modal that fires when a user creates a
// document from a template. For policy-type templates it collects org data,
// sector risks, and HMS-mål before creating; for all other templates it shows
// only the space-selector step. Token resolution ({{orgName}} etc.) and
// conditional block injection happen here before createPage is called.
//
// The WizardShell exported below is intentionally module-agnostic so it can
// be reused by the tasks, survey, or compliance modules without modification.

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'
import { useOrganisation } from '../../hooks/useOrganisation'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { formatBrregAddress } from '../../lib/brreg'
import type { BrregEnhet } from '../../types/brreg'
import type { ContentBlock, PageTemplate, WikiSpace } from '../../types/documents'
import { naceToSectorPreset } from '../../lib/documents/naceToSectorPreset'
import { resolveTemplateTokens, type TemplateContext } from '../../lib/documents/templateTokens'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'

// ─── WizardShell ──────────────────────────────────────────────────────────────
// Generic reusable wizard modal — handles layout, progress, navigation, and
// async submit. Steps render their own content via `children`.

export type WizardShellStep = {
  id: string
  label: string
  icon?: string
}

export type WizardShellProps = {
  open: boolean
  onClose: () => void
  title: string
  accent?: string   // Tailwind colour prefix, e.g. 'teal' or 'neutral'
  steps: WizardShellStep[]
  currentStep: number
  onBack: () => void
  onNext: () => void
  nextLabel?: string
  isLastStep: boolean
  canAdvance?: boolean
  busy?: boolean
  error?: string | null
  children: React.ReactNode
}

const SHELL_ACCENT = {
  teal:    { header: 'bg-teal-50',    text: 'text-teal-700',    btn: 'bg-teal-700 hover:bg-teal-800',    prog: 'bg-teal-600' },
  neutral: { header: 'bg-neutral-50', text: 'text-neutral-600', btn: 'bg-[#1a3d32] hover:bg-[#142e26]', prog: 'bg-[#1a3d32]' },
} as const

type AccentKey = keyof typeof SHELL_ACCENT

export function WizardShell({
  open,
  onClose,
  title,
  accent = 'neutral',
  steps,
  currentStep,
  onBack,
  onNext,
  nextLabel,
  isLastStep,
  canAdvance = true,
  busy = false,
  error,
  children,
}: WizardShellProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const a = SHELL_ACCENT[(accent as AccentKey) ?? 'neutral'] ?? SHELL_ACCENT.neutral
  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className={`shrink-0 px-6 pb-4 pt-5 ${a.header}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                {step?.icon && <span className="text-xl">{step.icon}</span>}
                <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
              </div>
              <p className={`mt-0.5 text-sm font-medium ${a.text}`}>{step?.label}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-black/5 hover:text-neutral-700 transition-colors"
              aria-label="Lukk"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex gap-1">
                {steps.map((s, i) => (
                  <div
                    key={s.id}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentStep ? `w-6 ${a.prog}` :
                      i < currentStep  ? `w-3 ${a.prog} opacity-50` :
                      'w-3 bg-neutral-200'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-neutral-500">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${a.prog}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {children}
          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t border-neutral-100 px-6 py-4 bg-neutral-50/80">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
              Tilbake
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              Avbryt
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={busy || !canAdvance}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${a.btn}`}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Oppretter…
              </span>
            ) : isLastStep ? (
              <>
                <CheckCircle2 className="size-4" />
                {nextLabel ?? 'Opprett dokument'}
              </>
            ) : (
              <>
                Neste
                <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DocumentCreationWizard ───────────────────────────────────────────────────

type CreateOpts = {
  legalRefs?: string[]
  requiresAcknowledgement?: boolean
  summary?: string
  revisionIntervalMonths?: number
  templateId?: string
}

export type DocumentCreationWizardProps = {
  open: boolean
  onClose: () => void
  template: PageTemplate | null
  documentFolders: WikiSpace[]
  defaultDocumentSpaceId: string
  onCreate: (spaceId: string, blocks: ContentBlock[], opts: CreateOpts) => Promise<{ id: string }>
  onCreated: (pageId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToNorwegian(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d ?? '??'}.${m ?? '??'}.${y ?? '????'}`
}

function addMonthsToIso(iso: string, months: number): string {
  if (!iso) return iso
  const d = new Date(iso)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Step components ──────────────────────────────────────────────────────────

type FieldRowProps = {
  label: string
  hint?: string
  children: React.ReactNode
}

function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800">{label}</label>
      {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

const INPUT_CLS =
  'w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent transition-shadow'

type OrgInfoValues = {
  orgName: string
  employeeCount: string
  hasBht: boolean
  hasCollectiveAgreement: boolean
  collectiveAgreementName: string
}

function StepOrgInfo({
  values,
  onChange,
  naceBeskrivelse,
}: {
  values: OrgInfoValues
  onChange: (patch: Partial<OrgInfoValues>) => void
  naceBeskrivelse: string
}) {
  return (
    <>
      <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        Vi har forhåndsutfylt feltene fra din virksomhetsprofil. Korriger ved behov — verdiene brukes i HMS-policyen.
      </div>
      <FieldRow label="Virksomhetens navn" hint="Vil erstatte {{orgName}} gjennom hele dokumentet">
        <input
          type="text"
          className={INPUT_CLS}
          value={values.orgName}
          onChange={(e) => onChange({ orgName: e.target.value })}
          placeholder="F.eks. Klarert AS"
        />
      </FieldRow>
      <FieldRow label="Antall ansatte" hint="Avgjør om AMU-tekst inkluderes (påkrevd ved ≥ 30)">
        <input
          type="number"
          className={INPUT_CLS}
          value={values.employeeCount}
          onChange={(e) => onChange({ employeeCount: e.target.value })}
          min="0"
          placeholder="0"
        />
      </FieldRow>
      {naceBeskrivelse ? (
        <div>
          <p className="text-xs font-medium text-neutral-500">Bransje (NACE)</p>
          <p className="mt-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-700">
            {naceBeskrivelse}
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">Hentet fra Enhetsregisteret — brukes til å foreslå relevante risikoer i neste steg.</p>
        </div>
      ) : null}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 hover:bg-neutral-50 transition-colors">
        <input
          type="checkbox"
          checked={values.hasBht}
          onChange={(e) => onChange({ hasBht: e.target.checked })}
          className="mt-0.5 size-4 rounded border-neutral-300"
          style={{ accentColor: '#0f766e' }}
        />
        <div>
          <span className="text-sm font-medium text-neutral-900">Tilknyttet bedriftshelsetjeneste (BHT)</span>
          <p className="text-xs text-neutral-500 mt-0.5">AML §3-3 — kreves i en rekke bransjer. Legger til BHT-avsnitt i policyen.</p>
        </div>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 hover:bg-neutral-50 transition-colors">
        <input
          type="checkbox"
          checked={values.hasCollectiveAgreement}
          onChange={(e) => onChange({ hasCollectiveAgreement: e.target.checked })}
          className="mt-0.5 size-4 rounded border-neutral-300"
          style={{ accentColor: '#0f766e' }}
        />
        <div>
          <span className="text-sm font-medium text-neutral-900">Tariffbundet virksomhet</span>
          <p className="text-xs text-neutral-500 mt-0.5">Legger til avsnitt om tillitsvalgte og tariffavtalens rolle i HMS-arbeidet.</p>
        </div>
      </label>
      {values.hasCollectiveAgreement && (
        <FieldRow label="Tariffavtale (navn)" hint="Valgfritt — f.eks. «LO/NHO Fellesoverenskomsten»">
          <input
            type="text"
            className={INPUT_CLS}
            value={values.collectiveAgreementName}
            onChange={(e) => onChange({ collectiveAgreementName: e.target.value })}
            placeholder="F.eks. LO/NHO Fellesoverenskomsten"
          />
        </FieldRow>
      )}
    </>
  )
}

type RiskValues = { selectedRisks: string[] }

function StepRisks({
  preset,
  values,
  onChange,
}: {
  preset: ReturnType<typeof naceToSectorPreset>
  values: RiskValues
  onChange: (patch: Partial<RiskValues>) => void
}) {
  function toggle(id: string, checked: boolean) {
    const next = checked
      ? [...values.selectedRisks, id]
      : values.selectedRisks.filter((r) => r !== id)
    onChange({ selectedRisks: next })
  }

  return (
    <>
      <p className="text-sm text-neutral-600">
        Velg de arbeidsmiljørisikoene som er relevante for din virksomhet. Disse vil beskrives i HMS-policyen som bransjespesifikke fokusområder.
      </p>
      <div className="space-y-2">
        {preset.risks.map((risk) => (
          <label
            key={risk.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 px-3.5 py-3 hover:bg-neutral-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={values.selectedRisks.includes(risk.id)}
              onChange={(e) => toggle(risk.id, e.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-neutral-300"
              style={{ accentColor: '#0f766e' }}
            />
            <div className="min-w-0">
              <span className="text-sm font-medium text-neutral-900">{risk.label}</span>
              <p className="text-xs text-neutral-500 mt-0.5">{risk.description}</p>
            </div>
          </label>
        ))}
      </div>
      {values.selectedRisks.length === 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Anbefalt: velg minst én risikofaktor slik at policyen inneholder bransjespesifikt innhold.
        </p>
      )}
    </>
  )
}

type GoalsValues = {
  sykefraværMål: string
  avvikFrist: string
  approverName: string
  policyDate: string
  nextRevisionDate: string
  amuDate: string
}

function StepGoals({
  values,
  onChange,
  employeeCount,
  approverOptions,
}: {
  values: GoalsValues
  onChange: (patch: Partial<GoalsValues>) => void
  employeeCount: number
  approverOptions: SelectOption[]
}) {
  const requiresAmu = employeeCount >= 30

  return (
    <>
      <FieldRow
        label="Sykefraværsmål (%)"
        hint="Mål for maksimalt sykefravær — typisk 3–7 % avhengig av bransje"
      >
        <input
          type="number"
          className={INPUT_CLS}
          value={values.sykefraværMål}
          onChange={(e) => onChange({ sykefraværMål: e.target.value })}
          min="1"
          max="20"
          step="0.5"
          placeholder="4"
        />
      </FieldRow>
      <FieldRow
        label="Frist for avviksbehandling (dager)"
        hint="Mål for lukking av avvik — typisk 7–21 dager"
      >
        <input
          type="number"
          className={INPUT_CLS}
          value={values.avvikFrist}
          onChange={(e) => onChange({ avvikFrist: e.target.value })}
          min="1"
          max="90"
          placeholder="14"
        />
      </FieldRow>
      <FieldRow
        label="Vedtatt av (daglig leder)"
        hint="Navn som skrives under policyen som formell godkjenner"
      >
        {approverOptions.length > 1 ? (
          <SearchableSelect
            value={values.approverName}
            options={approverOptions}
            onChange={(v) => onChange({ approverName: v })}
            placeholder="Velg person…"
          />
        ) : (
          <input
            type="text"
            className={INPUT_CLS}
            value={values.approverName}
            onChange={(e) => onChange({ approverName: e.target.value })}
            placeholder="F.eks. Kari Nordmann"
          />
        )}
      </FieldRow>
      <FieldRow label="Dato vedtatt">
        <input
          type="date"
          className={INPUT_CLS}
          value={values.policyDate}
          onChange={(e) => {
            const d = e.target.value
            onChange({
              policyDate: d,
              nextRevisionDate: d ? addMonthsToIso(d, 12) : values.nextRevisionDate,
            })
          }}
        />
      </FieldRow>
      <FieldRow label="Neste revisjon">
        <input
          type="date"
          className={INPUT_CLS}
          value={values.nextRevisionDate}
          onChange={(e) => onChange({ nextRevisionDate: e.target.value })}
        />
      </FieldRow>
      {requiresAmu && (
        <FieldRow
          label="Behandlet i AMU — dato"
          hint="AML §7-2: HMS-policy skal behandles i AMU for virksomheter med ≥ 30 ansatte"
        >
          <input
            type="date"
            className={INPUT_CLS}
            value={values.amuDate}
            onChange={(e) => onChange({ amuDate: e.target.value })}
          />
        </FieldRow>
      )}
    </>
  )
}

type SpaceValues = { spaceId: string }

function StepSpace({
  values,
  onChange,
  documentFolders,
  defaultDocumentSpaceId,
}: {
  values: SpaceValues
  onChange: (patch: Partial<SpaceValues>) => void
  documentFolders: WikiSpace[]
  defaultDocumentSpaceId: string
}) {
  const spaceOptions: SelectOption[] = [
    { value: '', label: 'Hoved (dokumenter)' },
    ...documentFolders.map((s) => ({ value: s.id, label: s.title })),
  ]

  if (!defaultDocumentSpaceId) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Opprett en dokumentmappe under Dokumenter før du kan opprette dokumenter fra maler.
      </div>
    )
  }

  return (
    <>
      <p className="text-sm text-neutral-600">
        Velg hvilken mappe det ferdige dokumentet skal plasseres i. Du kan flytte det senere.
      </p>
      <FieldRow label="Plasser dokument i">
        <SearchableSelect
          value={values.spaceId}
          options={spaceOptions}
          onChange={(v) => onChange({ spaceId: v })}
        />
      </FieldRow>
      <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
        Dokumentet opprettes som utkast. Du kan redigere innholdet og publisere det når det er klart.
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentCreationWizard({
  open,
  onClose,
  template,
  documentFolders,
  defaultDocumentSpaceId,
  onCreate,
  onCreated,
}: DocumentCreationWizardProps) {
  const org = useOrganisation()
  const { organization } = useOrgSetupContext()

  const isPolicy = template?.page.template === 'policy'

  // Derive org defaults from settings + brreg snapshot
  const brreg = organization?.brreg_snapshot as BrregEnhet | null | undefined
  const naceBeskrivelse =
    org.settings.brregNaceBeskrivelse ??
    brreg?.naeringskode1?.beskrivelse ??
    org.settings.industrySector ??
    ''
  const naceKode =
    org.settings.brregNaceKode ?? brreg?.naeringskode1?.kode ?? ''
  const preset = naceToSectorPreset(naceKode)

  // ── Wizard values ──────────────────────────────────────────────────────────

  const today = todayIso()
  const nextYear = addMonthsToIso(today, 12)

  const [orgInfo, setOrgInfo] = useState<OrgInfoValues>({
    orgName: org.settings.orgName,
    employeeCount: String(org.complianceThresholds.totalEmployeeCount || org.settings.employeeCount || 0),
    hasBht: preset.bhtPliktig,
    hasCollectiveAgreement: org.settings.hasCollectiveAgreement,
    collectiveAgreementName: org.settings.collectiveAgreementName ?? '',
  })

  const [risks, setRisks] = useState<RiskValues>({
    selectedRisks: preset.risks.filter((r) => r.defaultSelected).map((r) => r.id),
  })

  const [goals, setGoals] = useState<GoalsValues>({
    sykefraværMål: preset.sykefraværDefault,
    avvikFrist: preset.avvikFristDefault,
    approverName: '',
    policyDate: today,
    nextRevisionDate: nextYear,
    amuDate: '',
  })

  const [space, setSpace] = useState<SpaceValues>({ spaceId: '' })

  // Reset when template or org data changes
  useEffect(() => {
    if (!open) return
    setOrgInfo({
      orgName: org.settings.orgName,
      employeeCount: String(org.complianceThresholds.totalEmployeeCount || org.settings.employeeCount || 0),
      hasBht: preset.bhtPliktig,
      hasCollectiveAgreement: org.settings.hasCollectiveAgreement,
      collectiveAgreementName: org.settings.collectiveAgreementName ?? '',
    })
    setRisks({
      selectedRisks: preset.risks.filter((r) => r.defaultSelected).map((r) => r.id),
    })
    const t = todayIso()
    setGoals({
      sykefraværMål: preset.sykefraværDefault,
      avvikFrist: preset.avvikFristDefault,
      approverName: '',
      policyDate: t,
      nextRevisionDate: addMonthsToIso(t, 12),
      amuDate: '',
    })
    setSpace({ spaceId: '' })
    setStep(0)
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id])

  // ── Steps ─────────────────────────────────────────────────────────────────

  const POLICY_STEPS: WizardShellStep[] = [
    { id: 'org',    label: 'Virksomhetsinfo', icon: '🏢' },
    { id: 'risks',  label: 'Risikoprofil',    icon: '⚠️' },
    { id: 'goals',  label: 'Mål og godkjenning', icon: '🎯' },
    { id: 'space',  label: 'Velg plassering', icon: '📁' },
  ]
  const SIMPLE_STEPS: WizardShellStep[] = [
    { id: 'space', label: 'Velg plassering', icon: '📁' },
  ]
  const steps = isPolicy ? POLICY_STEPS : SIMPLE_STEPS

  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Approver options ───────────────────────────────────────────────────────

  const approverOptions: SelectOption[] = [
    { value: '', label: '— Skriv inn navn manuelt —' },
    ...org.activeEmployees
      .filter((e) => e.active)
      .map((e) => ({
        value: e.name,
        label: e.name + (e.jobTitle ? ` — ${e.jobTitle}` : ''),
      })),
  ]

  // ── Navigation ─────────────────────────────────────────────────────────────

  function validate(): string | null {
    if (isPolicy) {
      if (step === 0 && !orgInfo.orgName.trim()) return 'Fyll inn virksomhetens navn.'
      if (step === 2 && !goals.approverName.trim()) return 'Fyll inn navn på godkjenner (daglig leder).'
      if (step === 2 && !goals.policyDate) return 'Velg dato policyen ble vedtatt.'
    }
    if (step === steps.length - 1 && !defaultDocumentSpaceId) {
      return 'Opprett en dokumentmappe under Dokumenter først.'
    }
    return null
  }

  async function handleNext() {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)

    if (step < steps.length - 1) {
      setStep((s) => s + 1)
      return
    }

    // Last step — create the document
    if (!template) return
    setBusy(true)
    try {
      const resolvedBlocks = isPolicy
        ? resolveTemplateTokens(template.page.blocks, buildContext())
        : template.page.blocks

      const spaceId = space.spaceId || defaultDocumentSpaceId
      const page = await onCreate(spaceId, resolvedBlocks, {
        legalRefs: template.page.legalRefs,
        requiresAcknowledgement: template.page.requiresAcknowledgement,
        summary: template.page.summary,
        revisionIntervalMonths: template.page.revisionIntervalMonths,
        templateId: template.id,
      })
      onCreated(page.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette dokumentet. Prøv igjen.')
    } finally {
      setBusy(false)
    }
  }

  function buildContext(): TemplateContext {
    const employeeCount = parseInt(orgInfo.employeeCount, 10) || 0
    const address = brreg ? formatBrregAddress(brreg) : ''
    const orgNr =
      org.settings.orgNumber ??
      organization?.organization_number ??
      ''

    const selectedRiskItems = preset.risks.filter((r) =>
      risks.selectedRisks.includes(r.id)
    )

    return {
      orgName: orgInfo.orgName,
      orgNr,
      address,
      policyDate: isoToNorwegian(goals.policyDate),
      nextRevisionDate: isoToNorwegian(goals.nextRevisionDate),
      approverName: goals.approverName,
      approverTitle: 'Daglig leder',
      amuDate: goals.amuDate
        ? isoToNorwegian(goals.amuDate)
        : '[Dato ikke registrert — fyll inn etter AMU-behandling]',
      sykefraværMål: goals.sykefraværMål || preset.sykefraværDefault,
      avvikFrist: goals.avvikFrist || preset.avvikFristDefault,
      naceBeskrivelse,
      currentYear: String(new Date().getFullYear()),
      hasAmu: employeeCount >= 30,
      hasBht: orgInfo.hasBht,
      hasCollectiveAgreement: orgInfo.hasCollectiveAgreement,
      collectiveAgreementName: orgInfo.collectiveAgreementName,
      sectorRisks: selectedRiskItems.map((r) => r.label),
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentStepId = steps[step]?.id
  const employeeCount = parseInt(orgInfo.employeeCount, 10) || 0
  const canAdvance = step < steps.length - 1
    ? true
    : !!defaultDocumentSpaceId

  return (
    <WizardShell
      open={open}
      onClose={onClose}
      title={template?.label ?? 'Nytt dokument'}
      accent="neutral"
      steps={steps}
      currentStep={step}
      onBack={() => { setStep((s) => Math.max(0, s - 1)); setError(null) }}
      onNext={() => void handleNext()}
      isLastStep={step === steps.length - 1}
      canAdvance={canAdvance}
      busy={busy}
      error={error}
      nextLabel="Opprett dokument"
    >
      {/* Template description shown on first step */}
      {step === 0 && template?.description && (
        <div className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-neutral-400" />
          <p className="text-sm text-neutral-600">{template.description}</p>
        </div>
      )}

      {currentStepId === 'org' && (
        <StepOrgInfo
          values={orgInfo}
          onChange={(patch) => { setOrgInfo((v) => ({ ...v, ...patch })); setError(null) }}
          naceBeskrivelse={naceBeskrivelse}
        />
      )}

      {currentStepId === 'risks' && (
        <StepRisks
          preset={preset}
          values={risks}
          onChange={(patch) => { setRisks((v) => ({ ...v, ...patch })); setError(null) }}
        />
      )}

      {currentStepId === 'goals' && (
        <StepGoals
          values={goals}
          onChange={(patch) => { setGoals((v) => ({ ...v, ...patch })); setError(null) }}
          employeeCount={employeeCount}
          approverOptions={approverOptions}
        />
      )}

      {currentStepId === 'space' && (
        <StepSpace
          values={space}
          onChange={(patch) => { setSpace((v) => ({ ...v, ...patch })); setError(null) }}
          documentFolders={documentFolders}
          defaultDocumentSpaceId={defaultDocumentSpaceId}
        />
      )}
    </WizardShell>
  )
}

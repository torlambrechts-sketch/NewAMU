// CadenceWizard — sammensetning av step-indikator, summary-aside,
// step-views og footer-navigasjon.
//
// Designet replikerer /internkontroll-shellen: full bredde
// ModulePageShell rundt, tab-stripe over (Veiviser-tab er aktiv her),
// så et todelt grid med veiviser-trinn til venstre og summary aside
// til høyre. Sticky footer-bar med Forrige / Lagre / Neste.

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { StandardInput } from '../../../components/ui/Input'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useCadenceWizardState, canAdvance } from '../useCadenceWizardState'
import { CadenceStepIndicator, CadenceSummaryAside } from './CadenceWizardSteps'
import {
  Step1Regelverk,
  Step2Paragrafer,
  Step3Moduler,
  Step4Roller,
  Step5Frekvens,
  Step6Godkjenninger,
  Step7Eskalering,
  Step8Preview,
} from './CadenceWizardStepViews'

const STEP_NAMES: Record<number, string> = {
  1: 'Velg regelverk',
  2: 'Velg paragrafer',
  3: 'Velg moduler',
  4: 'Roller & ansvar',
  5: 'Frekvens per modul',
  6: 'Godkjenningskjeder',
  7: 'Eskalering & varsler',
  8: 'Forhåndsvis & iverksett',
}

export function CadenceWizard() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const wizard = useCadenceWizardState()
  const [showPlanNameEdit, setShowPlanNameEdit] = useState(false)
  const [activationResult, setActivationResult] = useState<{ planId: string; tasksCreated: number } | null>(null)

  const orgName = orgSetup.organization?.name ?? null
  const orgContext = (() => {
    const emp = (orgSetup.organization as { employee_count?: number | null } | null)?.employee_count
    const nace = (orgSetup.organization as { nace_code?: string | null } | null)?.nace_code
    const parts: string[] = []
    if (typeof emp === 'number' && emp > 0) parts.push(`${emp} ansatte`)
    if (nace) parts.push(`NACE ${nace}`)
    return parts.join(' · ') || null
  })()

  const handleAdvance = useCallback(async () => {
    if (!canAdvance(wizard.state)) return
    if (wizard.state.currentStep === 8) {
      const res = await wizard.activate()
      if (res) {
        setActivationResult(res)
      }
      return
    }
    wizard.goNext()
  }, [wizard])

  const handleSaveAndExit = useCallback(async () => {
    await wizard.saveDraft()
    navigate('/cadence?section=veiviser')
  }, [navigate, wizard])

  if (wizard.loadingDraft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#1a3d32]" aria-hidden />
      </div>
    )
  }

  const step = wizard.state.currentStep
  const isLast = step === 8
  const isActivated = wizard.activateStatus === 'activated'

  return (
    <div className="space-y-4">
      <CadenceStepIndicator state={wizard.state} onSelect={wizard.setStep} />

      {/* Plan-navn — vises som rediger-bar over første steg slik at brukeren
          kan navngi sin cadence før iverksettelse. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide text-neutral-500">
          Plan-navn
        </span>
        {showPlanNameEdit ? (
          <StandardInput
            value={wizard.state.planName}
            onChange={(e) => wizard.setPlanName(e.target.value)}
            onBlur={() => setShowPlanNameEdit(false)}
            autoFocus
            className="max-w-[300px] text-sm"
          />
        ) : (
          <Button
            variant="ghost"
            type="button"
            onClick={() => setShowPlanNameEdit(true)}
            className="h-auto px-1 py-0 text-sm font-medium text-neutral-900 hover:bg-transparent hover:underline"
          >
            {wizard.state.planName}
          </Button>
        )}
        <span className="ml-auto text-[11.5px] text-neutral-500">Steg {step}/8 · {STEP_NAMES[step]}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Step content */}
        <div className="min-w-0">
          {step === 1 && (
            <Step1Regelverk state={wizard.state} toggleRegelverk={wizard.toggleRegelverk} />
          )}
          {step === 2 && (
            <Step2Paragrafer
              state={wizard.state}
              toggleParagraph={wizard.toggleParagraph}
              toggleAllInChapter={wizard.toggleAllInChapter}
              selectAllRequired={wizard.selectAllRequired}
              clearParagraphs={wizard.clearParagraphs}
            />
          )}
          {step === 3 && (
            <Step3Moduler
              state={wizard.state}
              toggleModule={wizard.toggleModule}
              autoSelectRequiredModules={wizard.autoSelectRequiredModules}
              setModuleFilter={wizard.setModuleFilter}
            />
          )}
          {step === 4 && (
            <Step4Roller
              state={wizard.state}
              setRolePerson={wizard.setRolePerson}
              setRoleFallback={wizard.setRoleFallback}
              setRoleNote={wizard.setRoleNote}
              supabase={orgSetup.supabase}
              organizationId={orgSetup.organization?.id ?? null}
            />
          )}
          {step === 5 && (
            <Step5Frekvens state={wizard.state} setFrequency={wizard.setFrequency} />
          )}
          {step === 6 && <Step6Godkjenninger />}
          {step === 7 && <Step7Eskalering />}
          {step === 8 && (
            <Step8Preview
              state={wizard.state}
              activateStatus={wizard.activateStatus}
              activateError={wizard.activateError}
              activatedPlanId={activationResult?.planId ?? null}
              tasksCreated={activationResult?.tasksCreated ?? 0}
            />
          )}
        </div>

        {/* Summary aside */}
        <CadenceSummaryAside
          state={wizard.state}
          saveStatus={wizard.saveStatus}
          organizationName={orgName}
          organizationContext={orgContext}
        />
      </div>

      {/* Footer — sticky navigation */}
      <div className="sticky bottom-0 -mx-4 mt-2 flex flex-wrap items-center gap-3 border-t border-neutral-200 bg-[var(--ui-page)] px-4 py-3 md:-mx-8 md:px-8">
        <div className="text-[12.5px] text-neutral-500">
          Steg <strong className="font-semibold text-neutral-900">{step}</strong> av{' '}
          <strong className="font-semibold text-neutral-900">8</strong>
          {' · '}
          <span>{STEP_NAMES[step]}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {wizard.saveStatus === 'saving' && (
            <span className="text-[11.5px] text-neutral-500">
              <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden /> Lagrer …
            </span>
          )}
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={wizard.goPrev}>
              ← Forrige
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleSaveAndExit}>
            Lagre utkast
          </Button>
          {isActivated ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/tasks/management')}
            >
              Se opprettede oppgaver →
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdvance}
              disabled={!canAdvance(wizard.state) || wizard.activateStatus === 'activating'}
            >
              {wizard.activateStatus === 'activating' ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Iverksetter …
                </>
              ) : isLast ? (
                'Iverksett ✓'
              ) : (
                'Neste →'
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// StudioWizardLauncher — binder useWizardRun (persistens) til WizardModal.
//
// Tar inn en wizard-key og en factory som bygger en WizardDef. Når
// modal åpnes:
//   - lastes pågående payload + currentStep fra DB
//   - hver step-advance lagrer ny state (resumable)
//   - siste step kaller complete() som setter completed_at

import { useMemo } from 'react'
import { WizardModal } from '../../../components/wizard/WizardModal'
import type { WizardDef } from '../../../components/wizard/types'
import { useWizardRun, type WizardRunRow } from '../../../hooks/useWizardRun'

export type StudioWizardLauncherProps = {
  wizardKey: string
  open: boolean
  onClose: () => void
  /** Bygger WizardDef. Får completion-callback som lukker modal etter siste steg. */
  buildDef: (args: {
    onCompleted: (values: Record<string, string | boolean>) => void
    initialValues?: Record<string, string | boolean>
  }) => WizardDef
  /** Optional: kalles etter at run er markert complete (eks. for å reload status-kort). */
  onCompleted?: (run: WizardRunRow | null) => void
}

export function StudioWizardLauncher({
  wizardKey,
  open,
  onClose,
  buildDef,
  onCompleted,
}: StudioWizardLauncherProps) {
  const { run, loading, save, complete } = useWizardRun(wizardKey)

  const def = useMemo<WizardDef | null>(() => {
    if (!open) return null
    return buildDef({
      initialValues: run?.payload,
      onCompleted: async (values) => {
        const done = await complete(values)
        onCompleted?.(done)
        onClose()
      },
    })
  }, [open, buildDef, run?.payload, complete, onCompleted, onClose])

  if (!open || loading || !def) return null

  return (
    <WizardModal
      def={def}
      onClose={onClose}
      initialValues={run?.payload}
      initialStep={run?.completed_at ? 0 : run?.current_step}
      onStepChange={(nextStepIndex, values) => {
        // Ikke lagre når vi går forbi siste steg (complete tar over).
        if (nextStepIndex >= def.steps.length) return
        void save({ currentStep: nextStepIndex, payload: values })
      }}
    />
  )
}

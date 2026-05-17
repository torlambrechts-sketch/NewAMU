// WizardStepper — small horizontal stepper shared by the four gov-integration
// wizards (Altinn / Arbeidstilsynet / Datatilsynet / NAV). Keeps the look
// consistent across the four pages without pulling in the OnboardingWizard
// helpers (which assume an unauthenticated context). Renders a numbered
// pill row + step title + step description.

import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../../../components/ui/Button'

export type WizardStep = {
  id: string
  label: string
  description?: ReactNode
}

interface WizardStepperProps {
  steps: WizardStep[]
  activeIndex: number
  onSelect?: (index: number) => void
  className?: string
}

export function WizardStepper({ steps, activeIndex, onSelect, className }: WizardStepperProps) {
  return (
    <ol className={twMerge('flex flex-wrap items-center gap-2', className)} aria-label="Steg">
      {steps.map((step, i) => {
        const isActive = i === activeIndex
        const isDone = i < activeIndex
        const clickable = onSelect && i <= activeIndex
        return (
          <li key={step.id} className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={!clickable}
              onClick={() => clickable && onSelect?.(i)}
              aria-current={isActive ? 'step' : undefined}
              className={twMerge(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white hover:bg-[#1a3d32] hover:text-white'
                  : isDone
                    ? 'border-[#1a3d32]/30 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    : 'border-neutral-200 bg-white text-neutral-500 hover:bg-white',
                clickable ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={twMerge(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                  isActive
                    ? 'bg-white/20 text-white'
                    : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-100 text-neutral-600',
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span>{step.label}</span>
            </Button>
            {i < steps.length - 1 && <span className="h-px w-4 bg-neutral-300" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

// OnboardingVekst — multi-steg-veiviser i Vekst-stilen. Hvert steg
// kombinerer en illustrasjon på venstre side (tre, sol, skjold, eller
// custom) med tittel + body + ren content-slot på høyre. En liten
// fremdrifts-prikkrekke øverst og «Tilbake / Neste / Fullfør»-knapper
// i serif-typografi i bunnen.
//
// Bygd for førstegangsoppsett av Arbeidsmiljøstrategi, AMU-medlems-
// onboarding eller leder-introduksjon — alle tilfellene hvor en
// veiviser skal lese som en samtale, ikke et byråkratisk skjema.

import type { ReactNode } from 'react'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { VekstIllustration } from '../components/VekstIllustration'
import {
  MotifMedvirkning,
  MotifMestring,
  MotifTrivsel,
  MotifTrygghet,
} from '../components/AxisMotifs'
import type { WellbeingAxisKey } from '../dashboards/useWorkerWellbeingDatasets'

const SERIF = "'Libre Baskerville', Georgia, serif"

export type OnboardingVekstStep = {
  id: string
  eyebrow?: string
  title: string
  body?: ReactNode
  /** Either an axis motif or a custom React node. The big page hero illustration. */
  illustration?: WellbeingAxisKey | 'vekst' | ReactNode
  /** The form / inputs / content for this step. */
  content?: ReactNode
}

export type OnboardingVekstProps = {
  steps: OnboardingVekstStep[]
  onComplete?: () => void | Promise<void>
  /** Initial step index. Defaults to 0. */
  initialStep?: number
  /** Label for the final "done" button. Defaults to «Sett i gang». */
  doneLabel?: string
}

function renderIllustration(value: OnboardingVekstStep['illustration']): ReactNode {
  if (!value) return null
  if (value === 'vekst') return <VekstIllustration className="h-full w-full" />
  if (value === 'trygghet') return <MotifTrygghet className="h-full w-full" />
  if (value === 'trivsel') return <MotifTrivsel className="h-full w-full" />
  if (value === 'medvirkning') return <MotifMedvirkning className="h-full w-full" />
  if (value === 'mestring') return <MotifMestring className="h-full w-full" />
  return value
}

export function OnboardingVekst({
  steps,
  onComplete,
  initialStep = 0,
  doneLabel = 'Sett i gang',
}: OnboardingVekstProps) {
  const [stepIdx, setStepIdx] = useState(initialStep)
  const [completing, setCompleting] = useState(false)
  const step = steps[stepIdx]
  if (!step) return null
  const isLast = stepIdx === steps.length - 1
  const isFirst = stepIdx === 0

  const handleNext = async () => {
    if (isLast) {
      setCompleting(true)
      try {
        await onComplete?.()
      } finally {
        setCompleting(false)
      }
    } else {
      setStepIdx(stepIdx + 1)
    }
  }

  return (
    <div className="rounded-3xl border border-[#1a3d32]/15 bg-white p-8 shadow-[0_10px_30px_-18px_rgba(26,61,50,0.25)] sm:p-10">
      {/* Progress strip */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStepIdx(i)}
              aria-label={`Gå til steg ${i + 1}: ${s.title}`}
              className={`h-2.5 rounded-full transition-all ${
                i === stepIdx
                  ? 'w-10 bg-amber-500'
                  : i < stepIdx
                  ? 'w-2.5 bg-amber-300'
                  : 'w-2.5 bg-amber-100'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
          Steg {stepIdx + 1} av {steps.length}
        </span>
      </div>

      <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div className="order-2 lg:order-1">
          <div className="mx-auto flex aspect-square max-w-[280px] items-center justify-center rounded-3xl bg-[#FAF6EE] p-8">
            {renderIllustration(step.illustration)}
          </div>
        </div>

        <div className="order-1 space-y-5 lg:order-2">
          {step.eyebrow && (
            <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900">
              {step.eyebrow}
            </span>
          )}
          <h2
            className="text-3xl font-bold leading-tight text-[#1a3d32] sm:text-4xl"
            style={{ fontFamily: SERIF }}
          >
            {step.title}
          </h2>
          {step.body && (
            <div className="max-w-xl text-base leading-relaxed text-[#516760]">{step.body}</div>
          )}
          {step.content && <div className="pt-2">{step.content}</div>}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-amber-100 pt-6">
        <button
          type="button"
          onClick={() => setStepIdx(stepIdx - 1)}
          disabled={isFirst}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#1a3d32]/15 bg-white px-4 py-2 text-sm font-semibold text-[#1a3d32] transition-all hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: SERIF }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Tilbake
        </button>
        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={completing}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-amber-300 bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-10px_rgba(217,119,6,0.45)] transition-all hover:bg-amber-700 disabled:opacity-60"
          style={{ fontFamily: SERIF }}
        >
          {isLast ? (
            <>
              <Check className="h-4 w-4" aria-hidden /> {doneLabel}
            </>
          ) : (
            <>
              Neste <ArrowRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

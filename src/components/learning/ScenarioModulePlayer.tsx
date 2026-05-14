// ScenarioModulePlayer — renders a branching scenario module.
// Each step shows a prompt + 2-4 choices. Picking a choice reveals the
// feedback + impact score; the learner clicks "Neste" / "Se resultat" to
// advance. Running impact total is shown after the first pick so the
// learner gets formative feedback before the summary.

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ArrowRight, Scale, RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { MarkdownBody } from './MarkdownBody'
import { AML_LAW_REFS_CATALOG } from '../../lib/learning/amlLawRefsCatalog'
import type { ScenarioStep, ScenarioChoice } from '../../types/learning'

type Props = {
  intro?: string
  steps: ScenarioStep[]
  passingImpactScore?: number
  onComplete: () => void
}

export function ScenarioModulePlayer({ intro, steps, passingImpactScore = 0, onComplete }: Props) {
  const [stepIdx, setStepIdx] = useState(0)
  const [picks, setPicks] = useState<Record<string, ScenarioChoice>>({})
  // `done` is driven by the learner clicking "Se resultat" on the last step
  // rather than auto-flipping when the last choice is picked — so the
  // feedback for the final pick is always visible before the summary.
  const [done, setDone] = useState(false)

  const step = steps[stepIdx]
  const last = stepIdx >= steps.length - 1
  const picked = step ? picks[step.id] : undefined
  const totalScore = Object.values(picks).reduce((s, c) => s + c.impactScore, 0)
  const passed = totalScore >= passingImpactScore
  const picksCount = Object.keys(picks).length

  if (!step) return <p className="text-sm text-neutral-500">Ingen scenarier definert.</p>

  const reset = () => {
    setStepIdx(0)
    setPicks({})
    setDone(false)
  }

  return (
    <div className="space-y-5">
      {intro ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
          <MarkdownBody markdown={intro} />
        </div>
      ) : null}

      {/* progress dots — announced as a group with current step */}
      <div
        className="flex items-center justify-center gap-1.5"
        role="group"
        aria-label={`Scenario-fremdrift: situasjon ${stepIdx + 1} av ${steps.length}`}
      >
        {steps.map((s, i) => (
          <span
            key={s.id}
            aria-current={i === stepIdx ? 'step' : undefined}
            className={`h-1.5 rounded-full transition-all ${
              i === stepIdx ? 'w-6 bg-[#1a3d32]' : i < stepIdx ? 'w-3 bg-[#1a3d32]/50' : 'w-3 bg-neutral-200'
            }`}
          />
        ))}
      </div>

      {/* Running Impact Score — shown after the first pick if a threshold exists */}
      {picksCount > 0 && passingImpactScore > 0 && !done && (
        <div className="text-center text-xs text-neutral-600">
          Samlet Impact Score så langt:{' '}
          <strong className={totalScore >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {totalScore >= 0 ? '+' : ''}{totalScore}
          </strong>{' '}
          <span className="text-neutral-500">(krav for å bestå: {passingImpactScore})</span>
        </div>
      )}

      {!done && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Situasjon {stepIdx + 1} av {steps.length}
          </div>
          <p className="mt-2 text-base font-medium leading-snug text-neutral-900">{step.prompt}</p>

          <ul
            className="mt-4 space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0"
            role="radiogroup"
            aria-label="Velg ditt svar"
          >
            {step.choices.map((c, idx) => {
              const isPicked = picked?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isPicked}
                    disabled={!!picked}
                    onClick={() => setPicks((s) => ({ ...s, [step.id]: c }))}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isPicked
                        ? c.impactScore >= 0
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : 'border-rose-300 bg-rose-50 text-rose-900'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    } ${picked && !isPicked ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[10px] font-bold">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1">{c.label}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {picked ? (
            <div
              role="status"
              aria-live="polite"
              className={`mt-4 rounded-lg border-l-4 px-3 py-2 text-sm ${
                picked.impactScore >= 0
                  ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900'
                  : 'border-rose-500 bg-rose-50/60 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {picked.impactScore >= 0 ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <AlertTriangle className="size-4" />
                )}
                Impact Score: {picked.impactScore >= 0 ? '+' : ''}{picked.impactScore}
              </div>
              <p className="mt-1">{picked.feedback}</p>
              {picked.refLawId ? <ChoiceLawRef refId={picked.refLawId} /> : null}
            </div>
          ) : null}

          {picked ? (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<ArrowRight className="size-3.5" />}
                onClick={() => {
                  if (last) setDone(true)
                  else setStepIdx((i) => Math.min(steps.length - 1, i + 1))
                }}
              >
                {last ? 'Se samlet resultat' : 'Neste situasjon'}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {done && (
        <div className={`rounded-xl border p-4 ${passed ? 'border-emerald-300 bg-emerald-50/50' : 'border-amber-300 bg-amber-50/50'}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {passed ? (
              <CheckCircle2 className="size-5 text-emerald-700" />
            ) : (
              <AlertTriangle className="size-5 text-amber-700" />
            )}
            <span className={passed ? 'text-emerald-900' : 'text-amber-900'}>
              {passed ? 'Bestått' : 'Ikke bestått — refleksjon'}
            </span>
          </div>
          <div className="mt-2 text-sm">
            Samlet Impact Score: <strong>{totalScore >= 0 ? '+' : ''}{totalScore}</strong> (krav: {passingImpactScore}).
            {passed
              ? ' Du valgte konsekvent HMS-kompatible løsninger.'
              : ' Gå gjennom feedbacken på valgene som ga negativ score, og vurder å ta scenariet på nytt.'}
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-4 w-full rounded-full"
            onClick={onComplete}
          >
            Fullfør scenario
          </Button>
          {!passed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              icon={<RotateCcw className="size-3.5" />}
              onClick={reset}
            >
              Prøv scenariet på nytt
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ChoiceLawRef({ refId }: { refId: string }) {
  const law = AML_LAW_REFS_CATALOG.find((r) => r.id === refId)
  if (!law) return null
  return (
    <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium">
      <Scale className="size-3" />
      <span className="font-semibold">{law.paragraph}</span>
      <span className="text-neutral-600">— {law.title}</span>
    </div>
  )
}

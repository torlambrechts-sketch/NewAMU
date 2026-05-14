// ScenarioModulePlayer — renders a branching scenario module.
// Each step shows a prompt + 2-4 choices. Picking a choice reveals the
// feedback + impact score, then advances to the next step. The module
// completes once the user has gone through every step; the cumulative
// Impact Score is reported back to the parent player.

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, ArrowRight, Scale } from 'lucide-react'
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

  const step = steps[stepIdx]
  const last = stepIdx >= steps.length - 1
  const picked = step ? picks[step.id] : undefined
  const totalScore = Object.values(picks).reduce((s, c) => s + c.impactScore, 0)
  const passed = totalScore >= passingImpactScore
  const done = Object.keys(picks).length >= steps.length

  if (!step) return <p className="text-sm text-neutral-500">Ingen scenarier definert.</p>

  return (
    <div className="space-y-5">
      {intro ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
          <MarkdownBody markdown={intro} />
        </div>
      ) : null}

      {/* progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all ${
              i === stepIdx ? 'w-6 bg-[#1a3d32]' : i < stepIdx ? 'w-3 bg-[#1a3d32]/50' : 'w-3 bg-neutral-200'
            }`}
            aria-hidden
          />
        ))}
      </div>

      {!done && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Situasjon {stepIdx + 1} av {steps.length}
          </div>
          <p className="mt-2 text-base font-medium leading-snug text-neutral-900">{step.prompt}</p>

          <ul className="mt-4 space-y-2">
            {step.choices.map((c) => {
              const isPicked = picked?.id === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
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
                        {String.fromCharCode(65 + step.choices.indexOf(c))}
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
                onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
                disabled={last && !!picks[step.id]}
              >
                {last ? 'Se resultat' : 'Neste situasjon'}
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

// Iteration 6 — "Wizard / Konversasjon".
//
// Help-me-plan. A guided three-step flow where the page asks one
// question at a time, the right sidebar shows progress, and a quiet
// recap accumulates. Suitable for first-time onboarding, AMU-leder
// without prior context, or "let's reset the year" workshops.
//
// Built on WorkplaceDashboardShell + WorkplaceSplit7030Layout. Each
// step is a self-contained card; the aside is a checklist.

import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  HelpCircle,
  PartyPopper,
  Sparkles,
} from 'lucide-react'
import { WorkplaceDashboardShell } from '../../../components/layout/WorkplaceDashboardShell'
import { WorkplaceSerifSectionTitle, WORKPLACE_PAGE_SERIF } from '../../../components/layout/WorkplacePageHeading1'
import { WorkplaceSplit7030Layout } from '../../../components/layout/WorkplaceSplit7030Layout'
import { Button } from '../../../components/ui/Button'
import {
  CADENCE_CATEGORY_META,
  FIXTURE_CADENCES,
  FIXTURE_HEALTH,
  FIXTURE_OBJECTIVES,
  FREQ_LABEL,
} from './planleggingIterationsData'

const WIZARD_CANVAS = '#F4EFE3'
const WIZARD_PAPER = '#FFFDF7'

const STEPS = [
  { id: 'ambisjon', label: 'Ambisjon', sub: 'Hva sikter dere mot?' },
  { id: 'kadens', label: 'Kadens', sub: 'Hvilken rytme holder dere?' },
  { id: 'oppgaver', label: 'Oppgaver', sub: 'Hva skjer denne uka?' },
] as const

type StepId = (typeof STEPS)[number]['id']

export function PlanleggingIteration6Wizard() {
  const [step, setStep] = useState<StepId>('ambisjon')
  const [chosenObjective, setChosenObjective] = useState<string>(FIXTURE_OBJECTIVES[0]?.id ?? '')
  const [chosenCadences, setChosenCadences] = useState<Set<string>>(
    new Set(FIXTURE_CADENCES.filter((c) => c.recommended).map((c) => c.id)),
  )

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const next = () => {
    const idx = stepIndex + 1
    if (idx < STEPS.length) setStep(STEPS[idx].id)
  }
  const prev = () => {
    const idx = stepIndex - 1
    if (idx >= 0) setStep(STEPS[idx].id)
  }

  const toggleCadence = (id: string) => {
    setChosenCadences((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-white/10 p-6 md:p-8" style={{ backgroundColor: WIZARD_CANVAS }}>
      <WorkplaceDashboardShell
        breadcrumb={[
          { label: 'Plattformadmin', to: '/platform-admin' },
          { label: 'Planlegging-iterasjoner', to: '/platform-admin/planlegging-iterations' },
          { label: '06 · Wizard' },
        ]}
        title="La oss planlegge sammen"
        description="Tre korte spørsmål, så er rammen lagt. Du kan alltid endre senere."
        headerActions={
          <Button variant="secondary" icon={<HelpCircle className="h-4 w-4" />}>
            Hvorfor disse stegene?
          </Button>
        }
      >
        <WizardProgress step={step} setStep={setStep} stepIndex={stepIndex} />

        <div className="mt-6">
          <WorkplaceSplit7030Layout
            main={
              <div
                className="rounded-2xl border border-neutral-200/80 p-6 md:p-8"
                style={{ backgroundColor: WIZARD_PAPER, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              >
                {step === 'ambisjon' ? (
                  <StepAmbisjon
                    value={chosenObjective}
                    onChange={setChosenObjective}
                  />
                ) : null}
                {step === 'kadens' ? (
                  <StepKadens chosen={chosenCadences} onToggle={toggleCadence} />
                ) : null}
                {step === 'oppgaver' ? (
                  <StepOppgaver
                    chosenObjective={chosenObjective}
                    chosenCadences={chosenCadences}
                  />
                ) : null}

                <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-5">
                  <Button
                    variant="ghost"
                    onClick={prev}
                    disabled={stepIndex === 0}
                    icon={<ArrowLeft className="h-4 w-4" />}
                  >
                    Forrige
                  </Button>
                  <p className="text-xs text-neutral-500">
                    Steg <span className="font-bold text-neutral-700">{stepIndex + 1}</span> av {STEPS.length}
                  </p>
                  {stepIndex < STEPS.length - 1 ? (
                    <Button variant="primary" onClick={next}>
                      Neste
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="primary" icon={<PartyPopper className="h-4 w-4" />}>
                      Sett planen
                    </Button>
                  )}
                </footer>
              </div>
            }
            aside={
              <WizardRecap
                chosenObjective={chosenObjective}
                chosenCadences={chosenCadences}
                stepId={step}
              />
            }
          />
        </div>
      </WorkplaceDashboardShell>
    </div>
  )
}

function WizardProgress({
  step,
  setStep,
  stepIndex,
}: {
  step: StepId
  setStep: (id: StepId) => void
  stepIndex: number
}) {
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {STEPS.map((s, i) => {
        const active = s.id === step
        const done = i < stepIndex
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStep(s.id)}
              className={`flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition ${
                active
                  ? 'border-[#1a3d32] bg-white shadow-sm'
                  : done
                    ? 'border-neutral-200/80 bg-white/70 hover:bg-white'
                    : 'border-neutral-200/60 bg-white/50 hover:bg-white/80'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  active
                    ? 'bg-[#1a3d32] text-white'
                    : done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {done ? <Check className="h-5 w-5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[15px] font-semibold ${
                    active ? 'text-neutral-900' : done ? 'text-neutral-700' : 'text-neutral-600'
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{s.sub}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function StepAmbisjon({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2f7757]">Steg 01 · Ambisjon</p>
        <WorkplaceSerifSectionTitle>Hvilket mål skal lede arbeidet i 2026?</WorkplaceSerifSectionTitle>
        <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
          Velg ett hovedmål nå — det er fortsatt mulig å legge til flere senere. AMU og styret
          får én ting de kan samles om.
        </p>
      </header>

      <div className="space-y-3">
        {FIXTURE_OBJECTIVES.map((obj) => {
          const checked = obj.id === value
          const health = FIXTURE_HEALTH[obj.health]
          return (
            <label
              key={obj.id}
              className={`block cursor-pointer rounded-xl border p-4 transition ${
                checked ? 'border-[#1a3d32] bg-[#e7efe9]/40' : 'border-neutral-200/80 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="ambisjon"
                  value={obj.id}
                  checked={checked}
                  onChange={() => onChange(obj.id)}
                  className="mt-1 h-4 w-4 accent-[#1a3d32]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className="text-[16px] font-semibold leading-snug text-neutral-900"
                      style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
                    >
                      {obj.title}
                    </p>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: health.soft, color: health.text }}
                    >
                      {health.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-neutral-600">{obj.description}</p>
                  <p className="mt-2 text-[11px] text-neutral-500">
                    {obj.owner} · {obj.horizon} · {obj.keyResults.length} nøkkelresultater
                  </p>
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function StepKadens({
  chosen,
  onToggle,
}: {
  chosen: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2f7757]">Steg 02 · Kadens</p>
        <WorkplaceSerifSectionTitle>Hvilke rutiner skal være pulsen?</WorkplaceSerifSectionTitle>
        <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
          De anbefalte rutinene dekker AML-baselinen. Skru av eller på etter behov — du
          bestemmer takten.
        </p>
      </header>

      <ul className="space-y-2.5">
        {FIXTURE_CADENCES.map((c) => {
          const isOn = chosen.has(c.id)
          const meta = CADENCE_CATEGORY_META[c.category]
          const Icon = c.icon
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                aria-pressed={isOn}
                className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition ${
                  isOn ? 'border-[#1a3d32] bg-[#e7efe9]/40' : 'border-neutral-200/80 hover:border-neutral-300'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isOn ? 'text-white' : 'text-neutral-700'
                  }`}
                  style={{
                    backgroundColor: isOn ? meta.color : `${meta.color}15`,
                  }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-[15px] font-semibold text-neutral-900">{c.title}</p>
                    {c.recommended ? (
                      <span className="rounded-full bg-[#1a3d32] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Anbefalt
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {FREQ_LABEL[c.freq]} · {meta.label} · {c.owner}
                  </p>
                </div>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    isOn ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-300 bg-white'
                  }`}
                >
                  {isOn ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StepOppgaver({
  chosenObjective,
  chosenCadences,
}: {
  chosenObjective: string
  chosenCadences: Set<string>
}) {
  const obj = FIXTURE_OBJECTIVES.find((o) => o.id === chosenObjective)
  const enabled = FIXTURE_CADENCES.filter((c) => chosenCadences.has(c.id))
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2f7757]">Steg 03 · Oppgaver</p>
        <WorkplaceSerifSectionTitle>Da er rammen klar.</WorkplaceSerifSectionTitle>
        <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-700">
          Vi lager {enabled.length} vedvarende oppgaver fra rutinene du valgte, og knytter dem til
          målet. Du kan justere eier, frekvens og frist på hver enkelt etterpå.
        </p>
      </header>

      <div className="space-y-5">
        <RecapBlock label="Hovedmål">
          <p className="text-[15px] font-medium leading-snug text-neutral-900">{obj?.title ?? '—'}</p>
        </RecapBlock>

        <RecapBlock label={`Rutiner som blir vedvarende oppgaver (${enabled.length})`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {enabled.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-neutral-200/80 bg-neutral-50/50 px-3 py-2 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <span className="min-w-0 truncate font-medium text-neutral-800">{c.title}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wide text-neutral-500">
                  {FREQ_LABEL[c.freq]}
                </span>
              </li>
            ))}
          </ul>
        </RecapBlock>

        <RecapBlock label="Hva skjer når du klikker «Sett planen»?">
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-neutral-700">
            <li>OKR-roten lagres på organisasjonen din.</li>
            <li>{enabled.length} oppgaver opprettes som vedvarende rutiner.</li>
            <li>AMU varsles om at det er en ny plan å gjennomgå.</li>
          </ol>
        </RecapBlock>
      </div>
    </div>
  )
}

function RecapBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-neutral-50/40 p-4">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function WizardRecap({
  chosenObjective,
  chosenCadences,
  stepId,
}: {
  chosenObjective: string
  chosenCadences: Set<string>
  stepId: StepId
}) {
  const obj = useMemo(
    () => FIXTURE_OBJECTIVES.find((o) => o.id === chosenObjective) ?? null,
    [chosenObjective],
  )
  const recommended = FIXTURE_CADENCES.filter((c) => c.recommended).length
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Din plan så langt</p>
        <p
          className="mt-2 text-[19px] font-semibold leading-tight text-neutral-900"
          style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
        >
          {obj ? obj.title.split(' ').slice(0, 6).join(' ') + '…' : 'Ikke valgt enda'}
        </p>
        {obj ? <p className="mt-2 text-xs text-neutral-500">{obj.owner} · {obj.horizon}</p> : null}
      </div>

      <div className="space-y-2 border-t border-neutral-200 pt-4">
        <RecapRow done={stepId !== 'ambisjon'} label="Ambisjon valgt" />
        <RecapRow
          done={stepId === 'oppgaver'}
          label={`${chosenCadences.size} rutiner valgt`}
          hint={chosenCadences.size < recommended ? `${recommended - chosenCadences.size} anbefalte ikke valgt` : 'Anbefalte dekket'}
        />
        <RecapRow done={false} label="Plan satt" hint="Klikk «Sett planen» på steg 3" />
      </div>

      <div className="rounded-xl border border-[#1a3d32]/20 bg-[#e7efe9]/40 p-4">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a3d32]">
          <Sparkles className="h-3.5 w-3.5" />
          Tips
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
          {stepId === 'ambisjon'
            ? 'Velg det målet som er enklest å forklare for ansatte. Det blir den nordstjerna alle bidrar mot.'
            : stepId === 'kadens'
              ? 'AMU-møte + Vernerunde + Risikogjennomgang dekker de fleste tilsyn. Start der.'
              : 'Du kan starte med mindre — det er bedre at planen leves enn at den er komplett.'}
        </p>
      </div>
    </div>
  )
}

function RecapRow({ done, label, hint }: { done: boolean; label: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
      )}
      <div className="min-w-0">
        <p className={`text-[13px] ${done ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>{label}</p>
        {hint ? <p className="text-[11px] text-neutral-500">{hint}</p> : null}
      </div>
    </div>
  )
}

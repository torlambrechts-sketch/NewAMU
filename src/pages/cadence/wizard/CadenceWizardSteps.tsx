// CadenceWizardSteps — horisontal stegindikator + summary-aside.
//
// Replikerer step-bar-en fra HTML-veiviseren: 8 nummererte trinn, hver
// med sub-label som oppdateres etter hvert som brukeren går gjennom
// veiviseren. Klikkbare bare når et trinn er ulåst (forrige
// minstekrav nådd).

import { Check } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import type { CadenceWizardState } from '../useCadenceWizardState'
import { unlockedSteps } from '../useCadenceWizardState'
import { MODULES, REGELVERK_BY_ID } from './cadenceWizardData'

const STEP_DEFS: { id: number; name: string }[] = [
  { id: 1, name: 'Regelverk' },
  { id: 2, name: 'Paragrafer' },
  { id: 3, name: 'Moduler' },
  { id: 4, name: 'Roller' },
  { id: 5, name: 'Frekvens' },
  { id: 6, name: 'Godkjenninger' },
  { id: 7, name: 'Eskalering' },
  { id: 8, name: 'Forhåndsvis' },
]

function subLabelFor(stepId: number, state: CadenceWizardState): string {
  switch (stepId) {
    case 1:
      return state.regelverk.length === 0
        ? 'Velg lov'
        : `${state.regelverk.length} lov${state.regelverk.length === 1 ? '' : 'er'}`
    case 2:
      return state.paragraphs.length === 0 ? '—' : `${state.paragraphs.length} paragrafer`
    case 3:
      return state.modules.length === 0 ? '—' : `${state.modules.length} moduler`
    case 4: {
      const assigned = Object.values(state.roles).filter((r) => r.person?.name).length
      return assigned === 0 ? '—' : `${assigned} roller`
    }
    case 5: {
      if (state.modules.length === 0) return '—'
      const total = MODULES.filter((m) => state.modules.includes(m.id)).reduce((s, m) => s + m.volume, 0)
      return `${total} oppg./år`
    }
    case 6:
      return state.modules.length > 0 ? '4 kjeder' : '—'
    case 7:
      return state.modules.length > 0 ? '2 mønstre' : '—'
    case 8:
      return state.modules.length > 0 ? 'Klar' : '—'
    default:
      return '—'
  }
}

export function CadenceStepIndicator({
  state,
  onSelect,
}: {
  state: CadenceWizardState
  onSelect: (n: number) => void
}) {
  const unlocked = unlockedSteps(state)

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:grid-cols-4 lg:grid-cols-8">
      {STEP_DEFS.map(({ id, name }) => {
        const isCurrent = id === state.currentStep
        const isDone = id < state.currentStep
        const isLocked = !unlocked.has(id) && id > state.currentStep
        const sub = subLabelFor(id, state)
        return (
          <Button
            key={id}
            variant="ghost"
            type="button"
            onClick={() => !isLocked && onSelect(id)}
            disabled={isLocked}
            aria-current={isCurrent ? 'step' : undefined}
            className={[
              'flex h-auto flex-col items-start gap-1 rounded-md p-2 text-left font-normal normal-case transition-colors',
              isLocked
                ? 'cursor-not-allowed opacity-55 hover:bg-transparent'
                : 'cursor-pointer hover:bg-neutral-50',
              isCurrent ? 'bg-[#1a3d32]/5 hover:bg-[#1a3d32]/5' : '',
            ].join(' ')}
          >
            <span className="flex w-full items-center gap-2">
              <span
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  isDone
                    ? 'bg-[#2f7757] text-white'
                    : isCurrent
                      ? 'bg-[#1a3d32] text-white ring-4 ring-[#1a3d32]/15'
                      : 'bg-neutral-100 text-neutral-500',
                ].join(' ')}
              >
                {isDone ? <Check className="h-3 w-3" aria-hidden /> : id}
              </span>
              <span
                className={[
                  'text-xs font-medium leading-tight',
                  isCurrent ? 'font-semibold text-neutral-900' : isDone ? 'text-neutral-700' : 'text-neutral-500',
                ].join(' ')}
              >
                {name}
              </span>
            </span>
            <span className="ml-8 text-[10px] tabular-nums text-neutral-500">{sub}</span>
          </Button>
        )
      })}
    </div>
  )
}

// ── Summary aside ───────────────────────────────────────────────────────────

export function CadenceSummaryAside({
  state,
  saveStatus,
  organizationName,
  organizationContext,
}: {
  state: CadenceWizardState
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  organizationName: string | null
  organizationContext: string | null
}) {
  const regelverkNames = state.regelverk.map((id) => REGELVERK_BY_ID[id]?.shortCode ?? id).join(', ')
  const totalVolume = MODULES.filter((m) => state.modules.includes(m.id)).reduce((s, m) => s + m.volume, 0)
  const assignedRoles = Object.values(state.roles).filter((r) => r.person?.name).length

  return (
    <aside className="sticky top-3 self-start rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <header className="mb-4">
        <div className="font-serif text-base font-semibold text-neutral-900">
          {state.planName || 'Din cadence'}
        </div>
        {organizationName ? (
          <div className="mt-0.5 text-[11px] text-neutral-500">
            {organizationName}
            {organizationContext ? ` · ${organizationContext}` : ''}
          </div>
        ) : null}
        {saveStatus !== 'idle' ? (
          <div className="mt-2 text-[11px]">
            {saveStatus === 'saving' && <span className="text-neutral-500">Lagrer utkast …</span>}
            {saveStatus === 'saved' && <span className="text-[#166534]">Lagret automatisk</span>}
            {saveStatus === 'error' && <span className="text-[#991B1B]">Kunne ikke lagre</span>}
          </div>
        ) : null}
      </header>

      <SummaryBlock label="Regelverk">
        {regelverkNames || <span className="italic text-neutral-400">Ikke valgt enda</span>}
      </SummaryBlock>

      <SummaryBlock label="Paragrafer">
        {state.paragraphs.length === 0 ? (
          <span className="italic text-neutral-400">—</span>
        ) : (
          `${state.paragraphs.length} valgt`
        )}
      </SummaryBlock>

      <SummaryBlock label="Moduler">
        {state.modules.length === 0 ? (
          <span className="italic text-neutral-400">—</span>
        ) : (
          `${state.modules.length} valgt`
        )}
      </SummaryBlock>

      <SummaryBlock label="Roller besatt">
        {assignedRoles === 0 ? <span className="italic text-neutral-400">—</span> : `${assignedRoles} roller`}
      </SummaryBlock>

      <SummaryBlock label="Estimert volum">
        {totalVolume === 0 ? <span className="italic text-neutral-400">—</span> : `${totalVolume} oppgaver/år`}
      </SummaryBlock>

      <SummaryBlock label="Iverksettelse">
        {state.currentStep < 8 ? (
          <span>Steg {state.currentStep}/8 i veiviser</span>
        ) : (
          <span>Klar til iverksettelse</span>
        )}
      </SummaryBlock>
    </aside>
  )
}

function SummaryBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-neutral-100 py-2.5 first:border-t-0 first:pt-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-snug text-neutral-900">{children}</div>
    </div>
  )
}

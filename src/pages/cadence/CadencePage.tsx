// CadencePage — toppside for /cadence.
//
// Bruker samme shell-mønster som Internkontroll: ModulePageShell med
// breadcrumb + tittel + tab-stripe, så seksjonsinnholdet under. I
// første iterasjon er det kun ett aktivt tab ("Veiviser"); placeholder-
// tabbene "Aktive planer" og "Årshjul" peker mot fremtidige views som
// rulles ut etterhvert.
//
// Tab-state lever i ?section=... på samme måte som Internkontroll, slik
// at delte lenker til "Cadence-veiviser" eller "Aktive planer" lander
// rett i riktig fane.

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, History, ListChecks, Wand2 } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { CadenceWizard } from './wizard/CadenceWizard'
import { CadenceActivePlansList } from './CadenceActivePlansList'

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Styringssystem', to: '/internkontroll' },
  { label: 'Cadence' },
]

type CadenceSectionId = 'veiviser' | 'planer' | 'aarshjul' | 'historikk'

const NAV: Array<{ id: CadenceSectionId; label: string; Icon: typeof Wand2; disabled?: boolean }> = [
  { id: 'veiviser', label: 'Veiviser', Icon: Wand2 },
  { id: 'planer', label: 'Aktive planer', Icon: ListChecks },
  { id: 'aarshjul', label: 'Årshjul', Icon: CalendarClock, disabled: true },
  { id: 'historikk', label: 'Historikk', Icon: History, disabled: true },
]

const VALID_SECTIONS = new Set<CadenceSectionId>(NAV.map((n) => n.id))

export function CadencePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sectionParam = searchParams.get('section')
  const section: CadenceSectionId =
    sectionParam && VALID_SECTIONS.has(sectionParam as CadenceSectionId)
      ? (sectionParam as CadenceSectionId)
      : 'veiviser'

  const setSection = useCallback(
    (id: CadenceSectionId) => {
      const sp = new URLSearchParams(searchParams)
      sp.set('section', id)
      setSearchParams(sp, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const headerActions = useMemo(
    () => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSection('veiviser')}
        icon={<Wand2 className="h-3.5 w-3.5" />}
      >
        Ny cadence-plan
      </Button>
    ),
    [setSection],
  )

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      width="full"
      title="Cadence"
      description="Bygg og iverksett HMS-årshjulet — fra lovverk og paragrafer til oppgavemaler, roller, frekvens og eskalering."
      headerActions={headerActions}
    >
      <div className="space-y-3">
        {/* Section tabs — samme komponering som /internkontroll. */}
        <div className="rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <nav
            className="flex flex-wrap items-center gap-1 border-b border-neutral-100 px-3 py-2"
            aria-label="Cadence-seksjoner"
          >
            {NAV.map(({ id, label, Icon, disabled }) => {
              const active = id === section
              return (
                <Button
                  key={id}
                  variant="ghost"
                  onClick={() => !disabled && setSection(id)}
                  aria-current={active ? 'page' : undefined}
                  disabled={disabled}
                  className={[
                    'inline-flex h-auto items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    disabled ? 'cursor-not-allowed opacity-55' : '',
                    active
                      ? 'bg-[#1a3d32] text-white hover:bg-[#1a3d32] hover:text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{label}</span>
                  {disabled ? (
                    <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold tabular-nums text-neutral-700">
                      Snart
                    </span>
                  ) : null}
                </Button>
              )
            })}
          </nav>
        </div>

        {/* Section content */}
        <section className="min-w-0">
          {section === 'veiviser' && <CadenceWizard />}
          {section === 'planer' && <CadenceActivePlansList />}
          {(section === 'aarshjul' || section === 'historikk') && (
            <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              Denne seksjonen er under utvikling og rulles ut snart.
            </div>
          )}
        </section>
      </div>
    </ModulePageShell>
  )
}

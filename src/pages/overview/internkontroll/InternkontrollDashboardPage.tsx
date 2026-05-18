// /overview/internkontroll — Internkontroll AML hub.
//
// Replaces the prior SystemReport-backed dashboard with a bespoke AML
// hub matching the Klarert design system
// (ui_kits/aml-compliance/index.html): score hero → årshjul + side
// panel → modules grid → outstanding tasks + Klarert feed → regelverk
// bar. ModulePageShell enforces max-w-[1400px] + breadcrumb chrome.
//
// The companion Gap Analysis page stays at /overview/internkontroll/gaps.

import { useState } from 'react'
import {
  AlertCircle,
  Calendar,
  ChevronDown,
  Download,
  ShieldCheck,
} from 'lucide-react'
import { ModulePageShell } from '../../../components/module/ModulePageShell'
import { Button } from '../../../components/ui/Button'
import {
  KlarertFeed,
  ModulesOverview,
  OutstandingTasks,
  RegelverkBar,
  ScoreHero,
} from './aml/AmlHubPieces'
import { Arshjul, ArshjulLegend, ArshjulMonthList } from './aml/Arshjul'
import { useAmlHubData } from './aml/useAmlHubData'

const SERIF = "'Libre Baskerville', Georgia, serif"

const BREADCRUMB = [
  { label: 'Arbeidsflate', to: '/' },
  { label: 'Oversikt', to: '/overview/hms' },
  { label: 'Internkontroll' },
]

export function InternkontrollDashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const { modules, score, tasks, loading } = useAmlHubData()
  const today = new Date()

  const headerActions = (
    <>
      <Button
        variant="ghost"
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <Download className="h-4 w-4" /> Eksporter rapport
      </Button>
      <Button
        variant="ghost"
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <Calendar className="h-4 w-4" /> {today.getFullYear()}
        <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
      </Button>
      <Button
        variant="ghost"
        className="inline-flex items-center gap-1.5 rounded-md bg-[#1a3d32] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#14312a]"
      >
        <ShieldCheck className="h-4 w-4" /> Signer kvartalsrapport
      </Button>
    </>
  )

  return (
    <ModulePageShell
      breadcrumb={BREADCRUMB}
      title="Arbeidsmiljøloven"
      description="Samlet oversikt over alle moduler og krav i AML — årshjulet, status per modul, utestående oppgaver, og oppdateringer fra Klarert. Anker for IK-revisjonen."
      headerActions={headerActions}
      loading={loading}
      loadingLabel="Laster internkontroll-data …"
    >
      <ScoreHero score={score} />

      {/* Årshjul + side panel */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="px-5 pb-6 pt-5 md:px-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Årshjul · {today.getFullYear()}
                </p>
                <h2
                  className="mt-0.5 text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl"
                  style={{ fontFamily: SERIF }}
                >
                  Lovpålagte aktiviteter, plassert i tid
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                  Hver ring er en kategori; hver prikk er én aktivitet med kobling til paragraf.
                  Klikk på en måned for å filtrere listen til høyre.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c5d3c8] bg-[#e7efe9] px-2.5 py-0.5 font-semibold text-[#1a3d32]">
                  <Calendar className="h-3 w-3" /> I dag ·{' '}
                  {today.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
            <div className="mx-auto mt-4 max-w-[640px]">
              <Arshjul
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                today={today}
              />
            </div>
          </div>
          <aside
            className="flex flex-col gap-6 border-t border-neutral-100 px-5 py-5 md:px-6 lg:border-l lg:border-t-0"
            style={{ background: '#fbf9f3' }}
          >
            <ArshjulMonthList
              selectedMonth={selectedMonth}
              onClear={() => setSelectedMonth(null)}
              today={today}
            />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                Tegnforklaring · ringer
              </p>
              <div className="mt-2">
                <ArshjulLegend />
              </div>
            </div>
            {score.tasksOverdue > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">
                      {score.tasksOverdue} oppgave{score.tasksOverdue === 1 ? '' : 'r'} forfalt
                    </p>
                    <p className="mt-0.5 text-amber-800">
                      Se utestående-tabellen nedenfor — sortert etter alvorlighet og frist.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <ModulesOverview modules={modules} />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <OutstandingTasks tasks={tasks} />
        <KlarertFeed />
      </div>

      <RegelverkBar />

      <p className="pt-2 text-center text-[11px] text-neutral-500">
        Kilde: Arbeidsmiljøloven (LOV-2005-06-17-62) · Internkontrollforskriften · Forskrift om BHT.
        Vektingen reflekterer Klarerts standardprofil for AMU-styrte virksomheter.
      </p>
    </ModulePageShell>
  )
}

// /compliance/arbeidsmiljoloven — Klarert AML compliance dashboard.
// Composes: page header → score hero → årshjul (with side panel) →
// modules overview grid → outstanding tasks + Klarert feed → regelverk
// bar. Phase A (this commit): hardcoded seed data so the visual lands
// before any data wiring. Phase B replaces the seed imports with hooks.

import { useState } from 'react'
import { AlertCircle, Calendar, ChevronDown, Download, ShieldCheck } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { AmlScoreHero } from '../../components/aml/AmlScoreHero'
import {
  AmlYearWheel,
  AmlYearWheelLegend,
  AmlYearWheelMonthList,
} from '../../components/aml/AmlYearWheel'
import { AmlModulesOverview } from '../../components/aml/AmlModulesOverview'
import { AmlOutstandingTasksTable } from '../../components/aml/AmlOutstandingTasksTable'
import { AmlKlarertFeed } from '../../components/aml/AmlKlarertFeed'
import { AmlRegelverkBar } from '../../components/aml/AmlRegelverkBar'
import { useAmlComplianceData } from '../../hooks/useAmlComplianceData'

const SERIF = "'Libre Baskerville', Georgia, serif"

export function ComplianceArbeidsmiljolovenPage() {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const data = useAmlComplianceData()

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Internkontroll', to: '/compliance' },
        { label: 'Arbeidsmiljøloven' },
      ]}
      // The serif H1 + "Etterlevelse · 2026" eyebrow live in
      // ModulePageShell's title; the description carries the lead-in.
      title={
        <span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600">
            Etterlevelse · 2026
          </span>
          <span style={{ fontFamily: SERIF }}>Arbeidsmiljøloven</span>
        </span>
      }
      description="Samlet oversikt over alle moduler og krav i AML — årshjulet, status per modul, utestående oppgaver, og oppdateringer fra Klarert. Anker for IK-revisjonen i 2026."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            icon={<Download className="h-4 w-4" />}
          >
            Eksporter rapport
          </Button>
          <Button
            type="button"
            variant="secondary"
            icon={<Calendar className="h-4 w-4" />}
          >
            2026
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={<ShieldCheck className="h-4 w-4" />}
          >
            Signer kvartalsrapport
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {data.isUsingSeed.tasks ||
        data.isUsingSeed.score ||
        data.isUsingSeed.modules ||
        data.isUsingSeed.wheel ||
        data.isUsingSeed.feed ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <p className="font-semibold">Demo-data i bruk</p>
            <p className="mt-0.5 text-amber-800">
              {data.isUsingSeed.tasks
                ? 'Ingen AML-tilknyttede oppgaver i organisasjonen ennå — vi viser eksempeldata. '
                : 'Oppgaver er reelle. '}
              Score, moduler, årshjul og Klarert-feed kobles til ekte data i en senere
              utrulling.
            </p>
          </div>
        ) : null}

        <AmlScoreHero score={data.score} />

        <ModuleSectionCard className="!p-0">
          <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
            <div className="px-5 pb-6 pt-5 md:px-8">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                    Årshjul · 2026
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
                    <Calendar className="h-3 w-3" /> I dag · 8. mai
                  </span>
                </div>
              </div>
              <div className="mx-auto mt-4 max-w-[640px]">
                <AmlYearWheel
                  today={data.today}
                  items={data.wheel}
                  legend={data.ringLegend}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                />
              </div>
            </div>
            <aside
              className="flex flex-col gap-6 border-t border-neutral-100 px-5 py-5 md:px-6 lg:border-l lg:border-t-0"
              style={{ background: '#fbf9f3' }}
            >
              <AmlYearWheelMonthList
                today={data.today}
                items={data.wheel}
                legend={data.ringLegend}
                selectedMonth={selectedMonth}
                onClear={() => setSelectedMonth(null)}
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Tegnforklaring · ringer
                </p>
                <div className="mt-2">
                  <AmlYearWheelLegend legend={data.ringLegend} />
                </div>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">3 oppfølgingsplaner mangler</p>
                    <p className="mt-0.5 text-amber-800">
                      AML § 4-6 — frist 4 uker. Vist som røde prikker i mai-segmentet.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </ModuleSectionCard>

        <AmlModulesOverview modules={data.modules} />

        <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <AmlOutstandingTasksTable tasks={data.tasks} />
          <AmlKlarertFeed feed={data.feed} />
        </div>

        <AmlRegelverkBar />

        <p className="pt-2 text-center text-[11px] text-neutral-500">
          Kilde: Arbeidsmiljøloven (LOV-2005-06-17-62) · Internkontrollforskriften ·
          Forskrift om BHT. Vektingen reflekterer Klarerts standardprofil for AMU-styrte
          virksomheter.
        </p>
      </div>
    </ModulePageShell>
  )
}

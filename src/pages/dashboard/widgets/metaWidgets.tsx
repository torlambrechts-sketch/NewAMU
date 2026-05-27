// Meta-widget: metode-sammenligning.

import { Chip, WidgetCard } from './widgetShared'

const METHODS = [
  { key: 'gantt', label: 'Gantt', topBar: 'bg-[#1E3148]' },
  { key: 'kanban', label: 'Kanban', topBar: 'bg-[#3F6B4F]' },
  { key: 'sprint', label: 'Sprint', topBar: 'bg-[#BA0C2F]' },
  { key: 'lean', label: 'Lean / VSM', topBar: 'bg-[#3B5BDB]' },
  { key: 'gate', label: 'Stage-gate', topBar: 'bg-[#B8761F]' },
  { key: 'okr', label: 'OKR', topBar: 'bg-[#5A2F6F]' },
  { key: 'cpm', label: 'Kritisk linje (CPM/PERT)', topBar: 'bg-[#266B6B]' },
  { key: 'raid', label: 'RAID', topBar: 'bg-[#A03826]' },
] as const

type FitDot = 3 | 2 | 1 | 0

const FIT_ROWS: { label: string; values: Record<typeof METHODS[number]['key'], FitDot> }[] = [
  { label: 'Styremøte / topp-ledelse', values: { gantt: 3, kanban: 1, sprint: 0, lean: 2, gate: 3, okr: 3, cpm: 2, raid: 3 } },
  { label: 'Daglig operativ drift', values: { gantt: 1, kanban: 3, sprint: 3, lean: 2, gate: 0, okr: 1, cpm: 0, raid: 1 } },
  { label: 'Eksternt revisjon / Arbeidstilsynet', values: { gantt: 3, kanban: 0, sprint: 0, lean: 1, gate: 3, okr: 1, cpm: 2, raid: 3 } },
  { label: 'Identifisere flaskehalser', values: { gantt: 1, kanban: 3, sprint: 2, lean: 3, gate: 0, okr: 0, cpm: 3, raid: 1 } },
  { label: 'Kobling til strategi & bunnlinje', values: { gantt: 0, kanban: 0, sprint: 1, lean: 2, gate: 2, okr: 3, cpm: 0, raid: 1 } },
  { label: 'Bemanning & resource leveling', values: { gantt: 2, kanban: 1, sprint: 2, lean: 1, gate: 1, okr: 0, cpm: 3, raid: 0 } },
  { label: 'Krisehåndtering / akutt', values: { gantt: 0, kanban: 2, sprint: 1, lean: 0, gate: 0, okr: 0, cpm: 1, raid: 3 } },
  { label: 'Klarert sin standard for HMS-arbeid', values: { gantt: 3, kanban: 3, sprint: 1, lean: 2, gate: 3, okr: 2, cpm: 3, raid: 3 } },
]

const COMPARE_CARDS: { name: string; tag: string; body: string; pros: string[]; cons: string[]; topBar: string }[] = [
  {
    name: 'Fossefall / Gantt',
    tag: 'CPM · PMBOK · klassisk',
    body: 'Lineær fremstilling med faser, milepæler, og avhengigheter. Egnet for prosjekter der rekkefølgen er gitt og frister er hellige — som compliance-arbeid.',
    pros: ['Klar tidslinje · alle ser samme', 'Milepæler og frister synlige', 'Revisor elsker det'],
    cons: ['Skjuler flaskehalser', 'Tungt å oppdatere', 'Sier ingenting om ressurser'],
    topBar: 'bg-[#1E3148]',
  },
  {
    name: 'Kanban',
    tag: 'FLOW · WIP-limit · pull',
    body: 'Kortbasert flyt med kolonner. Begrenser «work in progress» — en person kan ikke ha mer enn N åpne oppgaver.',
    pros: ['Viser hva som er blokkert nå', 'Kontinuerlig flyt', 'Lett å forstå'],
    cons: ['Tidsdimensjon mangler', 'Vanskelig for langsiktig planlegging', 'Sier ikke når noe er ferdig'],
    topBar: 'bg-[#3F6B4F]',
  },
  {
    name: 'Sprint / Scrum',
    tag: 'Iterativ · 2-uker · velocity',
    body: 'Korte bolker med commit, retrospektiv, og burndown. Passer for tiltaksimplementering der man må eksperimentere.',
    pros: ['Kontinuerlig forbedring innebygd', 'Estimering blir bedre over tid', 'Sprint-mål skaper fokus'],
    cons: ['Tungt rammeverk for små team', 'Lovbestemte frister passer ikke sprint-grenser', 'Krever scrum-master-kompetanse'],
    topBar: 'bg-[#BA0C2F]',
  },
  {
    name: 'Lean / VSM',
    tag: 'Sløsing · syklustid · kaizen',
    body: 'Verdistrøm-kartlegging avslører ventetid, dobbeltarbeid, og overlevering. Drevet av: hva betaler kunden (loven) faktisk for?',
    pros: ['Avdekker hvor tiden forsvinner', 'Foreslår konkrete kaizen', 'Måler tid og kvalitet'],
    cons: ['Krever data for å gi mening', 'Mindre nyttig for planlegging', 'Kulturkrevende å adoptere'],
    topBar: 'bg-[#3B5BDB]',
  },
  {
    name: 'Stage-gate',
    tag: 'Porter · go/no-go · PMBOK',
    body: 'Faser separert med formelle beslutningsporter. Brukt i farmasi og bygg. Passer compliance-modning.',
    pros: ['Tvinger frem dokumentert beslutning', 'Risiko stoppes tidlig', 'Styret forstår det umiddelbart'],
    cons: ['Byråkratisk for små virksomheter', 'Lite fleksibilitet', 'Port-møter blir lett ritualer'],
    topBar: 'bg-[#B8761F]',
  },
  {
    name: 'OKR',
    tag: 'Outcomes · ambisjon · transparent',
    body: 'Mål med målbare nøkkelresultater. Knytter HMS-arbeidet til strategiske utfall.',
    pros: ['Kobler compliance til business value', 'Lett å rapportere oppover', 'Tydelig «hvorfor»'],
    cons: ['Lovkrav passer dårlig som «ambisjon»', 'KR-er kan bli vilkårlige', 'Lite operativ verdi'],
    topBar: 'bg-[#5A2F6F]',
  },
  {
    name: 'Kritisk linje (CPM/PERT)',
    tag: 'Network · slakk · dependencies',
    body: 'Network diagram som identifiserer hvilke oppgaver som ikke har slakk. Sløsing med tid på kritisk linje = forsinket helt prosjekt.',
    pros: ['Identifiserer hvor ressurser bør gå', 'Hjelper å forhandle frister', 'Modellerer usikkerhet (PERT)'],
    cons: ['Komplekst å sette opp', 'Vanskelig for ikke-prosjektfolk', 'Krever ekte tidsestimater'],
    topBar: 'bg-[#266B6B]',
  },
  {
    name: 'RAID',
    tag: 'Risk · Assumption · Issue · Decision',
    body: 'Levende logg av alt som kan/vil/har gått galt, og hva som er besluttet. Uerstattelig for revisjon og styrerapportering.',
    pros: ['Sporbar beslutningshistorikk', 'Risiko får eier og handling', 'Holdbart for revisjon årevis senere'],
    cons: ['Krever disiplin i oppdatering', 'Lett å overadministrere', 'Ingen tidsdimensjon'],
    topBar: 'bg-[#A03826]',
  },
]

function FitDotCell({ v }: { v: FitDot }) {
  const cls = v === 3 ? 'bg-[#3F6B4F]' : v === 2 ? 'bg-[#B8761F]' : v === 1 ? 'bg-[#C66854]' : 'bg-neutral-200 border border-dashed border-neutral-300'
  return <span className={`inline-block h-3.5 w-3.5 rounded-full ${cls}`} />
}

export function MethodComparisonWidget() {
  return (
    <div className="space-y-3">
      <WidgetCard title="Egnethet per situasjon" subtitle="Hvilken visning passer hvilken bruk">
        <div className="overflow-x-auto">
          <div className="min-w-[820px] overflow-hidden rounded-md border border-neutral-200">
            <div className="grid grid-cols-[220px_repeat(8,1fr)] gap-0 border-b border-neutral-200 bg-neutral-50">
              <div className="px-3 py-3 text-[10.5px] font-bold uppercase tracking-wider text-neutral-500">
                Egnethet for…
              </div>
              {METHODS.map((m) => (
                <div key={m.key} className="border-l border-neutral-200 px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                  {m.label}
                </div>
              ))}
            </div>
            {FIT_ROWS.map((row, idx) => (
              <div key={row.label} className={`grid grid-cols-[220px_repeat(8,1fr)] gap-0 border-b border-neutral-100 ${idx === FIT_ROWS.length - 1 ? 'bg-neutral-50 font-semibold' : ''}`}>
                <div className="px-3 py-3 text-[12px] font-medium text-neutral-900">{row.label}</div>
                {METHODS.map((m) => (
                  <div key={m.key} className="flex items-center justify-center border-l border-neutral-100 px-3 py-3">
                    <FitDotCell v={row.values[m.key]} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-neutral-600">
          <span className="inline-flex items-center gap-1.5"><FitDotCell v={3} />Sterk passform</span>
          <span className="inline-flex items-center gap-1.5"><FitDotCell v={2} />Brukbar</span>
          <span className="inline-flex items-center gap-1.5"><FitDotCell v={1} />Tvungen</span>
          <span className="inline-flex items-center gap-1.5"><FitDotCell v={0} />Ikke egnet</span>
        </div>
      </WidgetCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {COMPARE_CARDS.map((c) => (
          <div key={c.name} className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-5">
            <span className={`absolute left-0 top-0 h-1 w-full ${c.topBar}`} aria-hidden />
            <div className="mt-1 font-serif text-[18px] font-medium leading-tight">{c.name}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{c.tag}</div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-neutral-700">{c.body}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-[11.5px]">
              <div>
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-[#3F6B4F]">Styrker</div>
                <ul className="space-y-1 text-neutral-700">
                  {c.pros.map((p) => <li key={p} className="flex gap-1.5"><span className="text-neutral-400">·</span>{p}</li>)}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-[#A03826]">Svakheter</div>
                <ul className="space-y-1 text-neutral-700">
                  {c.cons.map((p) => <li key={p} className="flex gap-1.5"><span className="text-neutral-400">·</span>{p}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[#0A1628] p-6 text-white">
        <div>
          <div className="font-serif text-[20px] font-normal tracking-tight">Samme data. Forskjellige linser.</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-neutral-200">
            Hver dashboard-visning på denne siden er et perspektiv på de samme task_items + cadence-data. Klikk en oppgave i Gantt, åpne den i RAID, lukk den i Kanban — én sannhet, ulike måter å se den.
          </p>
        </div>
        <Chip tone="paper">{COMPARE_CARDS.length} metoder</Chip>
      </div>
    </div>
  )
}


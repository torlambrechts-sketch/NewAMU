/**
 * /okr-dashboard — sample data + demo surface for <OKRDashboard />.
 *
 * Sister of /table-test. Lets reviewers see both views (Cards + Matrix) with a
 * realistic mix of on-track / at-risk / off-track confidence states.
 */
import { Link } from 'react-router-dom'
import { OKRDashboard, type Objective } from '../components/okr/OKRDashboard'
import { PageContainer } from '../components/layout/PageContainer'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'

const OBJECTIVES: Objective[] = [
  {
    id: 'O-1',
    title: 'Bli foretrukket HMS-plattform i Norden',
    description:
      'Etablere Klarert som det åpenbare valget for mellomstore selskaper innen Q3.',
    owner: { name: 'Anita Solberg' },
    keyResults: [
      {
        id: 'O-1-KR-1',
        title: 'Øke ARR fra signerte HMS-kunder',
        progress: 82,
        confidence: 'on_track',
        current: '12,4 MNOK',
        target: '15 MNOK',
      },
      {
        id: 'O-1-KR-2',
        title: 'Lansere bransjepakker for bygg + industri',
        progress: 65,
        confidence: 'on_track',
        current: '2 pakker',
        target: '3 pakker',
      },
      {
        id: 'O-1-KR-3',
        title: 'Nå NPS ≥ 55 blant aktive HMS-brukere',
        progress: 48,
        confidence: 'at_risk',
        current: '47',
        target: '55',
      },
    ],
  },
  {
    id: 'O-2',
    title: 'Lukke alle åpne tilsynspålegg innen sommeren',
    description: 'Eliminere etterslepet etter Arbeidstilsynets tilsyn i 2025.',
    owner: { name: 'Bjørn Haug' },
    keyResults: [
      {
        id: 'O-2-KR-1',
        title: 'Lukke pålegg med frist før 1. juni',
        progress: 95,
        confidence: 'on_track',
        current: '19 / 20',
        target: '20 / 20',
      },
      {
        id: 'O-2-KR-2',
        title: 'Dokumentere SJA for alle høyrisiko-arbeid',
        progress: 72,
        confidence: 'on_track',
        current: '36',
        target: '50',
      },
      {
        id: 'O-2-KR-3',
        title: 'Gjennomføre vernerunder Q1 + Q2',
        progress: 88,
        confidence: 'on_track',
        current: '14 / 16',
        target: '16',
      },
    ],
  },
  {
    id: 'O-3',
    title: 'Halvere sykefraværet på Drift-avdelingen',
    description: 'Korttidsfraværet har ligget på 6,8 % i 12 måneder — målet er 3,4 %.',
    owner: { name: 'Cecilie Dahl' },
    keyResults: [
      {
        id: 'O-3-KR-1',
        title: 'Innføre tilrettelegging for slitne skift',
        progress: 40,
        confidence: 'at_risk',
        current: '2 / 5 team',
        target: '5 / 5 team',
      },
      {
        id: 'O-3-KR-2',
        title: 'Gjennomføre 1-til-1 sykefraværssamtaler',
        progress: 22,
        confidence: 'off_track',
        current: '12',
        target: '54',
      },
      {
        id: 'O-3-KR-3',
        title: 'Etablere bedriftshelse-samarbeid',
        progress: 100,
        confidence: 'on_track',
        current: 'Signert',
        target: 'Signert',
      },
    ],
  },
  {
    id: 'O-4',
    title: 'Bli ISO 45001-sertifisert',
    description: 'Forberede + bestå hovedrevisjon før 31. august.',
    owner: { name: 'Daniel Nordvik' },
    keyResults: [
      {
        id: 'O-4-KR-1',
        title: 'Fullføre gap-analyse mot ISO 45001',
        progress: 100,
        confidence: 'on_track',
        current: '128 / 128 krav',
        target: '128 / 128',
      },
      {
        id: 'O-4-KR-2',
        title: 'Lukke avvik fra intern revisjon',
        progress: 55,
        confidence: 'at_risk',
        current: '11 / 20',
        target: '20 / 20',
      },
      {
        id: 'O-4-KR-3',
        title: 'Bestå hovedrevisjon uten kritiske avvik',
        progress: 0,
        confidence: 'at_risk',
        current: '—',
        target: 'Bestått',
      },
    ],
  },
  {
    id: 'O-5',
    title: 'Doble e-læringsfullføringen i organisasjonen',
    description: 'Fra 34 % til 70 % fullført på pålagte kurs innen utgangen av Q2.',
    owner: { name: 'Eivind Krogh' },
    keyResults: [
      {
        id: 'O-5-KR-1',
        title: 'Migrere alle pålagte kurs til ny spiller',
        progress: 78,
        confidence: 'on_track',
        current: '14 / 18',
        target: '18 / 18',
      },
      {
        id: 'O-5-KR-2',
        title: 'Sende ut purringer via Innboks',
        progress: 30,
        confidence: 'off_track',
        current: '1 runde',
        target: '4 runder',
      },
    ],
  },
  {
    id: 'O-6',
    title: 'Stabilisere meldetiden i Varslingssaker',
    description: 'Førsteresponstid skal være < 24 timer for kritiske kategorier.',
    owner: { name: 'Frida Skogen' },
    keyResults: [
      {
        id: 'O-6-KR-1',
        title: 'Median førsterespons under 24t',
        progress: 60,
        confidence: 'on_track',
        current: '28t',
        target: '< 24t',
      },
      {
        id: 'O-6-KR-2',
        title: 'Bemanne 2. linje hele uka',
        progress: 50,
        confidence: 'at_risk',
        current: '5 / 7 dager',
        target: '7 / 7',
      },
      {
        id: 'O-6-KR-3',
        title: 'Innføre hash-kjedet hendelseslogg',
        progress: 100,
        confidence: 'on_track',
        current: 'Live',
        target: 'Live',
      },
    ],
  },
]

export function OKRDashboardPage() {
  return (
    <div className="min-h-screen bg-[#F7F4EE] pb-20">
      <PageContainer width="wide" py="py-8">
        <WorkplacePageHeading1
          breadcrumb={[
            { label: 'Hjem', to: '/' },
            { label: 'OKR-dashbord' },
          ]}
          title="OKR-dashbord"
          description={
            <>
              Mål, key-results, eieravatarer og fremdrift — to visninger via{' '}
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
                Tabs
              </span>
              . Tillitnivåer bruker semantiske tokens:{' '}
              <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                emerald-500
              </span>{' '}
              /{' '}
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                amber-500
              </span>{' '}
              /{' '}
              <span className="rounded bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                rose-500
              </span>
              . Rolle-fremdrift = snitt av KR-prosenter.
            </>
          }
        />

        <div className="mt-8">
          <OKRDashboard objectives={OBJECTIVES} />
        </div>

        <footer className="mt-12 flex items-center justify-between border-t border-neutral-200 pt-6 text-xs text-neutral-500">
          <span>
            Forhåndsvisning ·{' '}
            <Link to="/table-test" className="underline hover:text-neutral-700">
              tabellgalleri
            </Link>{' '}
            ·{' '}
            <Link to="/" className="underline hover:text-neutral-700">
              forsiden
            </Link>
          </span>
          <span>{OBJECTIVES.length} objectives · {OBJECTIVES.reduce((s, o) => s + o.keyResults.length, 0)} KR</span>
        </footer>
      </PageContainer>
    </div>
  )
}

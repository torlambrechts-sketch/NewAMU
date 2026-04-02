/**
 * Employee engagement + NPS templates — best practice oriented (clear scales, driver questions).
 */
import type { SurveyQuestion } from '../types/orgHealth'

const E_INTRO = `Denne medarbeiderundersøkelsen kartlegger trivsel, tilfredshet og anbefaling. Svarene brukes til å prioritere tiltak og oppfølging. Det finnes ingen fasitsvar — vi er ute etter din opplevelse.`

const NPS_INTRO = `Net Promoter Score (NPS) måler sannsynligheten for at du vil anbefale oss. Ett spørsmål om anbefaling, deretter korte drivere og mulighet for forslag.`

export function buildEmployeeEngagementQuestions(): SurveyQuestion[] {
  const section = (title: string): SurveyQuestion => ({
    id: crypto.randomUUID(),
    text: title,
    type: 'section',
    required: false,
  })

  const likert = (text: string): SurveyQuestion => ({
    id: crypto.randomUUID(),
    text,
    type: 'likert_5',
    required: true,
  })

  const text = (t: string, req: boolean): SurveyQuestion => ({
    id: crypto.randomUUID(),
    text: t,
    type: 'text',
    required: req,
  })

  const choice = (t: string, options: string[]): SurveyQuestion => ({
    id: crypto.randomUUID(),
    text: t,
    type: 'single_choice',
    required: true,
    options,
  })

  return [
    section('Din rolle og arbeidssituasjon'),
    choice('Hvilken beskrivelse passer best på din stilling?', [
      'Leder',
      'Medarbeider',
      'Konsulent / innleid',
      'Annet',
    ]),
    likert('Jeg er stolt av å jobbe her.'),
    likert('Jeg vil fortsatt jobbe her om to år (gitt lik stilling).'),
    section('NPS — anbefaling'),
    {
      id: 'emp-nps-core',
      text: 'Hvor sannsynlig er det at du vil anbefale oss som arbeidsplass til en venn eller kollega?',
      type: 'nps_11',
      required: true,
      npsLowLabel: 'Ikke sannsynlig',
      npsHighLabel: 'Svært sannsynlig',
    },
    text('Hva er hovedårsaken til din vurdering? (valgfritt)', false),
    section('Utvikling og trivsel'),
    likert('Jeg får mulighet til å utvikle meg faglig.'),
    likert('Samarbeidet i teamet mitt fungerer godt.'),
    text('Hva bør vi forbedre først? (valgfritt)', false),
  ]
}

export function buildNpsPulseQuestions(): SurveyQuestion[] {
  return [
    {
      id: 'nps-core',
      text: 'Hvor sannsynlig er det at du vil anbefale oss til en venn eller kollega?',
      type: 'nps_11',
      required: true,
      npsLowLabel: '0 — ikke sannsynlig',
      npsHighLabel: '10 — svært sannsynlig',
    },
    {
      id: crypto.randomUUID(),
      text: 'Hva er den viktigste grunnen til din score?',
      type: 'single_choice',
      required: false,
      options: [
        'Lønn og ytelser',
        'Ledelse og kommunikasjon',
        'Kollegaer og arbeidsmiljø',
        'Utviklingsmuligheter',
        'Arbeidsmengde og balanse',
        'Annet',
      ],
    },
    {
      id: crypto.randomUUID(),
      text: 'Har du konkrete forslag til forbedring?',
      type: 'text',
      required: false,
    },
  ]
}

export { E_INTRO, NPS_INTRO }

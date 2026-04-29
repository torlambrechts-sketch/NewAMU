import type { SurveyQuestionType } from './types'

export type PurposeSuggestion = {
  label: string
  questionText: string
  questionType: SurveyQuestionType
  hint: string
}

const GENERIC: PurposeSuggestion[] = [
  {
    label: 'Total tilfredshet',
    questionText: 'Hvor fornøyd er du med arbeidsmiljøet totalt sett?',
    questionType: 'rating_1_to_5',
    hint: 'Enkel skala som alle forstår.',
  },
  {
    label: 'Åpen tilbakemelding',
    questionText: 'Hva vil du si er det viktigste å forbedre?',
    questionType: 'long_text',
    hint: 'Gir utfyllende innspill til AMU.',
  },
]

const AML_BLOCK: PurposeSuggestion[] = [
  {
    label: 'AML § 4-3 — psykososial belastning',
    questionText:
      'Opplever du den psykiske og sosiale belastningen i arbeidet som akseptabel?',
    questionType: 'likert_scale',
    hint: 'Lovpålagt tema — bruk Likert med tydelige ytterpunkter.',
  },
  {
    label: 'AML § 4-3 — medvirkning',
    questionText: 'Har du mulighet til å påvirke beslutninger som angår ditt arbeid?',
    questionType: 'single_select',
    hint: 'Velg én passende formulering i listen over alternativer.',
  },
  {
    label: 'AML § 4-3 — trakassering',
    questionText:
      'Opplever du uønsket seksuell oppmerksomhet, trakassering eller diskriminering på jobben?',
    questionType: 'yes_no',
    hint: 'Ja/Nei gir enkel oversikt i analyse.',
  },
]

const PSYCH: PurposeSuggestion[] = [
  {
    label: 'Stress og balanse',
    questionText: 'Opplever du ofte urealistiske arbeidskrav eller manglende pauser?',
    questionType: 'likert_scale',
    hint: 'Likert passer godt til holdningskartlegging.',
  },
  ...GENERIC.slice(0, 1),
]

const PHYSICAL: PurposeSuggestion[] = [
  {
    label: 'Fysisk miljø',
    questionText: 'Fungerer lys, luft og ergonomi tilfredsstillende på din arbeidsplass?',
    questionType: 'rating_1_to_5',
    hint: 'Kort skala før oppfolging i vernerunden.',
  },
  ...GENERIC,
]

const LEADER: PurposeSuggestion[] = [
  {
    label: 'Tillit til ledelse',
    questionText: 'Har du tillit til at ledelsen tar arbeidsmiljø på alvor?',
    questionType: 'likert_scale',
    hint: 'Vanlig i medarbeiderundersøkelser.',
  },
  ...GENERIC,
]

const NPS_BLOCK: PurposeSuggestion[] = [
  {
    label: 'Anbefaling (NPS)',
    questionText: 'Hvor sannsynlig er det at du anbefaler oss som arbeidsplass (0–10)?',
    questionType: 'nps',
    hint: 'Standard NPS — vises som egen analyse.',
  },
]

const EXIT_BLOCK: PurposeSuggestion[] = [
  {
    label: 'Hovedårsak',
    questionText: 'Hva er den viktigste årsaken til at du slutter?',
    questionType: 'dropdown',
    hint: 'Legg inn forhåndsdefinerte alternativer under «Alternativer».',
  },
  ...GENERIC.slice(1, 2),
]

const ONBOARDING_BLOCK: PurposeSuggestion[] = [
  {
    label: 'Oppstart',
    questionText: 'Har du fått den introduksjonen du trenger i de første ukene?',
    questionType: 'rating_1_to_5',
    hint: 'Mål oppstartsopplevelsen.',
  },
  ...GENERIC,
]

const VENDOR_BLOCK: PurposeSuggestion[] = [
  {
    label: 'Leveranse',
    questionText: 'Oppfylte leverandøren avtalte krav til HMS og etikk i perioden?',
    questionType: 'yes_no',
    hint: 'Enkelt sporbarhet for revisjon.',
  },
  {
    label: 'Dokumentasjon',
    questionText: 'Mottok dere nødvendig dokumentasjon (risikovurdering, rutiner) i tide?',
    questionType: 'multiple_choice',
    hint: 'Legg inn alternative svar som passer leveransen.',
  },
]

/** Normaliser fritekst formål for enkel nøkkelord-matching (kun forslag — ikke rettslig klassifisering). */
function normPurpose(p: string | null | undefined): string {
  return (p ?? '').trim().toLowerCase()
}

/**
 * Returnerer forslag til spørsmål basert på undersøkelsens formålstekst og type.
 * Brukes i byggeren — ingen tekniske forutsetninger for brukeren.
 */
export function suggestionsForSurveyPurpose(
  purpose: string | null | undefined,
  surveyType: string,
): PurposeSuggestion[] {
  const t = normPurpose(purpose)
  const out: PurposeSuggestion[] = []

  const pushUnique = (items: PurposeSuggestion[]) => {
    for (const item of items) {
      if (!out.some((x) => x.questionText === item.questionText)) out.push(item)
    }
  }

  if (surveyType === 'external') {
    pushUnique(VENDOR_BLOCK)
    return out.slice(0, 8)
  }

  if (/\bpsykososial|stress|trivsel|psykisk|belastning\b/.test(t)) pushUnique(PSYCH)
  if (/\bpsykososialt|arbeidsmiljø|medarbeider|climate|klima\b/.test(t)) pushUnique(PSYCH)
  if (/\bfysisk|ergonomi|støy|lys|luft\b/.test(t)) pushUnique(PHYSICAL)
  if (/\bledelse|tillit|kommunikasjon\b/.test(t)) pushUnique(LEADER)
  if (/\banbefal|nps|loyalitet\b/.test(t)) pushUnique(NPS_BLOCK)
  if (/\bexit|slutt|avgang|oppsigelse\b/.test(t)) pushUnique(EXIT_BLOCK)
  if (/\bonboarding|oppstart|nyansatt\b/.test(t)) pushUnique(ONBOARDING_BLOCK)
  if (/\baml|§\s*4|lov|lovkrav|verneombud\b/.test(t) || /arbeidsmilj[oø]loven/.test(t)) pushUnique(AML_BLOCK)

  pushUnique(GENERIC)

  if (out.length === 0) pushUnique([...GENERIC, ...AML_BLOCK.slice(0, 2)])

  return out.slice(0, 10)
}

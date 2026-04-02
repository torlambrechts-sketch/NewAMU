/**
 * Psykososial arbeidsmiljø — spørsmålsmal inspirert av vanlig praksis i Norge
 * (kartlegging av krav, kontroll, støtte, rolle, endring m.m.).
 * Ikke en offisiell COPSOQ/QPSNordic-kopi — tilpass og valider mot egen risikovurdering.
 */

import type { PsykosocialDimension, SurveyQuestion } from '../types/orgHealth'

export const PSYKOSOCIAL_DIMENSION_ORDER: PsykosocialDimension[] = [
  'krav_tempo',
  'kontroll',
  'stotte',
  'anerkjennelse_utvikling',
  'rolle_forventninger',
  'endring_informasjon',
  'respekt_samarbeid',
]

export const PSYKOSOCIAL_DIMENSION_LABELS: Record<PsykosocialDimension, { title: string; hint: string }> = {
  krav_tempo: {
    title: 'Krav og tempo',
    hint: 'Belastning, arbeidsmengde og tidspress — sentralt i kartlegging av psykososiale risiko.',
  },
  kontroll: {
    title: 'Kontroll og medvirkning',
    hint: 'Mulighet til å påvirke egen arbeidssituasjon (jfr. krav-kontroll-modellen).',
  },
  stotte: {
    title: 'Sosial støtte',
    hint: 'Støtte fra leder og kollegaer — beskyttende faktor.',
  },
  anerkjennelse_utvikling: {
    title: 'Anerkjennelse og utvikling',
    hint: 'Tilbakemelding og muligheter for kompetanseutvikling.',
  },
  rolle_forventninger: {
    title: 'Rolle og forventninger',
    hint: 'Tydelighet i mål og ansvar reduserer konflikt og stress.',
  },
  endring_informasjon: {
    title: 'Endring og informasjon',
    hint: 'AML forventer medvirkning og informasjon ved endringer som kan påvirke arbeidsmiljøet.',
  },
  respekt_samarbeid: {
    title: 'Respekt og samarbeid',
    hint: 'Grunnlag for verdighet og inkludering; ved bekymring — følg opp strukturert (evt. varsling).',
  },
}

/** Likert 1–5: etter normalisering skal høyere tall = bedre opplevd arbeidsmiljø. */
export const LIKERT_SCALE_ANCHORS_NB = {
  low: 'Helt uenig',
  high: 'Helt enig',
} as const

const FIXED_IDS = {
  krav_ok: 'psyk-krav-ok',
  krav_press: 'psyk-krav-press',
  kontroll1: 'psyk-kontroll-1',
  kontroll2: 'psyk-kontroll-2',
  stotte_leder: 'psyk-stotte-leder',
  stotte_koll: 'psyk-stotte-koll',
  anerk1: 'psyk-anerk-1',
  anerk2: 'psyk-anerk-2',
  rolle1: 'psyk-rolle-1',
  rolle2: 'psyk-rolle-2',
  endring: 'psyk-endring',
  respekt: 'psyk-respekt',
  fritekst: 'psyk-fritekst',
} as const

/**
 * Standard spørsmål — reverseScored betyr at «enig» indikerer belastning;
 * snitt inverteres (6−verdi) før aggregering slik at høyere alltid er bedre.
 * Stabile ID-er for konsistent lagring og aggregering.
 */
export function buildPsykosocialQuestions(): SurveyQuestion[] {
  const q = (
    id: string,
    text: string,
    dimension: PsykosocialDimension,
    reverseScored: boolean,
  ): SurveyQuestion => ({
    id,
    text,
    type: 'likert_5',
    required: true,
    dimension,
    reverseScored,
  })

  return [
    q(
      FIXED_IDS.krav_ok,
      'Jeg opplever at arbeidsmengden er forsvarlig i forhold til den tiden jeg har til rådighet.',
      'krav_tempo',
      false,
    ),
    q(FIXED_IDS.krav_press, 'Jeg opplever ofte tidspress som er vanskelig å håndtere.', 'krav_tempo', true),
    q(
      FIXED_IDS.kontroll1,
      'Jeg har reell innflytelse på hvordan jeg utfører arbeidsoppgavene mine.',
      'kontroll',
      false,
    ),
    q(
      FIXED_IDS.kontroll2,
      'Jeg kan i rimelig grad påvirke beslutninger som angår mitt arbeid.',
      'kontroll',
      false,
    ),
    q(
      FIXED_IDS.stotte_leder,
      'Min nærmeste leder gir meg støtte når situasjonen krever det.',
      'stotte',
      false,
    ),
    q(
      FIXED_IDS.stotte_koll,
      'På arbeidsplassen hjelper vi hverandre og samarbeider godt.',
      'stotte',
      false,
    ),
    q(
      FIXED_IDS.anerk1,
      'Min innsats blir sett og verdsatt på en rettferdig måte.',
      'anerkjennelse_utvikling',
      false,
    ),
    q(
      FIXED_IDS.anerk2,
      'Jeg får mulighet til å lære og utvikle meg i jobben.',
      'anerkjennelse_utvikling',
      false,
    ),
    q(FIXED_IDS.rolle1, 'Jeg vet hva som forventes av meg i jobben.', 'rolle_forventninger', false),
    q(
      FIXED_IDS.rolle2,
      'Målene og prioritetene i jobben er tydelig kommunisert.',
      'rolle_forventninger',
      false,
    ),
    q(
      FIXED_IDS.endring,
      'Når det skjer endringer som berører meg, får jeg tilstrekkelig informasjon og involvering.',
      'endring_informasjon',
      false,
    ),
    q(
      FIXED_IDS.respekt,
      'Jeg opplever at jeg blir møtt med respekt av kollegaer og ledere.',
      'respekt_samarbeid',
      false,
    ),
    {
      id: FIXED_IDS.fritekst,
      text: 'Har du forslag til tiltak, eller merknader til arbeidsmiljøet? (valgfritt)',
      type: 'text',
      required: false,
      dimension: undefined,
    },
  ]
}

export const PSYKOSOCIAL_SURVEY_INTRO = `Denne undersøkelsen kartlegger det psykososiale arbeidsmiljøet — blant annet krav, kontroll, støtte og samarbeid. Resultatene brukes i det systematiske HMS-arbeidet (jfr. arbeidsmiljøloven og internkontroll). Svar så ærlig du kan. Det er ingen «riktige» svar.`

export const PSYKOSOCIAL_PRIVACY_NOTICE = `Personvern: Ved anonym modus lagres ikke fritekst innhold — kun om du har skrevet noe. Tall vises aggregert. Ved få svar (under ca. 5) bør resultater tolkes forsiktig og ikke brukes til å identifisere enkeltpersoner eller små grupper.`

/** Minimum antall svar før det er meningsfullt å dele detaljert fordeling (anbefaling). */
export const MIN_RESPONSES_FOR_CONFIDENT_DETAIL = 5

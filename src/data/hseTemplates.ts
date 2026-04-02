import type { HseChecklistItem } from '../types/hse'

export const SAFETY_ROUND_TEMPLATE_ID = 'vernerunde-standard-v1'

/**
 * Vernerunde / HMS-runde — punkter med referanse til typiske krav i arbeidsmiljøloven.
 * Tilpass til virksomhet og risiko — ikke juridisk rådgivning.
 */
export const DEFAULT_SAFETY_ROUND_CHECKLIST: HseChecklistItem[] = [
  {
    id: 'sr1',
    label: 'Orden og ryddighet i arbeidsområder',
    lawRef: 'AML § 4-1 (trygge arbeidsomgivelser)',
  },
  {
    id: 'sr2',
    label: 'Maskiner og verneutstyr er kontrollert og fungerer',
    lawRef: 'AML § 4-1, § 4-2 (maskiner, verktøy)',
  },
  {
    id: 'sr3',
    label: 'Eksos, støv, kjemikalier — håndtering og avtrekk',
    lawRef: 'AML § 4-1 (helsefarlige faktorer)',
  },
  {
    id: 'sr4',
    label: 'Ergonomi og arbeidsstillinger vurdert',
    lawRef: 'AML § 4-1 (fysisk arbeidsmiljø)',
  },
  {
    id: 'sr5',
    label: 'Elektrisk anlegg og belysning tilfredsstillende',
    lawRef: 'AML § 4-1, forskrifter om elektriske lavspenningsanlegg der relevant',
  },
  {
    id: 'sr6',
    label: 'Brannvern: slukkeutstyr, rømningsveier, merking',
    lawRef: 'AML § 4-1, brannforskrifter',
  },
  {
    id: 'sr7',
    label: 'Førstehjelp og varsling ved ulykker er kjent',
    lawRef: 'AML § 4-1, internkontroll',
  },
  {
    id: 'sr8',
    label: 'Psykososialt miljø: mulighet for å melde fra om problemer',
    lawRef: 'AML § 4-3 (kartlegging), § 4-1',
  },
  {
    id: 'sr9',
    label: 'Avvik og nestenulykker er meldt og fulgt opp',
    lawRef: 'AML § 3-2 (systematisk HMS)',
  },
]

/** Strukturert sporbarhet etter AML kap. 3–4 (illustrativ oversikt) */
export const AML_VERNEOMBUD_STRUCTURE: { title: string; points: string[]; lawRef: string }[] = [
  {
    title: 'Systematisk HMS (§ 3-1, § 3-2)',
    points: [
      'Rutiner for risikovurdering og revisjon',
      'Dokumentasjon av kartlegging og tiltak',
      'Medvirkning fra arbeidstakere og verneombud',
    ],
    lawRef: 'Arbeidsmiljøloven kap. 3',
  },
  {
    title: 'Kartlegging og risikovurdering (§ 4-3)',
    points: [
      'Kartlegge fysiske og psykososiale forhold',
      'Vurdere risiko og iverksette tiltak',
    ],
    lawRef: 'AML § 4-3',
  },
  {
    title: 'Verneombud (§§ 6-1–6-4)',
    points: [
      'Verneombud valgt der plikt eller behov',
      'Tid og ressurser til vervet',
      'Rett til opplæring og deltakelse i vernerunder',
    ],
    lawRef: 'AML kap. 6',
  },
  {
    title: 'Arbeidsutstyr og maskiner (§ 4-2)',
    points: ['Egnede verne tiltak', 'Vedlikehold og kontroll'],
    lawRef: 'AML § 4-2',
  },
]

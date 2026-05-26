// Non-component tokens shared across the Internkontroll section
// renderers. Lives in its own .ts file so the .tsx primitives file
// stays "components-only" (fast-refresh rule).

import type { IkKontroll, IkKravStatus } from '../useInternkontrollPageData'
import type { ControlFrequencyHint } from '../../../../types/complianceLayer'

// ── KATEGORIER — functional groupings of krav/kontroller/tiltak ─────────────
// Mirrors the design pattern from Sjekklister: a sidebar filter list with
// icon + label + count. Categorisation is derived from the paragraph code
// (law_ref) so we don't need a new DB table — each krav resolves to exactly
// one category via `categorizeLawRef()` below. Categories sit at a higher
// abstraction than "Rammeverk": one category groups krav across multiple
// regelverk (e.g. "Personvern" pulls in both GDPR and IK-f § 5 references).
// Naming mirrors `compliance_checklist_categories` on the Sjekklister
// page so the two surfaces feel like the same product. No dedicated
// "HMS-arbeid" bucket: the whole module IS HMS-arbeid, so a sibling
// category by that name was redundant. Rows that used to land there
// now sit under "Internkontroll og avvik" (the IK-forskrift + management-
// system core) or "Arbeidsmiljø" (ISO 45001 leadership/context/planning).
export const IK_CATEGORIES = [
  { id: 'arbeidsmiljo', label: 'Arbeidsmiljø', icon: 'HardHat' },
  { id: 'verneombud-amu', label: 'Verneombud og AMU', icon: 'Users' },
  { id: 'varsling', label: 'Varsling', icon: 'Megaphone' },
  { id: 'ansettelse', label: 'Ansettelse og opplæring', icon: 'UserCheck' },
  { id: 'internkontroll-avvik', label: 'Internkontroll og avvik', icon: 'ShieldCheck' },
  { id: 'personvern', label: 'Personvern', icon: 'Lock' },
  { id: 'leverandorkjeder', label: 'Leverandørkjeder', icon: 'Truck' },
  { id: 'andre', label: 'Andre krav', icon: 'Tag' },
] as const

export type IkCategoryId = (typeof IK_CATEGORIES)[number]['id']
export type IkCategoryFilter = IkCategoryId | 'all'

/**
 * Map a paragraph reference to its functional category. Used both to
 * tag krav at hook time and to filter kontroller/tiltak whose covering
 * paragraphs all live in the same bucket.
 *
 * The match order matters: more specific prefixes (e.g. AML § 2A —
 * Varsling) must run before more general ones (AML § 2 — generic).
 */
export function categorizeLawRef(ref: string): IkCategoryId {
  // Whistleblowing (AML chapter 2A) — must check BEFORE generic § 2-x.
  if (/^AML §\s?2A/.test(ref)) return 'varsling'
  // Internkontroll-management — AML §3 (virkemidler / systematic HSE),
  // IK-forskriften (the meta-framework), the management-system clauses
  // shared across the other ISO standards. Sits under the "Internkontroll
  // og avvik" label that mirrors Sjekklister's wording.
  if (/^AML §\s?3-/.test(ref)) return 'internkontroll-avvik'
  if (/^IK-f /.test(ref)) return 'internkontroll-avvik'
  if (/^ISO (9001|14001|27001)/.test(ref)) return 'internkontroll-avvik'
  // ISO 45001 leadership/context/planning/support belong with arbeidsmiljø
  // (they govern HOW the OHS environment is run). Monitoring + improvement
  // (§ 9.2 / § 9.3 / § 10) move to internkontroll-avvik.
  if (/^ISO 45001:2018 §\s?(4|5|6|7|8|9\.1)/.test(ref)) return 'arbeidsmiljo'
  if (/^ISO 45001:2018 §\s?(9\.2|9\.3|10)/.test(ref)) return 'internkontroll-avvik'
  // Work environment + working hours.
  if (/^AML §\s?(4|10)-/.test(ref)) return 'arbeidsmiljo'
  // Verneombud (AML §6) + AMU (AML §7) + drøftingsplikt (AML §8).
  if (/^AML §\s?(6|7|8)-/.test(ref)) return 'verneombud-amu'
  // Employment lifecycle: kontrolltiltak (§9), ansettelse (§14, §14A),
  // diskriminering (§13), opphør (§15), virksomhetsoverdragelse (§16),
  // permisjoner (§12).
  if (/^AML §\s?(9|12|13|14|15|16)/.test(ref)) return 'ansettelse'
  // Personvern.
  if (/^GDPR /.test(ref)) return 'personvern'
  // Supply chain (Åpenhetsloven).
  if (/^Åpenhetsloven /.test(ref)) return 'leverandorkjeder'
  // Reporting + supervision: registrerings- og meldeplikt (§5), tilsyn (§18).
  if (/^AML §\s?(5|18)/.test(ref)) return 'internkontroll-avvik'
  return 'andre'
}

// ── Klarert recommended cadence ─────────────────────────────────────────────
// Per-category baseline + paragraph-specific overrides for the most well-known
// Norwegian compliance cadences. Surfaced in the Gap-analyse "Anbefalt løsning"
// card when no control exists yet, so the user sees what frequency the law
// (or established practice) expects — e.g. AMU-møte minst 4× pr. år (AML § 7-2),
// vernerunde halvårlig, brann-/førstehjelpsøvelse årlig.
//
// Keys for the override map are paragraph-code prefixes (matched with startsWith
// after light normalisation). Order doesn't matter — the lookup picks the
// longest match. Frequency strings match `ControlFrequencyHint` so an "Opprett
// kontroll"-button can pass the value straight through to the editor.
export type RecommendedCadence = {
  frequency: ControlFrequencyHint
  /** Norwegian label shown in UI. */
  label: string
  /** Optional one-line context shown under the cadence (legal basis or
   *  established practice). Empty → only the label is shown. */
  rationale?: string
}

const PARAGRAPH_CADENCE_OVERRIDES: Array<{ prefix: string; cadence: RecommendedCadence }> = [
  {
    prefix: 'AML § 7-2',
    cadence: {
      frequency: 'kvartalsvis',
      label: 'Kvartalsvis',
      rationale: 'AMU-møter minst 4 ganger per år (AML § 7-2 andre ledd).',
    },
  },
  {
    prefix: 'AML § 6',
    cadence: {
      frequency: 'halvarlig',
      label: 'Halvårlig',
      rationale: 'Vernerunde anbefales halvårlig som etablert HMS-praksis.',
    },
  },
  {
    prefix: 'AML § 3-1',
    cadence: {
      frequency: 'arlig',
      label: 'Årlig',
      rationale: 'Systematisk HMS-arbeid skal følges opp og dokumenteres minst årlig.',
    },
  },
  {
    prefix: 'IK-f § 5',
    cadence: {
      frequency: 'arlig',
      label: 'Årlig',
      rationale: 'IK-forskriften § 5 nr. 7 — jevnlig overvåkning og gjennomgang.',
    },
  },
  {
    prefix: 'GDPR Art. 30',
    cadence: {
      frequency: 'arlig',
      label: 'Årlig',
      rationale: 'Behandlingsoversikt gjennomgås årlig og ved endringer.',
    },
  },
  {
    prefix: 'GDPR Art. 35',
    cadence: {
      frequency: 'ad_hoc',
      label: 'Ad hoc',
      rationale: 'DPIA gjennomføres ved ny eller endret behandling med høy risiko.',
    },
  },
  {
    prefix: 'Åpenhetsloven',
    cadence: {
      frequency: 'arlig',
      label: 'Årlig',
      rationale: 'Aktsomhetsvurdering offentliggjøres innen 30. juni hvert år.',
    },
  },
]

const CATEGORY_CADENCE: Record<IkCategoryId, RecommendedCadence> = {
  arbeidsmiljo: { frequency: 'arlig', label: 'Årlig' },
  'verneombud-amu': {
    frequency: 'kvartalsvis',
    label: 'Kvartalsvis',
    rationale: 'AMU-arbeidet skjer gjennom faste møter, normalt kvartalsvis.',
  },
  varsling: {
    frequency: 'arlig',
    label: 'Årlig',
    rationale: 'Varslingsrutinene gjennomgås årlig og ved endringer.',
  },
  ansettelse: {
    frequency: 'ad_hoc',
    label: 'Hendelsesbasert',
    rationale: 'Følger ansettelse, endring eller opphør — ikke fast frekvens.',
  },
  'internkontroll-avvik': {
    frequency: 'arlig',
    label: 'Årlig',
    rationale: 'Ledelsens gjennomgang og IK-revisjon minst årlig.',
  },
  personvern: { frequency: 'arlig', label: 'Årlig' },
  leverandorkjeder: {
    frequency: 'arlig',
    label: 'Årlig',
    rationale: 'Åpenhetsloven krever årlig aktsomhetsvurdering.',
  },
  andre: { frequency: 'arlig', label: 'Årlig' },
}

/** Resolve the Klarert-recommended cadence for a krav. Looks for a paragraph
 *  override first (longest matching prefix wins), then falls back to the
 *  category baseline. */
export function recommendedCadenceFor(ref: string, category: IkCategoryId): RecommendedCadence {
  const normalized = ref.replace(/\s+/g, ' ').trim()
  let bestMatch: RecommendedCadence | null = null
  let bestLen = 0
  for (const entry of PARAGRAPH_CADENCE_OVERRIDES) {
    if (normalized.startsWith(entry.prefix) && entry.prefix.length > bestLen) {
      bestMatch = entry.cadence
      bestLen = entry.prefix.length
    }
  }
  return bestMatch ?? CATEGORY_CADENCE[category]
}

export const MODULE_TABLE_TH =
  'border-b border-neutral-200 bg-neutral-50/60 px-5 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-500'
export const MODULE_TABLE_TR_BODY =
  'border-b border-neutral-100 transition-colors hover:bg-neutral-50/60'

export const STATUS_TONE: Record<
  IkKravStatus,
  { bg: string; text: string; border: string; label: string; dot: string }
> = {
  covered: {
    bg: 'bg-green-100',
    text: 'text-green-900',
    border: 'border-green-200',
    label: 'Dekket',
    dot: '#2f7757',
  },
  partial: {
    bg: 'bg-amber-100',
    text: 'text-amber-900',
    border: 'border-amber-200',
    label: 'Delvis',
    dot: '#c98a2b',
  },
  gap: {
    bg: 'bg-red-100',
    text: 'text-red-900',
    border: 'border-red-200',
    label: 'Gap',
    dot: '#b3382a',
  },
  na: {
    bg: 'bg-neutral-100',
    text: 'text-neutral-700',
    border: 'border-neutral-200',
    label: 'Ikke aktuelt',
    dot: '#a3a3a3',
  },
}

export const PRIO_TONE: Record<
  'kritisk' | 'høy' | 'middels' | 'lav',
  { bg: string; text: string; border: string }
> = {
  kritisk: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-200' },
  høy: { bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-200' },
  middels: { bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200' },
  lav: { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200' },
}

export const TYPE_TONE: Record<
  'forebyggende' | 'oppdagende' | 'korrigerende',
  { bg: string; text: string; label: string }
> = {
  forebyggende: { bg: '#e7efe9', text: '#1a3d32', label: 'Forebyggende' },
  oppdagende: { bg: '#DBEAFE', text: '#1E40AF', label: 'Oppdagende' },
  korrigerende: { bg: '#FFEDD5', text: '#9A3412', label: 'Korrigerende' },
}

export type IkSectionId =
  | 'oversikt'
  | 'krav'
  | 'kontroller'
  | 'gap'
  | 'aarshjul'
  | 'tiltak'
  | 'prosjekter'
  | 'revisjon'

import type { FrameworkId } from '../frameworkParagraphs'
export type IkFrameworkFilter = FrameworkId | 'all'

// Re-exported here so primitives can reference status type without
// needing to import the broader useInternkontrollPageData shape.
export type { IkKontroll }

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

// ── Cadence label ───────────────────────────────────────────────────────────
// The recommended cadence + legal rationale per paragraph used to live here as
// a hardcoded TS table. It now lives in `regulation_clauses.recommended_cadence`
// / `cadence_rationale` and is read straight off the IkKrav (`recommendedCadence`,
// `cadenceRationale`). Admins can edit cadence per org via the table; the
// frontend just needs to render the enum value as a Norwegian label.
const CADENCE_LABELS: Record<ControlFrequencyHint, string> = {
  arlig: 'Årlig',
  halvarlig: 'Halvårlig',
  kvartalsvis: 'Kvartalsvis',
  manedlig: 'Månedlig',
  ukentlig: 'Ukentlig',
  daglig: 'Daglig',
  ad_hoc: 'Ved hendelse',
}

/** Display label for a ControlFrequencyHint. Falls back to 'Årlig' as the
 *  catch-all when the cadence is unknown — matches the most conservative
 *  IK-forskriften baseline. */
export function cadenceLabel(cadence: ControlFrequencyHint | null | undefined): string {
  if (!cadence) return 'Årlig'
  return CADENCE_LABELS[cadence] ?? 'Årlig'
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

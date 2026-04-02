import type { ChecklistTemplate, HseChecklistItem } from '../types/hse'

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

// ─── Pre-built department checklist templates ─────────────────────────────────

const now = new Date().toISOString()

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'tpl-standard',
    name: 'Standard vernerunde (alle avdelinger)',
    items: DEFAULT_SAFETY_ROUND_CHECKLIST,
    createdAt: now,
  },
  {
    id: 'tpl-helse',
    name: 'Helse og omsorg',
    department: 'Helse',
    items: [
      { id: 'h1', label: 'Smittevern og hygieneprosedyrer følges', lawRef: 'AML §4-1, Smittevernloven' },
      { id: 'h2', label: 'Vold- og trusselrisiko kartlagt og tiltak iverksatt', lawRef: 'AML §4-3, Arbeidstilsynets veiledning' },
      { id: 'h3', label: 'Alenearbeid — rutiner for varsling og sjekk', lawRef: 'AML §4-1 (2)' },
      { id: 'h4', label: 'Løft og forflytningsteknikk er opplært og fulgt', lawRef: 'AML §4-1, Løfteforskriften' },
      { id: 'h5', label: 'Farlige legemidler — håndtering og oppbevaring', lawRef: 'Legemiddelforskriften' },
      { id: 'h6', label: 'Psykososialt arbeidsmiljø — trivselssamtale gjennomført', lawRef: 'AML §4-3' },
      { id: 'h7', label: 'Avvikssystem kjent og brukt aktivt', lawRef: 'IK-f §5 nr. 4' },
    ],
    createdAt: now,
  },
  {
    id: 'tpl-skole',
    name: 'Skole og barnehage',
    department: 'Skole',
    items: [
      { id: 's1', label: 'Uteområde — fallunderlag, lekeapparater kontrollert', lawRef: 'AML §4-1, Plan- og bygningsloven' },
      { id: 's2', label: 'Inneklima — ventilasjon, CO₂, temperatur vurdert', lawRef: 'AML §4-1, Forskrift om miljørettet helsevern' },
      { id: 's3', label: 'Kjemikalier i vaktmester/renholds-rom — korrekt merking', lawRef: 'REACH, AML §4-1' },
      { id: 's4', label: 'Vold og trusler mot ansatte — handlingsplan kjent', lawRef: 'AML §4-3' },
      { id: 's5', label: 'Beredskapsplan og brannøvelse gjennomført siste 12 mnd', lawRef: 'Brann- og eksplosjonsvernloven' },
      { id: 's6', label: 'Ergonomi — pulter/stoler tilpasset ansatte og elever', lawRef: 'AML §4-1' },
      { id: 's7', label: 'Avviksmeldinger siste periode behandlet', lawRef: 'IK-f §5 nr. 4' },
    ],
    createdAt: now,
  },
  {
    id: 'tpl-kontor',
    name: 'Kontor og administrasjon',
    department: 'Kontor',
    items: [
      { id: 'k1', label: 'Ergonomi — skjerm, mus, stol og belysning vurdert', lawRef: 'AML §4-1, Bildeskjermforskriften' },
      { id: 'k2', label: 'Inneklima — temperatur, ventilasjon og luftkvalitet', lawRef: 'AML §4-1' },
      { id: 'k3', label: 'Elektrisk — kabler og stikkontakter i orden', lawRef: 'AML §4-1, Lavspenningsforskriften' },
      { id: 'k4', label: 'Rømningsveier fri og merket', lawRef: 'Brann- og eksplosjonsvernloven' },
      { id: 'k5', label: 'Psykososialt — stress, arbeidsmengde og konflikter kartlagt', lawRef: 'AML §4-3' },
      { id: 'k6', label: 'Personvern — låsbart arkiv, skjerm ikke synlig for uvedkommende', lawRef: 'GDPR art. 32' },
    ],
    createdAt: now,
  },
  {
    id: 'tpl-produksjon',
    name: 'Produksjon og lager',
    department: 'Produksjon',
    items: [
      { id: 'p1', label: 'Maskiner og verneutstyr kontrollert og godkjent', lawRef: 'AML §4-2, Maskinforskriften' },
      { id: 'p2', label: 'Verneutstyr tilgjengelig og brukes korrekt', lawRef: 'AML §4-1' },
      { id: 'p3', label: 'Kjemikalier — sikkerhetsdatablad oppdatert og tilgjengelig', lawRef: 'REACH, Kjemikalieforskriften' },
      { id: 'p4', label: 'Støy — målinger gjennomført, hørselsvern tilgjengelig', lawRef: 'AML §4-1, Støyforskriften' },
      { id: 'p5', label: 'Trucker og løfteutstyr — sertifisering i orden', lawRef: 'Løfteforskriften' },
      { id: 'p6', label: 'Ryddighet og orden på arbeidsstasjoner', lawRef: 'AML §4-1' },
      { id: 'p7', label: 'Brannvern og slukkeutstyr kontrollert', lawRef: 'Brann- og eksplosjonsvernloven' },
      { id: 'p8', label: 'Farlige arbeidsoperasjoner — SJA gjennomført', lawRef: 'IK-f §5 nr. 2, AML §3-1' },
    ],
    createdAt: now,
  },
]

// ─── SJA seed rows ────────────────────────────────────────────────────────────

export const SJA_STEP_PROMPTS = [
  'Forberedelse og rigging',
  'Selve arbeidsoperasjonen',
  'Avslutning og rydding',
  'Nødsituasjon / evakuering',
]

// ─── Training kind labels and requirements ────────────────────────────────────

export const TRAINING_KIND_LABELS: Record<string, string> = {
  hms_40hr:          '40-timers HMS-kurs (AML §3-5 / §6-5)',
  fire_warden:       'Brannvernleder',
  first_aid:         'Førstehjelp',
  ppe_usage:         'Verneutstyr',
  chemical_handling: 'Kjemikaliehåndtering',
  custom:            'Egendefinert',
}

export const TRAINING_EXPIRY_YEARS: Partial<Record<string, number>> = {
  first_aid: 3,
  fire_warden: 3,
  ppe_usage: 5,
  chemical_handling: 3,
}

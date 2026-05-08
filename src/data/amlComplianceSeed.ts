// AML compliance dashboard — typed seed data ported from the Klarert
// design kit (ui_kits/aml-compliance/amlSeed.js). All copy in
// Norwegian Bokmål. "Today" anchored at 8. mai 2026 to drive the
// årshjul / overdue logic for the seed render.
//
// This file is the demo data for the visual pass. Phase B replaces it
// with real hooks; the shapes here match what those hooks will return.

export type AmlToday = { y: number; m: number; d: number }
export type AmlComplianceScore = {
  pct: number
  delta: number
  signed: string
  signer: string
  tasksOpen: number
  tasksOverdue: number
  tasksDueSoon: number
  modulesGreen: number
  modulesAmber: number
  modulesRed: number
}

export type AmlModuleStatus = 'green' | 'amber' | 'red'
export type AmlModuleSummary = {
  id: string
  title: string
  /** Lucide icon name. */
  icon: string
  law: string
  desc: string
  status: AmlModuleStatus
  progress: number
  metric: { label: string; value: string }
  next: { label: string; icon: string }
  last: string
  open: number
  overdue: number
  owner: string
}

export type AmlWheelState = 'done' | 'now' | 'upcoming' | 'overdue'
export type AmlWheelItem = {
  /** 0-indexed month: 0 = Jan, 11 = Dec */
  month: number
  /** Ring index — 0 = outer (AMU & verneombud), 5 = inner (Beredskap). */
  ring: number
  label: string
  state: AmlWheelState
  law: string
}
export type AmlRingLegendEntry = { id: number; label: string; color: string }

export type AmlTaskSeverity = 'critical' | 'high' | 'medium' | 'low'
export type AmlTask = {
  id: string
  title: string
  module: string
  law: string
  severity: AmlTaskSeverity
  owner: string
  due: string
  overdue: boolean
  daysLate?: number
}

export type AmlFeedKind = 'lov' | 'klarert' | 'tip'
export type AmlFeedItem = {
  kind: AmlFeedKind
  date: string
  title: string
  body: string
  cta: string
  pinned?: boolean
}

// ── Seed values (port from the design kit) ──────────────────────────────

export const AML_TODAY: AmlToday = { y: 2026, m: 4, d: 8 } // 8. mai

export const AML_SCORE: AmlComplianceScore = {
  pct: 87,
  delta: 4,
  signed: '14. apr 2026',
  signer: 'Marit Solberg, AMU-leder',
  tasksOpen: 23,
  tasksOverdue: 4,
  tasksDueSoon: 9,
  modulesGreen: 9,
  modulesAmber: 3,
  modulesRed: 1,
}

export const AML_MODULES: AmlModuleSummary[] = [
  {
    id: 'amu', title: 'AMU', icon: 'Users', law: 'AML § 7-1',
    desc: 'Arbeidsmiljøutvalg — møter, saksliste, protokoll og årsrapport.',
    status: 'green', progress: 100,
    metric: { label: 'Møter i år', value: '2 / 4' },
    next: { label: 'Møte 3 — 21. aug', icon: 'Calendar' },
    last: 'Protokoll signert 14. apr',
    open: 1, overdue: 0, owner: 'M. Solberg',
  },
  {
    id: 'verneombud', title: 'Verneombud', icon: 'ShieldCheck', law: 'AML § 6-1 / § 6-2',
    desc: 'Valg, opplæring og virksomhetsområder for verneombud.',
    status: 'green', progress: 100,
    metric: { label: 'Med gyldig 40-t kurs', value: '7 / 7' },
    next: { label: 'Nyvalg — sept 2027', icon: 'Vote' },
    last: 'Periode bekreftet 02. feb',
    open: 0, overdue: 0, owner: 'Personalavd.',
  },
  {
    id: 'ros', title: 'ROS-analyser', icon: 'ShieldAlert', law: 'AML § 3-1 · IK § 5 nr. 6',
    desc: 'Risikovurderinger for områder, prosesser og roller.',
    status: 'amber', progress: 72,
    metric: { label: 'Aktive analyser', value: '11' },
    next: { label: 'Revider lager — 02. jun', icon: 'CalendarClock' },
    last: 'Sveiseverksted oppdatert 28. apr',
    open: 6, overdue: 1, owner: 'HMS-koord.',
  },
  {
    id: 'vernerunder', title: 'Vernerunder', icon: 'Hammer', law: 'AML § 3-1 (2) c',
    desc: 'Planlagte runder med sjekkliste, funn og signaturer.',
    status: 'green', progress: 90,
    metric: { label: 'Gjennomført Q1+Q2', value: '4 / 4' },
    next: { label: 'Runde Q3 — 17. sep', icon: 'CalendarClock' },
    last: 'Verksted vest 06. mai',
    open: 3, overdue: 0, owner: 'M. Solberg',
  },
  {
    id: 'avvik', title: 'Avvik & forbedring', icon: 'Megaphone', law: 'AML § 3-1 (2) e',
    desc: 'Innmelding, tiltak og lukking av avvik og hendelser.',
    status: 'amber', progress: 64,
    metric: { label: 'Åpne over 30 dg', value: '6' },
    next: { label: 'Frist — gulvbelegg', icon: 'AlertTriangle' },
    last: 'Lukket 8 i april',
    open: 14, overdue: 2, owner: 'Linjeleder',
  },
  {
    id: 'sykefravar', title: 'Sykefravær & IA', icon: 'HeartPulse', law: 'AML § 4-6 · Folketrygdloven',
    desc: 'Oppfølgingsplaner, dialogmøter og tilrettelegging.',
    status: 'red', progress: 41,
    metric: { label: 'Plan innen 4 uker', value: '3 manglende' },
    next: { label: 'Dialogmøte 1 — 12. mai', icon: 'CalendarClock' },
    last: 'Plan opprettet 02. mai',
    open: 5, overdue: 3, owner: 'Personalavd.',
  },
  {
    id: 'opplaering', title: 'HMS-opplæring', icon: 'GraduationCap', law: 'AML § 3-5 / § 6-5',
    desc: 'Lovpålagt opplæring for ledere, verneombud og AMU-medlemmer.',
    status: 'green', progress: 95,
    metric: { label: 'Fullført', value: '38 / 40' },
    next: { label: 'Påmelding 40-t — 03. jun', icon: 'BookOpen' },
    last: 'Daglig leder fullførte 28. apr',
    open: 2, overdue: 0, owner: 'HR',
  },
  {
    id: 'bht', title: 'Bedriftshelsetjeneste', icon: 'Stethoscope', law: 'AML § 3-3 · Forskrift om BHT',
    desc: 'Plan, samarbeidsavtale og periodiske helseundersøkelser.',
    status: 'green', progress: 100,
    metric: { label: 'Gyldig avtale', value: 'Ja' },
    next: { label: 'Periodisk us. — sept', icon: 'Calendar' },
    last: 'Plan godkjent 18. mar',
    open: 0, overdue: 0, owner: 'Personalavd.',
  },
  {
    id: 'arbeidstid', title: 'Arbeidstid', icon: 'Clock', law: 'AML kap. 10',
    desc: 'Arbeidsplan, gjennomsnittsberegning og overtidsoversikt.',
    status: 'amber', progress: 78,
    metric: { label: 'Snitt overtid / mnd', value: '11,4 t' },
    next: { label: 'Avtale — gj.snitt H2', icon: 'FileSignature' },
    last: 'Plan publisert 30. apr',
    open: 2, overdue: 0, owner: 'Drift',
  },
  {
    id: 'sja', title: 'Sikker jobbanalyse', icon: 'ClipboardList', law: 'IK § 5 nr. 6',
    desc: 'SJA før kritiske enkeltoppdrag (varmt arbeid, høyder).',
    status: 'green', progress: 100,
    metric: { label: 'SJA siste 30 dg', value: '6' },
    next: { label: 'Maling tak — 14. mai', icon: 'CalendarClock' },
    last: 'Stillas øst 06. mai',
    open: 1, overdue: 0, owner: 'Linjeleder',
  },
  {
    id: 'arbeidsmiljo', title: 'Arbeidsmiljøkartlegging', icon: 'BarChart2', law: 'AML § 3-1 (2) c',
    desc: 'Periodisk undersøkelse av psykososialt og fysisk arbeidsmiljø.',
    status: 'green', progress: 100,
    metric: { label: 'Svarprosent 2025', value: '83 %' },
    next: { label: 'Ny måling — 06. okt', icon: 'BarChart2' },
    last: 'Rapport delt 12. feb',
    open: 0, overdue: 0, owner: 'AMU',
  },
  {
    id: 'beredskap', title: 'Beredskap & brann', icon: 'Flame', law: 'AML § 3-1 · Brann- og eksplosjonsv.',
    desc: 'Beredskapsplan, evakueringsøvelse og brannvernleder.',
    status: 'amber', progress: 68,
    metric: { label: 'Sist øvet', value: 'okt 2025' },
    next: { label: 'Øvelse — 09. jun', icon: 'AlertTriangle' },
    last: 'Plan revidert 11. apr',
    open: 4, overdue: 1, owner: 'Drift',
  },
]

export const AML_RING_LEGEND: AmlRingLegendEntry[] = [
  { id: 0, label: 'AMU & verneombud',  color: '#1a3d32' },
  { id: 1, label: 'Vernerunder & SJA', color: '#2f7757' },
  { id: 2, label: 'ROS & avvik',       color: '#c98a2b' },
  { id: 3, label: 'Opplæring',         color: '#1d4ed8' },
  { id: 4, label: 'Sykefravær & BHT',  color: '#7c3aed' },
  { id: 5, label: 'Beredskap & annet', color: '#525252' },
]

export const AML_WHEEL: AmlWheelItem[] = [
  // JAN
  { month: 0, ring: 0, label: 'AMU årsplan vedtas', state: 'done', law: '§ 7-2' },
  { month: 0, ring: 2, label: 'HMS-mål for året', state: 'done', law: 'IK § 5 nr. 4' },
  { month: 0, ring: 5, label: 'Internkontroll: årsrevisjon', state: 'done', law: 'IK § 5' },
  // FEB
  { month: 1, ring: 0, label: 'AMU-møte 1', state: 'done', law: '§ 7-2' },
  { month: 1, ring: 4, label: 'Sykefraværsstatistikk Q4', state: 'done', law: '§ 4-6' },
  { month: 1, ring: 3, label: 'Opplæringsplan signert', state: 'done', law: '§ 3-5' },
  // MAR
  { month: 2, ring: 1, label: 'Vernerunder Q1', state: 'done', law: '§ 3-1 c' },
  { month: 2, ring: 2, label: 'ROS — sveiseverksted', state: 'done', law: '§ 3-1' },
  { month: 2, ring: 4, label: 'BHT-plan godkjennes', state: 'done', law: '§ 3-3' },
  // APR
  { month: 3, ring: 0, label: 'Protokoll AMU 1 signert', state: 'done', law: '§ 7-2' },
  { month: 3, ring: 5, label: 'Beredskapsplan revideres', state: 'done', law: '§ 3-1' },
  // MAI (current)
  { month: 4, ring: 0, label: 'AMU-møte 2', state: 'now', law: '§ 7-2' },
  { month: 4, ring: 1, label: 'Vernerunder Q2', state: 'now', law: '§ 3-1 c' },
  { month: 4, ring: 4, label: 'Dialogmøte 1 — 3 saker', state: 'overdue', law: '§ 4-6' },
  { month: 4, ring: 2, label: 'ROS-revisjon — lager', state: 'now', law: '§ 3-1' },
  // JUN
  { month: 5, ring: 5, label: 'Evakueringsøvelse', state: 'upcoming', law: 'Brann- og eksplosjonsv.' },
  { month: 5, ring: 1, label: 'SJA — varmt arbeid sommer', state: 'upcoming', law: 'IK § 5 nr. 6' },
  { month: 5, ring: 3, label: '40-t kurs påmelding', state: 'upcoming', law: '§ 6-5' },
  // JUL
  { month: 6, ring: 4, label: 'Sommer — BHT på vakt', state: 'upcoming', law: '§ 3-3' },
  { month: 6, ring: 0, label: 'Ferieavvikling AMU pause', state: 'upcoming', law: '—' },
  // AUG
  { month: 7, ring: 0, label: 'AMU-møte 3', state: 'upcoming', law: '§ 7-2' },
  { month: 7, ring: 3, label: 'Ny ansatt-opplæring', state: 'upcoming', law: '§ 3-5' },
  // SEP
  { month: 8, ring: 1, label: 'Vernerunder Q3', state: 'upcoming', law: '§ 3-1 c' },
  { month: 8, ring: 4, label: 'Periodisk helseunders.', state: 'upcoming', law: '§ 3-3' },
  { month: 8, ring: 2, label: 'IK-revisjon halvår', state: 'upcoming', law: 'IK § 5' },
  // OKT
  { month: 9, ring: 2, label: 'Arbeidsmiljøundersøkelse', state: 'upcoming', law: '§ 3-1 c' },
  { month: 9, ring: 5, label: 'Beredskapsøvelse — vinter', state: 'upcoming', law: '§ 3-1' },
  // NOV
  { month: 10, ring: 0, label: 'AMU-møte 4', state: 'upcoming', law: '§ 7-2' },
  { month: 10, ring: 0, label: 'Årsrapport AMU', state: 'upcoming', law: '§ 7-2 (6)' },
  { month: 10, ring: 4, label: 'Sykefraværsanalyse Q3', state: 'upcoming', law: '§ 4-6' },
  // DES
  { month: 11, ring: 1, label: 'Vernerunder Q4', state: 'upcoming', law: '§ 3-1 c' },
  { month: 11, ring: 3, label: 'Kompetansegap 2027', state: 'upcoming', law: '§ 3-5' },
  { month: 11, ring: 5, label: 'Plan 2027 — IK', state: 'upcoming', law: 'IK § 5' },
]

export const AML_TASKS: AmlTask[] = [
  { id: 'AML-2026-041', title: 'Dialogmøte 1 — sak #IA-118', module: 'Sykefravær', law: '§ 4-6 (3)', severity: 'critical', owner: 'A. Vik', due: '06. mai', overdue: true, daysLate: 2 },
  { id: 'AML-2026-038', title: 'Lukk avvik — gulvbelegg lager B', module: 'Avvik', law: '§ 3-1 (2) e', severity: 'high', owner: 'L. Berg', due: '12. mai', overdue: false },
  { id: 'AML-2026-037', title: 'Revider ROS — kjemikalierom', module: 'ROS-analyser', law: '§ 3-1', severity: 'high', owner: 'M. Solberg', due: '14. mai', overdue: false },
  { id: 'AML-2026-035', title: 'Signer protokoll — AMU-møte 2', module: 'AMU', law: '§ 7-2', severity: 'medium', owner: 'M. Solberg', due: '16. mai', overdue: false },
  { id: 'AML-2026-031', title: 'Oppfølgingsplan — sak #IA-204', module: 'Sykefravær', law: '§ 4-6 (3)', severity: 'critical', owner: 'K. Riise', due: '04. mai', overdue: true, daysLate: 4 },
  { id: 'AML-2026-029', title: 'SJA — taktekking blokk C', module: 'SJA', law: 'IK § 5 nr. 6', severity: 'high', owner: 'T. Aas', due: '14. mai', overdue: false },
  { id: 'AML-2026-026', title: 'Plan beredskapsøvelse Q2', module: 'Beredskap', law: '§ 3-1', severity: 'medium', owner: 'Drift', due: '21. mai', overdue: false },
  { id: 'AML-2026-022', title: 'Påmelding 40-timers kurs (2 nye)', module: 'Opplæring', law: '§ 6-5', severity: 'low', owner: 'HR', due: '03. jun', overdue: false },
]

export const AML_KLARERT_FEED: AmlFeedItem[] = [
  { kind: 'lov', date: '02. mai 2026', title: 'Endring i AML § 4-6 — ny frist for oppfølgingsplan', body: 'Plan ved sykefravær skal nå være sendt arbeidstaker innen 4 uker (tidligere 7). Klarert har oppdatert maler og varslingsregler.', cta: 'Les sammendrag', pinned: true },
  { kind: 'klarert', date: '28. apr 2026', title: 'Ny modul: Whistleblower-kanal (§ 2 A-1)', body: 'Egen kanal for varsling om kritikkverdige forhold er nå tilgjengelig som tilleggsmodul. Aktiver fra Innstillinger › Moduler.', cta: 'Se modul' },
  { kind: 'tip', date: '24. apr 2026', title: 'Tips: Koble vernerunder direkte til ROS', body: 'Funn fra en runde kan nå konverteres til risiko i én klikk — sporbart tilbake til selve runden.', cta: 'Vis hvordan' },
  { kind: 'lov', date: '15. apr 2026', title: 'Arbeidstilsynet — ny veileder om hjemmekontor', body: 'Skriftlig avtale, kartlegging av arbeidsplass og rapportering av belastningsskader er presisert.', cta: 'Last ned veileder' },
]

// ── Constants used across components ────────────────────────────────────

export const MONTHS_NB = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]
export const MONTHS_NB_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

// Compliance content — single source of truth for /compliance and the landing teaser.
// Verified against /supabase/migrations/ and /specs/compliance-planner.md.

import type { FeatureModuleSlug, LawFamily } from './features'

export type Framework = {
  short: string
  full: string
  family: LawFamily
  summary: string
  paragraphs: string[]
  modulesCovering: FeatureModuleSlug[]
  slug: string
}

export function frameworkSlug(short: string): string {
  return short
    .toLowerCase()
    .replace(/[øæå]/g, (c) => ({ ø: 'o', æ: 'ae', å: 'a' }[c] ?? c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

type FrameworkInput = Omit<Framework, 'slug'>

const FRAMEWORKS_INPUT: FrameworkInput[] = [
  {
    short: 'Arbeidsmiljøloven',
    full: 'Lov om arbeidsmiljø, arbeidstid og stillingsvern m.v.',
    family: 'AML',
    summary:
      'Omfanget er stort: alle norske virksomheter med ansatte må følge AML. Vi har kartlagt over 80 paragrafer mot konkrete moduler — fra §3-1 (HMS-ansvar) til §2A-7 (taushetsplikt ved varsling).',
    paragraphs: [
      '§2-1 — Arbeidsgivers plikter',
      '§2A-1 til §2A-7 — Varsling',
      '§3-1 — Systematisk HMS-arbeid',
      '§3-5 — Plikt til opplæring',
      '§4-1 til §4-6 — Krav til arbeidsmiljøet',
      '§6-1 til §6-5 — Verneombud',
      '§7-1 til §7-4 — Arbeidsmiljøutvalg',
      '§14-12 — Innleie og innleieansvar',
    ],
    modulesCovering: ['oppgaver', 'sjekklister', 'varslinger', 'dokumenter', 'laering', 'undersokelser'],
  },
  {
    short: 'Internkontrollforskriften',
    full: 'Forskrift om systematisk helse-, miljø- og sikkerhetsarbeid (IK-f)',
    family: 'IK-f',
    summary:
      'Forskriften forteller deg hva som må gjøres systematisk; Klarert er hvordan. §5 nr. 1–8 er kjernen — alt fra mål til dokumentasjon til avviksbehandling — og vi har en modul for hvert nummer.',
    paragraphs: [
      '§5 nr. 1 — Mål for HMS',
      '§5 nr. 2 — Risikokartlegging',
      '§5 nr. 6 — Systematisk overvåking',
      '§5 nr. 7 — Avviksbehandling',
      '§5 nr. 8 — Dokumentasjon',
    ],
    modulesCovering: ['sjekklister', 'oppgaver', 'dokumenter', 'undersokelser'],
  },
  {
    short: 'ISO 45001',
    full: 'Occupational Health and Safety Management Systems',
    family: 'ISO',
    summary:
      'For virksomheter som vil sertifiseres etter ISO 45001:2018 har vi en egen samsvarssjekk-pakke som speiler revisjonskrav §9.2 (intern revisjon), §9.3 (ledelsens gjennomgang) og §10.2 (avvik og korrigerende tiltak).',
    paragraphs: ['§9.2 — Intern revisjon', '§9.3 — Ledelsens gjennomgang', '§10.2 — Avvik og korrigerende tiltak', '§10.3 — Kontinuerlig forbedring'],
    modulesCovering: ['sjekklister', 'oppgaver', 'dokumenter'],
  },
  {
    short: 'GDPR',
    full: 'Personvernforordningen + Personopplysningsloven',
    family: 'GDPR',
    summary:
      'Klarert behandler personopplysninger om ansatte, varslere og kursdeltakere. Vi har dokumentert behandlingsgrunnlag for hver datatype, og varslingsmodulen oppfyller Art. 33 (72-timers melding) som førsteklasses arbeidsflyt.',
    paragraphs: [
      'Art. 5 (1) — Lovlighet og formålsbegrensning',
      'Art. 9 — Helseopplysninger',
      'Art. 25 — Personvern ved utforming',
      'Art. 30 — Behandlingsprotokoll',
      'Art. 32 — Tekniske og organisatoriske tiltak',
      'Art. 33 — Melding av brudd',
      'Art. 34 — Underretning til registrerte',
    ],
    modulesCovering: ['varslinger', 'dokumenter', 'undersokelser'],
  },
  {
    short: 'Åpenhetsloven',
    full: 'Lov om virksomheters åpenhet og arbeid med grunnleggende menneskerettigheter',
    family: 'Åpenhetsloven',
    summary:
      'For virksomheter med plikt etter §5 har vi mal for aktsomhetsvurdering hos leverandører og automatisert årlig redegjørelse. Egenerklæringene sendes via Undersøkelser-modulen og knyttes til registerinnføringer.',
    paragraphs: ['§4 — Aktsomhetsvurderinger', '§5 — Plikt til å offentliggjøre redegjørelse', '§6 — Rett til informasjon'],
    modulesCovering: ['undersokelser', 'dokumenter'],
  },
  {
    short: 'Likestillingsloven',
    full: 'Lov om likestilling og forbud mot diskriminering',
    family: 'LDL',
    summary:
      'For virksomheter med 50+ ansatte: lønnskartlegging hvert annet år og aktivitetsrapport (ARP). Klarert leverer maler for begge — undersøkelsesmodulen for selve kartleggingen, dokumentmodulen for redegjørelsen.',
    paragraphs: ['§26 — Plikt til å arbeide for likestilling', '§26a — Aktivitets- og redegjørelsesplikt'],
    modulesCovering: ['undersokelser', 'dokumenter'],
  },
  {
    short: 'ISO 9001',
    full: 'Quality Management Systems',
    family: 'ISO',
    summary:
      'For virksomheter med ISO 9001-sertifisering har Klarerts dokumentmodul revisjonshistorikk og gjennomgangsfrister som tilfredsstiller kravet til dokumentstyring.',
    paragraphs: ['§7.5 — Dokumentert informasjon', '§9.2 — Intern revisjon', '§10.2 — Avvik'],
    modulesCovering: ['dokumenter', 'sjekklister'],
  },
  {
    short: 'ISO 14001',
    full: 'Environmental Management Systems',
    family: 'ISO',
    summary:
      'For virksomheter som også styrer miljørisiko, dekker Klarerts sjekkliste-pakke ISO 14001-revisjoner og miljørelaterte avvik — i samme arbeidsflyt som HMS.',
    paragraphs: ['§6.1.2 — Miljøaspekter', '§9.2 — Intern revisjon'],
    modulesCovering: ['sjekklister', 'dokumenter'],
  },
  {
    short: 'Folketrygdloven',
    full: 'Lov om folketrygd (yrkesskade og oppbevaring)',
    family: 'IK-f',
    summary:
      'Yrkesskade-relatert dokumentasjon må oppbevares i minst 5 år. Klarerts varslingsmodul og dokumentmodul håndhever oppbevaringsregler på databasenivå.',
    paragraphs: ['§13-3 — Yrkesskade og yrkessykdom'],
    modulesCovering: ['varslinger', 'dokumenter'],
  },
]

export const FRAMEWORKS: Framework[] = FRAMEWORKS_INPUT.map((f) => ({
  ...f,
  slug: frameworkSlug(f.short),
}))

export type CompliancePack = {
  id: 'aml-amu' | 'iso-45001'
  name: string
  description: string
  frameworks: string[]
}

export const PACKS: CompliancePack[] = [
  {
    id: 'aml-amu',
    name: 'AML- og internkontroll-pakken',
    description:
      'Standardpakken for norske virksomheter. Inkluderer vernerunder, ROS-maler, AMU-prosesser, sykefraværsoppfølging og dokumentmaler bygget direkte på Arbeidsmiljøloven og Internkontrollforskriften.',
    frameworks: ['Arbeidsmiljøloven', 'Internkontrollforskriften', 'GDPR'],
  },
  {
    id: 'iso-45001',
    name: 'ISO 45001-pakken',
    description:
      'Tillegg for virksomheter som er — eller skal bli — sertifisert etter ISO 45001:2018. Speiler revisjonskravene §§9.2, 9.3 og 10.2 til konkrete sjekklister og avviksflyt.',
    frameworks: ['ISO 45001', 'Arbeidsmiljøloven'],
  },
]

export type FaqEntry = { question: string; answer: string }

export const FAQ: FaqEntry[] = [
  {
    question: 'Hvor mange arbeidsmiljølov-paragrafer dekkes faktisk?',
    answer:
      'Vi har kartlagt 80+ paragrafer mot konkrete moduler — fra §2-1 (arbeidsgivers plikter) til §18-10 (overtredelsesgebyr). Hver mal og hvert workflow-skritt har en lovreferanse som peker tilbake til kilden.',
  },
  {
    question: 'Tilfredsstiller Klarert kravene i Internkontrollforskriften §5?',
    answer:
      'Ja — alle åtte nummer i §5 har et tilsvarende sted i systemet: målfastsetting (Dokumenter), risikokartlegging (Sjekklister), opplæring (E-læring), overvåking og avviksbehandling (Oppgaver), dokumentasjon (Dokumenter). Systemet er bygget rundt forskriften, ikke tilpasset i etterkant.',
  },
  {
    question: 'Hva med GDPR for varsling og sykefravær?',
    answer:
      'Varslingsmodulen håndhever taushetsplikten i AML §2A-7 (5) på databasenivå. Helseopplysninger lagres med adgangskontroll på en egen tabell, og varslere kan velge full anonymitet hvor identitetsfelt aldri lagres. Behandlingsprotokoll etter Art. 30 ligger som mal i Dokumenter.',
  },
  {
    question: 'Er Klarert godt nok for et tilsyn fra Arbeidstilsynet?',
    answer:
      'Hver mal har en kort selv-audit i toppen som forklarer hvilke pålegg-grunner som er adressert og hvilken restrisiko som gjenstår — sett fra Arbeidstilsynets perspektiv. Sjekklister, sertifikater og dokumenter har full revisjonshistorikk med signatur, tidspunkt og bruker.',
  },
  {
    question: 'Hvor lagres dataene?',
    answer:
      'Klarert kjører på Supabase i EU-region (Frankfurt og Stockholm). All persondata blir værende i EU. Vi bruker Row Level Security som primær tilgangskontroll — applikasjonen kan ikke ved et uhell gi tilgang som den ikke skulle hatt.',
  },
  {
    question: 'Hva skjer hvis loven endres?',
    answer:
      'Vi overvåker endringer i AML, IK-f, GDPR og Likestillingsloven. Når loven endres, oppdaterer vi systemmalene og varsler organisasjonene om hva som har endret seg. Egne maler kan eksistere parallelt — du tvinges ikke til å bruke våre.',
  },
]

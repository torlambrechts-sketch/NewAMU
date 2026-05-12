// Declarative Compliance Studio catalog — én post per veiviser.
//
// Veiviserne grupperes per *bruks-scenario*, ikke lov-kapittel.
// HR-lederen tenker "Vi skal etablere AMU", ikke "AML kap. 7".
// Lov-kapittel-aksen finnes allerede i Regelverk-dekning-dashbordet.
//
// Hver entry har et stabilt `wizardKey` som persisteres i
// compliance_wizard_runs — IKKE endre eksisterende keys.

export type StudioCategory = {
  id: string
  label: string
  description: string
}

export type StudioWizardEntry = {
  /** Stabil identifier — brukes som wizard_key i compliance_wizard_runs. */
  wizardKey: string
  categoryId: string
  title: string
  description: string
  /** Emoji eller lucide-navn for kortikon. */
  icon: string
  /** Lovreferanser som dekkes når wizardens "Aktivere"-steg er kjørt. */
  lawRefs: string[]
  /** Estimat for hvor lang tid det tar. */
  estimateMinutes: number
  /** Hvilke org-forutsetninger som må være på plass (vises som krav). */
  prerequisites?: string[]
  /** "Pliktig" hjelp brukeren prioritere. */
  priority: 'critical' | 'recommended'
}

export const STUDIO_CATEGORIES: StudioCategory[] = [
  {
    id: 'aml_core',
    label: 'AML — kjernesystem',
    description:
      'Grunnmuren som alle arbeidsgivere må ha på plass. Start her hvis dere er ny i AML.',
  },
  // Plassholdere for senere faser; tomme nå men reservert i sidebaren.
  {
    id: 'aml_employment',
    label: 'Når noen ansettes',
    description: 'Arbeidsavtale, onboarding-opplæring, bakgrunnssjekk, GDPR.',
  },
  {
    id: 'aml_sickness',
    label: 'Når noen blir syk',
    description: 'Sykefraværsoppfølging, dialogmøter, NAV-melding.',
  },
  {
    id: 'aml_termination',
    label: 'Når noen slutter',
    description: 'Drøftingsmøte, oppsigelse, sluttattest, tilbakelevering.',
  },
]

export const STUDIO_WIZARDS: StudioWizardEntry[] = [
  {
    wizardKey: 'compliance.hms_grunnmur',
    categoryId: 'aml_core',
    title: 'HMS-grunnmuren',
    description:
      'Etabler systematisk HMS-arbeid, internkontroll, opplæring og BHT. Kjernen i AML.',
    icon: '🏛️',
    lawRefs: [
      'AML § 3-1',
      'AML § 3-2',
      'AML § 3-5',
      'IK-f § 5 nr. 1a',
      'IK-f § 5 nr. 1b',
      'IK-f § 5 nr. 1c',
      'IK-f § 5 nr. 2',
      'IK-f § 5 nr. 3',
    ],
    estimateMinutes: 12,
    priority: 'critical',
  },
  {
    wizardKey: 'compliance.varsling',
    categoryId: 'aml_core',
    title: 'Varsling',
    description:
      'Skriftlig varslingsrutine, ekstern varslingskanal, vern mot gjengjeldelse. Pliktig ved ≥5 ansatte.',
    icon: '📣',
    lawRefs: [
      'AML § 2A-1',
      'AML § 2A-2',
      'AML § 2A-3',
      'AML § 2A-4',
      'AML § 2A-6',
    ],
    estimateMinutes: 8,
    prerequisites: ['≥5 ansatte for skriftlig rutine (anbefales for alle)'],
    priority: 'critical',
  },
  {
    wizardKey: 'compliance.amu_etablering',
    categoryId: 'aml_core',
    title: 'AMU-etablering',
    description:
      'Arbeidsmiljøutvalg: sammensetning, oppgaver, første møte. Pliktig ved ≥30 ansatte.',
    icon: '🤝',
    lawRefs: ['AML § 7-1', 'AML § 7-2', 'AML § 7-3', 'AML § 7-4'],
    estimateMinutes: 10,
    prerequisites: ['≥30 ansatte for pliktig AMU (≥10 etter avtale)'],
    priority: 'critical',
  },
]

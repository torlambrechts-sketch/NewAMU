/**
 * Master checklist: suggested / typical documents for Norwegian working-life compliance.
 * Not exhaustive legal advice — verify against lovdata.no, tariff, and sector rules.
 */
export type MasterChecklistCategory =
  | 'HMS og internkontroll'
  | 'Samarbeid og medvirkning'
  | 'Varsling og internkontroll (saker)'
  | 'Organisasjon og opplæring'
  | 'Annet'

export type MasterChecklistItem = {
  id: string
  category: MasterChecklistCategory
  /** Kort tittel på forventet dokument eller aktivitet */
  title: string
  /** Om dette ofte er pliktig, anbefalt eller kontekstavhengig */
  priority: 'påkrevd' | 'anbefalt' | 'situasjonsavhengig'
  lawHint?: string
  /** Forslag til hva som kan ligge i dokumentsenteret */
  suggestion: string
}

export const DOCUMENTATION_MASTER_CHECKLIST: MasterChecklistItem[] = [
  {
    id: 'mc-hms-policy',
    category: 'HMS og internkontroll',
    title: 'HMS-policy og mål',
    priority: 'anbefalt',
    lawHint: 'Internkontrollforskriften § 5',
    suggestion: 'Overordnede mål og prinsipper for systematisk HMS.',
  },
  {
    id: 'mc-ros',
    category: 'HMS og internkontroll',
    title: 'ROS / risikovurderinger',
    priority: 'påkrevd',
    lawHint: 'AML § 4-3, internkontroll',
    suggestion: 'Kartlegging av farer og risiko per relevant område; revisjon ved endring.',
  },
  {
    id: 'mc-avvik',
    category: 'HMS og internkontroll',
    title: 'Rutine for avvik og oppfølging',
    priority: 'påkrevd',
    lawHint: 'Internkontrollforskriften § 5',
    suggestion: 'Hvordan avvik registreres, vurderes og lukkes.',
  },
  {
    id: 'mc-ik-gjennomgang',
    category: 'HMS og internkontroll',
    title: 'Årlig gjennomgang av internkontrollen',
    priority: 'anbefalt',
    lawHint: 'Internkontrollforskriften § 5',
    suggestion: 'Dokumentert gjennomgang med tiltak og ansvarlig.',
  },
  {
    id: 'mc-vern',
    category: 'Samarbeid og medvirkning',
    title: 'Verneombud — utpeking og samarbeid',
    priority: 'situasjonsavhengig',
    lawHint: 'AML kap. 6',
    suggestion: 'Oversikt over verneområder og kontakt (der pliktig).',
  },
  {
    id: 'mc-amu',
    category: 'Samarbeid og medvirkning',
    title: 'AMU — sammensetning og møteplan',
    priority: 'situasjonsavhengig',
    lawHint: 'AML kap. 7',
    suggestion: 'Protokoller, innkallinger og beslutninger der AMU er påkrevd.',
  },
  {
    id: 'mc-informasjon',
    category: 'Samarbeid og medvirkning',
    title: 'Informasjon og drøfting ved endringer',
    priority: 'situasjonsavhengig',
    lawHint: 'AML § 16-1 m.fl.',
    suggestion: 'Prosedyre ved vesentlige endringer; arkiv av drøftinger.',
  },
  {
    id: 'mc-varsling-rutine',
    category: 'Varsling og internkontroll (saker)',
    title: 'Varslingsrutine (arbeidslivet)',
    priority: 'påkrevd',
    lawHint: 'Lov om arbeidslivets varslingssystemer',
    suggestion: 'Mottak, undersøkelse, konfidensialitet og oppfølging.',
  },
  {
    id: 'mc-ros-ik-kobling',
    category: 'Varsling og internkontroll (saker)',
    title: 'Kobling varslingssaker — internkontroll',
    priority: 'anbefalt',
    lawHint: 'Intern kontroll / personvern',
    suggestion: 'Intern beskrivelse av hvordan saker følges i internkontroll-modulen.',
  },
  {
    id: 'mc-opplæring',
    category: 'Organisasjon og opplæring',
    title: 'Opplæringsplan / HMS-introduksjon',
    priority: 'anbefalt',
    lawHint: 'AML § 3-2, bransjestandard',
    suggestion: 'Kobling til læringsmodulen; hvem skal gjennomføre hva.',
  },
  {
    id: 'mc-beredskap',
    category: 'Annet',
    title: 'Beredskap og førstehjelp (der relevant)',
    priority: 'situasjonsavhengig',
    lawHint: 'Brann, førstehjelp — forskrifter',
    suggestion: 'Rutiner og ansvarlige; jevnlig øvelse dokumentert.',
  },
]

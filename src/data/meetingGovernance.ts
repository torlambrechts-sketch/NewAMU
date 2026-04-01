/** Target number of ordinary council meetings per calendar year (governance cadence). */
export const MEETINGS_PER_YEAR = 4 as const

export type QuarterSlot = 1 | 2 | 3 | 4

export const QUARTER_LABELS: Record<QuarterSlot, string> = {
  1: 'Q1',
  2: 'Q2',
  3: 'Q3',
  4: 'Q4',
}

/** Suggested agenda themes per quarter (AMU / arbeidsmiljø — illustrative). */
export function suggestedAgendaItems(quarter: QuarterSlot): { title: string; notes: string }[] {
  const commonClosing = {
    title: 'Eventuelt og neste møte',
    notes: 'Avklar dato for neste ordinære møte i henhold til årshjulet (4 per år).',
  }
  switch (quarter) {
    case 1:
      return [
        {
          title: 'Godkjenning av innkalling, saksliste og referat fra forrige møte',
          notes: '',
        },
        {
          title: 'HMS — risikovurdering og tiltaksplan (status)',
          notes: 'Gå gjennom åpne avvik og frister.',
        },
        {
          title: 'Verneombud / samarbeid med ledelsen',
          notes: 'Kort orientering og eventuelle behov for oppfølging.',
        },
        {
          title: 'Årsplan for rådsmøter og dokumentasjon',
          notes: 'Bekreft at 4 møter per kalenderår er planlagt med standard agenda.',
        },
        commonClosing,
      ]
    case 2:
      return [
        {
          title: 'Godkjenning av innkalling og saksliste',
          notes: '',
        },
        {
          title: 'Arbeidsmiljøundersøkelse / trivsel (oppfølging)',
          notes: 'Drøft resultater og planlagte tiltak.',
        },
        {
          title: 'Opplæring og kompetanse i HMS',
          notes: '',
        },
        {
          title: 'Revisjon av interne rutiner (referat, journalføring)',
          notes: 'Sikre at protokoller og beslutninger er arkiverte.',
        },
        commonClosing,
      ]
    case 3:
      return [
        {
          title: 'Godkjenning av innkalling og saksliste',
          notes: '',
        },
        {
          title: 'Fysisk og psykososialt arbeidsmiljø — status',
          notes: 'Belastning, organisering, endringer.',
        },
        {
          title: 'Beredskap og avvik (læringspunkter)',
          notes: '',
        },
        {
          title: 'Informasjon om større endringer i virksomheten (drøfting)',
          notes: 'Orientering i tråd med informasjons- og drøftingsplikt der det er relevant.',
        },
        commonClosing,
      ]
    case 4:
      return [
        {
          title: 'Godkjenning av innkalling og saksliste',
          notes: '',
        },
        {
          title: 'Årsoppsummering — HMS og samarbeid',
          notes: 'Hovedtrekk fra året; hva fungerer, hva skal forbedres.',
        },
        {
          title: 'Plan for neste år (årshjul, 4 møter, ansvar)',
          notes: '',
        },
        {
          title: 'Eventuelt revisjon av sjekkliste mot arbeidsmiljøkrav',
          notes: 'Knytt til intern revisjon og lovhenvisninger i verktøyet.',
        },
        commonClosing,
      ]
    default:
      return [commonClosing]
  }
}

export function defaultPreparationChecklist(): { id: string; label: string; done: boolean }[] {
  return [
    { id: 'pc1', label: 'Innkalling og agenda er sendt til deltakere i tide', done: false },
    { id: 'pc2', label: 'Saksdokumenter og eventuelle HMS-rapporter er tilgjengelige', done: false },
    { id: 'pc3', label: 'Møteleder og referent er avtalt', done: false },
    { id: 'pc4', label: 'Teknisk opplegg (rom / digital lenke) er testet', done: false },
  ]
}

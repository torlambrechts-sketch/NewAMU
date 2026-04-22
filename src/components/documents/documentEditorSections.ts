/**
 * Pre-built HTML snippets for the document editor workbench (compliance-oriented).
 * Inserted at the cursor via TipTap; not persisted until the parent wires persistence.
 */

export type DocumentEditorSectionId =
  | 'welcome'
  | 'arbeidsmiljolov'
  | 'internkontroll'
  | 'risikovurdering'
  | 'opplaering'
  | 'arbeidstid'
  | 'varsling'
  | 'signaturblokk'
  | 'pagebreak'

export type DocumentEditorSectionDef = {
  id: DocumentEditorSectionId
  label: string
  description: string
  /** Short label for compact grid tiles */
  shortLabel: string
  html: string
}

export const DOCUMENT_EDITOR_SECTIONS: DocumentEditorSectionDef[] = [
  {
    id: 'welcome',
    shortLabel: 'Innledning',
    label: 'Innledning og formål',
    description: 'Standard åpning for HMS-/arbeidsavtaler.',
    html: `<h2>Innledning</h2><p>Dette dokumentet beskriver plikter og praksis i virksomheten i tråd med arbeidsmiljøloven og internkontrollforskriften. Innholdet skal tilpasses lokale rutiner og roller.</p>`,
  },
  {
    id: 'arbeidsmiljolov',
    shortLabel: 'AML § 2–3',
    label: 'Arbeidsmiljøloven — grunnleggende plikter',
    description: 'Henvisning til systematisk HMS-arbeid og medvirkning.',
    html: `<h2>Arbeidsmiljø og systematisk vernearbeid</h2><p>Virksomheten skal sørge for et fullt forsvarlig arbeidsmiljø, jf. arbeidsmiljøloven kapittel 2. Arbeidstaker skal medvirke i HMS-arbeidet etter gjeldende regler.</p><ul><li>Kartlegging og risikovurdering</li><li>Tiltak ved avvik</li><li>Opplæring og informasjon</li></ul>`,
  },
  {
    id: 'internkontroll',
    shortLabel: 'IK § 5',
    label: 'Internkontrollforskriften § 5',
    description: 'Kjernekrav: kartlegge, vurdere, iverksette og dokumentere.',
    html: `<h2>Internkontroll (internkontrollforskriften)</h2><p>Virksomheten skal systematisk kartlegge farer og problemer, vurdere risiko, og iverksette og følge opp tiltak. Resultatene skal dokumenteres slik at tilsyn og revisjon kan verifisere etterlevelse.</p><blockquote><p>«Virksomheten skal kartlegge farer og problemer og vurdere risiko.» — IK-forskriften § 5 nr. 6 (utdrag)</p></blockquote>`,
  },
  {
    id: 'risikovurdering',
    shortLabel: 'ROS / fare',
    label: 'Risikovurdering og tiltak',
    description: 'Mal for farekilder, sannsynlighet og tiltak.',
    html: `<h2>Risikovurdering</h2><p>Følgende farekilder er identifisert og vurdert:</p><ol><li><strong>Fare:</strong> … — <strong>Risiko:</strong> … — <strong>Tiltak:</strong> …</li><li><strong>Fare:</strong> … — <strong>Risiko:</strong> … — <strong>Tiltak:</strong> …</li></ol><p>Ansvarlig for oppfølging: [navn / rolle]. Frist for gjennomgang: [dato].</p>`,
  },
  {
    id: 'opplaering',
    shortLabel: 'Opplæring',
    label: 'Opplæring og kompetanse',
    description: 'Dokumentasjon av opplæring i henhold til krav.',
    html: `<h2>Opplæring og kompetanse</h2><p>Arbeidstaker har mottatt nødvendig opplæring i sikker bruk av utstyr, førstehjelp og rapportering av avvik. Opplæringen er dokumentert i læringsmodulen / opplæringsmatrise.</p><ul><li>Introduksjon HMS</li><li>Stedsspesifikke farer</li><li>Nødprosedyrer</li></ul>`,
  },
  {
    id: 'arbeidstid',
    shortLabel: 'Arbeidstid',
    label: 'Arbeidstid og hvile (arbeidsmiljøloven kap. 10)',
    description: 'Rammer for arbeidstid — tilpass til tariff/avtale.',
    html: `<h2>Arbeidstid og hvile</h2><p>Arbeidstid følger arbeidsmiljøloven kapittel 10 og eventuelle tariffavtaler. Avvik fra normal arbeidstid skal avklares skriftlig. Hviletidsreglene skal overholdes.</p>`,
  },
  {
    id: 'varsling',
    shortLabel: 'Varsling',
    label: 'Varsling og meldeplikt',
    description: 'Kan kobles til anonym varsling og avviksmodul.',
    html: `<h2>Varsling</h2><p>Virksomheten fremmer åpen dialog om arbeidsmiljø. Avvik og farlige forhold skal meldes til nærmeste leder eller via godkjente varslingskanaler. Rettsmessig varsling etter arbeidsmiljøloven § 2 A skal ikke medføre negative reaksjoner.</p>`,
  },
  {
    id: 'signaturblokk',
    shortLabel: 'Signatur',
    label: 'Signatur og bekreftelse',
    description: 'Visuell signatur-seksjon (felt er ikke bundet til backend i denne testen).',
    html: `<hr /><h3>Bekreftelse</h3><p>Ved signatur bekrefter partene at innholdet er lest og forstått, og at plikter som følger av arbeidsmiljøloven og internkontroll er kommunisert.</p><p><em>[Signaturfelt og dato settes inn fra sidepanelet «Utfyllbare felt».]</em></p>`,
  },
  {
    id: 'pagebreak',
    shortLabel: 'Sideskift',
    label: 'Visuelt sideskift (utkast)',
    description: 'Markerer ønsket PDF-sideskift — kun visuell markør i denne prototypen.',
    html: `<p style="border-top: 2px dashed #d4d4d4; padding-top: 12px; margin-top: 24px; color: #737373; font-size: 12px;">— PDF-sideskift (utkast) —</p>`,
  },
]

export function getDocumentEditorSection(id: DocumentEditorSectionId): DocumentEditorSectionDef | undefined {
  return DOCUMENT_EDITOR_SECTIONS.find((s) => s.id === id)
}

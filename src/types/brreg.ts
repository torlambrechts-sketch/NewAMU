/** Subset of Brønnøysund Enhetsregisteret JSON (enheter). */
export type BrregEnhet = {
  organisasjonsnummer: string
  navn: string
  organisasjonsform?: { kode?: string; beskrivelse?: string }
  forretningsadresse?: {
    adresse?: string[]
    postnummer?: string
    poststed?: string
    kommune?: string
  }
  postadresse?: {
    adresse?: string[]
    postnummer?: string
    poststed?: string
  }
  hjemmeside?: string
  epostadresse?: string
  konkurs?: boolean
  underAvvikling?: boolean
  /** Official employee count as registered in Enhetsregisteret */
  antallAnsatte?: number
  /** Primary NACE industry code */
  naeringskode1?: { kode?: string; beskrivelse?: string }
  /** Secondary NACE industry code */
  naeringskode2?: { kode?: string; beskrivelse?: string }
  /** Institutional sector code */
  institusjonellSektorkode?: { kode?: string; beskrivelse?: string }
  /** Date of incorporation / founding */
  stiftelsesdato?: string
  /** Date first registered in Enhetsregisteret */
  registreringsdatoEnhetsregisteret?: string
  registrertIForetaksregisteret?: boolean
  registrertIMvaRegisteret?: boolean
}

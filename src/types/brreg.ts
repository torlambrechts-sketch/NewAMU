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
}

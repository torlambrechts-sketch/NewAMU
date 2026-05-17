// Integrasjoner — verified status against /specs/integrasjoner-bankid-restanser.md
// and README. Honest: not everything is live yet.

export type IntegrationStatus = 'live' | 'phase2' | 'planned' | 'placeholder'

export type Integration = {
  name: string
  category: 'Signering' | 'Offentlige registre' | 'HR/SSO' | 'Kommunikasjon' | 'Innhold og lovkilder'
  status: IntegrationStatus
  description: string
  detail: string
}

export const INTEGRATIONS: Integration[] = [
  {
    name: 'Brønnøysundregistrene',
    category: 'Offentlige registre',
    status: 'live',
    description: 'Oppslag av organisasjonsdata ved registrering og senere oppdatering.',
    detail:
      'Klarert henter organisasjonsnavn, adresse, NACE-kode, daglig leder og styresammensetning direkte fra Enhetsregisteret i Brønnøysund. Brukes ved opprettelse og kan oppdateres ved behov. Ingen sensitive personopplysninger lagres som ikke allerede er offentlige.',
  },
  {
    name: 'BankID-signering',
    category: 'Signering',
    status: 'phase2',
    description: 'OIDC-basert dokumentsignering (Q1 2026).',
    detail:
      'Database-skjema og UI-komponenter er på plass. OIDC-flyt med edge functions (bankid-init, bankid-callback) ligger som siste fase før produksjonslansering. Når den er aktiv kan dokumenter, sjekklister og kurssertifikater BankID-signeres direkte i Klarert.',
  },
  {
    name: 'Eco-Online',
    category: 'Innhold og lovkilder',
    status: 'planned',
    description: 'Kjemikaliedatabase og sikkerhetsdatablad (SDS).',
    detail:
      'For virksomheter som allerede har Eco-Online: synkronisering av kjemikaliebeholdning og SDS-er inn i Klarerts dokumentmodul. Krever Eco-Online API-konto. Planlagt 2026.',
  },
  {
    name: 'Altinn',
    category: 'Offentlige registre',
    status: 'planned',
    description: 'Innsending via Maskinporten-OIDC.',
    detail:
      'Når den er klar vil utvalgte rapporter — aktivitetsrapport (ARP), Åpenhetsloven-redegjørelse, AMU-meldinger — kunne sendes til Altinn direkte fra Klarert. Krever virksomhetsertifikat via Maskinporten.',
  },
  {
    name: 'Lovdata Pro',
    category: 'Innhold og lovkilder',
    status: 'planned',
    description: 'Direkte lenke til lovteksten.',
    detail:
      'Når lovreferanser er klikkbare i Klarert (f.eks. «AML §3-1») vil de åpne paragrafen i Lovdata Pro for organisasjoner som har abonnement. Ingen abonnement er nødvendig fra vår side.',
  },
  {
    name: 'Feide SSO',
    category: 'HR/SSO',
    status: 'planned',
    description: 'Single sign-on for utdanningssektoren.',
    detail:
      'For skoler, universiteter og høgskoler som har Feide. Standard SAML-flyt. Andre SSO-leverandører (Microsoft Entra, Google Workspace) støttes via OIDC i Enterprise-tier i dag.',
  },
  {
    name: 'Webhooks',
    category: 'Kommunikasjon',
    status: 'placeholder',
    description: 'Skjema er der; utsending kommer.',
    detail:
      'Skjema-felter for webhook-URL og signaturhemmelighet finnes i admin-panelet. Aktiv utsending ved hendelser (ny sak, ferdig kurs, varsling lukket) er ikke i produksjon ennå.',
  },
  {
    name: 'Slack',
    category: 'Kommunikasjon',
    status: 'placeholder',
    description: 'Kanalvarsler ved hendelser.',
    detail:
      'Skjema for innkommende webhook-URL er på plass. Aktivering kommer sammen med webhooks-utsending. For team som bruker Slack til daglig, vil dette dekke 80 % av varslingsbehovet.',
  },
]

export const STATUS_META: Record<IntegrationStatus, { label: string; tone: 'live' | 'soon' | 'planned' }> = {
  live: { label: 'I produksjon', tone: 'live' },
  phase2: { label: 'Q1 2026', tone: 'soon' },
  planned: { label: 'Planlagt', tone: 'planned' },
  placeholder: { label: 'Skjema klart', tone: 'planned' },
}

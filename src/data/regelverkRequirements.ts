// regelverkRequirements.ts
//
// Statisk registry over alle lovkrav per regelverk. Brukes av
// useRegelverkCoverage til å bygge en regelverk-dekning-oversikt.
//
// Hver requirement har:
//   - lawRef (kanonisk streng — matcher law_refs[]/legal_refs[] på moduler)
//   - title (kort beskrivelse)
//   - obligation (mandatory | recommended | conditional)
//   - applies (når er kravet aktuelt — eks: "≥ 10 ansatte")
//   - category (gruppering for visning)
//
// Synkronisert manuelt med specs/aml-requirements-inventory.md.

export type Regelverk = {
  id: string
  label: string
  fullName: string
  description: string
}

export type Requirement = {
  regelverkId: string
  lawRef: string                    // matcher law_refs/legal_refs på moduler
  title: string
  obligation: 'mandatory' | 'recommended' | 'conditional'
  applies?: string                  // når aktuelt (eks: "≥ 10 ansatte")
  category: string
  description?: string
  alternateRefs?: string[]          // alternative skrivemåter (eks: 'AML §3-1', 'AML § 3-1 (2c)')
}

export const REGELVERK: Regelverk[] = [
  { id: 'aml', label: 'AML', fullName: 'Arbeidsmiljøloven', description: 'Lov om arbeidsmiljø, arbeidstid og stillingsvern (2005)' },
  { id: 'ik-f', label: 'IK-f', fullName: 'Internkontroll­forskriften', description: 'Forskrift om systematisk HMS-arbeid (1996)' },
  { id: 'ldl', label: 'LDL', fullName: 'Likestillings- og diskriminerings­loven', description: 'Lov om likestilling og forbud mot diskriminering (2017)' },
  { id: 'gdpr', label: 'GDPR', fullName: 'GDPR / Personopplysningsloven', description: 'EUs personvern­forordning + norsk lov (2018)' },
  { id: 'folm', label: 'FOLM', fullName: 'Forskrift om organisering, ledelse og medvirkning', description: 'Verneombud, AMU, vernerunder (2011)' },
  { id: 'brannvern', label: 'Brannvern', fullName: 'Brann- og eksplosjons­vernloven', description: 'Lov om vern mot brann (2002)' },
  { id: 'apenhet', label: 'Åpenhet', fullName: 'Åpenhets­loven', description: 'Lov om virksomheters åpenhet og arbeid med menneske­rettigheter (2021)' },
  { id: 'bht', label: 'BHT-f', fullName: 'BHT-forskriften', description: 'Forskrift om bedriftshelse­tjeneste (2011)' },
  { id: 'utf-arb', label: 'Utf.arb', fullName: 'Forskrift om utførelse av arbeid', description: 'Kjemikalier, asbest, støy, vibrasjon, ergonomi (2011)' },
]

export const REQUIREMENTS: Requirement[] = [
  // ─── AML kap. 2 — Plikter ──────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 2-1', title: 'Arbeidsgivers ansvar', obligation: 'mandatory', category: 'Kap. 2 — Plikter' },
  { regelverkId: 'aml', lawRef: 'AML § 2-2', title: 'Konsulent og oppdragstaker', obligation: 'mandatory', category: 'Kap. 2 — Plikter' },
  { regelverkId: 'aml', lawRef: 'AML § 2-3', title: 'Arbeidstakers plikter', obligation: 'mandatory', category: 'Kap. 2 — Plikter' },

  // ─── AML kap. 2A — Varsling ────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 2A-1', title: 'Rett til å varsle', obligation: 'mandatory', category: 'Kap. 2A — Varsling' },
  { regelverkId: 'aml', lawRef: 'AML § 2A-2', title: 'Skriftlig varslings­rutine', obligation: 'mandatory', applies: '≥ 5 ansatte', category: 'Kap. 2A — Varsling' },
  { regelverkId: 'aml', lawRef: 'AML § 2A-3', title: 'Ekstern varsling', obligation: 'mandatory', category: 'Kap. 2A — Varsling' },
  { regelverkId: 'aml', lawRef: 'AML § 2A-4', title: 'Vern mot gjengjeldelse', obligation: 'mandatory', category: 'Kap. 2A — Varsling' },
  { regelverkId: 'aml', lawRef: 'AML § 2A-6', title: 'Behandling av varslers identitet', obligation: 'mandatory', category: 'Kap. 2A — Varsling' },

  // ─── AML kap. 3 — Virkemidler ──────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 3-1', title: 'Systematisk HMS-arbeid', obligation: 'mandatory', category: 'Kap. 3 — Virkemidler' },
  { regelverkId: 'aml', lawRef: 'AML § 3-2', title: 'Opplæring og instruksjon for arbeidstakere', obligation: 'mandatory', category: 'Kap. 3 — Virkemidler' },
  { regelverkId: 'aml', lawRef: 'AML § 3-3', title: 'BHT-tilknytning', obligation: 'conditional', applies: 'Bransje-spesifikk', category: 'Kap. 3 — Virkemidler' },
  { regelverkId: 'aml', lawRef: 'AML § 3-4', title: 'Sykefraværs­oppfølging', obligation: 'mandatory', category: 'Kap. 3 — Virkemidler' },
  { regelverkId: 'aml', lawRef: 'AML § 3-5', title: 'Arbeidsgivers HMS-opplæring', obligation: 'mandatory', category: 'Kap. 3 — Virkemidler' },

  // ─── AML kap. 4 — Krav til arbeidsmiljø ────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 4-1', title: 'Generelt forsvarlig arbeidsmiljø', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },
  { regelverkId: 'aml', lawRef: 'AML § 4-2', title: 'Medvirkning + endrings­kartlegging', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },
  { regelverkId: 'aml', lawRef: 'AML § 4-3', title: 'Psykososialt arbeidsmiljø', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },
  { regelverkId: 'aml', lawRef: 'AML § 4-4', title: 'Fysisk arbeidsmiljø', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },
  { regelverkId: 'aml', lawRef: 'AML § 4-5', title: 'Kjemikalier og biologisk materiale', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },
  { regelverkId: 'aml', lawRef: 'AML § 4-6', title: 'Tilretteleggings­plikt', obligation: 'mandatory', category: 'Kap. 4 — Arbeidsmiljø' },

  // ─── AML kap. 5 — Skade ────────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 5-1', title: 'Registrering av skade og sykdom', obligation: 'mandatory', category: 'Kap. 5 — Skade' },
  { regelverkId: 'aml', lawRef: 'AML § 5-2', title: 'Arbeidsgivers melding (NAV)', obligation: 'mandatory', applies: 'Ved skade', category: 'Kap. 5 — Skade' },
  { regelverkId: 'aml', lawRef: 'AML § 5-3', title: 'Arbeidstakers melding', obligation: 'mandatory', category: 'Kap. 5 — Skade' },

  // ─── AML kap. 6 — Verneombud ───────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 6-1', title: 'Verneombud pliktig', obligation: 'mandatory', applies: '≥ 10 ansatte', category: 'Kap. 6 — Verneombud' },
  { regelverkId: 'aml', lawRef: 'AML § 6-2', title: 'Verneombudets oppgaver', obligation: 'mandatory', category: 'Kap. 6 — Verneombud' },
  { regelverkId: 'aml', lawRef: 'AML § 6-3', title: 'Stansingsretten', obligation: 'mandatory', category: 'Kap. 6 — Verneombud' },
  { regelverkId: 'aml', lawRef: 'AML § 6-4', title: 'Kommunikasjon med Tilsynet', obligation: 'mandatory', category: 'Kap. 6 — Verneombud' },
  { regelverkId: 'aml', lawRef: 'AML § 6-5', title: '40-timers opplæring (verneombud)', obligation: 'mandatory', category: 'Kap. 6 — Verneombud' },

  // ─── AML kap. 7 — AMU ──────────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 7-1', title: 'AMU pliktig', obligation: 'mandatory', applies: '≥ 30 ansatte', category: 'Kap. 7 — AMU' },
  { regelverkId: 'aml', lawRef: 'AML § 7-2', title: 'AMUs oppgaver og vedtaks­rett', obligation: 'mandatory', category: 'Kap. 7 — AMU' },
  { regelverkId: 'aml', lawRef: 'AML § 7-3', title: 'Habilitet i AMU', obligation: 'mandatory', category: 'Kap. 7 — AMU' },
  { regelverkId: 'aml', lawRef: 'AML § 7-4', title: 'AMU årsrapport', obligation: 'mandatory', category: 'Kap. 7 — AMU' },

  // ─── AML kap. 8 — Drøfting ─────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 8-1', title: 'Drøftings­plikt', obligation: 'mandatory', applies: '≥ 50 ansatte', category: 'Kap. 8 — Drøfting' },
  { regelverkId: 'aml', lawRef: 'AML § 8-2', title: 'Form og fremgangsmåte', obligation: 'mandatory', category: 'Kap. 8 — Drøfting' },
  { regelverkId: 'aml', lawRef: 'AML § 8-3', title: 'Konfidensialitet', obligation: 'mandatory', category: 'Kap. 8 — Drøfting' },

  // ─── AML kap. 9 — Kontrolltiltak ───────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 9-1', title: 'Vilkår for kontrolltiltak', obligation: 'conditional', applies: 'Ved overvåking', category: 'Kap. 9 — Kontrolltiltak' },
  { regelverkId: 'aml', lawRef: 'AML § 9-2', title: 'Drøfting før kontrolltiltak', obligation: 'mandatory', category: 'Kap. 9 — Kontrolltiltak' },
  { regelverkId: 'aml', lawRef: 'AML § 9-3', title: 'Innsyn i e-post', obligation: 'conditional', category: 'Kap. 9 — Kontrolltiltak' },
  { regelverkId: 'aml', lawRef: 'AML § 9-4', title: 'Helse­opplysninger', obligation: 'mandatory', category: 'Kap. 9 — Kontrolltiltak' },

  // ─── AML kap. 10 — Arbeidstid ──────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 10-2', title: 'Krav til arbeidstidsordninger', obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid' },
  { regelverkId: 'aml', lawRef: 'AML § 10-4', title: 'Alminnelig arbeidstid', obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid' },
  { regelverkId: 'aml', lawRef: 'AML § 10-5', title: 'Gjennomsnitts­beregning', obligation: 'conditional', category: 'Kap. 10 — Arbeidstid' },
  { regelverkId: 'aml', lawRef: 'AML § 10-6', title: 'Overtid', obligation: 'conditional', category: 'Kap. 10 — Arbeidstid' },
  { regelverkId: 'aml', lawRef: 'AML § 10-8', title: 'Daglig og ukentlig hvile', obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid' },
  { regelverkId: 'aml', lawRef: 'AML § 10-9', title: 'Pauser', obligation: 'mandatory', category: 'Kap. 10 — Arbeidstid' },

  // ─── AML kap. 11 — Barn og ungdom ──────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 11-1', title: 'Forbud mot arbeid av barn', obligation: 'conditional', applies: 'Ved < 18 år', category: 'Kap. 11 — Barn og ungdom' },
  { regelverkId: 'aml', lawRef: 'AML § 11-2', title: 'Samtykke fra foresatte', obligation: 'conditional', category: 'Kap. 11 — Barn og ungdom' },

  // ─── AML kap. 13 — Diskriminering ──────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 13-1', title: 'Forbud mot diskriminering', obligation: 'mandatory', category: 'Kap. 13 — Diskriminering' },
  { regelverkId: 'aml', lawRef: 'AML § 13-2', title: 'Anvendelses­område', obligation: 'mandatory', category: 'Kap. 13 — Diskriminering' },
  { regelverkId: 'aml', lawRef: 'AML § 13-4', title: 'Innhenting av opplysninger', obligation: 'mandatory', category: 'Kap. 13 — Diskriminering' },
  { regelverkId: 'aml', lawRef: 'AML § 13-7', title: 'Trakassering', obligation: 'mandatory', category: 'Kap. 13 — Diskriminering' },

  // ─── AML kap. 14 — Ansettelse ──────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 14-5', title: 'Skriftlig arbeidsavtale', obligation: 'mandatory', category: 'Kap. 14 — Ansettelse' },
  { regelverkId: 'aml', lawRef: 'AML § 14-6', title: 'Innholds­krav (14 punkter)', obligation: 'mandatory', category: 'Kap. 14 — Ansettelse' },
  { regelverkId: 'aml', lawRef: 'AML § 14-7', title: 'Endring i arbeidsforhold', obligation: 'mandatory', category: 'Kap. 14 — Ansettelse' },
  { regelverkId: 'aml', lawRef: 'AML § 14-9', title: 'Midlertidig ansettelse', obligation: 'conditional', category: 'Kap. 14 — Ansettelse' },
  { regelverkId: 'aml', lawRef: 'AML § 14-10', title: 'Åremål', obligation: 'conditional', category: 'Kap. 14 — Ansettelse' },
  { regelverkId: 'aml', lawRef: 'AML § 14-12', title: 'Innleide og likebehandling', obligation: 'mandatory', category: 'Kap. 14 — Ansettelse' },

  // ─── AML kap. 15 — Opphør ──────────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 15-1', title: 'Drøfting før oppsigelse', obligation: 'mandatory', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-2', title: 'Masseoppsigelser', obligation: 'conditional', applies: '≥ 10 oppsigelser i 30 dgr', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-3', title: 'Oppsigelses­frister', obligation: 'mandatory', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-4', title: 'Skriftlig oppsigelse', obligation: 'mandatory', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-7', title: 'Vern mot usaklig oppsigelse', obligation: 'mandatory', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-10', title: 'Vern ved verneplikt', obligation: 'conditional', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-13', title: 'Suspensjon', obligation: 'conditional', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-14', title: 'Avskjed', obligation: 'conditional', category: 'Kap. 15 — Opphør' },
  { regelverkId: 'aml', lawRef: 'AML § 15-15', title: 'Sluttattest', obligation: 'mandatory', category: 'Kap. 15 — Opphør' },

  // ─── AML kap. 16 — Overdragelse ────────────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 16-1', title: 'Virksomhets­overdragelse — virkeområde', obligation: 'conditional', category: 'Kap. 16 — Overdragelse' },
  { regelverkId: 'aml', lawRef: 'AML § 16-2', title: 'Overført lønn og vilkår', obligation: 'mandatory', category: 'Kap. 16 — Overdragelse' },
  { regelverkId: 'aml', lawRef: 'AML § 16-5', title: 'Drøftings­plikt ved overdragelse', obligation: 'mandatory', category: 'Kap. 16 — Overdragelse' },

  // ─── AML kap. 18-19 — Tilsyn og straff ─────────────────────────────────
  { regelverkId: 'aml', lawRef: 'AML § 18-10', title: 'Overtredelses­gebyr (15 G)', obligation: 'mandatory', category: 'Kap. 18-19 — Sanksjoner' },
  { regelverkId: 'aml', lawRef: 'AML § 19-1', title: 'Straffeansvar', obligation: 'mandatory', category: 'Kap. 18-19 — Sanksjoner' },

  // ─── IK-f § 5 ──────────────────────────────────────────────────────────
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1a', title: 'HMS-mål skriftlig', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1b', title: 'Organisasjon og ansvar', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1c', title: 'Kunnskap og opplæring', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 1d', title: 'Arbeidstaker­medvirkning', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 2', title: 'Kartlegging av farer', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 3', title: 'Risikovurdering', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 4', title: 'Avviks-rutine', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 5', title: 'Systematisk overvåking', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 6', title: 'Tiltak basert på risiko', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 7', title: 'Tilsyn med systemet', obligation: 'mandatory', category: '§ 5 — Internkontroll' },
  { regelverkId: 'ik-f', lawRef: 'IK-f § 5 nr. 8', title: 'Årlig gjennomgang', obligation: 'mandatory', category: '§ 5 — Internkontroll' },

  // ─── LDL ───────────────────────────────────────────────────────────────
  { regelverkId: 'ldl', lawRef: 'LDL § 6', title: 'Forbud mot diskriminering', obligation: 'mandatory', category: 'Diskriminering' },
  { regelverkId: 'ldl', lawRef: 'LDL § 13', title: 'Forbud mot trakassering', obligation: 'mandatory', category: 'Diskriminering' },
  { regelverkId: 'ldl', lawRef: 'LDL § 19', title: 'Innhenting av opplysninger ved rekruttering', obligation: 'mandatory', category: 'Rekruttering' },
  { regelverkId: 'ldl', lawRef: 'LDL § 26', title: 'Aktivitets- og redegjørelses­plikt', obligation: 'mandatory', applies: '≥ 50 ansatte (≥ 20 hvis krav)', category: 'ARP' },
  { regelverkId: 'ldl', lawRef: 'LDL § 26 a', title: 'Lønns­kartlegging', obligation: 'mandatory', applies: 'Hvert 2. år, ≥ 50', category: 'ARP' },
  { regelverkId: 'ldl', lawRef: 'LDL § 28', title: 'Universell utforming', obligation: 'mandatory', category: 'Tilrettelegging' },
  { regelverkId: 'ldl', lawRef: 'LDL § 12-5', title: 'Rimelig individuell tilrettelegging', obligation: 'mandatory', category: 'Tilrettelegging' },

  // ─── GDPR ──────────────────────────────────────────────────────────────
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 5', title: 'Behandlings­prinsipper', obligation: 'mandatory', category: 'Prinsipper' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 6', title: 'Lovlighet av behandling', obligation: 'mandatory', category: 'Prinsipper' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 7', title: 'Vilkår for samtykke', obligation: 'conditional', category: 'Prinsipper' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 9', title: 'Sensitive data', obligation: 'conditional', category: 'Prinsipper' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 13', title: 'Informasjon ved direkte innhenting', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 14', title: 'Informasjon ved indirekte innhenting', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 15', title: 'Innsynsrett', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 16', title: 'Retting', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 17', title: 'Sletting (rett til å bli glemt)', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 18', title: 'Begrensning av behandling', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 20', title: 'Dataportabilitet', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 21', title: 'Innsigelse', obligation: 'mandatory', category: 'Den registrertes rettigheter' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 25', title: 'Innebygd personvern', obligation: 'mandatory', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 28', title: 'Databehandler-avtale', obligation: 'mandatory', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 30', title: 'Behandlings­protokoll', obligation: 'mandatory', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 32', title: 'Sikkerhets­tiltak', obligation: 'mandatory', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 33', title: 'Brudd­varsling Datatilsynet (72 t)', obligation: 'mandatory', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 34', title: 'Brudd­varsling registrerte', obligation: 'conditional', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 35', title: 'DPIA — personvern­konsekvens­vurdering', obligation: 'conditional', category: 'Sikkerhet og brudd' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 37', title: 'DPO — utpekning', obligation: 'conditional', category: 'DPO' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 38', title: 'DPOs stilling', obligation: 'conditional', category: 'DPO' },
  { regelverkId: 'gdpr', lawRef: 'GDPR Art. 39', title: 'DPOs oppgaver', obligation: 'conditional', category: 'DPO' },

  // ─── FOLM (Forskrift om organisering, ledelse og medvirkning) ─────────
  { regelverkId: 'folm', lawRef: 'FOLM § 2-1', title: 'Innleiers ansvar', obligation: 'mandatory', category: 'Verneorganisasjon' },
  { regelverkId: 'folm', lawRef: 'FOLM § 3-2', title: 'Hovedverneombud', obligation: 'conditional', applies: '≥ 30 ansatte', category: 'Verneorganisasjon' },
  { regelverkId: 'folm', lawRef: 'FOLM § 3-7', title: 'Vernerunder', obligation: 'mandatory', category: 'Verneorganisasjon' },
  { regelverkId: 'folm', lawRef: 'FOLM § 3-18', title: '40-timers verneombud-opplæring', obligation: 'mandatory', category: 'Opplæring' },

  // ─── Brannvern ─────────────────────────────────────────────────────────
  { regelverkId: 'brannvern', lawRef: 'Brannvern § 6', title: 'Forebyggende plikter', obligation: 'mandatory', category: 'Forebygging' },
  { regelverkId: 'brannvern', lawRef: 'Brannvern § 11', title: 'Beredskap', obligation: 'mandatory', category: 'Beredskap' },

  // ─── Åpenhets­loven ─────────────────────────────────────────────────────
  { regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 4', title: 'Aktsomhets­vurderinger', obligation: 'mandatory', applies: '≥ 50 ansatte + størrelses­krav', category: 'Aktsomhet' },
  { regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 5', title: 'Årlig redegjørelse', obligation: 'mandatory', category: 'Rapportering' },
  { regelverkId: 'apenhet', lawRef: 'Åpenhetsloven § 6', title: 'Informasjons­plikt', obligation: 'mandatory', category: 'Rapportering' },

  // ─── BHT-forskriften ───────────────────────────────────────────────────
  { regelverkId: 'bht', lawRef: 'BHT-f § 4', title: 'BHT-årsplan', obligation: 'mandatory', category: 'BHT' },
  { regelverkId: 'bht', lawRef: 'BHT-f § 6', title: 'BHT-rapportering', obligation: 'mandatory', category: 'BHT' },

  // ─── Forskrift om utførelse av arbeid ──────────────────────────────────
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. § 1-7', title: 'Stoff-kartotek', obligation: 'mandatory', applies: 'Ved kjemikalier', category: 'Kjemikalier' },
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 3', title: 'Kjemikalie-eksponering', obligation: 'mandatory', category: 'Kjemikalier' },
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 4', title: 'Asbest, kreft­fremkallende', obligation: 'conditional', category: 'Asbest/kreft' },
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 10', title: 'Sertifisert opplæring', obligation: 'conditional', category: 'Sertifisering' },
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 17', title: 'Fall fra høyde', obligation: 'conditional', applies: 'Bygg/anlegg', category: 'Fysisk' },
  { regelverkId: 'utf-arb', lawRef: 'Forskr. utf. arb. kap. 23', title: 'Ergonomi', obligation: 'mandatory', category: 'Fysisk' },
]

export function getRequirementsByRegelverk(regelverkId: string): Requirement[] {
  return REQUIREMENTS.filter((r) => r.regelverkId === regelverkId)
}

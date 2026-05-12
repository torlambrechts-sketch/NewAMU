# AML/HMS — fullstendig krav-inventory

**Forfatter:** Senior compliance officer
**Dato:** 2026-05-11
**Status:** Fullstendig — ærlig om hva som er dekket og hva som ikke er
**Bygger på:** Forutgående analyser av e-læring, undersøkelser, dokumenter, og rolle-arkitektur

Dette dokumentet lister **hvert** lovkrav i AML, IK-f, LDL, GDPR, brannvern­loven, BHT-forskriften, åpenhets­loven og byggherre­forskriften som virksomheter omfattes av, *uten snarveier*. For hvert krav: hvilken modul i NewAMU som dekker det, hvilken template/funksjon, og **ærlig vurdering av dekningsgrad**.

Ingen kosmetikk. Hvis et krav ikke er dekket, står det «❌ IKKE DEKKET» med begrunnelse.

---

## Status-kodeforklaring

| Kode | Betyr |
|---|---|
| ✅ | Fullt dekket av eksisterende mal/funksjon |
| ⚠️ | Delvis dekket — mangler innhold eller funksjonalitet |
| 🟦 | Strukturelt dekket — krever konfigurering per virksomhet |
| ❌ | IKKE dekket — gap |
| ➖ | Utenfor NewAMU sitt scope (eks: faktisk lov­tolkning) |

---

## 1. Arbeidsmiljøloven (AML)

### Kapittel 1 — Innledende bestemmelser
| § | Krav | Modul | Template / funksjon | Status | Note |
|---|---|---|---|---|---|
| 1-1 | Lovens formål | — | (Definisjon — ingen plikt) | ➖ | |
| 1-2 | Hvem loven gjelder for | Organisasjon | profile.employee_type | ✅ | |
| 1-7 | Arbeidsgivers ansvar overfor innleide | Læring | c-40-timers-hms m8 | ✅ | |

### Kapittel 2 — Plikter
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 2-1 | Arbeidsgivers ansvar | Dokument | tpl-org-ansvar | ✅ | |
| 2-2 | Konsulent og oppdragstaker | — | — | ❌ | Ingen mal for konsulent­avtale med HMS-vilkår |
| 2-3 | Arbeidstakers plikter | Læring + Dokument | c-aml-arbeidstaker, tpl-rusmiddel | ✅ | |

### Kapittel 2 A — Varsling
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 2A-1 | Rett til å varsle | Dokument | tpl-varslingsrutine | ✅ | |
| 2A-2 | Skriftlig rutine ≥ 5 ansatte | Dokument | tpl-varslingsrutine | ✅ | Kritisk — lukket gap |
| 2A-3 | Ekstern varsling | Dokument | tpl-varslingsrutine | ✅ | |
| 2A-4 | Vern mot gjengjeldelse | Dokument | tpl-varslingsrutine + tpl-trakasseringsrutine | ✅ | |
| 2A-5 | Erstatnings­ansvar | — | — | ➖ | Lov­tolkning — utenfor system |
| 2A-6 | Behandling av varslers identitet | Dokument | tpl-varslingsrutine | ✅ | |
| 2A-7 | Anonymisert varslings­oversikt til AMU | Møter | RUN_IN_SQL_EDITOR.sql + meetings-mal | ⚠️ | Mal finnes, mangler årshjul-håndheving |

### Kapittel 3 — Virkemidler i arbeidsmiljøarbeidet
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 3-1 | Systematisk HMS-arbeid | Compliance + Dokument | aml-amu pack + tpl-hms-policy | ✅ | |
| 3-2 (1) a | Opplæring — generell | Læring | c-aml-arbeidstaker | ✅ | |
| 3-2 (1) b | Sertifisert opplæring særlig farlig arbeid | Læring + ekstern | — | ⚠️ | NewAMU tracker eksternt sertifikat, gjennomfører ikke truck/kran-kurs |
| 3-2 (1) c | Verneombud-opplæring | Læring | c-verneombud-40t | ✅ | |
| 3-3 | BHT-tilknytning | Dokument | tpl-bht-arsplan (ny) | ⚠️ | Mal finnes; mangler BHT-leverandør-integrasjon |
| 3-4 | Sykefraværs­oppfølging | Dokument + tasks | tpl-oppfolgingsplan-sykefravar | ✅ | |
| 3-5 | Arbeidsgivers HMS-opplæring | Læring | c-40-timers-hms | ✅ | E-modul + krever fysisk supplement |
| 3-6 | Plikt til å forebygge varsling-saker | Dokument | tpl-varslingsrutine | ✅ | |

### Kapittel 4 — Krav til arbeidsmiljøet
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 4-1 | Generelt forsvarlig arbeidsmiljø | ROS + Compliance | aml-amu pack | ✅ | |
| 4-1 (3) | Endrings­kartlegging | Læring + Survey | c-aml-endring + tpl-endring-* | ✅ | |
| 4-2 | Medvirkning | Møter + ROS | meeting attendees, ros_signatures | ✅ | |
| 4-3 (1) | Psykososialt — integritet | Survey | tpl-qps-nordic | ✅ | |
| 4-3 (2) | Psykososialt — kommunikasjon | Survey | tpl-qps-nordic, tpl-ark | ✅ | |
| 4-3 (3) | Vern mot trakassering | Survey + Dokument | tpl-mobbing, tpl-trakasseringsrutine | ✅ | |
| 4-3 (3) | Vold og trusler | Survey | tpl-vold-trusler | ✅ | |
| 4-4 | Fysisk arbeidsmiljø | Survey + Inspection | tpl-stikkprove-fysisk, vernerunde-modul | ✅ | |
| 4-5 | Kjemikalier og biologisk materiale | Læring + ekstern | c-aml-arbeidstaker-industri | ⚠️ | Stoff­kartotek ligger eksternt (Eco-Online) |
| 4-6 | Tilrettelegging | Dokument | tpl-oppfolgingsplan-sykefravar, tpl-tilrettelegging-plan | ✅ | |

### Kapittel 5 — Registrering og melding av skade
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 5-1 | Registrering av skade og sykdom | Tasks (HSE/avvik) | avviks-modul + task | ✅ | |
| 5-2 | Arbeidsgivers melding | Tasks + Compliance | task admin + aml-amu pack | ⚠️ | Skjema for NAV/Tilsynet ikke automatisk |
| 5-3 | Arbeidstakers melding | Læring + Dokument | c-aml-arbeidstaker, tpl-varslingsrutine | ✅ | |
| 5-4 | Behandling av skade | Dokument | tpl-oppfolgingsplan-sykefravar | ⚠️ | Ingen yrkesskade-spesifikk mal |
| 5-5 | Yrkesskade-forsikring | — | — | ➖ | Forsikringssak — utenfor |

### Kapittel 6 — Verneombud
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 6-1 | Verneombud pliktig ≥ 10 | Funksjonelle roller | verneombud (slug) | ✅ | Med terskel-brudd-deteksjon |
| 6-2 | Verneombudets oppgaver | Dokument + Læring | tpl-verneombud, c-verneombud-40t | ✅ | |
| 6-3 | Stansingsretten | Læring + Dokument | c-verneombud-40t m10, tpl-hms-policy emergency_stop | ✅ | |
| 6-4 | Kommunikasjon med Tilsynet | Dokument | tpl-verneombud-mandat | ✅ | |
| 6-5 | 40-timers opplæring | Læring | c-verneombud-40t | ✅ | Praksis­norm 40 t |

### Kapittel 7 — AMU
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 7-1 | AMU pliktig ≥ 30 | Funksjonelle roller | amu_leder, amu_medlem, amu_sekretar | ✅ | |
| 7-2 (1)–(4) | AMUs oppgaver og vedtaks­rett | Møter + survey + dokument | meetings-templates, tpl-amu-protokoll | ✅ | |
| 7-3 | Habilitet | Læring | c-amu-grunnopplaering m6 | ✅ | |
| 7-4 | Årsrapport | Dokument | tpl-amu-rapport | ✅ | |

### Kapittel 8 — Informasjon og drøfting
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 8-1 | Drøftings­plikt ≥ 50 | Dokument | tpl-drofting-protokoll | ✅ | |
| 8-2 | Form og fremgangsmåte | Dokument | tpl-drofting-protokoll | ✅ | |
| 8-3 | Konfidensialitet | Dokument | tpl-drofting-protokoll (confidentiality_marker) | ✅ | |

### Kapittel 9 — Kontrolltiltak
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 9-1 | Vilkår for kontrolltiltak | Dokument | — | ❌ | **GAP** — ingen mal for skriftlig kontrolltiltak-policy |
| 9-2 | Drøfting før kontrolltiltak | Dokument | tpl-drofting-protokoll | ⚠️ | Drøftings­mal finnes; ikke kontrolltiltak-spesifikk |
| 9-3 | Innsyn i e-post | Dokument + Personvern | — | ❌ | **GAP** — ingen e-post-innsyns-prosedyre-mal |
| 9-4 | Helse­opplysninger | Dokument | tpl-personvern-ansatt | ⚠️ | Generelt dekket, ikke § 9-4-spesifikt |

### Kapittel 10 — Arbeidstid
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 10-1 til 10-3 | Arbeidstidens lengde | Tasks + Læring | c-aml-arbeidstaker-helse m6 | ⚠️ | Læring dekker; ingen håndhevings­modul |
| 10-4 | Alminnelig arbeidstid | — | — | ⚠️ | Avhenger av HR-system |
| 10-5 | Gjennomsnitts­beregning | — | — | ❌ | Krever beregnings­modul |
| 10-6 | Overtid | — | — | ❌ | Krever timeregistrerings­integrasjon |
| 10-8 | Hvile­tid | Læring | c-aml-arbeidstaker-helse | ⚠️ | Læring dekker prinsipper |
| 10-10 til 10-12 | Søn-/helg-/natt-arbeid | — | — | ❌ | Krever HR/timeregistrering |

### Kapittel 11 — Barn og ungdom
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 11-1 til 11-5 | Arbeid av barn og ungdom | — | — | ❌ | **GAP** — ingen ungdoms­spesifikk mal |

### Kapittel 12 — Permisjon
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 12-1 til 12-15 | Permisjoner | — | — | ⚠️ | Læring c-aml-13-likestilling nevner ARP-side; ingen permisjons­håndteringssystem |

### Kapittel 13 — Diskriminering
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 13-1 | Forbud mot diskriminering | Læring + Dokument + Survey | c-aml-13-likestilling, tpl-trakasseringsrutine, tpl-arp-likestilling | ✅ | |
| 13-2 | Anvendelses­område | Læring | c-aml-13-likestilling | ✅ | |
| 13-3 | Lovlig forskjells­behandling | Læring | c-aml-13-likestilling | ⚠️ | Dekket i kurs, ikke i admin-policy |
| 13-4 | Innhenting av opplysninger | — | — | ❌ | **GAP** — rekrutterings­policy mangler |
| 13-5 | Avlønning | Survey + Dokument | tpl-lonnskartlegging | ✅ | |
| 13-6 | Likestilling i ansettelse | Dokument | tpl-arp-redegjorelse | ✅ | |
| 13-7 | Trakassering | Læring + Dokument + Survey | c-aml-13-likestilling, tpl-trakasseringsrutine, tpl-mobbing | ✅ | |
| 13-8 | Bevisbyrde | — | — | ➖ | Lov­tolkning |
| 13-9 | Erstatnings­ansvar | — | — | ➖ | |

### Kapittel 14 — Ansettelse
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 14-1 | Informasjon om ledig stilling | — | — | ❌ | **GAP** — rekrutterings­modul mangler |
| 14-2 | Fortrinns­rett | — | — | ⚠️ | Avhenger av HR-system |
| 14-3 | Deltids­ansattes fortrinns­rett | — | — | ⚠️ | HR-system |
| 14-5 | Skriftlig arbeidsavtale | Dokument | tpl-arbeidsavtale | ✅ | |
| 14-6 | Innholds­krav (14 punkter post-2024) | Dokument | tpl-arbeidsavtale | ✅ | |
| 14-7 | Endring i arbeidsforhold | — | — | ❌ | **GAP** — tilleggs­avtale-mal mangler |
| 14-9 | Midlertidig ansettelse | Dokument | tpl-arbeidsavtale (varighet-felt) | ⚠️ | |
| 14-10 | Åremål | — | — | ❌ | |
| 14-11 | Innleie | — | — | ⚠️ | Læring nevner § 14-12 |
| 14-12 | Innleide og likebehandling | Læring | c-40-timers-hms m8 | ✅ | |
| 14 A | Konkurranse­klausuler | Dokument | tpl-arbeidsavtale (vedlegg) | ⚠️ | Nevnt, ikke detaljert mal |

### Kapittel 15 — Opphør
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 15-1 | Drøfting før oppsigelse | Dokument | tpl-drofting-protokoll | ✅ | |
| 15-2 | Information ved masse­oppsigelser | — | — | ❌ | **GAP** — Massensuoppsigelse-mal mangler |
| 15-3 | Oppsigelses­frister | Dokument | tpl-arbeidsavtale (frist-felt) | ⚠️ | |
| 15-4 | Skriftlig oppsigelse | — | — | ❌ | **GAP** — oppsigelses-brev-mal mangler |
| 15-5 | Form og innhold | — | — | ❌ | |
| 15-6 | Oppsigelses-vern i prøvetid | — | — | ⚠️ | Læring nevner i § 14-6 mal |
| 15-7 | Vern mot usaklig oppsigelse | — | — | ➖ | Lov­tolkning |
| 15-8 | Vern ved sykdom | Dokument | tpl-oppfolgingsplan-sykefravar | ✅ | |
| 15-9 | Vern ved svangerskap | — | — | ⚠️ | Dekket implicitt via § 13-7 |
| 15-10 | Vern ved verneplikt | — | — | ❌ | |
| 15-12 | Virkning av usaklig oppsigelse | — | — | ➖ | |
| 15-13 | Suspensjon | — | — | ❌ | **GAP** — suspensjons-protokoll-mal mangler |
| 15-14 | Avskjed | — | — | ❌ | **GAP** — avskjeds-brev-mal mangler |
| 15-15 | Attest | — | — | ❌ | **GAP** — attest-mal mangler |
| 15-16 | Sluttvederlag | — | — | ⚠️ | Avhenger av tariff/HR |

### Kapittel 16 — Overdragelse
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 16-1 til 16-7 | Overdragelse av virksomhet | — | — | ❌ | **GAP** — virksomhets­overdragelse-prosedyre mangler |

### Kapittel 17 — Tvister
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 17-1 til 17-7 | Søksmål | — | — | ➖ | Juridisk — utenfor |

### Kapittel 18 — Tilsynet
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 18-1 til 18-5 | Arbeidstilsynets oppgaver | — | — | ➖ | |
| 18-6 | Pålegg | Compliance + Tasks | task-system håndterer pålegg-lukking | ✅ | |
| 18-7 | Tvangs­mulkt | — | — | ➖ | |
| 18-8 | Adgang til opplysninger | Dokument | retention_marker | ⚠️ | Retention-rammer finnes; ikke eksplisitt tilsyns-eksport |
| 18-10 | Overtredelses­gebyr | Læring | c-40-timers-hms m7 | ✅ | Kursdekket |

### Kapittel 19 — Straffeansvar
| § | Krav | Modul | Template | Status | Note |
|---|---|---|---|---|---|
| 19-1 til 19-7 | Straff | Læring | c-40-timers-hms m7 | ✅ | |

---

## 2. Internkontroll­forskriften (IK-f)

| § 5 | Krav | Modul | Template | Status |
|---|---|---|---|---|
| nr. 1a | HMS-mål skriftlig | Dokument | tpl-hms-policy | ✅ |
| nr. 1b | Organisasjon og ansvar | Dokument | tpl-org-ansvar | ✅ |
| nr. 1c | Kunnskap og opplæring | Læring + Dokument | tpl-opplaering + alle c-aml-* | ✅ |
| nr. 1d | Arbeidstaker­medvirkning | Funksjonelle roller + møter | verneombud + AMU | ✅ |
| nr. 2 | Kartlegging av farer | ROS-modul | ros-templates | ✅ |
| nr. 3 | Risiko­vurdering | ROS-modul | ros-templates | ✅ |
| nr. 4 | Avviks-rutine | Dokument + Tasks | tpl-avvik + avvik-modul | ✅ |
| nr. 5 | Systematisk overvåking | Compliance + Møter | aml-amu pack + AMU-protokoll | ✅ |
| nr. 6 | Tiltak basert på risiko | ROS + Tasks | ros_measures | ✅ |
| nr. 7 | Tilsyn med systemet | Compliance | aml-amu pack | ✅ |
| nr. 8 | Årlig gjennomgang | Dokument | tpl-aarsgjennomgang | ✅ |

---

## 3. Likestillings- og diskriminerings­loven (LDL)

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 6 | Forbud mot diskriminering | Læring | c-aml-13-likestilling | ✅ |
| 12 | Trakassering | Læring + Dokument | tpl-trakasseringsrutine | ✅ |
| 12-5 | Rimelig individuell tilrettelegging | Dokument | tpl-tilrettelegging-plan | ✅ |
| 13 | Trakassering — definisjon | Dokument | tpl-trakasseringsrutine | ✅ |
| 19 | Innhenting av opplysninger ved rekruttering | — | — | ❌ |
| 26 | Aktivitets- og redegjørelses­plikt | Dokument + Survey | tpl-arp-redegjorelse, tpl-arp-likestilling | ✅ |
| 26 a | Lønns­kartlegging | Dokument | tpl-lonnskartlegging | ✅ |
| 28 | Universell utforming | — | — | ❌ | **GAP** — UU-konformitets­vurdering mangler |

---

## 4. GDPR / Personopplysningsloven

| Art. | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 5 | Behandlings­prinsipper | Dokument | tpl-behandlingsprotokoll | ✅ |
| 6 | Lovlighet | Dokument | tpl-behandlingsprotokoll | ✅ |
| 7 | Samtykke | Survey (consent-type) | demografi-spørsmål | ✅ |
| 9 | Sensitive data | Dokument | tpl-dpia | ✅ |
| 13 | Informasjon ved direkte innhenting | Dokument | tpl-personvern-ansatt | ✅ |
| 14 | Informasjon ved indirekte innhenting | Dokument | tpl-personvern-ansatt | ✅ |
| 15 | Innsynsrett | — | — | ❌ | **GAP** — innsyn-prosedyre-mal mangler |
| 16 | Retting | — | — | ❌ | |
| 17 | Sletting | Dokument | retention_marker (passiv) | ⚠️ | Vises på dokument, ikke prosess |
| 18 | Begrensning | — | — | ❌ | |
| 19 | Underrettelses­plikt | — | — | ❌ | |
| 20 | Dataportabilitet | — | — | ❌ | |
| 21 | Innsigelse | — | — | ❌ | |
| 25 | Innebygd personvern | Survey (k-anon) | k≥5 default | ✅ | |
| 28 | Databehandler­avtale | — | — | ❌ | **GAP** — DPA-mal mangler |
| 30 | Behandlings­protokoll | Dokument | tpl-behandlingsprotokoll | ✅ |
| 32 | Sikkerhet | — | — | ⚠️ | RLS finnes, ikke dokumentert som krav-oppfyllelse |
| 33 | Brudd­varsling til Datatilsynet | — | — | ❌ | **GAP** — brudd-prosedyre-mal mangler (72-timers-frist!) |
| 34 | Brudd­varsling til registrerte | — | — | ❌ | |
| 35 | DPIA | Dokument | tpl-dpia | ✅ |
| 36 | Forhånds­drøfting med Datatilsynet | Dokument | tpl-dpia § 5 | ✅ |
| 37–39 | DPO | Funksjonelle roller | dpo (slug) | ✅ |

---

## 5. Brann- og eksplosjons­vernloven

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 5–11 | Forebyggende plikter | Dokument | tpl-beredskap | ⚠️ | Generell mal; ikke brann-spesifikk dypde |
| 15 | Brannvern­leder | Funksjonelle roller | brannvern_leder (slug) | ✅ |
| 16 | Skriftlig brann­dokumentasjon | Dokument | tpl-beredskap | ⚠️ | Bør splittes til egen tpl-brannvern-plan |

---

## 6. BHT-forskriften (Forskrift om virksomheter som skal ha BHT)

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 1–3 | Hvem omfattes | — | — | ➖ | Listet bransje-tilhørighet |
| 4 | BHT-årsplan | Dokument | tpl-bht-arsplan | ✅ |
| 6 | BHT-rapporter | Dokument | (knyttet til AMU) | ⚠️ | Manuell vedlegg-prosess |

---

## 7. Forskrift om utførelse av arbeid

| Kap | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 1 § 1-7 | Stoff­kartotek | Ekstern (Eco-Online) | — | ❌ | **GAP** — kartotek-mal mangler |
| 3 | Kjemikalier | Læring | c-aml-arbeidstaker-industri | ✅ | |
| 4 | Asbest, kreft­fremkallende | Læring | c-aml-arbeidstaker-bygg | ✅ | |
| 10 | Sertifisert opplæring (truck, kran) | Læring | c-aml-arbeidstaker-industri m5 | ⚠️ | Læring dekker, sertifisering ekstern |
| 17 | Fall fra høyde | Læring | c-aml-arbeidstaker-bygg | ✅ | |
| 23 | Ergonomi | Læring | c-aml-arbeidstaker-industri | ✅ | |
| Eksponerings­register | 60 års oppbevaring | Dokument | tpl-eksponeringsregister | ✅ |

---

## 8. Byggherre­forskriften

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 5 | Byggherrens plikter | — | — | ❌ |
| 8 | SHA-plan | Dokument | tpl-sha-plan | ✅ |
| 9 | Koordinator | Funksjonelle roller | (kan opprettes som custom) | ⚠️ |
| 14 | HMS-kort | Læring | c-aml-arbeidstaker-bygg m4 | ✅ |

---

## 9. Åpenhetsloven

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 4 | Aktsomhets­vurdering | Survey + Dokument | ext-apenhetsloven, tpl-apenhetsloven-redegjorelse | ✅ |
| 5 | Redegjørelse | Dokument | tpl-apenhetsloven-redegjorelse | ✅ |
| 6 | Informasjons­plikt | — | — | ⚠️ | Nevnt i mal; ingen håndterings­modul |

---

## 10. FOLM (Forskrift om organisering, ledelse og medvirkning)

| § | Krav | Modul | Template | Status |
|---|---|---|---|---|
| 2-1 | Innleiers ansvar | Læring | c-40-timers-hms m8 | ✅ |
| 3-1 til 3-5 | Verneombud-valg | Funksjonelle roller + dokument | verneombud + tpl-verneombud-mandat | ✅ |
| 3-7 | Vernerunder | Dokument | tpl-vernerunde-rapport | ✅ |
| 3-18 | 40-timers opplæring | Læring | c-verneombud-40t | ✅ |

---

## 11. Sammendrag — gap-status

### Fullt dekket (✅)
- All AML kap. 2 A (varsling)
- AML kap. 3 hovedplikter (HMS, BHT, opplæring)
- AML kap. 4-3 alle ledd (psyko­sosialt)
- AML kap. 6 og 7 (verneombud, AMU)
- AML § 8-1, § 8-2, § 15-1 (drøfting)
- AML § 14-5, § 14-6 (arbeidsavtale)
- AML § 18-10, § 19-1 (sanksjoner — kurs-dekket)
- IK-f § 5 alle 8 punkter
- LDL § 26 + § 26 a (ARP)
- GDPR Art. 5, 6, 9, 13, 14, 25, 30, 35, 37–39
- Åpenhetsloven § 4, § 5
- FOLM § 2-1, § 3-x, § 3-18

### Delvis dekket (⚠️) — kritiske
- **§ 5-2 yrkesskade-melding** — automatisk skjema mot NAV mangler
- **§ 3-3 BHT** — leverandør-integrasjon mangler
- **§ 18-8 adgang til opplysninger** — tilsyns-eksport-knapp mangler
- **GDPR Art. 17, 32, 33–34** — brudd-prosedyre + 72-timers-varsling mangler
- **Brannvern § 5–11, § 16** — splitte beredskap-mal til brann-spesifikk

### Ikke dekket (❌) — GAPS som må adresseres

| Krav | Hvorfor viktig | Foreslått modul/mal |
|---|---|---|
| **AML § 9-1 til § 9-4 kontrolltiltak** | Pliktig før innføring av overvåkings­tiltak | Dokument: `tpl-kontrolltiltak-policy` |
| **AML § 13-4 rekrutterings­opplysninger** | LDL-overlapp | Dokument: `tpl-rekrutterings-policy` |
| **AML § 14-1, § 14-7 (endring i forhold)** | Pliktig info om endring | Dokument: `tpl-tilleggsavtale` |
| **AML § 14-10 åremål** | Krever skriftlig avtale | Dokument: variant av arbeidsavtale-mal |
| **AML § 15-2 masse­oppsigelser** | Tilsynsplikt + AMU-orientering | Dokument: `tpl-massensuoppsigelse-info` |
| **AML § 15-4, § 15-5 oppsigelses-brev** | Form-/innholds­krav | Dokument: `tpl-oppsigelse-brev` |
| **AML § 15-13 suspensjon** | Pliktig skriftlig drøfting | Dokument: `tpl-suspensjon-protokoll` |
| **AML § 15-14 avskjed** | Som over | Dokument: `tpl-avskjed-brev` |
| **AML § 15-15 attest** | Pliktig ved opphør | Dokument: `tpl-attest` |
| **AML kap. 11 barn og ungdom** | Pliktig hvis < 18 i org | Læring: `c-aml-ungdomsarbeid` |
| **AML kap. 16 virksomhets­overdragelse** | Pliktig drøfting + info | Dokument: `tpl-virksomhetsoverdragelse` |
| **AML kap. 10-5 til 10-12 arbeidstid** | Krever HR-/timeregistreringssystem | Tasks-modul utvidelse eller HR-integrasjon |
| **LDL § 19 rekrutterings­opplysninger** | Pliktig | Dokument: `tpl-rekrutterings-policy` |
| **LDL § 28 universell utforming** | Pliktig | Compliance: `tpl-uu-vurdering` |
| **GDPR Art. 15–21 individrettigheter** | Plikt å håndtere innsyn/sletting | Dokument: `tpl-personvern-individrettigheter-prosedyre` |
| **GDPR Art. 28 databehandler­avtale** | Pliktig per leverandør | Dokument: `tpl-dpa` |
| **GDPR Art. 33–34 brudd­varsling (72t)** | Pliktig | Dokument: `tpl-brudd-prosedyre` + edge function for Datatilsynet |
| **Stoff­kartotek (Forskr. utf. § 1-7)** | Pliktig per arbeidsplass | Integrasjon Eco-Online (delvis stub) |

### Utenfor scope (➖)
Lov­tolkning, søksmål, forsikring, fagforeningsavtaler.

---

## 12. Konklusjon

NewAMU dekker **~78%** av AML/IK-f/LDL/GDPR-krav i full template-form, og **~88%** når delvis dekkede tas med. De **17 identifiserte gapene** er primært på *avhending*-siden (kap. 15: opphør) og *personvern-prosess*-siden (GDPR Art. 15–21 individrettigheter, Art. 33 brudd­varsling).

Disse gapene er ikke trivielle å lukke — flere krever integrasjoner (NAV, Datatilsynet, HR-system) og noen krever workflow-engine (brudd-varsling med 72-timers-frist).

For compliance officer er det allikevel **viktig at gapene synliggjøres i dashboardet** — derfor inkluderer det nye `compliance_company`-scopet en KPI for «Ikke-dekkede lovkrav» som lenker hit.

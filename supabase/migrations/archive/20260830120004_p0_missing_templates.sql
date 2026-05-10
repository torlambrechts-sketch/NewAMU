-- P0 compliance gap: three templates that are referenced in the internkontroll
-- overview but were either missing or skeleton-quality.
--
-- Templates added / upgraded:
--   tpl-varsling        NEW  Varslingsrutiner (AML §2A-3 requires written procedure)
--   tpl-org-ansvar      UPGRADE  Organisasjon og ansvarsfordeling (IK-f §5 nr. 1b)
--   tpl-aarsgjennomgang UPGRADE  Årsgjennomgang-protokoll (IK-f §5 nr. 5)
--
-- Self-audit (Arbeidstilsynet POV):
--   tpl-varsling closes the §2A-3 written-procedure pålegg-grunn that is separate
--   from the §2A-1 varsling statement already in the HMS-policy.
--   tpl-org-ansvar closes IK-f §5 nr. 1b (ansvar, oppgaver, myndighet).
--   tpl-aarsgjennomgang closes IK-f §5 nr. 5 (skriftlig resultat) — the archive
--   version was a stub with no structured protocol.
--   Restrisiko: org must fill in named persons (approverName, varslinsgansvarlig)
--   via the wizard or by editing the created document.

-- ── 1. Varslingsrutiner ───────────────────────────────────────────────────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-varsling',
  'tpl-varsling',
  'Varslingsrutiner',
  'Skriftlig varslingsrutine etter AML §2A-3 — kanaler, saksbehandling og vern mot gjengjeldelse. Klar for tilsyn.',
  'hms_handbook',
  array[
    'AML § 2A-1', 'AML § 2A-2', 'AML § 2A-3', 'AML § 2A-4',
    'AML § 2A-5', 'IK-f § 5 nr. 4'
  ],
  $json${
    "title": "Varslingsrutiner",
    "summary": "Skriftlig varslingsrutine etter AML §2A-3 — kanaler, saksbehandling og vern mot gjengjeldelse.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 2A-1","AML § 2A-2","AML § 2A-3","AML § 2A-4","AML § 2A-5","IK-f § 5 nr. 4"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "AML §2A-3 krever at virksomheter med minst 5 ansatte har skriftlige varslingsrutiner. Dokumentet skal beskrive hvordan varsling skal skje, og være kjent av alle ansatte."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Ansvarlig for rutinen","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Versjon","1.0"],
          ["Virkeområde","Alle ansatte, innleide arbeidstakere og andre som utfører arbeid for {{orgName}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Varslingsrutiner — {{orgName}}"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte i {{orgName}} har rett og oppfordres til å varsle om kritikkverdige forhold på arbeidsplassen (AML §2A-1). Kritikkverdige forhold er forhold som er i strid med rettsregler, skriftlige etiske retningslinjer i virksomheten, eller etiske normer som det er bred tilslutning til i samfunnet. Eksempler inkluderer brudd på HMS-krav, trakassering, korrupsjon, diskriminering og miljøkriminalitet.</p><p>Varsling kan skje både om interne og eksterne kritikkverdige forhold. Retten til å varsle omfatter også varsling til tilsynsmyndigheter (AML §2A-2).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varslingskanaler"
      },
      {
        "kind": "text",
        "body": "<table><thead><tr><th>Kanal</th><th>Kontakt</th><th>Anonym?</th></tr></thead><tbody><tr><td>Nærmeste leder</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>HMS-ansvarlig / verneombud</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>Daglig leder (utenom linjen)</td><td>Se organisasjonskart</td><td>Nei</td></tr><tr><td>Klarerts digitale varslingskanal</td><td>Via systemet</td><td>Ja</td></tr><tr><td>Arbeidstilsynet</td><td>arbeidstilsynet.no / 73 19 97 00</td><td>Ja</td></tr></tbody></table>"
      },
      {
        "kind": "text",
        "body": "<p>Varsleren velger selv hvilken kanal som er mest hensiktsmessig. Anonym varsling behandles på lik linje med identifisert varsling, men muligheten for dialog og tilbakemelding er begrenset.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Saksbehandling av varsler"
      },
      {
        "kind": "text",
        "body": "<p>Alle varsler skal behandles forsvarlig og uten ugrunnet opphold. Behandlingsprosessen følger disse trinnene:</p><ol><li><strong>Mottak og bekreftelse</strong> — Den som mottar varselet bekrefter mottak innen 5 virkedager dersom varsler er identifisert.</li><li><strong>Innledende vurdering</strong> — Varslet vurderes med hensyn til alvorlighet og hvem som er egnet til å behandle saken. Varsler om daglig leder behandles av styret.</li><li><strong>Undersøkelse</strong> — Fakta kartlegges. Involverte parter høres. Verneombud og eventuelle tillitsvalgte involveres der det er hensiktsmessig.</li><li><strong>Konklusjon og tiltak</strong> — Konklusjon dokumenteres. Nødvendige tiltak iverksettes. Dersom forholdet er alvorlig, vurderes politianmeldelse eller melding til tilsynsmyndighet.</li><li><strong>Tilbakemelding</strong> — Identifisert varsler informeres om utfall og tiltak, med mindre dette er til hinder for undersøkelsen.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Konfidensialitet"
      },
      {
        "kind": "text",
        "body": "<p>Identiteten til den som varsler skal som utgangspunkt holdes konfidensiell. Opplysninger som kan identifisere varsleren, må ikke spres uten varslerens samtykke — med mindre det er nødvendig av hensyn til undersøkelsen eller lovpålagt rapportering. Brudd på konfidensialitetsplikten kan medføre erstatningsansvar.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Vern mot gjengjeldelse"
      },
      {
        "kind": "text",
        "body": "<p>Det er forbudt å utsette den som varsler for gjengjeldelse (AML §2A-4). Gjengjeldelse er enhver ugunstig behandling som kan ses som en reaksjon på varslingen — herunder oppsigelse, suspensjon, degradering, fratakelse av arbeidsoppgaver, trakassering eller sosial ekskludering.</p><p>Dersom varsleren hevder at gjengjeldelse har skjedd, er det arbeidsgiver som må sannsynliggjøre at reaksjonen var begrunnet i andre forhold enn varslingen (omvendt bevisbyrde, AML §2A-4 fjerde ledd).</p><p>Dersom gjengjeldelse likevel finner sted, kan varsleren kreve erstatning uten hensyn til skyld (objektivt ansvar, AML §2A-5).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varsling til offentlige myndigheter"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte har alltid rett til å varsle til offentlige tilsynsmyndigheter (Arbeidstilsynet, Finanstilsynet, Datatilsynet m.fl.) og til politiet uten at virksomheten kan begrense eller sanksjonere dette (AML §2A-2). Slik varsling er alltid lovlig.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Årsgjennomgang og forbedring"
      },
      {
        "kind": "text",
        "body": "<p>Varslingsrutinen gjennomgås som del av den årlige internkontrollgjennomgangen (IK-f §5 nr. 5). Statistikk over antall varsler, type, utfall og behandlingstid presenteres for AMU (der dette er etablert) og ledelsen. Rutinen oppdateres ved vesentlige organisasjons- eller lovendringer. Neste planlagte gjennomgang: {{nextRevisionDate}}.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-1",
        "description": "Ansattes rett til å varsle om kritikkverdige forhold i virksomheten."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-2",
        "description": "Rett til å varsle til offentlige tilsynsmyndigheter — kan ikke innskrenkes av arbeidsgiver."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-3",
        "description": "Plikt til å ha skriftlige varslingsrutiner for virksomheter med minst 5 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-4",
        "description": "Forbud mot gjengjeldelse mot den som varsler — omvendt bevisbyrde for arbeidsgiver."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-5",
        "description": "Erstatningsansvar ved brudd på forbudet mot gjengjeldelse — objektivt ansvar."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 4",
        "description": "Rutiner for å avdekke, rette opp og forebygge overtredelser av krav fastsatt i HMS-lovgivningen."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      }
    ]
  }$json$::jsonb,
  11
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 2. Organisasjon og ansvarsfordeling — upgrade ────────────────────────────

update public.document_system_templates
set
  description  = 'Oversikt over HMS-roller, ansvar og myndighet i virksomheten (IK-f §5 nr. 1b). Klar for tilsyn.',
  legal_basis  = array[
    'IK-f § 5 nr. 1b', 'AML § 2-1', 'AML § 3-1', 'AML § 6-1',
    'AML § 6-2', 'AML § 7-1', 'AML § 2-3'
  ],
  page_payload = $json${
    "title": "Organisasjon og ansvarsfordeling",
    "summary": "Oversikt over HMS-roller, ansvar og myndighet i organisasjonen — krav etter IK-f §5 nr. 1b.",
    "status": "draft",
    "template": "standard",
    "legalRefs": ["IK-f § 5 nr. 1b","AML § 2-1","AML § 3-1","AML § 6-1","AML § 6-2","AML § 7-1","AML § 2-3"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-f §5 nr. 1b: Internkontrollen skal ha oversikt over organisasjon, ansvarsforhold, oppgaver og myndighet. Dette dokumentet fyller det kravet og er bevis for at HMS-ansvaret er formelt plassert."
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Organisasjon og ansvarsfordeling — HMS"
      },
      {
        "kind": "text",
        "body": "<p>AML §2-1 slår fast at arbeidsgivers plikter etter arbeidsmiljøloven ikke kan delegeres vekk. Daglig leder i {{orgName}} har det overordnede og udelte ansvaret for at HMS-arbeidet er systematisk, dokumentert og i samsvar med loven. Delegering av konkrete HMS-oppgaver til ledere og HMS-ansvarlig fritar ikke daglig leder fra dette overordnede styringsansvaret.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ansvarsmatrise"
      },
      {
        "kind": "table",
        "caption": "HMS-roller og ansvar",
        "headers": ["Rolle","Lovhjemmel","Ansvar og oppgaver"],
        "rows": [
          ["Daglig leder","AML §2-1, §3-1, IK-f §4","Overordnet ansvar for HMS-systemet. Stille ressurser til rådighet. Godkjenne HMS-policy og mål. Lede årsgjennomgang. Kan ikke delegere det overordnede ansvaret."],
          ["Avdelings-/enhetsleder","AML §3-1","HMS-ansvar i eget ansvarsområde. Kartlegge risiko, iverksette tiltak, følge opp avvik og sykefravær i avdelingen. Sikre at ansatte har nødvendig opplæring."],
          ["HMS-ansvarlig","IK-f §4, AML §3-1","Koordinere det systematiske HMS-arbeidet. Holde oversikt over lovkrav. Administrere internkontrollsystemet. Bistå linjeledere i risikovurdering og avviksbehandling."],
          ["Verneombud","AML §6-1, §6-2","Ivareta arbeidstakernes interesser i HMS-spørsmål. Medvirke i kartlegginger og risikovurderinger. Kan stanse farlig arbeid (AML §6-3). Har rett til opplæring og ressurser (AML §6-5)."],
          ["AMU (hvis etablert)","AML §7-1, §7-2","Behandle HMS-policy og mål. Gjennomgå avviksstatistikk og arbeidsmiljøundersøkelser. Medbestemmende og rådgivende rolle. Påkrevd ved ≥ 30 ansatte."],
          ["Alle ansatte","AML §2-3","Bruke påbudt verneutstyr. Melde avvik og farlige forhold. Delta i kartlegginger. Informere leder om helseproblemer knyttet til arbeidet."]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Organisasjonskart — verneorganisasjon"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Medvirkning"
      },
      {
        "kind": "text",
        "body": "<p>AML §3-1 (2a) og §4-2 stiller krav om at arbeidstakerne og deres representanter medvirker i HMS-arbeidet. I {{orgName}} ivaretas dette gjennom:</p><ul><li>Verneombudets medvirkning i risikovurderinger og kartlegginger</li><li>AMUs behandling av HMS-policy og mål (for virksomheter med ≥ 30 ansatte)</li><li>Arbeidsmiljøundersøkelser gjennomført via undersøkelsesmodulen</li><li>Åpne varslingskanaler der alle ansatte kan melde bekymringer</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Oppdatering"
      },
      {
        "kind": "text",
        "body": "<p>Ansvarsfordelingen gjennomgås ved organisasjonsendringer og som del av årsgjennomgangen (IK-f §5 nr. 5). Organisasjonskartet oppdateres fortløpende i systemet.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1b",
        "description": "Internkontrollen skal ha oversikt over organisasjon, ansvarsforhold, oppgaver og myndighet i HMS-arbeidet."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2-1",
        "description": "Arbeidsgivers plikter — kan ikke delegeres, men konkrete oppgaver kan overlates til andre."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — kartlegging, tiltak, og involvering av ansatte og VO."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-1",
        "description": "Rett og plikt til å velge verneombud i virksomheter med minst 5 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-2",
        "description": "Verneombudets oppgaver — ivareta arbeidstakernes interesser i HMS-spørsmål."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 7-1",
        "description": "Plikt til å opprette arbeidsmiljøutvalg (AMU) i virksomheter med minst 30 ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2-3",
        "description": "Arbeidstakers medvirkningsplikt og plikt til å melde fra om feil og mangler."
      }
    ]
  }$json$::jsonb
where id = 'tpl-org-ansvar';

-- ── 3. Årsgjennomgang-protokoll — upgrade ────────────────────────────────────

update public.document_system_templates
set
  description  = 'Protokoll for den lovpålagte årsgjennomgangen av internkontrollen (IK-f §5 nr. 5). Strukturert agenda, beslutningsfelt og signaturer.',
  legal_basis  = array[
    'IK-f § 5 nr. 5', 'AML § 3-1', 'IK-f § 5 nr. 1a',
    'IK-f § 5 nr. 3', 'IK-f § 5 nr. 4'
  ],
  page_payload = $json${
    "title": "Årsgjennomgang av internkontrollen {{currentYear}}",
    "summary": "Protokoll for den lovpålagte årsgjennomgangen av HMS-systemet — IK-f §5 nr. 5.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["IK-f § 5 nr. 5","AML § 3-1","IK-f § 5 nr. 1a","IK-f § 5 nr. 3","IK-f § 5 nr. 4"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-f §5 nr. 5 krever at internkontrollen gjennomgås systematisk minst én gang per år, og at resultatet dokumenteres skriftlig. Dette dokumentet er protokollen fra den gjennomgangen."
      },
      {
        "kind": "table",
        "caption": "Møteinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Virksomhet","{{orgName}}"],
          ["Dato for gjennomgang","{{policyDate}}"],
          ["Møteleder (daglig leder)","{{approverName}}"],
          ["Deltakere","[Fyll inn navn — verneombud skal delta]"],
          ["AMU orientert","[Dato eller N/A]"],
          ["Neste gjennomgang","{{nextRevisionDate}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Årsgjennomgang — internkontroll {{currentYear}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "1. HMS-mål — måloppnåelse"
      },
      {
        "kind": "text",
        "body": "<p>Gjennomgang av HMS-mål fastsatt for {{currentYear}} (IK-f §5 nr. 1a):</p><table><thead><tr><th>Mål</th><th>Måleverdi</th><th>Resultat</th><th>Status</th></tr></thead><tbody><tr><td>Arbeidsulykker</td><td>Null alvorlige personskader</td><td>[Fyll inn]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Sykefravær</td><td>[Fastsatt mål %]</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>HMS-opplæring</td><td>100 % gjennomført</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Avviksbehandling</td><td>≥ 90 % lukket i tide</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr><tr><td>Risikovurderinger</td><td>100 % gjennomgått</td><td>[Faktisk %]</td><td>[✅ / ⚠️ / ❌]</td></tr></tbody></table>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "2. Avvik og uønskede hendelser (IK-f §5 nr. 4)"
      },
      {
        "kind": "text",
        "body": "<table><thead><tr><th>Type</th><th>Antall meldt</th><th>Antall lukket</th><th>Meldepliktige (§5-2)</th></tr></thead><tbody><tr><td>Avvik</td><td>[Antall]</td><td>[Antall]</td><td>[Antall]</td></tr><tr><td>Nestenulykker</td><td>[Antall]</td><td>[Antall]</td><td>—</td></tr><tr><td>Personskader</td><td>[Antall]</td><td>[Antall]</td><td>[Antall]</td></tr></tbody></table><p>Kommentar til avviksutviklingen: [Fyll inn observasjoner og vurdering av trender.]</p>"
      },
      {
        "kind": "module",
        "moduleName": "live_risk_feed",
        "params": {"maxItems": 5, "showDepartment": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "3. Risikovurderinger (IK-f §5 nr. 3)"
      },
      {
        "kind": "text",
        "body": "<p>Oversikt over risikovurderinger gjennomgått siste 12 måneder:</p><ul><li>Antall aktive risikovurderinger: [Antall]</li><li>Antall gjennomgått dette året: [Antall]</li><li>Antall med restrisiko «Høy»: [Antall] — tiltak: [beskriv]</li><li>Nye farekilder identifisert: [beskriv]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "4. HMS-opplæring (IK-f §5 nr. 1c)"
      },
      {
        "kind": "text",
        "body": "<ul><li>Andel ansatte med gjennomført obligatorisk HMS-opplæring: [%]</li><li>Ledere med godkjent HMS-lederopplæring: [antall / totalt med personalansvar]</li><li>Verneombud — opplæring à jour: [Ja/Nei]</li><li>AMU-opplæring gjennomført: [Ja/Nei/N/A]</li><li>Planlagte opplæringstiltak neste periode: [beskriv]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "5. Psykososialt arbeidsmiljø (AML §4-3)"
      },
      {
        "kind": "text",
        "body": "<p>Arbeidsmiljøundersøkelse gjennomført: [Ja/Nei — dato]. Svarprosent: [%]. Vesentlige funn: [beskriv]. Iverksatte tiltak: [beskriv].</p><p>Varslingssaker behandlet dette året: [Antall — uten å angi personidentifiserende detaljer].</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "6. Sykefraværsoppfølging (AML §4-6)"
      },
      {
        "kind": "text",
        "body": "<p>Sykefravær dette året: [%]. Tilretteleggingssaker: [antall]. Dialogmøter gjennomført innen frist: [andel]. Kommentar til sykefraværsutvikling og tiltak: [beskriv].</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "7. Verneorganisasjon"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "8. Konklusjoner og handlingsplan"
      },
      {
        "kind": "text",
        "body": "<p>Følgende forbedringsområder og tiltak er besluttet for {{nextRevisionDate | neste periode}}:</p><table><thead><tr><th>Tiltak</th><th>Ansvarlig</th><th>Frist</th><th>Prioritet</th></tr></thead><tbody><tr><td>[Beskriv tiltak 1]</td><td>[Navn/rolle]</td><td>[Dato]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>[Beskriv tiltak 2]</td><td>[Navn/rolle]</td><td>[Dato]</td><td>[Høy/Medium/Lav]</td></tr></tbody></table><p>HMS-mål for neste periode oppdateres i HMS-policy og mål etter denne gjennomgangen.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "9. Konklusjon og godkjenning"
      },
      {
        "kind": "text",
        "body": "<p>Årsgjennomgangen er gjennomført i samsvar med IK-forskriften §5 nr. 5. Internkontrollen vurderes som [tilfredsstillende / tilfredsstillende med forbehold / ikke tilfredsstillende — begrunn].</p><p><br/>Signatur daglig leder: ___________________________ Dato: ___________<br/><br/>Signatur verneombud: ___________________________ Dato: ___________</p>"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 5",
        "description": "Internkontrollen skal gjennomgås systematisk — minst én gang per år. Resultatet skal dokumenteres skriftlig."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — kontinuerlig kartlegging, tiltak og dokumentasjon."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1a",
        "description": "HMS-mål skal oppdateres og gjennomgås i forbindelse med årsgjennomgangen."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 3",
        "description": "Risikovurderinger skal gjennomgås jevnlig — status dokumenteres her."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 4",
        "description": "Avviksstatus og trendanalyse er en obligatorisk del av årsgjennomgangen."
      }
    ]
  }$json$::jsonb
where id = 'tpl-aarsgjennomgang';

-- ── 4. Enable for all existing orgs ──────────────────────────────────────────
-- tpl-org-ansvar and tpl-aarsgjennomgang were seeded in the archive migration
-- but document_org_template_settings rows were never backfilled. tpl-varsling
-- is new. All three need enabling for every existing tenant.

do $$
declare
  v_org_id uuid;
  v_ids    text[] := array['tpl-varsling', 'tpl-org-ansvar', 'tpl-aarsgjennomgang'];
  v_id     text;
begin
  for v_org_id in select id from public.organizations loop
    foreach v_id in array v_ids loop
      insert into public.document_org_template_settings (organization_id, template_id, enabled)
      values (v_org_id, v_id, true)
      on conflict (organization_id, template_id) do nothing;
    end loop;
  end loop;
end;
$$;

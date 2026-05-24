-- Harassment procedure document template (AML § 4-3 (3), § 13-1, LDL § 26).
--
-- AML § 4-3 (3): Employer shall have a procedure for handling cases of
-- harassment and unwanted behaviour. This is a common Arbeidstilsynet finding
-- when absent. The procedure must cover: what constitutes harassment, reporting
-- channels, investigation process, confidentiality, and protection from retaliation.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed:
--     Manglende skriftlig rutine for håndtering av trakassering (AML § 4-3 (3)).
--     Plikten gjelder alle virksomheter; rutinen er særlig kritisk fordi:
--       1. LDL § 26 ARP krever at rutinen eksisterer og er kommunisert.
--       2. Dokumentasjon på at saker er håndtert korrekt er revisjonsbevis
--          mot LDO og NAV (IA-avtalen § 4 om forebyggende arbeidsmiljøarbeid).
--
--   Restrisiko:
--     Selve saksbehandlings-loggen (varsling-handtering-logg) er allerede
--     seeded som compliance-sjekkliste i batch5. Dette dokumentet er rutine-
--     malen som forklarer prosessen — ikke loggen per sak.

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis,
  sort_order, page_payload
) values (
  '00000000-d000-4000-a000-000000000108',
  'tpl-trakasseringsrutine',
  'Rutine for håndtering av trakassering',
  'Skriftlig rutine for forebygging og håndtering av trakassering, mobbing og utilbørlig atferd — pliktig etter AML § 4-3 (3). Dekker varsling, undersøkelse, konfidensialitet og vern mot gjengjeldelse.',
  'varsling',
  array[
    'AML § 4-3',
    'AML § 2A-3',
    'AML § 2A-4',
    'AML § 13-1',
    'Likestillings- og diskrimineringsloven § 13',
    'Likestillings- og diskrimineringsloven § 26'
  ],
  108,
  '{
    "title": "Rutine for håndtering av trakassering og utilbørlig atferd",
    "summary": "Virksomhetens skriftlige rutine for å forebygge og håndtere trakassering, mobbing og utilbørlig atferd etter AML § 4-3. Pliktig for alle virksomheter.",
    "status": "draft",
    "template": "procedure",
    "legalRefs": [
      "AML § 4-3",
      "AML § 2A-3",
      "AML § 2A-4",
      "AML § 13-1",
      "Likestillings- og diskrimineringsloven § 13",
      "Likestillings- og diskrimineringsloven § 26"
    ],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "Denne rutinen er pliktig etter AML § 4-3 (3) og skal gjøres kjent for alle ansatte. Arbeidstilsynet finner mangel på skriftlig rutine i svært mange tilsyn. Fyll ut virksomhetens kontaktpersoner og godkjenn dokumentet."
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "1. Formål og virkeområde"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} har nulltoleranse for trakassering, mobbing og utilbørlig atferd på arbeidsplassen. Denne rutinen gjelder for alle ansatte, innleide og andre som opptrer på vegne av virksomheten.</p><p>Rutinen dekker:</p><ul><li>Trakassering basert på kjønn, etnisitet, religion, funksjonsnedsettelse, alder, seksuell orientering eller andre diskrimineringsgrunnlag (LDL § 13)</li><li>Seksuell trakassering (AML § 4-3 (3))</li><li>Mobbing og utilbørlig atferd (AML § 4-3 (1))</li><li>Vold og trusler i arbeidssammenheng (AML § 4-3 (4))</li></ul>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "2. Hvem kan varsle og til hvem"
      },
      {
        "kind": "text",
        "body": "<p>Alle ansatte kan varsle om trakassering eller utilbørlig atferd til:</p><ul><li><strong>Nærmeste leder</strong> — hvis lederen ikke selv er involvert</li><li><strong>HR / personalleder</strong></li><li><strong>Verneombud</strong> — har rett og plikt til å ivareta arbeidstakernes interesser (AML § 6-2)</li><li><strong>Daglig leder / administrerende direktør</strong> — ved alvorlige tilfeller eller hvis leder er involvert</li></ul><p>Kontaktpersoner:<br/><strong>Verneombud:</strong> [Navn og telefon]<br/><strong>HR-kontakt:</strong> [Navn og e-post]<br/><strong>Ekstern kanal (Arbeidstilsynet):</strong> arbeidstilsynet.no / 73 19 97 00</p>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "3. Saksbehandlingsrutine"
      },
      {
        "kind": "text",
        "body": "<p><strong>Steg 1 — Mottak (innen 2 virkedager):</strong><br/>Den som mottar varselet bekrefter skriftlig mottak overfor varsler. Navn på saksbehandler oppgis. Varsler informeres om konfidensialitetsvern og prosessen videre.</p><p><strong>Steg 2 — Foreløpig vurdering (innen 5 virkedager):</strong><br/>Saksbehandler vurderer alvorlighetsgrad og om midlertidige tiltak er nødvendige (f.eks. fysisk adskillelse, endring av arbeidsoppgaver). Beslutning dokumenteres.</p><p><strong>Steg 3 — Undersøkelse:</strong><br/>Begge parter tilbys samtale. Vitner kan intervjues etter behov. All dokumentasjon lagres konfidensielt. Undersøkelsen skal gjennomføres innen rimelig tid — normalt 4–6 uker.</p><p><strong>Steg 4 — Konklusjon og tiltak:</strong><br/>Saksbehandler og leder konkluderer skriftlig. Tiltak besluttes (advarsel, omplassering, oppsigelse, annen personalreaksjon). Begge parter informeres om konklusjonen.</p><p><strong>Steg 5 — Oppfølging:</strong><br/>Status gjennomgås etter 4 og 12 uker. Anonymisert statistikk rapporteres til AMU/VO ved årsgjennomgangen (AML § 7-2).</p>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "4. Konfidensialitet og dokumentasjon"
      },
      {
        "kind": "text",
        "body": "<p>All informasjon om trakasseringssaker behandles konfidensielt. Kun de som er direkte involvert i saksbehandlingen har tilgang til dokumentasjonen.</p><p>Dokumentasjon oppbevares i henhold til arkivloven og GDPR (behandlingsgrunnlag: rettslig forpliktelse etter AML § 4-3). Sletting vurderes etter at saken er avsluttet og klagefrist er utløpt — normalt 3 år.</p>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "5. Vern mot gjengjeldelse"
      },
      {
        "kind": "text",
        "body": "<p>Det er forbudt å gjengjelde mot en arbeidstaker som varsler om trakassering eller medvirker i undersøkelsen (AML § 2A-4). Gjengjeldelse kan innebære:</p><ul><li>Degradering, endring av arbeidsoppgaver eller arbeidstid</li><li>Manglende lønnstillegg, oppsigelse eller avskjed</li><li>Trakassering eller utfrysing</li></ul><p>Brudd på forbudet mot gjengjeldelse er et eget arbeidsrettslig brudd og kan medføre erstatnings- og oppreisningsansvar for arbeidsgiver.</p>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "6. Forebygging"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} forebygger trakassering gjennom:</p><ul><li>Regelmessige vernerunder med psykososialt fokus (AML § 4-3, IK-f § 5 nr. 6)</li><li>Halvårlige psykososiale pulsmålinger (anonymt, verneombud deltar)</li><li>Opplæring av ledere i konflikthåndtering og varslingsplikter</li><li>Tydelig kommunikasjon av nulltoleranse-politikken ved tilsetting og i HMS-håndboken</li></ul>"
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "7. Ansvar og revisjon"
      },
      {
        "kind": "text",
        "body": "<p><strong>Ansvarlig:</strong> Daglig leder har det overordnede ansvaret. HR / personalleder er ansvarlig for saksbehandling og vedlikehold av rutinen.</p><p>Rutinen gjennomgås og oppdateres minimum én gang per år (IK-f § 5 nr. 8) og etter hver alvorlig sak. Verneombudet involveres i revisjon (AML § 6-2).</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-3",
        "description": "Psykososialt arbeidsmiljø — krav om rutine mot trakassering og utilbørlig atferd."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-3",
        "description": "Vern mot gjengjeldelse ved varsling — gjelder også trakasseringsvarsler."
      },
      {
        "kind": "law_ref",
        "ref": "Likestillings- og diskrimineringsloven § 13",
        "description": "Forbud mot trakassering på grunn av diskrimineringsgrunnlag."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer",
        "params": {
          "text": "Jeg bekrefter at jeg har lest og forstått virksomhetens rutine for håndtering av trakassering og utilbørlig atferd.",
          "requiresSignature": true
        }
      }
    ]
  }'::jsonb
) on conflict (slug) do update set
  label        = excluded.label,
  description  = excluded.description,
  legal_basis  = excluded.legal_basis,
  sort_order   = excluded.sort_order,
  page_payload = excluded.page_payload;

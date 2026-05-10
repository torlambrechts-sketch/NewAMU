-- Update HMS-policy og mål template to close 12 compliance audit gaps.
--
-- Gaps closed:
--   1. No date / version / formal approval   → policy metadata table ({{tokens}})
--   2. No trakassering / §4-3 statement      → dedicated nulltoleranse section
--   3. No varsling / §2A                      → dedicated varsling section
--   4. HMS-mål not SMART                      → SMART table with baseline, target, frequency, data source
--   5. No annual review obligation            → årsgjennomgang section
--   6. No scope / applicability               → virkeområde row in metadata table
--   7. No AMU reference                       → {{inject:amu_section}} + showAMU on org chart
--   8. No BHT reference                       → {{inject:bht_section}} + §3-3 law_ref
--   9. No environmental dimension             → ytre miljø section
--  10. No sector-specific content             → {{inject:sector_risks}} placeholder
--  11. Incomplete law refs                    → 10 law_ref blocks covering full chain
--  12. Unresolved [Virksomhetens navn]        → {{orgName}} tokens resolved by DocumentCreationWizard
--
-- Self-audit (Arbeidstilsynet POV):
--   Addresses pålegg-grunner for: IK-f §5 nr. 1a, AML §§ 3-1, 3-2, 3-3, 4-1,
--   4-3, 2A-1, 6-1.
--   Restrisiko: template describes required policy content; orgs must populate
--   real values (approver name, AMU date, sector risks) via the wizard for the
--   document to constitute audit evidence.

update public.document_system_templates
set
  description  = 'Virksomhetens overordnede HMS-erklæring med formell godkjenning, SMART-mål, nulltoleranse for trakassering, varsling og AMU/BHT-referanser — klar for tilsyn.',
  legal_basis  = array[
    'IK-f § 5 nr. 1a', 'AML § 3-1', 'AML § 3-2', 'AML § 3-3',
    'AML § 4-1', 'AML § 4-3', 'AML § 2A-1', 'AML § 6-1',
    'IK-f § 4', 'IK-f § 5 nr. 5'
  ],
  page_payload = '{
    "title": "HMS-policy og mål",
    "summary": "Virksomhetens overordnede HMS-erklæring med formell godkjenning, SMART-mål og lovhenvisninger — tilpasset via veiviseren.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["IK-f § 5 nr. 1a","AML § 3-1","AML § 3-2","AML § 3-3","AML § 4-1","AML § 4-3","AML § 2A-1","AML § 6-1","IK-f § 4","IK-f § 5 nr. 5"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "warning",
        "text": "Tilpass dette dokumentet til din virksomhet: bruk knappen «Bruk dokumentmal» slik at veiviseren fyller inn virksomhetsnavn, bransje, mål og godkjenner automatisk. Fjern denne boksen etter tilpasning."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt", "Verdi"],
        "rows": [
          ["Vedtatt av", "{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt", "{{policyDate}}"],
          ["Neste revisjon", "{{nextRevisionDate}}"],
          ["Versjon", "1.0"],
          ["Virkeområde", "Alle ansatte, innleide arbeidstakere (AML §2-2) og besøkende ved {{orgName}} sine lokaler"],
          ["AMU behandlet", "{{amuDate}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "HMS-policy — {{orgName}}"
      },
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-forskriften §5 nr. 1a krever at HMS-mål er fastsatt og skriftlig dokumentert. Dette dokumentet utgjør virksomhetens overordnede styringsdokument for helse, miljø og sikkerhet."
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} (org.nr. {{orgNr}}) er forpliktet til å skape og opprettholde et trygt, sunt og inkluderende arbeidsmiljø for alle ansatte, innleide arbeidstakere og øvrige personer i virksomhetens lokaler. Ledelsen tar et personlig og udelt ansvar for at HMS-arbeidet er systematisk, forebyggende og fullt ut i samsvar med arbeidsmiljøloven og internkontrollforskriften.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Nulltoleranse"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} har nulltoleranse for trakassering, mobbing, utilbørlig atferd og uønsket seksuell oppmerksomhet på arbeidsplassen. Alle slike tilfeller skal varsles umiddelbart og behandles i henhold til AML §4-3 og virksomhetens varslingsrutiner. Ansatte er trygge på at varsling ikke medfører gjengjeldelse (AML §2A-4).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Kjente risikofaktorer"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:sector_risks}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Våre HMS-mål"
      },
      {
        "kind": "text",
        "body": "<p>HMS-målene nedenfor gjelder for {{currentYear}} og gjennomgås ved årsgjennomgangen (IK-f §5 nr. 5). Baseline-verdier hentes fra foregående periodes målinger.</p>"
      },
      {
        "kind": "table",
        "caption": "SMART HMS-mål",
        "headers": ["Mål", "Måleverdi", "Målefrekvens", "Ansvarlig", "Datakilde"],
        "rows": [
          ["Arbeidsulykker", "Null alvorlige personskader", "Løpende", "HMS-ansvarlig / DL", "Avviksmodul"],
          ["Sykefravær", "< {{sykefraværMål}} %", "Kvartalsvis", "HR / Daglig leder", "NAV / A-ordningen"],
          ["HMS-opplæring", "100 % gjennomført innen årsfristen", "Årlig", "HMS-ansvarlig", "Læringsmodul"],
          ["Avviksbehandling", "≥ 90 % lukket innen {{avvikFrist}} dager", "Kvartalsvis", "Avdelingsledere", "Oppgavemodul"],
          ["Risikovurderinger", "100 % gjennomgått siste 12 måneder", "Årlig", "HMS-ansvarlig", "Oppgavemodul"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ansvar og organisering"
      },
      {
        "kind": "text",
        "body": "<p>Daglig leder har det overordnede ansvaret for HMS-arbeidet etter AML §3-1 og IK-f §4. Ansvaret delegeres til ledere på alle nivåer innenfor deres ansvarsområde — dette fritar ikke daglig leder fra overordnet styringsansvar. Verneombudet (AML §6-1) bistår i kartlegging og risikovurdering og har selvstendig rett til å stanse farlig arbeid etter AML §6-3.</p>"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:amu_section}}"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:bht_section}}"
      },
      {
        "kind": "alert",
        "variant": "warning",
        "text": "{{inject:collective_section}}"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showVerneombud": true, "showAMU": true, "showBHT": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ytre miljø"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} skal begrense sin negative påvirkning på det ytre miljøet. Virksomheten overholder kravene i forurensningsloven og tilhørende forskrifter. Energibruk, avfallshåndtering og transport vurderes løpende som del av det systematiske HMS-arbeidet og rapporteres ved årsgjennomgangen.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Varsling om kritikkverdige forhold"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte har rett og oppfordres til å varsle om kritikkverdige HMS-forhold etter AML §2A-1. Varsling kan skje til nærmeste leder, til HMS-ansvarlig, til verneombudet eller via Klarerts anonyme varslingskanal. Varsler behandles konfidensielt og innen rimelig tid. Gjengjeldelse mot den som varsler er forbudt etter AML §2A-4 og kan medføre erstatningsansvar.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Årsgjennomgang"
      },
      {
        "kind": "text",
        "body": "<p>HMS-policyen og virksomhetens øvrige internkontrolldokumenter gjennomgås minst én gang per år (IK-f §5 nr. 5). Gjennomgangen ledes av daglig leder med deltagelse av verneombud og AMU der dette er etablert. HMS-mål oppdateres med nye baseline-verdier og eventuelle korrigerende tiltak besluttes. Neste planlagte gjennomgang: {{nextRevisionDate}}.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Arbeidsgivers plikt til systematisk helse-, miljø- og sikkerhetsarbeid — kartlegging, tiltak og dokumentasjon."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-2",
        "description": "Plikt til å sikre at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i HMS-arbeidet, herunder om risiko i eget arbeid."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-3",
        "description": "Plikt til å knytte til seg bedriftshelsetjeneste i særskilt risikoeksponerte bransjer (BHT-forskriften)."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-1",
        "description": "Krav til fullt forsvarlig arbeidsmiljø — både fysisk og psykososialt, inkl. organisering, tilrettelegging og ledelse."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-3",
        "description": "Krav til psykososialt arbeidsmiljø — forbud mot trakassering og utilbørlig atferd, forsvarlig arbeidsbelastning."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2A-1",
        "description": "Ansattes rett til å varsle om kritikkverdige forhold — arbeidsgiver plikter å legge til rette for varsling."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-1",
        "description": "Rett og plikt til å velge verneombud — virksomheter med minst 5 ansatte (med unntak ved skriftlig avtale)."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 4",
        "description": "Plikt til å etablere, gjennomføre og videreutvikle systematisk internkontroll."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1a",
        "description": "HMS-mål skal fastsettes skriftlig og være en del av internkontrollen.",
        "url": "https://lovdata.no/forskrift/1996-12-06-1127/§5"
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 5",
        "description": "Internkontrollen skal gjennomgås jevnlig — minst én gang per år — for å sikre at den fungerer som forutsatt."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      },
      {
        "kind": "module",
        "moduleName": "emergency_stop_procedure",
        "params": {}
      }
    ]
  }'::jsonb
where id = 'tpl-hms-policy';

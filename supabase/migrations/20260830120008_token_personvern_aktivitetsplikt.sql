-- Extend and add compliance templates.
--
-- Changes:
--   tpl-org-ansvar          template 'standard' → 'policy' so the wizard resolves
--                           {{tokens}} that were left literal in every created doc.
--   tpl-beredskap           replace [Fyll inn] placeholders with {{assemblyPoint}},
--                           {{aedLocation}}, {{bhtPhone}} — wizard now collects them.
--   tpl-opplaering          replace static generic sector block with
--                           {{inject:sector_training_note}} so the plan is driven
--                           by the org's NACE risk profile, not example text.
--   tpl-personvern-ansatte  NEW: GDPR Art. 13/14 employee privacy notice —
--                           requiresAcknowledgement gives an immutable per-user
--                           receipt that satisfies Datatilsynet's documentation req.
--   tpl-aktivitetsplikt     NEW: Ldl §26/§26a activity + transparency plan for
--                           equality and non-discrimination.
--
-- Self-audit (Arbeidstilsynet / Datatilsynet POV):
--   tpl-org-ansvar: 'standard' skips the wizard so {{orgName}} etc. stay literal.
--     Every created doc showed "[Navn]" as approver — zero audit value.
--   tpl-beredskap: [Fyll inn] in a published beredskapsplan is a documentation
--     deficiency under Brann- og eksplosjonsvernloven §3-4 + AML §4-1.
--   tpl-opplaering: Generic examples are not sector evidence for IK-f §5 nr. 1c.
--     NACE-driven inject makes the plan specific to the employer's industry.
--   tpl-personvern-ansatte: GDPR Art. 13 requires notice at collection time.
--     acknowledgement_footer provides per-user signed receipt.
--   tpl-aktivitetsplikt: Ldl §26 applies to all employers; §26a requires public
--     reporting for 50+ employees. Both levels covered with threshold note.
--   Restrisiko: privacyOfficerEmail not yet a TemplateContext token — org must
--     fill in the placeholder manually after document creation.

-- ── 1. tpl-org-ansvar — flip template type so wizard runs ─────────────────────

update public.document_system_templates
set page_payload = jsonb_set(page_payload, '{template}', '"policy"')
where id = 'tpl-org-ansvar'
  and page_payload->>'template' = 'standard';

-- ── 2. tpl-beredskap — replace [Fyll inn] with {{tokens}} ─────────────────────

update public.document_system_templates
set page_payload = replace(replace(replace(
  page_payload::text,
  '[BHT-telefon — fyll inn]',
  '{{bhtPhone}}'
), '[Fyll inn adresse/sted — tydelig synlig fra alle utganger]',
   '{{assemblyPoint}}'
), 'plassering: [Fyll inn]',
   'plassering: {{aedLocation}}'
)::jsonb
where id = 'tpl-beredskap';

-- ── 3. tpl-opplaering — replace static sector block with inject ───────────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(
      case
        when b->>'kind' = 'text'
          and (b->>'body') like '%sektorspesifikk opplæring%'
          and (b->>'body') like '%Kjemisk eksponering%'
        then '{"kind":"alert","variant":"warning","text":"{{inject:sector_training_note}}"}'::jsonb
        else b
      end
      order by ordinality
    )
    from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
  )
)
where id = 'tpl-opplaering';

-- ── 4. tpl-personvern-ansatte — NEW (GDPR Art. 13/14 employee notice) ─────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-personvern-ansatte',
  'tpl-personvern-ansatte',
  'Personvernerklæring for ansatte',
  'GDPR Art. 13/14-erklæring om behandling av ansattes personopplysninger — med digital kvittering som gir revisjonsbevis.',
  'hms_handbook',
  array[
    'GDPR Art. 13', 'GDPR Art. 14', 'GDPR Art. 5', 'GDPR Art. 6',
    'GDPR Art. 9', 'Personopplysningsloven § 2', 'AML § 9-1'
  ],
  $json${
    "title": "Personvernerklæring for ansatte — {{orgName}}",
    "summary": "Informasjon om hvordan {{orgName}} behandler ansattes personopplysninger — GDPR Art. 13/14.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["GDPR Art. 13","GDPR Art. 14","GDPR Art. 5","GDPR Art. 6","GDPR Art. 9","Personopplysningsloven § 2","AML § 9-1"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "GDPR Art. 13 krever at du mottar denne informasjonen senest ved ansettelse. Vennligst les gjennom og bekreft med signaturen nederst."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Behandlingsansvarlig","{{orgName}} (org.nr. {{orgNr}})"],
          ["Adresse","{{address}}"],
          ["Vedtatt av","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Personvernombud","[Fyll inn e-post til personvernombud eller kontaktperson]"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Personvernerklæring — ansatte i {{orgName}}"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} er behandlingsansvarlig for de personopplysningene vi samler inn og behandler i forbindelse med arbeidsforholdet. Denne erklæringen forklarer hvilke opplysninger vi behandler, hvorfor, og hvilke rettigheter du har.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Kategorier av personopplysninger vi behandler"
      },
      {
        "kind": "table",
        "caption": "Behandlede personopplysningskategorier",
        "headers": ["Kategori","Eksempler","Behandlingsgrunnlag (GDPR Art. 6)","Rettslig hjemmel"],
        "rows": [
          ["Identitets- og kontaktopplysninger","Navn, adresse, e-post, telefon, fødselsnummer (ved nødvendig ID-kontroll)","Art. 6 (1)(b) — oppfyllelse av arbeidsavtalen","—"],
          ["Ansettelsesopplysninger","Stillingstittel, ansettelsesdato, arbeidssted, stillingsprosent, lønn, pensjon og forsikringsordninger","Art. 6 (1)(b) + (1)(c) — avtale og lovpålagt","Ferieloven, skatteloven, ftrl."],
          ["Fraværs- og helsedata","Egenmelding, sykemelding (dato/varighet — ikke diagnose), arbeidsavklaringer","Art. 9 (2)(b) — nødvendig for arbeids- og trygderettslige forpliktelser","AML § 4-6, ftrl. § 8-7"],
          ["Lønns- og skatteopplysninger","Lønn, trekk, skattekort, a-melding","Art. 6 (1)(c) — rettslig forpliktelse","Skattebetalingsloven, a-opplysningsloven"],
          ["Kurs og kompetanse","Gjennomførte opplæringsaktiviteter, sertifiseringer, HMS-kurs","Art. 6 (1)(b) + (1)(c) — arbeidsavtale og AML § 3-2","AML § 3-2, IK-f § 5"],
          ["Tilgangs- og sikkerhetslogger","IT-systemtilgang, tidsstempler (for IT-sikkerhet og driftslogging)","Art. 6 (1)(f) — berettiget interesse (IT-sikkerhet)","Personopplysningsloven § 2"],
          ["Bilder til ID-kort / profil","Portrettfoto (dersom brukt i profil eller adgangskontroll)","Art. 6 (1)(a) — samtykke","—"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Særlige kategorier (sensitive opplysninger)"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} behandler ikke sensitive kategorier (GDPR Art. 9) utover det som er strengt nødvendig — konkret: <strong>helseopplysninger</strong> (sykemelding og arbeidsavklaringer) behandles kun for å ivareta pliktene etter AML §4-6 og folketrygdloven, og kun av autorisert HR-personell. Opplysningene deles ikke med uvedkommende.</p><p>AML §9-1 forbyr innhenting av opplysninger om søkeres/ansattes politiske syn, religion, fagforeningsmedlemskap og seksuelle orientering med mindre dette er saklig begrunnet og nødvendig for stillingens karakter.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Lagring og sletting"
      },
      {
        "kind": "table",
        "caption": "Lagringsperioder",
        "headers": ["Kategori","Lagringsperiode","Hjemmel"],
        "rows": [
          ["Lønns- og regnskapsdata","5 år etter regnskapsårets slutt","Regnskapsloven § 13"],
          ["Skattemelding og a-melding","5 år","Ligningsloven / a-opplysningsloven"],
          ["Permisjons- og fraværsdokumentasjon","5 år etter arbeidsforholdets slutt","AML §17-1, ftrl."],
          ["HMS-opplæring og sertifiseringer","5 år etter siste gjennomføring","IK-f § 5"],
          ["Generell ansettelsesdokumentasjon","3 år etter arbeidsforholdets slutt","Foreldelsesloven"],
          ["IT-tilgangskontroll og sikkerhetslogger","90 dager (løpende)","Personopplysningsloven § 2"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Dine rettigheter"
      },
      {
        "kind": "text",
        "body": "<p>Som registrert har du følgende rettigheter etter GDPR kapittel III:</p><ul><li><strong>Innsyn (Art. 15)</strong> — du kan be om kopi av alle personopplysninger vi har om deg.</li><li><strong>Retting (Art. 16)</strong> — du kan kreve at uriktige opplysninger korrigeres.</li><li><strong>Sletting (Art. 17)</strong> — du kan be om sletting der vi ikke lenger har rettslig grunnlag for behandlingen.</li><li><strong>Begrensning (Art. 18)</strong> — du kan be om at behandlingen begrenses under visse forutsetninger.</li><li><strong>Dataportabilitet (Art. 20)</strong> — gjelder opplysninger du selv har gitt, behandlet på grunnlag av samtykke eller avtale.</li><li><strong>Innsigelse (Art. 21)</strong> — du kan protestere mot behandling basert på berettiget interesse.</li></ul><p>Henvendelser om personvernrettigheter rettes til: <strong>[Fyll inn e-post til personvernombud eller kontaktperson]</strong>. Vi svarer innen 30 dager (Art. 12).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Databehandlere og tredjeparter"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} deler personopplysninger med følgende kategorier av mottakere under databehandleravtale (DPA):</p><ul><li>Lønnssystem-leverandør (lønns- og skattedata)</li><li>HR-/personalsystem-leverandør (ansettelsesdata og kompetanseregistrering)</li><li>Bedriftshelsetjeneste / BHT (helserelaterte opplysninger ved behov og med ditt samtykke)</li><li>NAV (sykemelding, arbeidsavklaring og refusjonskrav)</li><li>Revisor (regnskaps- og lønnsdata under revisjon)</li></ul><p>Vi overfører ikke personopplysninger til land utenfor EU/EØS uten at tilfredsstillende overføringsgrunnlag foreligger (Art. 46).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Klageadgang"
      },
      {
        "kind": "text",
        "body": "<p>Dersom du mener {{orgName}} behandler dine personopplysninger i strid med GDPR, kan du klage til <strong>Datatilsynet</strong> (datatilsynet.no — tlf. 22 39 69 00). Vi oppfordrer deg til å ta opp spørsmålet med oss først slik at vi kan rette eventuelle feil.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "GDPR Art. 13",
        "description": "Informasjonsplikt når personopplysninger samles inn direkte fra den registrerte (ved ansettelse)."
      },
      {
        "kind": "law_ref",
        "ref": "GDPR Art. 14",
        "description": "Informasjonsplikt når personopplysninger ikke er innsamlet direkte fra den registrerte."
      },
      {
        "kind": "law_ref",
        "ref": "GDPR Art. 6",
        "description": "Behandlingsgrunnlag — lovlig behandling krever et av de seks grunnlagene (avtale, rettslig forpliktelse, samtykke m.fl.)."
      },
      {
        "kind": "law_ref",
        "ref": "GDPR Art. 9",
        "description": "Særlige kategorier av personopplysninger (sensitive) — behandling er som utgangspunkt forbudt med mindre et unntak i Art. 9 (2) gjelder."
      },
      {
        "kind": "law_ref",
        "ref": "Personopplysningsloven § 2",
        "description": "Utfyllende norske bestemmelser til GDPR — tilpasning til norsk forvaltning og arbeidsliv."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 9-1",
        "description": "Forbud mot innhenting av visse kategorier opplysninger om arbeidssøkere og ansatte uten saklig grunn."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      }
    ]
  }$json$::jsonb,
  25
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 5. tpl-aktivitetsplikt — NEW (Ldl §26 / §26a activity plan) ───────────────

insert into public.document_system_templates
  (id, slug, label, description, category, legal_basis, page_payload, sort_order)
values (
  'tpl-aktivitetsplikt',
  'tpl-aktivitetsplikt',
  'Aktivitets- og redegjørelsesplan',
  'Kartlegging og tiltak for likestilling og ikke-diskriminering — Ldl §26 (alle arbeidsgivere) og §26a (50+ ansatte).',
  'hms_handbook',
  array[
    'Ldl § 26', 'Ldl § 26a', 'Ldl § 6', 'Ldl § 13',
    'AML § 4-3', 'IK-f § 5 nr. 1a'
  ],
  $json${
    "title": "Aktivitets- og redegjørelsesplan — likestilling {{currentYear}}",
    "summary": "Kartlegging og tiltak for likestilling og ikke-diskriminering — Ldl §26 (alle) og §26a (50+ ansatte).",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["Ldl § 26","Ldl § 26a","Ldl § 6","Ldl § 13","AML § 4-3","IK-f § 5 nr. 1a"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "Likestillings- og diskrimineringsloven §26 pålegger alle arbeidsgivere en aktivitetsplikt: du skal arbeide aktivt, målrettet og planmessig for likestilling og mot diskriminering. Arbeidsgivere med 50 eller flere ansatte (eller 20+ med tariffavtale) har i tillegg redegjørelsesplikt etter §26a — resultater skal offentliggjøres i årsberetning eller på nettsted."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Virksomhet","{{orgName}} (org.nr. {{orgNr}})"],
          ["Vedtatt av","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Planperiode","{{currentYear}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Aktivitets- og redegjørelsesplan {{currentYear}} — {{orgName}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "1. Kartlegging — status likestilling og diskriminering"
      },
      {
        "kind": "text",
        "body": "<p>Kartleggingen er grunnlaget for aktivitetsplanen og skal dekke de diskrimineringsgrunnlagene i Ldl §6: kjønn, graviditet, permisjon, etnisitet, religion, livssyn, funksjonsnedsettelse, seksuell orientering, kjønnsidentitet, kjønnsuttrykk og alder.</p>"
      },
      {
        "kind": "table",
        "caption": "Kjønnsfordeling og lønn",
        "headers": ["Kategori","Kvinner","Menn","Ikke-binær/annet","Merknad"],
        "rows": [
          ["Totalt antall ansatte","[Antall]","[Antall]","[Antall]","—"],
          ["Lederstillinger","[Antall]","[Antall]","[Antall]","Inkl. mellomledere"],
          ["Deltidsstillinger","[Antall]","[Antall]","[Antall]","% av gruppen"],
          ["Midlertidige ansettelser","[Antall]","[Antall]","[Antall]","—"],
          ["Gjennomsnittlig grunnlønn","[Beløp kr]","[Beløp kr]","—","Samme stillingskategori"],
          ["Foreldrepermisjon tatt ut","[Antall uker tot.]","[Antall uker tot.]","—","Siste 12 mnd"]
        ]
      },
      {
        "kind": "text",
        "body": "<p><strong>Øvrige diskrimineringsgrunnlag — risikovurdering:</strong></p><ul><li>Etnisitet / nasjonal opprinnelse: [beskriv praksis for likebehandling ved rekruttering og i arbeidsforhold]</li><li>Funksjonsnedsettelse: [beskriv tilretteleggingspraksis og eventuelle barrierer identifisert]</li><li>Religion og livssyn: [beskriv praksis for fridager, kleskode og andre tilpasninger]</li><li>Alder: [beskriv rekrutteringspraksis og eventuelle aldersrelaterte utfordringer]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "2. Risikoområder og funn"
      },
      {
        "kind": "text",
        "body": "<p>Kartleggingen har identifisert følgende risikoområder som kan bidra til diskriminering eller hindre likestilling:</p><table><thead><tr><th>Område</th><th>Funn / risiko</th><th>Alvorlighet</th></tr></thead><tbody><tr><td>Rekruttering</td><td>[Beskriv — f.eks. kjønnsskjevhet i søkergruppe, ubevisst bias i intervju]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>Lønn og lønnsutvikling</td><td>[Beskriv — kjønnsbetinget lønnsforskjell, lønnsutvikling for deltidsansatte]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>Foreldrepermisjon og tilbakekomst</td><td>[Beskriv — tilrettelegging ved retur, karriereeffekter]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>Arbeidsmiljø og trakassering</td><td>[Beskriv — antall varsler/hendelser siste år]</td><td>[Høy/Medium/Lav]</td></tr><tr><td>Universell utforming og tilrettelegging</td><td>[Beskriv fysiske og digitale barrierer]</td><td>[Høy/Medium/Lav]</td></tr></tbody></table>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "3. Tiltak og handlingsplan"
      },
      {
        "kind": "table",
        "caption": "Aktivitetstiltak {{currentYear}}",
        "headers": ["Tiltak","Ansvarlig","Frist","Forventet effekt","Status"],
        "rows": [
          ["[Beskriv tiltak 1 — f.eks. strukturert intervju med standardiserte spørsmål]","[Rolle/navn]","[Dato]","[Redusere ubevisst bias ved rekruttering]","Planlagt"],
          ["[Beskriv tiltak 2 — f.eks. lønnsjustering for å lukke kjønnsbetinget gap]","[Rolle/navn]","[Dato]","[Likere lønn i samme stillingskategori]","Planlagt"],
          ["[Beskriv tiltak 3 — f.eks. opplæring i mangfolds- og inkluderingsarbeid for ledere]","[Rolle/navn]","[Dato]","[Økt bevissthet om diskrimineringsvern]","Planlagt"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "4. Mål for planperioden"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} har satt følgende målbare mål for {{currentYear}} (IK-f §5 nr. 1a — SMART-mål):</p><ul><li><strong>Kjønnsbalanse i ledelse</strong>: [Fastsett mål, f.eks. minst 40 % av hvert kjønn blant avdelingsledere innen {{nextRevisionDate}}]</li><li><strong>Likelønn</strong>: [Fastsett mål, f.eks. gjennomsnittlig lønnsforskjell &lt; 3 % mellom kjønn i samme stillingskategori]</li><li><strong>Trakasseringsvarsler</strong>: [Fastsett mål, f.eks. alle varsler behandlet innen 30 dager]</li><li><strong>Tilrettelegging</strong>: [Fastsett mål, f.eks. 100 % av tilretteleggingsforespørsler besvart innen 5 virkedager]</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "5. Redegjørelse (§26a — virksomheter med 50+ ansatte)"
      },
      {
        "kind": "alert",
        "variant": "info",
        "text": "Redegjørelsesplikten etter Ldl §26a gjelder virksomheter med 50 eller flere ansatte (eller 20+ med tariffavtale). Redegjørelsen skal inngå i årsberetningen eller offentliggjøres på virksomhetens nettsted. Virksomheter under terskelen anbefales å gjennomføre kartleggingen, men er ikke forpliktet til offentliggjøring."
      },
      {
        "kind": "text",
        "body": "<p>Sammendrag for offentlig redegjørelse (Ldl §26a) — bruk dette avsnittet i årsberetningen:</p><p><em>[{{orgName}} har i {{currentYear}} gjennomført kartlegging av status for likestilling og ikke-diskriminering i virksomheten. Kartleggingen dekker kjønnsfordeling, lønnsforhold, deltid, foreldrepermisjon og arbeidsmiljøforhold knyttet til øvrige diskrimineringsgrunnlag. På bakgrunn av kartleggingen er det iverksatt [antall] tiltak. Virksomheten vurderer risikoen for diskriminering som [lav/medium/høy] og vil gjennomgå tiltakene ved neste revisjon [{{nextRevisionDate}}].]</em></p><p>Juster og tilpass teksten over til faktiske funn og tiltak.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "6. Involvering og forankring"
      },
      {
        "kind": "text",
        "body": "<p>Aktivitetsplanen er utarbeidet med involvering av: verneombud, tillitsvalgte (der disse finnes), og HR-ansvarlig. AMU er orientert om planen den [dato eller N/A]. Planen gjennomgås og oppdateres som del av årsgjennomgangen av internkontrollen.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "Ldl § 26",
        "description": "Aktivitetsplikten — alle arbeidsgivere skal arbeide aktivt, målrettet og planmessig for å fremme likestilling og hindre diskriminering."
      },
      {
        "kind": "law_ref",
        "ref": "Ldl § 26a",
        "description": "Redegjørelsesplikten — arbeidsgivere med 50+ ansatte (eller 20+ med tariffavtale) skal redegjøre for likestillingstiltak i årsberetning eller på nettsted."
      },
      {
        "kind": "law_ref",
        "ref": "Ldl § 6",
        "description": "Diskrimineringsforbudet — forbud mot diskriminering på grunnlag av kjønn, graviditet, permisjon, etnisitet, religion, funksjonsnedsettelse, seksuell orientering, alder m.fl."
      },
      {
        "kind": "law_ref",
        "ref": "Ldl § 13",
        "description": "Rett til individuell tilrettelegging for ansatte med funksjonsnedsettelse — ikke uforholdsmessig byrde."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-3",
        "description": "Psykososialt arbeidsmiljø — forbud mot trakassering og utilbørlig atferd er nært knyttet til diskrimineringsvernet."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1a",
        "description": "HMS-mål skal fastsettes skriftlig — aktivitetsmål for likestilling inngår i det systematiske HMS-arbeidet."
      }
    ]
  }$json$::jsonb,
  26
)
on conflict (id) do update set
  label        = excluded.label,
  description  = excluded.description,
  category     = excluded.category,
  legal_basis  = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order   = excluded.sort_order;

-- ── 6. Enable new templates for all existing tenants ─────────────────────────

do $$
declare
  v_org_id uuid;
  v_ids    text[] := array['tpl-personvern-ansatte', 'tpl-aktivitetsplikt'];
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

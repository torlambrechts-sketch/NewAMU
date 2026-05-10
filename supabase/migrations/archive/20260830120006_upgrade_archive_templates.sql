-- Upgrade four archive-era templates to token-aware, audit-grade quality.
--
-- Templates upgraded:
--   tpl-beredskap   wide→policy, adds {{tokens}}, full emergency procedure,
--                   Arbeidstilsynet number, BHT contact, drill obligation
--   tpl-opplaering  standard→policy, adds {{tokens}}, role matrix, sector
--                   training note, onboarding requirement, AMU training
--   tpl-amu-rapport adds {{currentYear}}/{{orgName}} tokens, structured
--                   meeting log, risk feed, comeplete law refs
--   tpl-rusmiddel   replaces [Virksomhetens navn] with {{orgName}},
--                   adds AML §9-4 + §4-3 refs, improves oppfølging section
--
-- Self-audit (Arbeidstilsynet POV):
--   tpl-beredskap: Brann- og eksplosjonsvernloven §3-4 + AML §4-1 require
--     documented emergency procedures. [Fyll inn] placeholders are a
--     documentation deficiency — tokens + wizard close this.
--   tpl-opplaering: IK-f §5 nr. 1c requires documented training plans.
--     Generic tables without org/date info are not audit evidence.
--   tpl-amu-rapport: AML §7-4 requires AMU to submit an annual report.
--     Unresolved [ÅR] tokens are not acceptable in a submitted report.
--   tpl-rusmiddel: AML §9-4 authorises control measures (testing) as part
--     of a rusmiddelpolicy — omitting it leaves the legal basis incomplete.

-- ── 1. tpl-beredskap ─────────────────────────────────────────────────────────

update public.document_system_templates
set
  description = 'Beredskapsplan for brann, ulykke og krisesituasjoner med nødnumre, evakueringsprosedyre og øvelsesplan. Klar for tilsyn.',
  legal_basis = array[
    'AML § 4-1', 'AML § 3-1', 'IK-f § 5 nr. 3',
    'Brann- og eksplosjonsvernloven § 3-4', 'AML § 3-3'
  ],
  page_payload = $json${
    "title": "Beredskapsplan — {{orgName}}",
    "summary": "Prosedyrer, nødnumre og kontaktlister for brann, ulykker og krisehåndtering.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 4-1","AML § 3-1","IK-f § 5 nr. 3","Brann- og eksplosjonsvernloven § 3-4","AML § 3-3"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "danger",
        "text": "Beredskapsplanen skal være kjent av alle ansatte. Gjennomgå den ved onboarding, øv minst én gang per år, og oppdater ved organisasjonsendringer eller lokalebytte."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Vedtatt av","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Virksomhet","{{orgName}}"],
          ["Adresse / lokasjon","{{address}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Beredskapsplan — {{orgName}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Nødnumre og kontakter"
      },
      {
        "kind": "table",
        "caption": "Nødnumre",
        "headers": ["Situasjon","Nummer","Merknad"],
        "rows": [
          ["Brann","110","Ring umiddelbart — ikke vent"],
          ["Politi","112","Ved kriminalitet, trusler, ulykke"],
          ["Ambulanse","113","Ved alvorlig personskade"],
          ["Arbeidstilsynet (alvorlig skade)","73 19 97 00","Meldeplikt AML §5-2"],
          ["Giftinformasjonen","22 59 13 00","Kjemisk eksponering"],
          ["Bedriftshelsetjeneste","[BHT-telefon — fyll inn]",""],
          ["Intern krisekontakt (HMS-ansvarlig)","[Fyll inn — navn og mobil]",""],
          ["Intern krisekontakt (daglig leder)","[Fyll inn — navn og mobil]",""]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Evakuering og brann"
      },
      {
        "kind": "text",
        "body": "<p><strong>Samlingsplass:</strong> [Fyll inn adresse/sted — tydelig synlig fra alle utganger]</p><ol><li>Aktiver brannalarm umiddelbart ved branntegn — IKKE vent på bekreftelse.</li><li>Ring 110.</li><li>Evakuer alle personer via nærmeste rømningsvei. Heis skal IKKE benyttes.</li><li>Hjelp personer med nedsatt mobilitet til nødutgang — utpekt ansvarlig: [Fyll inn navn/rolle].</li><li>Møt på samlingsplassen. Den som oppdaget brannen melder til brannvesenet.</li><li>Brannvernleder foretar navnekontroll og rapporterer til 110.</li><li>Ingen går inn igjen i bygningen uten klarsignal fra brannvesen.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Personulykke og akutt sykdom"
      },
      {
        "kind": "text",
        "body": "<ol><li>Vurder om stedet er trygt — sikre om nødvendig.</li><li>Ring 113 ved bevisstløshet, pustevansker, alvorlig blødning eller mulig hjertestans.</li><li>Start livreddende førstehjelp (HLR) dersom opplært og personen er bevisstløs uten normal pust.</li><li>Bruk hjertestarter (AED) ved hjertestans — plassering: [Fyll inn].</li><li>Varsle nærmeste leder og HMS-ansvarlig.</li><li>Sikre ulykkesstedet — ikke flytt skadde unødvendig.</li><li>Meld alvorlig personskade til Arbeidstilsynet (AML §5-2): 73 19 97 00.</li><li>Registrer hendelsen i avvikssystemet innen 24 timer.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Kjemisk utslipp / farlige stoffer"
      },
      {
        "kind": "text",
        "body": "<ol><li>Evakuer umiddelbart berørt område.</li><li>Unngå innånding av røyk/damp — trekk opp mot vinden.</li><li>Ring 110 ved brann eller eksplosjon, 113 ved personskade, 112 ved behov for politiassistanse.</li><li>Ring Giftinformasjonen (22 59 13 00) for kjemisk eksponering.</li><li>Ha sikkerhetsdatablad (SDS) tilgjengelig for innsatspersonell.</li><li>Meld til Arbeidstilsynet dersom farlig kjemikalie er involvert.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Trusler, vold og ran"
      },
      {
        "kind": "text",
        "body": "<ol><li>Prioriter din egen sikkerhet — ikke motstand mot væpnet person.</li><li>Gi angriper det de ber om dersom liv er i fare.</li><li>Ring 112 så snart det er trygt.</li><li>Varsle leder umiddelbart.</li><li>Sikre potensielt bevismateriale — ikke rør mer enn nødvendig.</li><li>Tilby den berørte ansatte støttesamtale og oppfølging.</li><li>Registrer hendelsen som avvik.</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Øvelser og opplæring"
      },
      {
        "kind": "text",
        "body": "<p>Brann- og eksplosjonsvernloven §3-4 krever at beredskapsplanen øves. {{orgName}} gjennomfører:</p><ul><li><strong>Brannøvelse</strong> — minst én gang per år. Dato for neste øvelse: {{nextRevisionDate | eller planlegg separat}}.</li><li><strong>Førstehjelpskurs</strong> — minst én ansatt med gyldig sertifisering per arbeidsskift/etasje.</li><li><strong>Gjennomgang av planen</strong> — ved onboarding og ved alle organisasjons- eller lokaleendringer.</li></ul><p>Øvelser dokumenteres med dato, antall deltakere og læringspunkter i avvikssystemet.</p>"
      },
      {
        "kind": "module",
        "moduleName": "action_button",
        "params": {"label": "Registrer beredskapshendelse", "route": "/tasks/management?template=avvik", "variant": "danger"}
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-1",
        "description": "Krav til fullt forsvarlig arbeidsmiljø — herunder beredskap mot ulykker og akutte situasjoner."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 5-2",
        "description": "Umiddelbar meldeplikt til Arbeidstilsynet ved alvorlig personskade eller farlig forhold — tlf. 73 19 97 00."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 3",
        "description": "Beredskapsplan er en handlingsplan for å redusere risiko — lovpålagt del av internkontrollen."
      },
      {
        "kind": "law_ref",
        "ref": "Brann- og eksplosjonsvernloven § 3-4",
        "description": "Plikt til å ha nødvendig beredskap og gjennomføre øvelser for å håndtere brann og eksplosjon."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-3",
        "description": "BHT skal bistå med beredskapsplanlegging og oppfølging etter alvorlige hendelser i risikoeksponerte bransjer."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      }
    ]
  }$json$::jsonb
where id = 'tpl-beredskap';

-- ── 2. tpl-opplaering ────────────────────────────────────────────────────────

update public.document_system_templates
set
  description = 'HMS-opplæringsplan med rollespesifikke krav, verneombudsopplæring og sektorspesifikke tillegg. Klar for tilsyn.',
  legal_basis = array[
    'AML § 3-2', 'IK-f § 5 nr. 1c', 'AML § 3-5',
    'AML § 6-5', 'AML § 7-3', 'FOR-2011-12-06-1355 § 3-18'
  ],
  page_payload = $json${
    "title": "HMS-opplæringsplan — {{orgName}}",
    "summary": "Oversikt over påkrevd og planlagt HMS-opplæring per rolle — dokumentasjon etter IK-f §5 nr. 1c.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 3-2","IK-f § 5 nr. 1c","AML § 3-5","AML § 6-5","AML § 7-3","FOR-2011-12-06-1355 § 3-18"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "IK-f §5 nr. 1c krever at internkontrollen inneholder oversikt over kompetansekrav og opplæringsaktiviteter. Dette dokumentet er virksomhetens opplæringsplan — gjennomføring dokumenteres i læringsmodulen."
      },
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Virksomhet","{{orgName}}"],
          ["Vedtatt av","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Gjeldende år","{{currentYear}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "HMS-opplæringsplan {{currentYear}} — {{orgName}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Obligatorisk opplæring — alle ansatte"
      },
      {
        "kind": "table",
        "caption": "Alle ansatte",
        "headers": ["Opplæring","Frekvens","Hjemmel","Dokumenteres i"],
        "rows": [
          ["HMS-introduksjon (onboarding)","Ved ansettelse — før arbeid starter","AML § 3-2","Læringsmodul"],
          ["Brannvern og evakueringsprosedyre","Årlig øvelse + gjennomgang","Brann- og ekspl.vernloven § 3-4","Avvikssystem"],
          ["Avviksmelding og varslingskanaler","Hvert 2. år","IK-f § 5 nr. 4, AML § 2A-3","Læringsmodul"],
          ["HMS-policy og mål","Ved ansettelse + ved revisjon","IK-f § 5 nr. 1a","Kvitteringsmodul"],
          ["Ergonomi og arbeidsmiljø (skjerm/fysisk)","Hvert 2. år","AML § 4-1","Læringsmodul"],
          ["Risikovurdering — metode og bruk","Hvert 3. år","IK-f § 5 nr. 3","Læringsmodul"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Ledere med personalansvar"
      },
      {
        "kind": "table",
        "caption": "Lederopplæring",
        "headers": ["Opplæring","Omfang","Hjemmel","Dokumenteres i"],
        "rows": [
          ["HMS-lederopplæring (systematisk HMS-arbeid)","Minimum 40 timer — én gang","AML § 3-5, FOR-2011-12-06-1355 § 3-18","Læringsmodul / ekstern kursbevis"],
          ["Sykefraværsoppfølging (AML §4-6 milepæler)","Hvert 2. år","AML § 4-6","Læringsmodul"],
          ["Arbeidsmiljølovgivning — oppdatering","Hvert 3. år","AML § 3-2","Læringsmodul / kurs"],
          ["Konflikt- og trakasseringshåndtering","Hvert 3. år","AML § 4-3","Læringsmodul"]
        ]
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Verneombud"
      },
      {
        "kind": "text",
        "body": "<p>Verneombudet har lovfestet rett til opplæring i arbeidsmiljøarbeid tilsvarende <strong>minst 40 timer</strong>, jf. AML §6-5 og FOR-2011-12-06-1355 §3-18. Arbeidsgiveren dekker alle kostnader inkludert kursavgift, reise og tapt arbeidstid.</p><table><thead><tr><th>Opplæring</th><th>Omfang</th><th>Hjemmel</th></tr></thead><tbody><tr><td>Grunnopplæring verneombud</td><td>40 timer — ved valg</td><td>AML § 6-5</td></tr><tr><td>Oppdateringskurs</td><td>Etter behov — anbefalt hvert 4. år</td><td>AML § 6-5</td></tr></tbody></table>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "AMU-representanter"
      },
      {
        "kind": "text",
        "body": "<p>Representanter i AMU har rett til opplæring som er nødvendig for å utføre vervet, jf. AML §7-3. For virksomheter med ≥ 30 ansatte anbefales deltakelse på AMU-kurs (typisk 1–2 dager) ved tiltredelse i utvalget.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Sektorspesifikk opplæring"
      },
      {
        "kind": "text",
        "body": "<p>I tillegg til ovennevnte grunnopplæring krever virksomhetens bransje og arbeidsoppgaver sektorspesifikk opplæring. Eksempler:</p><ul><li>Kjemisk eksponering — opplæring i SDS-lesing og verneutstyr (AML § 4-5)</li><li>Maskinsikkerhet og verneutstyr (Maskinforskriften)</li><li>Manuell håndtering og forflytning (AML § 4-1)</li><li>Smittevern og biologiske faktorer (AML § 4-5)</li></ul><p>Sektorspesifikke krav kartlegges i risikovurderingen og legges til denne planen som vedlegg ved behov.</p>"
      },
      {
        "kind": "module",
        "moduleName": "action_button",
        "params": {"label": "Åpne læringsmodulen", "route": "/learning", "variant": "primary"}
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-2",
        "description": "Plikt til å sørge for at arbeidstakerne har tilstrekkelig kunnskap og ferdigheter i HMS-arbeidet."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-5",
        "description": "Særskilt plikt for øverste leder til å gjennomgå opplæring i systematisk HMS-arbeid."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 1c",
        "description": "Internkontrollen skal inneholde oversikt over kompetansekrav og gjennomførte opplæringstiltak."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 6-5",
        "description": "Verneombudet har rett og plikt til opplæring — minimum 40 timer, bekostet av arbeidsgiver."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 7-3",
        "description": "AMU-representanter har rett til nødvendig opplæring for å utføre vervet."
      },
      {
        "kind": "law_ref",
        "ref": "FOR-2011-12-06-1355 § 3-18",
        "description": "Forskrift om organisering, ledelse og medvirkning — krav til 40 timers HMS-opplæring for ledere og verneombud."
      }
    ]
  }$json$::jsonb
where id = 'tpl-opplaering';

-- ── 3. tpl-amu-rapport ───────────────────────────────────────────────────────

update public.document_system_templates
set
  description = 'AMUs årsrapport til ansatte og ledelse om arbeidsmiljøarbeidet — AML §7-4. Klar for tilsyn.',
  legal_basis = array['AML § 7-2', 'AML § 7-4', 'AML § 3-1', 'IK-f § 5 nr. 5'],
  page_payload = $json${
    "title": "AMU-årsrapport {{currentYear}} — {{orgName}}",
    "summary": "AMUs årsrapport til ansatte og ledelse om arbeidsmiljøarbeidet — AML §7-4.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 7-2","AML § 7-4","AML § 3-1","IK-f § 5 nr. 5"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 12,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "AML §7-4 pålegger AMU å avgi årsrapport til virksomheten. Rapporten skal gi alle ansatte innsyn i arbeidsmiljøarbeidet og presenteres for de ansattes representanter."
      },
      {
        "kind": "table",
        "caption": "Rapportinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Virksomhet","{{orgName}} (org.nr. {{orgNr}})"],
          ["Rapportperiode","{{currentYear}}"],
          ["Fremlagt dato","{{policyDate}}"],
          ["AMU-leder","{{approverName}}"],
          ["Neste rapport","{{nextRevisionDate}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "AMU-årsrapport {{currentYear}} — {{orgName}}"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "AMU-sammensetning og møter"
      },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": {"showAMU": true, "showVerneombud": true}
      },
      {
        "kind": "text",
        "body": "<p>AMU har i {{currentYear}} avholdt [antall] ordinære møter og [antall] ekstraordinære møter. Møtene er gjennomført i henhold til AML §7-2 og AMUs arbeidsplan.</p><table><thead><tr><th>Møtedato</th><th>Behandlede saker (sammendrag)</th></tr></thead><tbody><tr><td>[Dato]</td><td>[Sak 1, Sak 2 — beskriv kort]</td></tr><tr><td>[Dato]</td><td>[Sak 1, Sak 2 — beskriv kort]</td></tr></tbody></table>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Arbeidsmiljø — status og hendelser"
      },
      {
        "kind": "text",
        "body": "<p>Generell vurdering av arbeidsmiljøet i {{currentYear}}: [Beskriv overordnet status — fysisk og psykososialt.]</p><table><thead><tr><th>Tema</th><th>Status {{currentYear}}</th><th>Endring fra {{currentYear | forrige år}}</th></tr></thead><tbody><tr><td>Arbeidsulykker / personskader</td><td>[Antall]</td><td>[Bedre / Uendret / Verre]</td></tr><tr><td>Nestenulykker meldt</td><td>[Antall]</td><td>[Bedre / Uendret / Verre]</td></tr><tr><td>Avvik behandlet</td><td>[Antall meldt / lukket]</td><td>[Bedre / Uendret / Verre]</td></tr><tr><td>Arbeidsmiljøundersøkelse</td><td>[Gjennomført / Ikke gjennomført]</td><td>—</td></tr></tbody></table>"
      },
      {
        "kind": "module",
        "moduleName": "live_risk_feed",
        "params": {"maxItems": 5, "showDepartment": true}
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Sykefravær"
      },
      {
        "kind": "text",
        "body": "<p>Sykefravær {{currentYear}}: <strong>[%]</strong> (mål: [fastsatt mål %]). Langtidsfravær (> 16 dager): [antall saker].</p><p>AMUs vurdering av sykefraværsutviklingen og gjennomførte tiltak: [beskriv]. Oppfølging av sykemeldte er gjennomført etter AML §4-6 (4-ukersplan, dialogmøter).</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "HMS-opplæring og kompetanse"
      },
      {
        "kind": "text",
        "body": "<p>Andel ansatte med gjennomført obligatorisk HMS-opplæring: [%]. Verneombudsopplæring à jour: [Ja/Nei]. HMS-lederopplæring for ledere med personalansvar: [antall / totalt].</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "AMUs anbefalinger til ledelsen"
      },
      {
        "kind": "text",
        "body": "<p>På bakgrunn av arbeidsmiljøarbeidet i {{currentYear}} anbefaler AMU følgende prioriteringer for {{nextRevisionDate | neste periode}}:</p><ol><li>[Anbefaling 1 — beskriv konkret tiltak og begrunnelse]</li><li>[Anbefaling 2 — beskriv konkret tiltak og begrunnelse]</li></ol>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Konklusjon"
      },
      {
        "kind": "text",
        "body": "<p>AMU i {{orgName}} vurderer arbeidsmiljøet som [tilfredsstillende / tilfredsstillende med forbehold / ikke tilfredsstillende] per utgangen av {{currentYear}}. Rapporten er behandlet i AMU-møte den {{policyDate}} og oversendes ledelsen og de ansattes representanter.</p><p><br/>Signatur AMU-leder: ___________________________ Dato: ___________</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 7-2",
        "description": "AMUs oppgaver — behandle HMS-policy, risikovurderinger, arbeidsmiljøundersøkelser og avviksstatistikk."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 7-4",
        "description": "AMU skal avgi årsrapport om sin virksomhet til virksomhetens øverste organ og de ansattes organisasjoner."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — AMUs rapport er bevis for at plikten etterleves."
      },
      {
        "kind": "law_ref",
        "ref": "IK-f § 5 nr. 5",
        "description": "AMU-rapporten inngår som del av den årlige gjennomgangen av internkontrollen."
      }
    ]
  }$json$::jsonb
where id = 'tpl-amu-rapport';

-- ── 4. tpl-rusmiddel ─────────────────────────────────────────────────────────

update public.document_system_templates
set
  description = 'Rusmiddelpolicy med nulltoleranse, støtteordning og AML §9-4-hjemmel for kontrolltiltak. Klar for tilsyn.',
  legal_basis = array[
    'AML § 4-3', 'AML § 9-4', 'AML § 2-3', 'AML § 3-1'
  ],
  page_payload = $json${
    "title": "Rusmiddelpolicy — {{orgName}}",
    "summary": "Virksomhetens regler for alkohol og rusmidler på arbeidsplassen — AML §9-4.",
    "status": "draft",
    "template": "policy",
    "legalRefs": ["AML § 4-3","AML § 9-4","AML § 2-3","AML § 3-1"],
    "requiresAcknowledgement": true,
    "revisionIntervalMonths": 24,
    "blocks": [
      {
        "kind": "table",
        "caption": "Dokumentinformasjon",
        "headers": ["Felt","Verdi"],
        "rows": [
          ["Vedtatt av","{{approverName}} — {{approverTitle}}"],
          ["Dato vedtatt","{{policyDate}}"],
          ["Neste revisjon","{{nextRevisionDate}}"],
          ["Virkeområde","Alle ansatte og innleide i {{orgName}}"]
        ]
      },
      {
        "kind": "heading",
        "level": 1,
        "text": "Rusmiddelpolicy — {{orgName}}"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} skal ha et arbeidsmiljø fritt for rus. Bruk av alkohol og illegale rusmidler i arbeidstiden er uforenlig med kravene til fullt forsvarlig arbeidsmiljø (AML §4-1) og kan utgjøre en sikkerhetsrisiko for den ansatte selv, kolleger og tredjeparter.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Regler"
      },
      {
        "kind": "text",
        "body": "<ul><li>Det er forbudt å møte på jobb påvirket av alkohol eller andre rusmidler.</li><li>Inntak av alkohol eller rusmidler i arbeidstiden og på arbeidsstedet er forbudt.</li><li>Oppbevaring av alkohol eller illegale rusmidler på arbeidsstedet er forbudt.</li><li>Bruk av reseptbelagte legemidler som kan påvirke arbeidsevnen, skal varsles til nærmeste leder slik at risiko kan vurderes.</li><li>Unntak for representasjonsarrangementer og sosiale tilstelninger i regi av virksomheten kan avtales skriftlig med daglig leder — grensen for hva som er akseptabelt gjelder uansett.</li></ul>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Kontrolltiltak"
      },
      {
        "kind": "text",
        "body": "<p>{{orgName}} kan gjennomføre rusmiddeltesting i henhold til AML §9-4 dersom vilkårene er oppfylt: stillingens art innebærer sikkerhetsrisiko, testingen er saklig begrunnet og forholdsmessig, og ansatte er informert om ordningen. Testing kan gjennomføres ved:</p><ul><li>Konkret mistanke om påvirkning</li><li>Etter ulykker eller nestenulykker</li><li>Som del av tilbakekomst etter behandlingsopplegg (etter avtale)</li></ul><p>Eventuelle testordninger etableres etter drøfting med tillitsvalgte/verneombud og fremlegges for AMU.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Oppfølging og støtte"
      },
      {
        "kind": "text",
        "body": "<p>Ansatte med rusproblemer oppfordres til å søke hjelp. {{orgName}} tilbyr:</p><ul><li>Konfidensielle samtaler med nærmeste leder eller HMS-ansvarlig</li><li>Henvisning til bedriftshelsetjeneste (BHT) for råd og veiledning</li><li>Tilrettelegging og permisjon for behandling ved behov</li></ul><p>Arbeidsgiveren vil søke løsninger som ivaretar den ansattes arbeidsforhold, forutsatt at behandling gjennomføres. Gjentatte brudd etter at hjelp er tilbudt og avslått, behandles som et disiplinærforhold.</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Brudd på policyen"
      },
      {
        "kind": "text",
        "body": "<p>Brudd håndteres etter virksomhetens personalreglement og kan medføre advarsel, omplassering eller oppsigelse avhengig av alvorlighetsgrad og gjentakelse. Der rus har medvirket til en ulykke, skal dette registreres som avvik og årsaksanalyseres.</p>"
      },
      {
        "kind": "law_ref",
        "ref": "AML § 9-4",
        "description": "Hjemmel for rusmiddeltesting — krever saklig grunn, forholdsmessighet og forutgående informasjon til ansatte."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 4-3",
        "description": "Krav til psykososialt arbeidsmiljø — rus på arbeidsplassen er et psykososialt og sikkerhetsmessig forhold."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 2-3",
        "description": "Arbeidstakers medvirkningsplikt — plikt til å melde fra om forhold som kan medføre fare."
      },
      {
        "kind": "law_ref",
        "ref": "AML § 3-1",
        "description": "Systematisk HMS-arbeid — rusmiddelpolicyen er del av internkontrollen."
      },
      {
        "kind": "module",
        "moduleName": "acknowledgement_footer"
      }
    ]
  }$json$::jsonb
where id = 'tpl-rusmiddel';

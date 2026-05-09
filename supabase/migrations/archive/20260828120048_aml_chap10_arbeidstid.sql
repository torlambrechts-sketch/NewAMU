-- AML kapittel 10 — Arbeidstid.
--
-- Coverage gap closed:
--   §10-1 definisjoner, §10-4 alminnelig arbeidstid, §10-6 overtid,
--   §10-7 plikt til oversikt over utført arbeidstid, §10-8 daglig og
--   ukentlig arbeidsfri (hvileregler 11/35 timer), §10-9 pauser,
--   §10-10 søndag/helgedagsarbeid, §10-12 unntak (ledende / særlig
--   uavhengig stilling).
--
-- Arbeidstilsynet sjekker arbeidstid ved nesten hvert tilsyn. De tre
-- vanligste pålegg-grunnene er (1) ingen oversikt § 10-7, (2) brudd
-- på 11/35-timers hvile, (3) feil bruk av «særlig uavhengig stilling»
-- for å omgå arbeidstidsreglene.
--
-- Two artifacts:
--   1. Document tpl-arbeidstidsrutine — arbeidstidsordning,
--      registreringsplikt, hviletid og overtid.
--   2. Compliance checklist arbeidstid-arsgjennomgang — kvartalsvis
--      gjennomgang av faktisk overholdelse: hvile, overtid, oversikt,
--      særavtaler.
--
-- Self-audit (Arbeidstilsynet POV): Tilsynet kan be om å se § 10-7-
-- oversikten direkte fra IT-systemet. Sjekklisten leverer akkurat
-- denne dokumentasjonen + statistikkgjennomgangen tilsynet ville
-- bedt om. Restrisiko: spesifikke avtaler etter § 10-12 (3) krever
-- arbeidsgiver-/tillitsvalgt-protokoll som lagres separat — det er
-- en register-sak for senere PR.

set local search_path = public, pg_catalog;

-- ── 1. Document: arbeidstidsrutine ────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-arbeidstidsrutine',
  'tpl-arbeidstidsrutine',
  'Arbeidstidsrutine — hvile, overtid og registrering',
  'Skriftlig rutine for arbeidstid, hvile, overtid og oversikt etter AML kapittel 10.',
  'procedure',
  array['AML § 10-4', 'AML § 10-6', 'AML § 10-7', 'AML § 10-8', 'AML § 10-9', 'AML § 10-10', 'AML § 10-12']::text[],
  jsonb_build_object(
    'title', 'Arbeidstidsrutine',
    'summary', 'Hvordan vi planlegger, registrerer og kontrollerer arbeidstid for å sikre overholdelse av AML kapittel 10.',
    'status', 'draft',
    'template', 'standard',
    'legalRefs', jsonb_build_array('AML § 10-4', 'AML § 10-6', 'AML § 10-7', 'AML § 10-8'),
    'requiresAcknowledgement', true,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','info',
        'text','Arbeidsgiver er ansvarlig for å sørge for at bestemmelsene i kap. 10 overholdes — også for innleide og selvstendige som kan likestilles med ansatte.'),
      jsonb_build_object('kind','heading','level',1,'text','Arbeidstidsrutine'),
      jsonb_build_object('kind','heading','level',2,'text','1. Alminnelig arbeidstid (§ 10-4)'),
      jsonb_build_object('kind','text','body',
        '<p>Den alminnelige arbeidstiden hos [Virksomhet] er <strong>[X] timer pr. døgn</strong> og <strong>40 timer pr. uke</strong>. For arbeid som overveiende skjer om natten, eller for arbeid med belastende vaktordninger, gjelder reduserte rammer (§ 10-4 (4)–(6)).</p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Hviletid (§ 10-8)'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Krav</th><th>Norm</th><th>Avvik krever</th></tr></thead><tbody><tr><td>Daglig hvile</td><td>Minst 11 sammenhengende timer i løpet av 24 timer</td><td>Skriftlig avtale med tillitsvalgt (§ 10-8 (3))</td></tr><tr><td>Ukentlig hvile</td><td>Minst 35 sammenhengende timer pr. 7 dager</td><td>Tillitsvalgt-avtale eller dispensasjon</td></tr><tr><td>Pauser</td><td>Minst 30 min hvis arbeidsdagen er over 5,5 timer</td><td>—</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Overtid (§ 10-6)'),
      jsonb_build_object('kind','text','body',
        '<p>Overtidsarbeid er bare tillatt når det foreligger særlig og tidsavgrenset behov. Maksimalrammer:</p><ul><li><strong>10 timer</strong> i sju dager</li><li><strong>25 timer</strong> i fire sammenhengende uker</li><li><strong>200 timer</strong> i 52 uker (kan utvides ved tillitsvalgt-avtale)</li></ul><p>Overtid skal kompenseres med tillegg på minst 40 % av lønnen, eventuelt avspasering — det siste forutsetter avtale.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Registrering — § 10-7'),
      jsonb_build_object('kind','text','body',
        '<p>Vi fører oversikt over hvor mye den enkelte arbeider, slik bestemmelsen krever. Oversikten skal:</p><ul><li>være tilgjengelig for Arbeidstilsynet og tillitsvalgte</li><li>vise faktisk arbeidstid pr. døgn / uke</li><li>fanges opp ved [tidsregistreringssystem] — alle ansatte registrerer inn/ut</li></ul><p>Mistet eller manglende registrering rapporteres som avvik.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Søndags- og helgedagsarbeid (§ 10-10)'),
      jsonb_build_object('kind','text','body',
        '<p>Arbeid på søn- og helgedager er forbudt med mindre arbeidets art gjør det nødvendig. Annenhver søndag fri er hovedregel ved skiftordninger. Avtale med tillitsvalgt kan gi annen ordning.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Nattarbeid (§ 10-11)'),
      jsonb_build_object('kind','text','body',
        '<p>Med nattarbeid menes arbeid mellom kl. 21:00 og kl. 06:00. Nattarbeid er forbudt med mindre arbeidets art gjør det nødvendig. Tilbud om helsekontroll etter § 10-11 (7) gis før tiltredelse og deretter med jevne mellomrom.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Unntak — § 10-12'),
      jsonb_build_object('kind','text','body',
        '<p>Arbeidstidskapittelet gjelder ikke for arbeidstaker i <strong>ledende stilling</strong> eller <strong>særlig uavhengig stilling</strong>. Unntaket tolkes strengt:</p><ul><li>«Ledende stilling» = øverste leder + nærmeste underordnede med personalansvar og budsjettansvar.</li><li>«Særlig uavhengig stilling» = egne fritt prioriterte oppgaver, eget ansvar, ingen detaljstyring.</li><li>Tittel alene avgjør ikke. Reell stilling og handlingsrom avgjør.</li></ul><p>Liste over stillinger som er unntatt skal være drøftet med tillitsvalgte og kunne fremlegges Arbeidstilsynet. Liste vedlikeholdes av HR.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','8. Avvikshåndtering'),
      jsonb_build_object('kind','text','body',
        '<p>Brudd på arbeidstidsreglene meldes som avvik i [HMS-system]. Leder vurderer årsak (planleggingssvikt vs. nødssituasjon) og treffer tiltak. Gjentatte brudd følges opp i AMU.</p>'),
      jsonb_build_object('kind','module','moduleName','action_button','params',
        jsonb_build_object('label','Se min arbeidstidsoversikt','route','/working-time','variant','primary')),
      jsonb_build_object('kind','law_ref','ref','AML § 10-4','description','Alminnelig arbeidstid','url','https://lovdata.no/lov/2005-06-17-62/§10-4'),
      jsonb_build_object('kind','law_ref','ref','AML § 10-6','description','Overtid','url','https://lovdata.no/lov/2005-06-17-62/§10-6'),
      jsonb_build_object('kind','law_ref','ref','AML § 10-7','description','Oversikt over arbeidstiden','url','https://lovdata.no/lov/2005-06-17-62/§10-7'),
      jsonb_build_object('kind','law_ref','ref','AML § 10-8','description','Daglig og ukentlig arbeidsfri','url','https://lovdata.no/lov/2005-06-17-62/§10-8'),
      jsonb_build_object('kind','law_ref','ref','AML § 10-12','description','Unntak','url','https://lovdata.no/lov/2005-06-17-62/§10-12'),
      jsonb_build_object('kind','module','moduleName','acknowledgement_footer')
    )
  ),
  90
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Compliance checklist: arbeidstid-arsgjennomgang ────────────────────

do $$
declare
  v_org_id uuid;
begin
  for v_org_id in select id from public.organizations loop
    insert into public.compliance_checklist_templates (
      organization_id, pack, slug, name, description, definition,
      law_refs, is_active, nav_pinned, is_system, review_status, cadence_hint
    ) values (
      v_org_id,
      'aml-amu',
      'arbeidstid-kvartalsgjennomgang',
      'Arbeidstid — kvartalsvis gjennomgang',
      'Kvartalsvis kontroll av at arbeidstidsregistreringen er fullstendig, at hvile- og overtidsregler overholdes, og at unntakslister etter § 10-12 er korrekte. Leverer dokumentasjon ved tilsyn.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','oversikt_komplett','prompt','Er § 10-7-oversikten oppdatert og tilgjengelig for alle ansatte og innleide?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-7','severity_default','critical'),
        jsonb_build_object('key','manglende_reg','prompt','Hvor mange ansatte har manglende eller ufullstendig registrering siste 13 uker?',
                           'type','number','required',true,
                           'law_ref','AML § 10-7','severity_default','high'),
        jsonb_build_object('key','daglig_hvile','prompt','Er det avdekket brudd på 11-timers daglig hvile siste 13 uker?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-8 (1)','severity_default','critical',
                           'help','Brudd skal være meldt som avvik og ha skriftlig tillitsvalgt-avtale hvis tilbakevendende.'),
        jsonb_build_object('key','ukentlig_hvile','prompt','Er det avdekket brudd på 35-timers ukentlig hvile siste 13 uker?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-8 (2)','severity_default','critical'),
        jsonb_build_object('key','overtid_uke','prompt','Er noen ansatte over 10t overtid pr. uke uten dispensasjon eller avtale?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-6','severity_default','critical'),
        jsonb_build_object('key','overtid_aar','prompt','Er noen ansatte over 200t overtid på rullerende 52 uker uten utvidet avtale?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-6 (4)','severity_default','high'),
        jsonb_build_object('key','overtidskompensasjon','prompt','Er overtid kompensert med minst 40 % tillegg eller avtalt avspasering?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-6 (11)','severity_default','high'),
        jsonb_build_object('key','soenarb','prompt','Er søndags-/helgedagsarbeid begrunnet i arbeidets art eller forhåndsavtalt?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-10','severity_default','high'),
        jsonb_build_object('key','natt_helsekontroll','prompt','Har nattarbeidere fått tilbud om helsekontroll?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 10-11 (7)','severity_default','high'),
        jsonb_build_object('key','unntak_liste','prompt','Er liste over stillinger unntatt etter § 10-12 oppdatert og drøftet med tillitsvalgte?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 10-12','severity_default','high',
                           'help','Tilsynet ser særlig på misbruk av «særlig uavhengig stilling».'),
        jsonb_build_object('key','vaktordninger_avtale','prompt','Er gjennomsnittsberegninger / særavtaler etter § 10-5 gyldig protokollført?',
                           'type','yes_no_na','required',false,
                           'law_ref','AML § 10-5','severity_default','high'),
        jsonb_build_object('key','avvik_oppfolging','prompt','Er meldte arbeidstidsavvik fulgt opp og lukket innen 60 dager?',
                           'type','yes_no_na','required',true,
                           'law_ref','IK-f § 5 nr. 7','severity_default','medium'),
        jsonb_build_object('key','amu_orientert','prompt','Er statistikken lagt fram for AMU?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 7-2','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner','type','text','required',false),
        jsonb_build_object('key','sign_hr','prompt','HR-/personalansvarliges signatur','type','signature','required',true),
        jsonb_build_object('key','sign_vo','prompt','Verneombudets signatur','type','signature','required',true)
      )),
      array['AML § 10-4','AML § 10-6','AML § 10-7','AML § 10-8','AML § 10-10','AML § 10-11','AML § 10-12']::text[],
      true, false, true, 'draft', 'kvartalsvis'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;

-- AML kapittel 2A — Varsling.
--
-- Coverage gap closed:
--   §2A-7 plikt til å utarbeide varslingsrutiner (mandatory for orgs
--   with ≥5 employees) had no document template and no recurring
--   checklist. This migration ships:
--
--   1. Document: tpl-varslingsrutiner — full §2A-7 conformant rutiner
--      (conditions, forsvarlig framgangsmåte, mottak, behandling,
--       gjengjeldelsesvern, ekstern varsling).
--   2. Compliance checklist: varsling-arsgjennomgang — annual review
--      that confirms rutinene er kjent, mottakskanaler virker,
--      taushetsplikt er ivaretatt, og statistikk dokumenteres.
--
-- Self-audit (Arbeidstilsynet POV): § 2A-7 (5) krever at rutinene er
-- skriftlige, lett tilgjengelige for arbeidstakerne, og angir
-- framgangsmåten for varsling og for arbeidsgivers behandling.
-- Document below dekker alle fem minimumspunktene i §2A-7 (5). Den
-- årlige sjekklisten dokumenterer at rutinene er reelt operative —
-- en typisk pålegg-grunn er at rutinen finnes på papir men ikke er
-- implementert.

set local search_path = public, pg_catalog;

-- ── 1. Document: varslingsrutiner ─────────────────────────────────────────

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
) values (
  'tpl-varslingsrutiner',
  'tpl-varslingsrutiner',
  'Varslingsrutiner',
  'Skriftlige rutiner for varsling om kritikkverdige forhold etter AML kap. 2A. Lovpålagt for virksomheter med minst fem ansatte.',
  'procedure',
  array['AML § 2A-1', 'AML § 2A-2', 'AML § 2A-3', 'AML § 2A-7', 'AML § 2A-4', 'AML § 2A-5']::text[],
  jsonb_build_object(
    'title', 'Varslingsrutiner',
    'summary', 'Slik varsler du om kritikkverdige forhold i [Virksomhetens navn], og slik behandler vi varslene.',
    'status', 'draft',
    'template', 'policy',
    'legalRefs', jsonb_build_array('AML § 2A-1', 'AML § 2A-2', 'AML § 2A-3', 'AML § 2A-7', 'AML § 2A-4', 'AML § 2A-5'),
    'requiresAcknowledgement', true,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','alert','variant','info',
        'text','Disse rutinene er lovpålagt etter AML § 2A-7 og gjelder alle ansatte og innleide hos [Virksomhetens navn].'),
      jsonb_build_object('kind','heading','level',1,'text','Varslingsrutiner'),
      jsonb_build_object('kind','heading','level',2,'text','1. Hva kan og skal varsles?'),
      jsonb_build_object('kind','text','body',
        '<p>Du har rett til å varsle om <strong>kritikkverdige forhold</strong> i virksomheten, jf. AML § 2A-1. Med kritikkverdige forhold menes forhold som er i strid med:</p><ul><li>rettsregler</li><li>skriftlige etiske retningslinjer i virksomheten</li><li>etiske normer det er bred tilslutning til i samfunnet</li></ul><p>Eksempler (ikke uttømmende, jf. § 2A-1 (2)): fare for liv eller helse, fare for klima eller miljø, korrupsjon eller annen økonomisk kriminalitet, myndighetsmisbruk, uforsvarlig arbeidsmiljø og brudd på personopplysningssikkerheten.</p><p><em>Ytringer som handler om forhold som kun gjelder arbeidstakerens eget arbeidsforhold, regnes ikke som varsling, med mindre forholdet faller inn under første ledd.</em></p>'),
      jsonb_build_object('kind','heading','level',2,'text','2. Hvordan varsle — forsvarlig framgangsmåte'),
      jsonb_build_object('kind','text','body',
        '<p>Etter AML § 2A-2 er framgangsmåten alltid forsvarlig dersom du varsler internt — til arbeidsgiver eller representant for arbeidsgiver — eller til verneombud, tillitsvalgt eller advokat. Du kan også alltid varsle eksternt til offentlig tilsynsmyndighet.</p><h3>Interne kanaler hos [Virksomhet]:</h3><ul><li><strong>Nærmeste leder</strong> — første valg når det er trygt å gå direkte</li><li><strong>HMS-ansvarlig / verneombud</strong> — når saken gjelder arbeidsmiljø</li><li><strong>Varslingsmottaket</strong>: <code>[varsling@virksomhet.no]</code> · sikker portal: <code>[lenke]</code></li><li><strong>Anonymt skjema</strong>: [lenke til /workplace-reporting/whistleblowing]</li></ul><h3>Ekstern varsling (AML § 2A-2 (3)):</h3><p>Du kan alltid varsle eksternt til tilsynsmyndighet — Arbeidstilsynet, Økokrim, Datatilsynet, Finanstilsynet eller annen relevant myndighet. Ekstern varsling til media eller allmennheten er forsvarlig dersom: (a) du er i god tro om innholdet, (b) varselet gjelder kritikkverdige forhold av allmenn interesse, og (c) du først har varslet internt eller har grunn til å tro at det ikke vil føre fram.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','3. Vern mot gjengjeldelse'),
      jsonb_build_object('kind','alert','variant','warning',
        'text','AML § 2A-4: Gjengjeldelse mot arbeidstaker som varsler i samsvar med § 2A-1 og § 2A-2 er forbudt. Forbudet gjelder også overfor innleide.'),
      jsonb_build_object('kind','text','body',
        '<p>Med gjengjeldelse menes ugunstig behandling som er en følge av eller reaksjon på varsling — for eksempel trusler, trakassering, usaklig forskjellsbehandling, sosial ekskludering, advarsler, endring i arbeidsoppgaver eller arbeidssted, suspensjon, omplassering eller oppsigelse.</p><p>Dersom du opplever gjengjeldelse, skal du melde fra til varslingsmottaket umiddelbart. AML § 2A-5 gir rett til erstatning og oppreisning uten hensyn til skyld hos arbeidsgiver.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','4. Slik behandler vi varselet — arbeidsgivers aktivitetsplikt'),
      jsonb_build_object('kind','text','body',
        '<p>Arbeidsgiver har en lovpålagt aktivitetsplikt etter AML § 2A-3:</p><ol><li><strong>Bekreftelse</strong>: Vi bekrefter mottak av varselet innen <strong>5 virkedager</strong>.</li><li><strong>Undersøkelse</strong>: Saken undersøkes innen rimelig tid — typisk innen 6 uker, lengre i komplekse saker. Du får løpende status.</li><li><strong>Tiltak</strong>: Hvis varselet bekreftes, treffer vi tiltak for å rette opp forholdet.</li><li><strong>Oppfølging</strong>: Du får tilbakemelding om utfall, så langt taushetsplikten tillater. Vi følger opp at varsleren ikke utsettes for gjengjeldelse.</li></ol><p>Ved varsel om seksuell trakassering eller andre alvorlige forhold gjelder særlige sporings- og dokumentasjonskrav.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','5. Konfidensialitet og personvern'),
      jsonb_build_object('kind','text','body',
        '<p>Identiteten til varsleren er en fortrolig opplysning, jf. AML § 2A-7 (3). Den kan ikke gjøres kjent for andre enn dem som har tjenstlig behov for den. Dette gjelder også overfor sakens parter og deres representanter. Personopplysninger behandles i tråd med GDPR og virksomhetens behandlingsprotokoll.</p>'),
      jsonb_build_object('kind','heading','level',2,'text','6. Roller i varslingsmottaket'),
      jsonb_build_object('kind','text','body',
        '<table><thead><tr><th>Rolle</th><th>Ansvar</th></tr></thead><tbody><tr><td>Varslingsmottaker</td><td>Mottar, registrerer og vurderer varsler. Habilitetsprøver.</td></tr><tr><td>Saksbehandler</td><td>Undersøker, intervjuer, dokumenterer.</td></tr><tr><td>Beslutningstaker</td><td>Vedtak om tiltak. Kan ikke være parten det varsles om.</td></tr><tr><td>Verneombud</td><td>Bistår varsler ved ønske; bidrar til habilitet.</td></tr><tr><td>AMU</td><td>Mottar avidentifisert årsstatistikk.</td></tr></tbody></table>'),
      jsonb_build_object('kind','heading','level',2,'text','7. Dokumentasjon og oppbevaring'),
      jsonb_build_object('kind','text','body',
        '<p>Alle varsler registreres i [whistleblowing_cases]. Saksdokumenter oppbevares i lukket arkiv så lenge det er nødvendig for å oppfylle behandlings- og oppfølgingsformålet, og minst <strong>5 år</strong> etter at saken er avsluttet for å kunne dokumentere virksomhetens behandling overfor Arbeidstilsynet eller andre tilsynsmyndigheter.</p>'),
      jsonb_build_object('kind','module','moduleName','action_button','params',
        jsonb_build_object('label','Send et varsel','route','/workplace-reporting/whistleblowing','variant','primary')),
      jsonb_build_object('kind','law_ref','ref','AML § 2A-1','description','Rett til å varsle om kritikkverdige forhold','url','https://lovdata.no/lov/2005-06-17-62/§2A-1'),
      jsonb_build_object('kind','law_ref','ref','AML § 2A-2','description','Framgangsmåte ved varsling','url','https://lovdata.no/lov/2005-06-17-62/§2A-2'),
      jsonb_build_object('kind','law_ref','ref','AML § 2A-3','description','Arbeidsgivers aktivitetsplikt ved varsling','url','https://lovdata.no/lov/2005-06-17-62/§2A-3'),
      jsonb_build_object('kind','law_ref','ref','AML § 2A-4','description','Forbud mot gjengjeldelse','url','https://lovdata.no/lov/2005-06-17-62/§2A-4'),
      jsonb_build_object('kind','law_ref','ref','AML § 2A-7','description','Plikt til å utarbeide rutiner for intern varsling','url','https://lovdata.no/lov/2005-06-17-62/§2A-7'),
      jsonb_build_object('kind','module','moduleName','acknowledgement_footer')
    )
  ),
  35
)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

-- ── 2. Compliance checklist: varsling-arsgjennomgang ──────────────────────
-- Inserted as a system template per existing org via the provision
-- function pattern. Idempotent on (organization_id, slug).

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
      'varsling-arsgjennomgang',
      'Varsling — årsgjennomgang av rutiner og mottak',
      'Årlig kontroll av at varslingsrutinene etter AML § 2A-7 er kjent, oppdaterte, og operative — at mottakskanalene fungerer, at habilitetskrav er ivaretatt, og at årsstatistikk er forsvarlig dokumentert.',
      jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('key','rutiner_skriftlige','prompt','Er varslingsrutinene skriftlige og lett tilgjengelige for alle ansatte?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-7 (5)','severity_default','critical',
                           'help','Krav: rutinen ligger på intranett/HMS-håndbok, kjent ved onboarding, og oppdatert siste 12 mnd.'),
        jsonb_build_object('key','rutiner_innhold','prompt','Inneholder rutinen alle de fem lovpålagte minimumspunktene (oppfordring til å varsle, framgangsmåte, mottak, taushetsplikt, ekstern varsling)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-7 (5)','severity_default','critical'),
        jsonb_build_object('key','dom_drofting_amu','prompt','Er rutinen drøftet med arbeidstakerne / tillitsvalgte og AMU?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-7 (4)','severity_default','high',
                           'help','§ 2A-7 (4) krever drøfting før utarbeidelse/endring.'),
        jsonb_build_object('key','mottak_test','prompt','Er e-post / portal / anonymt skjema testet siste 6 mnd. og fungerer?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-3','severity_default','high',
                           'help','Send testvarsel og bekreft mottak innen 5 virkedager.'),
        jsonb_build_object('key','habilitet','prompt','Er det fastsatt habilitetsregler for varslingsmottakerne (saksbehandler ≠ den det varsles om)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-3','severity_default','high'),
        jsonb_build_object('key','taushet','prompt','Er taushetsplikten om varslerens identitet ivaretatt — gjelder også overfor sakens parter?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-7 (3)','severity_default','critical'),
        jsonb_build_object('key','aktivitetsplikt','prompt','Er aktivitetsplikten dokumentert for hvert varsel siste 12 mnd. (mottaksbekreftelse, undersøkelse, tilbakemelding)?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-3','severity_default','critical'),
        jsonb_build_object('key','gjengjeldelsesvern','prompt','Er det rutiner for å forebygge og avdekke gjengjeldelse mot varslere?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-4','severity_default','high'),
        jsonb_build_object('key','statistikk','prompt','Er avidentifisert årsstatistikk over varsler lagt fram for AMU?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 7-2 + § 2A-7','severity_default','medium'),
        jsonb_build_object('key','opplaering','prompt','Har ledere og varslingsmottakere fått oppdatert opplæring siste 24 mnd.?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 3-2','severity_default','medium'),
        jsonb_build_object('key','arkivering','prompt','Oppbevares varslingssaker i lukket arkiv i minst 5 år?',
                           'type','yes_no_na','required',true,
                           'law_ref','AML § 2A-7 + GDPR Art. 5','severity_default','medium'),
        jsonb_build_object('key','kommentar','prompt','Observasjoner / forbedringspunkter','type','text','required',false),
        jsonb_build_object('key','sign_hms','prompt','HMS-leders signatur','type','signature','required',true),
        jsonb_build_object('key','sign_vo','prompt','Verneombudets signatur','type','signature','required',true)
      )),
      array['AML § 2A-1','AML § 2A-2','AML § 2A-3','AML § 2A-4','AML § 2A-7']::text[],
      true, false, true, 'draft', 'arlig'
    )
    on conflict (organization_id, slug) do update set
      law_refs = excluded.law_refs,
      definition = excluded.definition,
      description = excluded.description;
  end loop;
end $$;

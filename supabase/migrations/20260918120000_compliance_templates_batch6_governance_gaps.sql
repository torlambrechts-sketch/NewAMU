-- Compliance templates batch 6: AML governance gaps.
--
-- Closes critical gaps identified in AML compliance review 2026-05-24:
--   1. Verneombud election & mandate not verified (AML § 6-1)
--   2. AMU establishment not verified for ≥50-employee companies (AML § 7-1)
--   3. Verneombud–employer meeting frequency not logged (AML § 6-2)
--   4. Employee consultation on work-organisation changes not checked (AML § 4-2)
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed:
--     1. Manglende valg av verneombud og formelt mandat (AML § 6-1)
--        → verneombud-valg-mandate (ny, årlig)
--     2. Manglende opprettelse og mandat for AMU ≥50 ansatte (AML § 7-1)
--        → amu-etablering-sjekk (ny, årlig / ved endring)
--     3. Manglende møtelogg for verneombud–arbeidsgiver (AML § 6-2)
--        → verneombud-motelogg (ny, kvartalsvis)
--     4. Ansattes medvirkning i organisasjonsendringer ikke dokumentert (AML § 4-2)
--        → item patched into internkontroll-arsgjennomgang
--
--   Restrisiko deferred:
--     - AMU meeting count validation (≥4/year): compliance-planner v2 scope.
--     - ARP survey + document seeding (LDL § 26): next batch (survey/documents layer).
--     - Harassment procedure document (`tpl-trakasseringsrutine`): documents-content batch.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. New provision helper: VO/AMU governance templates
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._provision_compliance_aml_vo_amu_governance(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin

  -- ── verneombud-valg-mandate ──────────────────────────────────────────────
  -- Verifies that the safety representative is elected and has a signed
  -- mandate per AML § 6-1. Most frequent Arbeidstilsynet finding when absent.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint,
    law_refs
  ) values (
    p_org_id,
    'aml-amu',
    'verneombud-valg-mandate',
    'Verneombud – valg og mandat',
    'Verifiserer at verneombud er valgt iht. AML § 6-1, at mandat er signert og at VO har nødvendig opplæring. Arbeidstilsynets hyppigste funn ved tilsyn.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object(
        'key','antall_ansatte_sjekk',
        'prompt','Har virksomheten 10 eller flere ansatte?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-1 (1)',
        'help','Virksomheter med 10 eller flere ansatte skal ha verneombud. Under 10 ansatte kan VO avtales bort skriftlig.',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','valg_gjennomfort',
        'prompt','Er verneombud valgt iht. AML § 6-1?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-1 (1)',
        'task_template',jsonb_build_object('title','Gjennomfør valg av verneombud','priority','high'),
        'severity_default','critical'
      ),
      jsonb_build_object(
        'key','valgsprotokoll_signert',
        'prompt','Er valgsprotokoll signert og arkivert?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-1',
        'help','Protokollen skal angi navn, hvem som avholdt valget, dato og godkjenning fra de ansattes representant.',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','mandatdokument_signert',
        'prompt','Har verneombudet mottatt og signert formelt mandatdokument?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-2',
        'task_template',jsonb_build_object('title','Utarbeid og signer mandatdokument for verneombud','priority','high'),
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','vo_navn_kontakt',
        'prompt','Navn og kontaktinfo til valgt verneombud',
        'type','text','required',true,
        'law_ref','AML § 6-1',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','funksjonstid',
        'prompt','Hva er funksjonstiden? (typisk 2 år per AML § 6-1 (3))',
        'type','text','required',true,
        'law_ref','AML § 6-1 (3)',
        'help','AML § 6-1 (3): funksjonstiden er 2 år med mindre annet er skriftlig avtalt. Dokumenter avvik.',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','opplaering_gjennomfort',
        'prompt','Har verneombudet gjennomført påkrevd HMS-opplæring (≥40 timer)?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-5',
        'task_template',jsonb_build_object('title','Meld verneombud på lovpålagt HMS-kurs (40 timer)','priority','high'),
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','opplaering_dokumentert',
        'prompt','Last opp kursbevis / opplæringsattest',
        'type','photo','required',false,
        'law_ref','AML § 6-5',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','vo_kjent_for_ansatte',
        'prompt','Er verneombudets navn og rolle kommunisert til alle ansatte?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-1',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','signatur_arbeidsgiver',
        'prompt','Arbeidsgivers bekreftelse',
        'type','signature','required',true,
        'law_ref','AML § 6-1'
      )
    )),
    true, true, true, 'draft', 'årlig',
    array['AML § 6-1','AML § 6-2','AML § 6-5']
  )
  on conflict (organization_id, slug) do update
    set name        = excluded.name,
        description = excluded.description,
        definition  = excluded.definition,
        law_refs    = excluded.law_refs,
        review_status = excluded.review_status;

  -- ── amu-etablering-sjekk ─────────────────────────────────────────────────
  -- Verifies that AMU (Arbeidsmiljøutvalg) is formally established for
  -- companies with ≥50 employees per AML § 7-1. Size threshold documented.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint,
    law_refs
  ) values (
    p_org_id,
    'aml-amu',
    'amu-etablering-sjekk',
    'AMU – etablering og mandat',
    'Sjekker om virksomheten har AMU-plikt (≥50 ansatte per AML § 7-1), og om AMU er formelt opprettet med representanter og mandat. Kjøres årlig eller ved endring i antall ansatte.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object(
        'key','antall_ansatte',
        'prompt','Antall ansatte i virksomheten (heltidsekvivalenter)',
        'type','text','required',true,
        'law_ref','AML § 7-1 (1)',
        'help','AMU er påkrevd når virksomheten jevnlig sysselsetter minst 50 arbeidstakere.',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','amu_plikt',
        'prompt','Har virksomheten AMU-plikt (≥50 ansatte)?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-1 (1)',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','amu_etablert',
        'prompt','Er AMU formelt etablert?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-1',
        'help','Svar «Ikke aktuelt» hvis virksomheten har færre enn 50 ansatte og AMU ikke er påkrevd.',
        'task_template',jsonb_build_object('title','Etabler AMU – Arbeidsmiljøutvalg – med representanter fra begge parter','priority','high'),
        'severity_default','critical'
      ),
      jsonb_build_object(
        'key','amu_representanter',
        'prompt','Navn på AMU-representanter (arbeidsgiver + arbeidstakersiden)',
        'type','text','required',true,
        'law_ref','AML § 7-1 (2)',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','valg_protokoll',
        'prompt','Er valg av arbeidstakerrepresentanter til AMU protokollert?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-1',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','leder_sekretaer',
        'prompt','Er AMU-leder og sekretær oppnevnt?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-1 (3)',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','representanter_opplaert',
        'prompt','Er AMU-representantene tilbudt nødvendig opplæring (AML § 7-3)?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-3',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','bht_representert',
        'prompt','Er bedriftshelsetjenesten representert i AMU (der BHT-plikt foreligger)?',
        'type','yes_no_na','required',false,
        'law_ref','AML § 7-1 (4)',
        'help','Gjelder virksomheter med BHT-plikt etter BHT-forskriften.',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','moter_planlagt',
        'prompt','Er AMU-møteplan lagt for inneværende år (minst 4 møter)?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 7-2',
        'task_template',jsonb_build_object('title','Sett opp AMU-møteplan for året (min. 4 møter)','priority','medium'),
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','signatur_arbeidsgiver',
        'prompt','Arbeidsgivers bekreftelse',
        'type','signature','required',true,
        'law_ref','AML § 7-1'
      )
    )),
    true, true, true, 'draft', 'årlig',
    array['AML § 7-1','AML § 7-2','AML § 7-3']
  )
  on conflict (organization_id, slug) do update
    set name        = excluded.name,
        description = excluded.description,
        definition  = excluded.definition,
        law_refs    = excluded.law_refs,
        review_status = excluded.review_status;

  -- ── verneombud-motelogg ──────────────────────────────────────────────────
  -- Quarterly log of VO–employer meetings. AML § 6-2 requires the VO to
  -- meet regularly with the employer. Without a log, Arbeidstilsynet cannot
  -- verify the mandate is exercised in practice.
  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    is_active, nav_pinned, is_system, review_status, cadence_hint,
    law_refs
  ) values (
    p_org_id,
    'aml-amu',
    'verneombud-motelogg',
    'Verneombud – møtelogg',
    'Kvartalsvis logg over møter mellom verneombud og arbeidsgiver per AML § 6-2. Dokumenterer at VO aktivt utøver sitt mandat.',
    jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object(
        'key','motedato',
        'prompt','Dato for møtet',
        'type','text','required',true,
        'law_ref','AML § 6-2',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','deltakere',
        'prompt','Deltakere (navn og rolle)',
        'type','text','required',true,
        'law_ref','AML § 6-2',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','saker_behandlet',
        'prompt','Hvilke saker ble behandlet på møtet?',
        'type','text','required',true,
        'law_ref','AML § 6-2',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','vernerunde_observasjoner',
        'prompt','Har VO rapportert observasjoner fra vernerunder?',
        'type','yes_no_na','required',false,
        'law_ref','AML § 6-2',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','avvik_meldt_av_vo',
        'prompt','Har VO meldt avvik siden forrige møte?',
        'type','yes_no_na','required',false,
        'law_ref','AML § 6-3',
        'severity_default','medium'
      ),
      jsonb_build_object(
        'key','tiltak_fulgt_opp',
        'prompt','Er tiltak fra forrige møte fulgt opp?',
        'type','yes_no_na','required',true,
        'law_ref','AML § 6-2',
        'severity_default','high'
      ),
      jsonb_build_object(
        'key','neste_motedato',
        'prompt','Dato for neste planlagte møte',
        'type','text','required',false,
        'law_ref','AML § 6-2',
        'severity_default','low'
      ),
      jsonb_build_object(
        'key','signatur_vo',
        'prompt','Verneombudets signatur',
        'type','signature','required',true,
        'law_ref','AML § 6-2'
      ),
      jsonb_build_object(
        'key','signatur_arbeidsgiver',
        'prompt','Arbeidsgivers signatur',
        'type','signature','required',true,
        'law_ref','AML § 6-2'
      )
    )),
    true, false, true, 'draft', 'kvartalsvis',
    array['AML § 6-2','AML § 6-3']
  )
  on conflict (organization_id, slug) do update
    set name        = excluded.name,
        description = excluded.description,
        definition  = excluded.definition,
        law_refs    = excluded.law_refs,
        review_status = excluded.review_status;

end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Patch internkontroll-arsgjennomgang: add AML § 4-2 medvirkning items
--    Uses jsonb_build_object concatenation so the patch is idempotent —
--    items are appended only if the key does not yet exist in the array.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._patch_internkontroll_medvirkning(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing jsonb;
  v_items    jsonb;
  v_keys     text[];
  v_new_item jsonb;
begin
  select definition
    into v_existing
    from public.compliance_checklist_templates
   where organization_id = p_org_id
     and slug = 'internkontroll-arsgjennomgang'
     and is_system = true
     and deleted_at is null;

  if v_existing is null then
    return;
  end if;

  v_items := coalesce(v_existing -> 'items', '[]'::jsonb);

  -- Collect existing keys
  select array_agg(item ->> 'key')
    into v_keys
    from jsonb_array_elements(v_items) item;

  -- medvirkning_endringer
  if not ('medvirkning_endringer' = any(coalesce(v_keys, array[]::text[]))) then
    v_new_item := jsonb_build_object(
      'key','medvirkning_endringer',
      'prompt','Er ansatte konsultert ved endringer i arbeidsorganisering eller arbeidsmiljøforhold siste år?',
      'type','yes_no_na','required',true,
      'law_ref','AML § 4-2 (3)',
      'help','Gjelder vesentlige endringer i arbeidets art, organisering, teknologi eller lokaler. Ansatte har rett til medvirkning i planleggingen (§ 4-2 og § 8-1).',
      'severity_default','high'
    );
    v_items := v_items || jsonb_build_array(v_new_item);
  end if;

  -- medvirkning_feedback
  if not ('medvirkning_feedback' = any(coalesce(v_keys, array[]::text[]))) then
    v_new_item := jsonb_build_object(
      'key','medvirkning_feedback',
      'prompt','Har ansattes tilbakemeldinger påvirket beslutninger om arbeidsforhold det siste året?',
      'type','yes_no_na','required',false,
      'law_ref','AML § 4-2',
      'help','Eksempel: resultater fra vernerunde / psykososial pulsmåling som førte til konkrete tiltak.',
      'severity_default','medium'
    );
    v_items := v_items || jsonb_build_array(v_new_item);
  end if;

  -- medvirkning_forum
  if not ('medvirkning_forum' = any(coalesce(v_keys, array[]::text[]))) then
    v_new_item := jsonb_build_object(
      'key','medvirkning_forum',
      'prompt','Finnes det dokumenterte arenaer for medvirkning (f.eks. personalmøter, AMU, forslagskasse)?',
      'type','yes_no_na','required',false,
      'law_ref','AML § 4-2',
      'severity_default','low'
    );
    v_items := v_items || jsonb_build_array(v_new_item);
  end if;

  update public.compliance_checklist_templates
     set definition = jsonb_set(v_existing, '{items}', v_items),
         law_refs   = array(
                        select distinct unnest(
                          coalesce(law_refs, array[]::text[]) ||
                          array['AML § 4-2']
                        ) order by 1
                      )
   where organization_id = p_org_id
     and slug = 'internkontroll-arsgjennomgang'
     and is_system = true
     and deleted_at is null;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Updated master provision function
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.provision_compliance_baseline_for_org(
  p_org_id   uuid,
  p_pack_slug public.compliance_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pack_slug = 'aml-amu' then
    perform public._provision_compliance_aml_baseline(p_org_id);
    perform public._provision_compliance_aml_ik_core(p_org_id);
    perform public._provision_compliance_aml_onboarding(p_org_id);
    perform public._provision_compliance_aml_fysisk(p_org_id);
    perform public._provision_compliance_aml_psyk_vo(p_org_id);
    perform public._provision_compliance_aml_varsling(p_org_id);
    perform public._provision_compliance_aml_registre_ia(p_org_id);
    perform public._provision_compliance_aml_amu_styring(p_org_id);
    perform public._provision_compliance_aml_hr_sjekker(p_org_id);
    -- Batch 6 — governance gaps
    perform public._provision_compliance_aml_vo_amu_governance(p_org_id);
    perform public._patch_internkontroll_medvirkning(p_org_id);
    -- Set law_refs on all system templates (no-op if already set)
    perform public._backfill_compliance_aml_law_refs(p_org_id);
  elsif p_pack_slug = 'iso-45001' then
    perform public._provision_compliance_iso_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public, anon;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. One-time backfill: provision new templates + patch for existing orgs
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_pack record;
  v_fn   regprocedure := to_regprocedure(
    'public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)'
  );
begin
  if v_fn is null then
    raise notice
      'compliance batch6: provision_compliance_baseline_for_org not found — '
      'apply earlier batch migrations first, then re-run. Skipping.';
    return;
  end if;

  for v_pack in
    select organization_id, slug
    from public.compliance_packs
    where is_active = true
      and deleted_at is null
      and slug = 'aml-amu'
  loop
    execute format('select %s($1, $2)', v_fn::regproc::text)
      using v_pack.organization_id, v_pack.slug;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Create 'styrende-organer' category and assign governance templates
--    Also assigns batch5 templates that were seeded without a category.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_org record;
  v_styrende   uuid;
  v_varsling   uuid;
  v_internkontroll uuid;
  v_ansettelse uuid;
begin
  for v_org in
    select id from public.organizations
  loop
    -- Ensure 'styrende-organer' category exists (VO, AMU og styrende organer)
    insert into public.compliance_checklist_categories
      (organization_id, pack, slug, name, description, position, is_system)
    values
      (v_org.id, 'aml-amu', 'styrende-organer',
       'VO, AMU og styrende organer',
       'Verneombud, Arbeidsmiljøutvalg og medvirkningsplikt.',
       55, true)
    on conflict (organization_id, pack, slug) do nothing;

    -- Ensure 'varsling' category exists
    insert into public.compliance_checklist_categories
      (organization_id, pack, slug, name, description, position, is_system)
    values
      (v_org.id, 'aml-amu', 'varsling',
       'Varsling og registre',
       'Varslingsrutine, skade/sykdomsregister, arbeidstid og kontrolltiltak.',
       60, true)
    on conflict (organization_id, pack, slug) do nothing;

    -- Look up category IDs
    select id into v_styrende from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'styrende-organer';
    select id into v_varsling from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'varsling';
    select id into v_internkontroll from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'internkontroll';
    select id into v_ansettelse from public.compliance_checklist_categories
      where organization_id = v_org.id and pack = 'aml-amu' and slug = 'ansettelse';

    -- Batch 6 governance templates → styrende-organer
    if v_styrende is not null then
      update public.compliance_checklist_templates
        set category_id = v_styrende
        where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
          and slug in ('verneombud-valg-mandate','amu-etablering-sjekk','verneombud-motelogg');

      -- Move existing AMU reporting template (batch5) here too
      update public.compliance_checklist_templates
        set category_id = v_styrende
        where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
          and slug in ('amu-arsrapport-sjekk','likestilling-arssjekk');
    end if;

    -- Batch5 varsling + registre + control measure templates → varsling
    if v_varsling is not null then
      update public.compliance_checklist_templates
        set category_id = v_varsling
        where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
          and slug in (
            'varsling-rutine-arssjekk','varsling-handtering-logg',
            'skade-sykdom-register-sjekk','arbeidstid-kontroll',
            'kontrolltiltak-evaluering'
          );
    end if;

    -- Batch5 internkontroll-adjacent → internkontroll
    if v_internkontroll is not null then
      update public.compliance_checklist_templates
        set category_id = v_internkontroll
        where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
          and slug in ('bht-samarbeid-arsplan','hms-maal-arsplan-sjekk');
    end if;

    -- Batch5 HR / employment → ansettelse
    if v_ansettelse is not null then
      update public.compliance_checklist_templates
        set category_id = v_ansettelse
        where organization_id = v_org.id and pack = 'aml-amu' and category_id is null
          and slug in ('ia-oppfolgingsplan-sjekk','innleie-sjekk','oppsigelse-drofting-sjekk');
    end if;

  end loop;
end $$;

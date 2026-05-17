-- Workflow emitter payload enrichment — sector-pack rule field alignment.
--
-- Several sector-pack rules in _123000 (helse) and _123200 (bygg) match
-- against payload paths that the emitters don't produce:
--   * helse-sertifikat-autorisasjon-monitor    matches path='kind' but
--     trg_learning_certificates_workflow_issued dispatches to_jsonb(NEW)
--     of learning_certificates — a table that has no 'kind' column.
--   * bygg-sha-plan-onboarding + bygg-sprengning-dsb-melding match
--     'registerType' (camelCase) but trg_register_records_workflow_*
--     dispatches to_jsonb(NEW) which carries 'register_type_id'
--     (snake_case, and an id, not a slug).
--
-- Approach: enrich the emitters once so rule authors can keep using the
-- familiar event-field names. Rules continue to read 'kind' / 'registerType'
-- and now those keys actually appear in the dispatched payload.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: Helsepersonelloven § 48 (autorisasjon-utløp
--   må kunne følges automatisk) + Byggherreforskriften § 8/§ 11 (SHA-plan
--   + DSB-sprengning er regelfyrende kun hvis match-path stemmer). Disse
--   reglene er allerede seedet — feilen er stille, fanges først ved
--   audit-replay. Manglende auto-oppgaver for utløpende autorisasjoner =
--   pålegg-grunn ved Helsetilsynet-tilsyn.
--   Restrisiko deferred: vi har ingen normalisert kind-kolonne på
--   learning_courses. Mappingen 'autorisasjon-%' → healthcare_authorization
--   er heuristisk; korrekt løsning er en eksplisitt kolonne, men det
--   krever skjema-endring + frontend-form-felter, defer til v0.2.

set local search_path = public, pg_catalog;

-- ── 1. Learning certificates — inject derived 'kind' field ───────────────
-- Strategy:
--   (a) Prefer tags-derived kind: if learning_courses.tags @> ARRAY['kind:foo'],
--       use 'foo'.
--   (b) Else fall back to slug-pattern matching on learning_courses.id
--       (e.g. 'autorisasjon-%' → 'healthcare_authorization').
--   (c) Else null — rules that match field_equals will just not fire,
--       which is the same behaviour as today.

create or replace function public.trg_learning_certificates_workflow_issued()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course_id  text;
  v_tags       text[];
  v_kind       text;
  v_payload    jsonb;
begin
  v_course_id := new.course_id;

  -- Pull tags + derive kind from the parent course row.
  select coalesce(tags, '{}'::text[]) into v_tags
    from public.learning_courses
   where id = v_course_id;

  -- (a) Tag-derived: any tag of shape 'kind:xxx' wins (first match).
  if v_tags is not null then
    select substring(t from 6) into v_kind
      from unnest(v_tags) as t
     where t like 'kind:%'
     limit 1;
  end if;

  -- (b) Slug-pattern fallback. Conservative mapping: only well-known
  -- prefixes promote to a structured kind. Anything else stays null so
  -- field_equals rules don't fire on unintended courses.
  if v_kind is null and v_course_id is not null then
    v_kind := case
      when v_course_id ilike 'autorisasjon-%'         then 'healthcare_authorization'
      when v_course_id ilike 'helse-autorisasjon%'    then 'healthcare_authorization'
      when v_course_id ilike '%-autorisasjon'         then 'healthcare_authorization'
      when v_course_id ilike 'truck-%'                then 'forklift_certification'
      when v_course_id ilike 'kran-%'                 then 'crane_certification'
      when v_course_id ilike 'sprengning-%'           then 'blasting_certification'
      when v_course_id ilike 'fagbrev-%'              then 'fagbrev'
      when v_course_id ilike 'hms-grunnopplaering%'   then 'hms_basic_training'
      else null
    end;
  end if;

  v_payload := to_jsonb(new);
  if v_kind is not null then
    v_payload := v_payload || jsonb_build_object('kind', v_kind);
  end if;

  perform public.workflow_dispatch_db_event(
    new.organization_id, 'learning', 'ON_CERTIFICATE_ISSUED', v_payload
  );
  return new;
end;
$$;

comment on function public.trg_learning_certificates_workflow_issued() is
  'Dispatches ON_CERTIFICATE_ISSUED with a derived ''kind'' field so sector-pack rules (e.g. helse-sertifikat-autorisasjon-monitor) can match field_equals path=kind. Source of kind: learning_courses.tags @ kind:xxx, else slug-pattern, else null.';

-- ── 2. Register records — inject snake + camel-case register_type ───────
-- The trigger fans out on insert OR update; we add a join on
-- register_types to project the slug-equivalent (here: register_types.id
-- which is the text PK we use as a slug across the seed migrations).

do $$
begin

  create or replace function public.trg_register_records_workflow_created()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  declare
    v_type_slug text;
    v_payload   jsonb;
  begin
    select rt.id into v_type_slug
      from public.register_types rt
     where rt.id = new.register_type_id;

    v_payload := to_jsonb(new)
                 || jsonb_build_object(
                      'register_type', v_type_slug,
                      'registerType',  v_type_slug
                    );

    perform public.workflow_dispatch_db_event(
      new.organization_id, 'registers', 'ON_REGISTER_RECORD_CREATED', v_payload
    );
    return new;
  end;
  $fn$;

  create or replace function public.trg_register_records_workflow_updated()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  declare
    v_type_slug text;
    v_payload   jsonb;
  begin
    select rt.id into v_type_slug
      from public.register_types rt
     where rt.id = new.register_type_id;

    v_payload := to_jsonb(new)
                 || jsonb_build_object(
                      'register_type', v_type_slug,
                      'registerType',  v_type_slug
                    );

    perform public.workflow_dispatch_db_event(
      new.organization_id, 'registers', 'ON_REGISTER_RECORD_UPDATED', v_payload
    );
    return new;
  end;
  $fn$;

  comment on function public.trg_register_records_workflow_created() is
    'Dispatches ON_REGISTER_RECORD_CREATED with register_type + registerType (camelCase, sector-pack-friendly) projected from register_types.id (text slug).';

  comment on function public.trg_register_records_workflow_updated() is
    'Dispatches ON_REGISTER_RECORD_UPDATED with register_type + registerType (camelCase). Same shape as the *_created variant.';

exception
  when undefined_table then
    raise notice 'trg_register_records_workflow_*: register_records / register_types not present — skipping';
end;
$$;

-- Defense-in-depth: even though RLS on internal_packs hides cross-org
-- packs from reads, the FK alone doesn't prevent an admin in org A
-- from setting internal_pack_id on one of their own templates to a
-- UUID that belongs to an org-B pack. The link would be invisible
-- (RLS-hidden) but it's a referential-integrity smell. This trigger
-- enforces same-org at write time.
--
-- Mirrors the regulation_id_must_match_org pattern used by
-- register_categories — same SECURITY DEFINER + search_path = public
-- shape so platform admins recognise it.
--
-- Compliance angle: AML § 5-1 evidence chains require that audit
-- references stay within the tenant boundary. Cross-org references
-- would invalidate the chain.

create or replace function public.internal_pack_id_must_match_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.internal_pack_id is null then
    return new;
  end if;
  if not exists (
    select 1 from public.internal_packs
    where id = new.internal_pack_id
      and organization_id = new.organization_id
  ) then
    raise exception 'internal_pack_id % does not exist for org %',
      new.internal_pack_id, new.organization_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.internal_pack_id_must_match_org() from public;

-- Attach to every table that carries the internal_pack_id column.
-- Both INSERT and UPDATE so re-pointing a template stays org-safe.

drop trigger if exists compliance_checklist_templates_internal_pack_same_org_tg on public.compliance_checklist_templates;
create trigger compliance_checklist_templates_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.compliance_checklist_templates
  for each row execute function public.internal_pack_id_must_match_org();

drop trigger if exists survey_org_templates_internal_pack_same_org_tg on public.survey_org_templates;
create trigger survey_org_templates_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.survey_org_templates
  for each row execute function public.internal_pack_id_must_match_org();

drop trigger if exists document_org_templates_internal_pack_same_org_tg on public.document_org_templates;
create trigger document_org_templates_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.document_org_templates
  for each row execute function public.internal_pack_id_must_match_org();

drop trigger if exists meeting_org_templates_internal_pack_same_org_tg on public.meeting_org_templates;
create trigger meeting_org_templates_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.meeting_org_templates
  for each row execute function public.internal_pack_id_must_match_org();

drop trigger if exists register_types_internal_pack_same_org_tg on public.register_types;
create trigger register_types_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.register_types
  for each row execute function public.internal_pack_id_must_match_org();

drop trigger if exists learning_courses_internal_pack_same_org_tg on public.learning_courses;
create trigger learning_courses_internal_pack_same_org_tg
  before insert or update of internal_pack_id on public.learning_courses
  for each row execute function public.internal_pack_id_must_match_org();

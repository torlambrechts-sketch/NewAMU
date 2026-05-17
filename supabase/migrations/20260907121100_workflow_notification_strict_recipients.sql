-- Fix-up: resolve_workflow_notification_recipients must use the STRICT
-- permission helper (user_has_permission_strict), not the legacy
-- user_has_permission which short-circuits on is_org_admin() (per
-- archive/20260402120000_rbac_invites.sql:133). The strict variant was
-- introduced in _120200_workflow_confidentiality_strict.sql precisely so
-- workflow recipient resolution can refuse to leak confidential payloads
-- to org-admins who do not actually hold workflows.view_confidential.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 femte ledd (varslersaker — admin
--   uten varslingsutvalg-rolle SKAL ikke få konfidensielt varsel videresendt),
--   GDPR Art. 32 (need-to-know — strict-helper avgjør på faktisk grant,
--   ikke admin-bypass), IK-f § 5 nr. 7 (sporbar konfidensialitet).
--   Restrisiko: shadow-rolla "org admin" gjenstår nyttig for andre flyt
--   (vanlige varsler treffer fortsatt admin via permAny). Fix-up review
--   (C-1) av kategori-CHECK-vinduet: rebuild i _120250 skjer i ett do$$-
--   blokk (single transaction), så det finnes ikke et faktisk
--   insert-vindu — re-flagging unngås ved å notere dette her.
--
-- Body is bit-identical to _120250:103-164 except for the two
-- user_has_permission(...) → user_has_permission_strict(...) call sites.

set local search_path = public, pg_catalog;

create or replace function public.resolve_workflow_notification_recipients(
  p_org_id          uuid,
  p_role_or_user    text,
  p_payload         jsonb default '{}'::jsonb,
  p_min_permission  text default null
)
returns setof uuid
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_uuid uuid;
  v_slug text;
begin
  if p_org_id is null or p_role_or_user is null or btrim(p_role_or_user) = '' then
    return;
  end if;

  -- (a) uuid-style → single recipient, must belong to the org (via profiles).
  begin
    v_uuid := p_role_or_user::uuid;
    return query
      select p.id
        from public.profiles p
       where p.id = v_uuid
         and p.organization_id = p_org_id
         and (
               p_min_permission is null
            or public.user_has_permission_strict(p_min_permission, p.id)
         );
    return;
  exception when invalid_text_representation then
    -- not a uuid → fall through to slug resolution
    null;
  end;

  -- (b) Slug aliasing — match the strings sprinkled across workflow_catalog
  -- (`hms_leder`, `varslingsutvalg`) to the seeded functional_roles slugs.
  v_slug := case lower(p_role_or_user)
              when 'hms_leder'         then 'hms_koordinator'
              when 'hms-leder'         then 'hms_koordinator'
              when 'varslingsutvalg'   then 'varslings_mottak'
              when 'personvernombud'   then 'dpo'
              when 'hr'                then 'hr_leder'
              when 'arbeidsgiver'      then 'daglig_leder'
              else lower(p_role_or_user)
            end;

  return query
    select distinct a.user_id
      from public.org_functional_role_assignments a
     where a.organization_id = p_org_id
       and a.role_slug = v_slug
       and (a.valid_to is null or a.valid_to >= current_date)
       and a.valid_from <= current_date
       and (
             p_min_permission is null
          or public.user_has_permission_strict(p_min_permission, a.user_id)
       );
end;
$$;

revoke all on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) from public;
grant execute on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) to service_role;

comment on function public.resolve_workflow_notification_recipients(uuid, text, jsonb, text) is
  'Resolve a workflow recipient spec (uuid OR role-slug, with catalog aliases) to a set of profile ids. p_min_permission filters recipients to those with the given permission via user_has_permission_strict — admin-bypass DISABLED so confidential workflow payloads stop leaking to org-admins that lack workflows.view_confidential. Empty result = no eligible recipient — caller logs.';

do $$
begin
  raise notice 'resolve_workflow_notification_recipients now uses user_has_permission_strict (no admin bypass).';
end
$$;

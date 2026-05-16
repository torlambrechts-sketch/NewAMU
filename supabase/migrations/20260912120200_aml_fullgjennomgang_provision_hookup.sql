-- AML fullgjennomgang — wire into the per-org provision dispatcher.
--
-- Coverage gap closed:
--   Phase 1's seed migration (_120100) seeded every existing org via a
--   `for v_org_id in select id from organizations` loop. But the
--   provision dispatcher `provision_compliance_baseline_for_org` (which
--   the trigger on `compliance_packs` fires for new orgs licensing the
--   AML pack) was never updated — so NEW tenants miss the walkthrough.
--
--   This migration plugs the gap with the smallest-possible diff:
--     1. New helper `_provision_compliance_aml_fullgjennomgang(p_org_id)`
--        that copies the canonical row from any existing org's seeded
--        template (system rows are byte-identical across orgs because
--        they all originate from the same seed migration).
--     2. Re-declares the dispatcher to call the new helper alongside
--        the existing eight AML helpers.
--     3. Backfills any AML-licensed org that doesn't yet have the
--        template — covers manual provisioning fallout.
--
-- Self-audit (Arbeidstilsynet POV):
--   * Failure mode = silent miss for the very first org on a brand-new
--     DB where Phase 1's loop hit zero orgs. Mitigation: Phase 1's
--     `for ... loop` reseeds on every migration run, so the first time
--     the seed runs *after* an org exists, the canonical row is
--     created. Document the gotcha in the function header so a future
--     dev doesn't have to rediscover.
--   * No data destruction: `on conflict (organization_id, slug) do
--     update` always touches the same row.

set local search_path = public, pg_catalog;

-- ── 1. Per-org provisioning helper ────────────────────────────────────────
create or replace function public._provision_compliance_aml_fullgjennomgang(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src compliance_checklist_templates%rowtype;
begin
  -- Pull the canonical definition from any other org that already has it.
  -- Phase 1 (migration _120100) seeded every existing org, so as long as
  -- ≥1 canonical row exists this returns a usable source.
  select * into v_src
  from public.compliance_checklist_templates
  where slug = 'aml-fullgjennomgang'
    and pack = 'aml-amu'
    and organization_id <> p_org_id
    and is_system = true
    and deleted_at is null
  limit 1;

  if v_src.id is null then
    -- No canonical row yet. The very first org on a fresh DB hits this
    -- path; the next reseed of _120100 will populate it. Logging via
    -- raise notice keeps the gap visible without aborting transactions.
    raise notice 'No canonical aml-fullgjennomgang row to copy from; org % skipped', p_org_id;
    return;
  end if;

  insert into public.compliance_checklist_templates (
    organization_id, pack, slug, name, description, definition,
    law_refs, is_active, nav_pinned, is_system, review_status,
    cadence_hint, metadata_schema
  ) values (
    p_org_id,
    'aml-amu',
    'aml-fullgjennomgang',
    v_src.name,
    v_src.description,
    v_src.definition,
    v_src.law_refs,
    true, true, true,
    v_src.review_status,
    v_src.cadence_hint,
    v_src.metadata_schema
  )
  on conflict (organization_id, slug) do update set
    name             = excluded.name,
    description      = excluded.description,
    definition       = excluded.definition,
    law_refs         = excluded.law_refs,
    nav_pinned       = excluded.nav_pinned,
    is_system        = excluded.is_system,
    review_status    = excluded.review_status,
    cadence_hint     = excluded.cadence_hint,
    metadata_schema  = excluded.metadata_schema,
    updated_at       = now();
end;
$$;

comment on function public._provision_compliance_aml_fullgjennomgang(uuid) is
  $c$Copy-from-canonical provisioner for the AML fullgjennomgang
  walkthrough. Called from provision_compliance_baseline_for_org()
  when a new org licenses the aml-amu pack.$c$;

-- ── 2. Update dispatcher to include the new helper ────────────────────────
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
    perform public._backfill_compliance_aml_law_refs(p_org_id);
    -- New (12-09-2026): start-to-finish walkthrough.
    perform public._provision_compliance_aml_fullgjennomgang(p_org_id);
  elsif p_pack_slug = 'iso-45001' then
    perform public._provision_compliance_iso_baseline(p_org_id);
  end if;
end;
$$;

revoke all on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  from public;
grant execute on function public.provision_compliance_baseline_for_org(uuid, public.compliance_pack)
  to authenticated;

-- ── 3. Backfill: any AML-licensed org missing the template ────────────────
-- Covers orgs that licensed AML between Phase 1 and this migration
-- without going through the new dispatcher (e.g. manual data fixes).
do $$
declare v_org_id uuid;
begin
  for v_org_id in
    select cp.organization_id
    from public.compliance_packs cp
    where cp.slug = 'aml-amu'
      and cp.deleted_at is null
      and not exists (
        select 1
        from public.compliance_checklist_templates ct
        where ct.organization_id = cp.organization_id
          and ct.slug = 'aml-fullgjennomgang'
          and ct.deleted_at is null
      )
  loop
    perform public._provision_compliance_aml_fullgjennomgang(v_org_id);
  end loop;
end $$;

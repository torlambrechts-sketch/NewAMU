-- Task provisioning — kobler systemfiler til per-org aktivering.
--
-- Coverage gap closed:
--   Nye organisasjoner trenger AML-maler tilgjengelig fra dag én
--   uten manuell oppsett. provision_task_baseline_for_org speiler
--   alle systemfiler for en gitt pakke inn i task_org_templates
--   med nav_pinned=true. Trigger på task_packs kaller funksjonen
--   automatisk ved licenstiering (insert/reactivation).
--
-- Self-audit (Arbeidstilsynet POV):
--   Automatisk provisjonering sikrer at ingen virksomhet kan
--   hevde manglende kjennskap til maler — de er synlige i
--   sidepanelet fra oppstart. Backfill-loop under dekker
--   eksisterende organisasjoner.

set local search_path = public, pg_catalog;

create or replace function public.provision_task_baseline_for_org(
  p_org_id   uuid,
  p_pack     public.task_pack
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_org_templates (
    organization_id, catalog_id, nav_pinned, is_active
  )
  select
    p_org_id, c.id, true, true
  from public.task_template_catalog c
  where c.organization_id is null
    and c.is_system = true
    and c.is_active = true
    and c.pack = p_pack
  on conflict (organization_id, catalog_id) do nothing;
end;
$$;

revoke all on function public.provision_task_baseline_for_org(uuid, public.task_pack)
  from public, anon;
grant execute on function public.provision_task_baseline_for_org(uuid, public.task_pack)
  to authenticated, service_role;

-- ── Trigger: licenstiering → provisjonering ───────────────────────────────

create or replace function public.task_pack_provision_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active = true then
    if (tg_op = 'INSERT')
       or (tg_op = 'UPDATE' and old.is_active = false)
    then
      perform public.provision_task_baseline_for_org(new.organization_id, new.slug);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists task_pack_provision_tg on public.task_packs;
create trigger task_pack_provision_tg
  after insert or update on public.task_packs
  for each row execute function public.task_pack_provision_on_change();

-- ── Backfill: provisjoner for alle eksisterende aktive (org, pack) ────────

do $$
declare
  v_pack record;
begin
  for v_pack in
    select organization_id, slug
    from public.task_packs
    where is_active = true
      and deleted_at is null
  loop
    perform public.provision_task_baseline_for_org(v_pack.organization_id, v_pack.slug);
  end loop;
end $$;

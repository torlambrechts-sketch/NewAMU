-- Add soft-delete column to register_types for the /admin/templates
-- «Slett» action. Org rows can be soft-deleted; system rows cannot
-- (organization_id is null on system rows, and the UI prevents the
-- attempt — belt-and-braces via the trigger guard below).
--
-- Existing code (useAdminTemplates) currently doesn't filter
-- deleted_at — needs a one-line update to read `deleted_at is null`,
-- shipped alongside this migration in src/hooks/useAdminTemplates.ts.

alter table public.register_types
  add column if not exists deleted_at timestamptz null;

create index if not exists register_types_active_idx
  on public.register_types (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where deleted_at is null;

-- Belt-and-braces: a trigger that refuses to set deleted_at on a
-- system row. The UI already gates this, but DB-level enforcement
-- prevents a misbehaving admin tool from soft-deleting system types.
create or replace function public.register_types_protect_system_delete()
returns trigger
language plpgsql
as $fn$
begin
  if new.deleted_at is not null and (old.deleted_at is null) and new.organization_id is null then
    raise exception 'Cannot soft-delete a system register type'
      using errcode = '42501';
  end if;
  return new;
end
$fn$;

drop trigger if exists register_types_protect_system_delete on public.register_types;
create trigger register_types_protect_system_delete
  before update on public.register_types
  for each row execute function public.register_types_protect_system_delete();

comment on column public.register_types.deleted_at is
  'Soft-delete marker (org rows only). NULL = active. System rows are protected by trigger.';

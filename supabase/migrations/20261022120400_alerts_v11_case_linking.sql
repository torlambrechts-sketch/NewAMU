-- Alerts v1.1 — alert_case_link (case-to-case linking).
--
-- v1.1 §6: handlers with access to two cases can mark them linked
-- (parent/child). The linker is auditable; the link visibility-to-reporter
-- flag controls whether the reporter learns of the relationship.
--
-- Self-audit:
--   * GDPR Art. 5 (2) — link is a processing act; audit row created.
--   * AML § 2A-7 (5) — visibility flag respects reporter's confidentiality
--     expectations.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_case_link (
  parent_id        uuid not null references public.alert_cases (id) on delete cascade,
  child_id         uuid not null references public.alert_cases (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  linked_by        uuid not null references auth.users (id) on delete restrict,
  visibility       text not null default 'committee' check (visibility in ('committee','reporter')),
  reason           text,
  created_at       timestamptz not null default now(),
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create index if not exists alert_case_link_child_idx on public.alert_case_link (child_id);

alter table public.alert_case_link enable row level security;

drop policy if exists alert_case_link_select on public.alert_case_link;
create policy alert_case_link_select
  on public.alert_case_link for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.alert_cases p where p.id = parent_id
    )
    and exists (
      select 1 from public.alert_cases c where c.id = child_id
    )
  );

drop policy if exists alert_case_link_write on public.alert_case_link;
create policy alert_case_link_write
  on public.alert_case_link for all
  using (
    organization_id = public.current_org_id()
    and exists (select 1 from public.alert_cases p where p.id = parent_id)
    and exists (select 1 from public.alert_cases c where c.id = child_id)
  )
  with check (
    organization_id = public.current_org_id()
    and linked_by = auth.uid()
  );

-- Cycle prevention.
create or replace function public.alert_case_link_before_insert_validate()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id = new.child_id then
    raise exception 'self_link_forbidden' using errcode = 'check_violation';
  end if;
  -- Walk the link graph from new.child_id to detect cycle back to new.parent_id.
  if exists (
    with recursive descendants(id) as (
      select child_id from public.alert_case_link where parent_id = new.child_id
      union
      select l.child_id from public.alert_case_link l
        join descendants d on l.parent_id = d.id
    )
    select 1 from descendants where id = new.parent_id
  ) then
    raise exception 'cycle_forbidden' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists alert_case_link_before_insert_validate_tg on public.alert_case_link;
create trigger alert_case_link_before_insert_validate_tg
  before insert on public.alert_case_link
  for each row execute function public.alert_case_link_before_insert_validate();

-- Mirror onto alert_cases.parent_case_id (added in 20261020120100). When a
-- link is inserted with the child case having a null parent_case_id, we
-- populate it. (Optional convenience for queries.)
create or replace function public.alert_case_link_after_insert_sync_parent()
returns trigger
language plpgsql
as $$
begin
  update public.alert_cases
     set parent_case_id = new.parent_id
   where id = new.child_id
     and parent_case_id is null
     and closed_at is null;  -- skip closed cases (parent_case_id is immutable post-close)
  return new;
end;
$$;

drop trigger if exists alert_case_link_after_insert_sync_parent_tg on public.alert_case_link;
create trigger alert_case_link_after_insert_sync_parent_tg
  after insert on public.alert_case_link
  for each row execute function public.alert_case_link_after_insert_sync_parent();

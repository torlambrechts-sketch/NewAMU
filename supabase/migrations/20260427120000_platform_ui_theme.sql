-- Global UI theme tokens (Layout Lab publish) — readable by all app users, writable by platform admins.

create table if not exists public.platform_ui_theme (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.platform_ui_theme (id, payload)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

drop trigger if exists platform_ui_theme_set_updated_at on public.platform_ui_theme;
create trigger platform_ui_theme_set_updated_at
  before update on public.platform_ui_theme
  for each row execute function public.set_updated_at();

alter table public.platform_ui_theme enable row level security;

drop policy if exists "platform_ui_theme_select_all" on public.platform_ui_theme;
create policy "platform_ui_theme_select_all"
  on public.platform_ui_theme for select
  using (true);

drop policy if exists "platform_ui_theme_write_admin" on public.platform_ui_theme;
create policy "platform_ui_theme_write_admin"
  on public.platform_ui_theme for all
  using (public.platform_is_admin())
  with check (public.platform_is_admin());

create or replace function public.platform_ui_theme_publish(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.platform_is_admin() then
    raise exception 'Not allowed';
  end if;
  insert into public.platform_ui_theme (id, payload, updated_at)
  values ('default', coalesce(p_payload, '{}'::jsonb), now())
  on conflict (id) do update set
    payload = excluded.payload,
    updated_at = now();
end;
$$;

grant execute on function public.platform_ui_theme_publish(jsonb) to authenticated;

comment on table public.platform_ui_theme is 'Published UI tokens from platform admin Layout Lab; clients read and apply as CSS variables.';

-- Realtime: broadcast row changes to subscribed clients (idempotent).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'platform_ui_theme'
  ) then
    alter publication supabase_realtime add table public.platform_ui_theme;
  end if;
end $$;

-- Saved page/layout compositions: named tabs, slots referencing component designs by reference_key.

create table if not exists public.platform_layout_compositions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_key text not null,
  display_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reference_key)
);

create index if not exists platform_layout_compositions_user_updated_idx
  on public.platform_layout_compositions (user_id, updated_at desc);

drop trigger if exists platform_layout_compositions_set_updated_at on public.platform_layout_compositions;
create trigger platform_layout_compositions_set_updated_at
  before update on public.platform_layout_compositions
  for each row execute function public.set_updated_at();

alter table public.platform_layout_compositions enable row level security;

drop policy if exists "platform_layout_compositions_all" on public.platform_layout_compositions;
create policy "platform_layout_compositions_all"
  on public.platform_layout_compositions for all
  using (public.platform_is_admin() and user_id = (select auth.uid()))
  with check (public.platform_is_admin() and user_id = (select auth.uid()));

comment on table public.platform_layout_compositions is 'Named layout compositions with slots pointing at platform_box_designs.reference_key.';

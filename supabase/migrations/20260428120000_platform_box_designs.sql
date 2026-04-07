-- Named UI box designs (advanced JSON schema) for platform admins — refer by reference_key in prompts.

create table if not exists public.platform_box_designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reference_key text not null,
  display_name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reference_key)
);

create index if not exists platform_box_designs_user_updated_idx
  on public.platform_box_designs (user_id, updated_at desc);

drop trigger if exists platform_box_designs_set_updated_at on public.platform_box_designs;
create trigger platform_box_designs_set_updated_at
  before update on public.platform_box_designs
  for each row execute function public.set_updated_at();

alter table public.platform_box_designs enable row level security;

drop policy if exists "platform_box_designs_all" on public.platform_box_designs;
create policy "platform_box_designs_all"
  on public.platform_box_designs for all
  using (public.platform_is_admin() and user_id = (select auth.uid()))
  with check (public.platform_is_admin() and user_id = (select auth.uid()));

comment on table public.platform_box_designs is 'Advanced ui_box_core JSON designs; reference_key is unique per admin user.';

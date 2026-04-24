-- Named layout composer templates (stack + grid) for platform admins; published rows readable by all authenticated users (workplace).

create table if not exists public.platform_composer_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('stack', 'grid')),
  payload jsonb not null default '{}'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_composer_templates_user_name_idx
  on public.platform_composer_templates (user_id, lower(trim(name)));

create index if not exists platform_composer_templates_user_updated_idx
  on public.platform_composer_templates (user_id, updated_at desc);

create index if not exists platform_composer_templates_published_idx
  on public.platform_composer_templates (published, updated_at desc)
  where published;

drop trigger if exists platform_composer_templates_set_updated_at on public.platform_composer_templates;
create trigger platform_composer_templates_set_updated_at
  before update on public.platform_composer_templates
  for each row execute function public.set_updated_at();

alter table public.platform_composer_templates enable row level security;

drop policy if exists "platform_composer_templates_admin_own" on public.platform_composer_templates;
create policy "platform_composer_templates_admin_own"
  on public.platform_composer_templates for all
  to authenticated
  using (public.platform_is_admin() and auth.uid() = user_id)
  with check (public.platform_is_admin() and auth.uid() = user_id);

drop policy if exists "platform_composer_templates_published_select" on public.platform_composer_templates;
create policy "platform_composer_templates_published_select"
  on public.platform_composer_templates for select
  to authenticated
  using (published = true);

comment on table public.platform_composer_templates is 'Platform-admin layout composer saves (stack=block order/visibility, grid=rows/columns); published rows are readable in the workplace app.';

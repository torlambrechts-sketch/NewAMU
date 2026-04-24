-- Platform operator admin: list tenants, billing placeholders, layout lab presets.
-- Grant platform access by inserting into platform_admins (your auth user id).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_billing (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  monthly_amount_cents integer not null default 0,
  currency text not null default 'NOK',
  plan text not null default 'standard',
  notes text,
  updated_at timestamptz not null default now()
);

drop trigger if exists organization_billing_set_updated_at on public.organization_billing;
create trigger organization_billing_set_updated_at
  before update on public.organization_billing
  for each row execute function public.set_updated_at();

create table if not exists public.platform_layout_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_layout_presets_user_idx on public.platform_layout_presets (user_id, updated_at desc);

drop trigger if exists platform_layout_presets_set_updated_at on public.platform_layout_presets;
create trigger platform_layout_presets_set_updated_at
  before update on public.platform_layout_presets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.platform_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
  );
$$;

grant execute on function public.platform_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: dashboard payload (orgs + billing + counts)
-- ---------------------------------------------------------------------------

create or replace function public.platform_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  org_rows jsonb;
  total_monthly bigint;
  total_members bigint;
  org_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select public.platform_is_admin() into ok;
  if not ok then
    raise exception 'Not a platform admin';
  end if;

  select coalesce(sum(ob.monthly_amount_cents), 0)::bigint into total_monthly
  from public.organization_billing ob;

  select count(*)::bigint into total_members from public.profiles where organization_id is not null;

  select count(*)::int into org_count from public.organizations;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'name', o.name,
        'organization_number', o.organization_number,
        'created_at', o.created_at,
        'onboarding_completed_at', o.onboarding_completed_at,
        'member_count', coalesce((
          select count(*)::int from public.profiles p where p.organization_id = o.id
        ), 0),
        'monthly_amount_cents', coalesce(ob.monthly_amount_cents, 0),
        'currency', coalesce(ob.currency, 'NOK'),
        'plan', coalesce(ob.plan, 'standard')
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  ) into org_rows
  from public.organizations o
  left join public.organization_billing ob on ob.organization_id = o.id;

  return jsonb_build_object(
    'organizations', org_rows,
    'totals', jsonb_build_object(
      'organization_count', org_count,
      'profile_count', total_members,
      'monthly_billing_cents', coalesce(total_monthly, 0)
    )
  );
end;
$$;

grant execute on function public.platform_admin_dashboard() to authenticated;

create or replace function public.platform_admin_upsert_billing(
  p_organization_id uuid,
  p_monthly_amount_cents integer,
  p_plan text default 'standard',
  p_currency text default 'NOK',
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.platform_is_admin() then
    raise exception 'Not allowed';
  end if;
  insert into public.organization_billing (organization_id, monthly_amount_cents, plan, currency, notes)
  values (p_organization_id, p_monthly_amount_cents, coalesce(nullif(trim(p_plan), ''), 'standard'), coalesce(nullif(trim(p_currency), ''), 'NOK'), p_notes)
  on conflict (organization_id) do update set
    monthly_amount_cents = excluded.monthly_amount_cents,
    plan = excluded.plan,
    currency = excluded.currency,
    notes = coalesce(excluded.notes, public.organization_billing.notes),
    updated_at = now();
end;
$$;

grant execute on function public.platform_admin_upsert_billing(uuid, integer, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.platform_admins enable row level security;

drop policy if exists "platform_admins_self_read" on public.platform_admins;
create policy "platform_admins_self_read"
  on public.platform_admins for select
  using (user_id = (select auth.uid()));

alter table public.organization_billing enable row level security;

drop policy if exists "organization_billing_platform_admin" on public.organization_billing;
create policy "organization_billing_platform_admin"
  on public.organization_billing for all
  using (public.platform_is_admin())
  with check (public.platform_is_admin());

alter table public.platform_layout_presets enable row level security;

drop policy if exists "platform_layout_presets_all" on public.platform_layout_presets;
create policy "platform_layout_presets_all"
  on public.platform_layout_presets for all
  using (public.platform_is_admin() and user_id = (select auth.uid()))
  with check (public.platform_is_admin() and user_id = (select auth.uid()));

comment on table public.platform_admins is 'Global platform operators; insert user_id manually after first signup.';
comment on table public.organization_billing is 'Optional per-tenant billing; surfaced in platform admin dashboard.';
comment on table public.platform_layout_presets is 'Saved UI lab presets for platform admins (layout/style experiments).';

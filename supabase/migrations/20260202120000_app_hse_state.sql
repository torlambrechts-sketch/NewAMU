-- HSE-modul: én JSON-rad per miljø (utvid med org_id senere)
create table if not exists public.app_hse_state (
  id text primary key default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.app_hse_state is 'Synkron HSE-tilstand (vernerunder, inspeksjoner, inspeksjonsmodul m.m.) — styres fra klient via Supabase.';

create index if not exists app_hse_state_updated_at_idx on public.app_hse_state (updated_at desc);

alter table public.app_hse_state enable row level security;

-- Utvikling: tillat les/skriv med anon key. STRAM INN i produksjon (authenticated + org policies).
create policy "app_hse_state_select"
  on public.app_hse_state for select
  using (true);

create policy "app_hse_state_insert"
  on public.app_hse_state for insert
  with check (true);

create policy "app_hse_state_update"
  on public.app_hse_state for update
  using (true)
  with check (true);

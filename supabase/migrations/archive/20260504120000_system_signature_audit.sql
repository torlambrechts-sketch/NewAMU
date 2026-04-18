-- Level 1 system signature audit: intent + auth.uid + document hash + optional client IP.
-- Immutable insert-only from app at sign time; Level 2 (BankID/QES) is a separate roadmap track.

create table if not exists public.system_signature_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  action text not null,
  document_hash_sha256 text not null,
  signer_display_name text not null,
  role text,
  client_ip text,
  created_at timestamptz not null default now()
);

create index if not exists system_signature_events_org_created_idx
  on public.system_signature_events (organization_id, created_at desc);

create index if not exists system_signature_events_org_resource_idx
  on public.system_signature_events (organization_id, resource_type, resource_id);

comment on table public.system_signature_events is
  'Append-only audit of level-1 system signatures (SHA-256 over canonical JSON). Not QES/BankID.';

alter table public.system_signature_events enable row level security;

create policy system_signature_events_select_org
  on public.system_signature_events
  for select
  to authenticated
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
    )
  );

create policy system_signature_events_insert_self
  on public.system_signature_events
  for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and user_id = auth.uid()
  );

-- No update/delete — legal audit immutability at app layer; RLS has no policies for them.

grant select, insert on public.system_signature_events to authenticated;

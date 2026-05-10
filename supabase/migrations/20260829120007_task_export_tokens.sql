-- Task export tokens — tidsbegrenset revisortilgang til prosjektpakke.
--
-- Coverage gap closed:
--   Revisor og tilsynsmyndighet trenger tidsbegrenset, autentiseringsfri
--   tilgang til et prosjekts dokumentasjon (oppgaver + bevis + signaturer).
--   task_export_tokens utsteder et tilfeldig token (256-bit hex) som gir
--   30-dagers lese-tilgang til én prosjektpakke — uten å eksponere
--   resten av organisasjonens data.
--
-- Self-audit (Arbeidstilsynet POV):
--   IK-f § 5 nr. 1 og AML § 18-6 (tilsynsmyndighetens adgang) krever
--   at virksomheten kan dokumentere internkontrollarbeid på forespørsel.
--   Token-mekanismen gir en kontrollert, sporbar delingskanal:
--     - Token er engangsgenerert og ugjenkallelig (revoked_at)
--     - 30-dagers utløp minimerer eksponering
--     - Alle token-opprettelser loggføres med created_by og created_at
--   Restrisiko: token-URL kan videresendes; det finnes ingen
--   autentiseringssjekk på mottaker. Virksomheten er ansvarlig for
--   sikker distribusjon av URL-en.

set local search_path = public, pg_catalog;

create table if not exists public.task_export_tokens (
  id              uuid primary key default gen_random_uuid(),
  -- 256-bit tilfeldig token (hex-kodet) — brukes i URL-en
  -- Two gen_random_uuid() calls concatenated give 256 bits of randomness
  -- without requiring the pgcrypto extension.
  token           text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id      uuid not null references public.task_projects (id) on delete cascade,
  pack            public.task_pack not null,
  expires_at      timestamptz not null default (now() + interval '30 days'),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Tilbakekalling: sett revoked_at for å ugyldiggjøre token
  revoked_at      timestamptz,
  check (revoked_at is null or revoked_at >= created_at)
);

create index if not exists task_export_tokens_token_idx
  on public.task_export_tokens (token)
  where revoked_at is null;

create index if not exists task_export_tokens_project_idx
  on public.task_export_tokens (project_id, created_at desc);

-- Tokens er ikke org-scoped for select (leses av uautentisert klient via token)
alter table public.task_export_tokens enable row level security;

-- Autentiserte brukere kan lese tokens for sin org (admin-visning)
drop policy if exists task_export_tokens_select_org on public.task_export_tokens;
create policy task_export_tokens_select_org
  on public.task_export_tokens for select
  using (organization_id = public.current_org_id());

drop policy if exists task_export_tokens_write_org on public.task_export_tokens;
create policy task_export_tokens_write_org
  on public.task_export_tokens for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

create or replace function public.task_export_tokens_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists task_export_tokens_before_insert_defaults_tg on public.task_export_tokens;
create trigger task_export_tokens_before_insert_defaults_tg
  before insert on public.task_export_tokens
  for each row execute function public.task_export_tokens_before_insert_defaults();

-- ── RPC: generer token for prosjekt ──────────────────────────────────────

create or replace function public.generate_task_export_token(
  p_project_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text;
  v_project public.task_projects%rowtype;
begin
  select * into v_project
  from public.task_projects
  where id = p_project_id
    and organization_id = public.current_org_id()
    and deleted_at is null;

  if not found then
    raise exception 'Project not found or access denied';
  end if;

  insert into public.task_export_tokens (
    organization_id, project_id, pack, created_by
  ) values (
    v_project.organization_id,
    p_project_id,
    v_project.pack,
    auth.uid()
  )
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.generate_task_export_token(uuid) from public, anon;
grant execute on function public.generate_task_export_token(uuid)
  to authenticated;

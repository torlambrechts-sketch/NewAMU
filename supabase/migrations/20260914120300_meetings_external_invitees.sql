-- Meetings · external invitees with secure one-time link (L8).
--
-- Why
--   AML doesn't formally restrict who attends AMU; in practice
--   Arbeidstilsynet inspectors, ekstern tillitsvalgt (LO/NHO), and BHT-
--   guest speakers join meetings without org user accounts. We need a
--   token-gated read/speak access path that doesn't pollute the org's
--   permission graph.
--
--   secure_token is the random tail of an opaque URL (klr.no/m/<token>);
--   used_at marks first redemption (prevents share-link abuse); expires_at
--   defaults to the meeting end + 7 days for protocol access.
--
-- Self-audit (Arbeidstilsynet POV)
--   Privacy: external invitees see only meeting metadata + agenda + their
--   own attendance row. They never see confidentiality_level='restricted'
--   meetings unless the chair explicitly granted access.

set local search_path = public, pg_catalog;

create table if not exists public.meeting_external_invitees (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null references public.meetings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  email           text,
  org_affiliation text,
  role            text,
  access_level    text not null default 'observer'
                  check (access_level in ('observer','speak','vote')),
  secure_token    text not null unique,
  expires_at      timestamptz,
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid
);

create index if not exists meeting_external_invitees_meeting_idx
  on public.meeting_external_invitees (meeting_id);
create index if not exists meeting_external_invitees_token_idx
  on public.meeting_external_invitees (secure_token);

comment on table public.meeting_external_invitees is
  'External (non-user) meeting participants reached via secure one-time link. Token-gated read access at /meetings/external/<token>.';

alter table public.meeting_external_invitees enable row level security;

drop policy if exists meeting_external_invitees_select on public.meeting_external_invitees;
create policy meeting_external_invitees_select
  on public.meeting_external_invitees
  for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists meeting_external_invitees_write on public.meeting_external_invitees;
create policy meeting_external_invitees_write
  on public.meeting_external_invitees
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

-- ── Stakeholder digest recipients (L11) ───────────────────────────────────

create table if not exists public.meeting_digest_recipients (
  id                 uuid primary key default gen_random_uuid(),
  meeting_id         uuid not null references public.meetings(id) on delete cascade,
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  -- Free-form display label (e.g. "Alle ansatte", "Styret", "Avd Prod").
  name               text not null,
  -- Filter that resolves to recipients. Shape is module-defined; consumer
  -- edge function resolves at send time.
  recipient_filter   jsonb not null default '{}'::jsonb,
  -- 'full' (whole protocol) | 'decisions_only' (kun vedtak)
  extract_mode       text not null default 'full'
                     check (extract_mode in ('full','decisions_only')),
  default_selected   boolean not null default false,
  sent_at            timestamptz,
  sent_count         integer not null default 0,
  law_ref            text,
  created_at         timestamptz not null default now()
);

create index if not exists meeting_digest_recipients_meeting_idx
  on public.meeting_digest_recipients (meeting_id);

comment on table public.meeting_digest_recipients is
  'Post-signing distribution list — filtered recipients for the protocol digest. Reuses send-meeting-invites (or a dedicated edge fn) for actual dispatch.';

alter table public.meeting_digest_recipients enable row level security;

drop policy if exists meeting_digest_recipients_select on public.meeting_digest_recipients;
create policy meeting_digest_recipients_select
  on public.meeting_digest_recipients
  for select
  to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists meeting_digest_recipients_write on public.meeting_digest_recipients;
create policy meeting_digest_recipients_write
  on public.meeting_digest_recipients
  for all
  to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  )
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

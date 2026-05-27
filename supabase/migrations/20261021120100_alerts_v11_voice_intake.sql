-- Alerts v1.1 — alert_voice_intake (voice-message intake).
--
-- A reporter can record a voice message via MediaRecorder API. The audio
-- file is uploaded to alert-attachments under <org>/voice/<draft_id>/...
-- and optionally transcribed via OpenAI Whisper on opt-in. The transcript
-- is encrypted with the org DEK and lives here.
--
-- Self-audit:
--   * AML § 2A-7 (5) — voice carries identity (pitch, accent). Storage is
--     private, signed-URL TTL = 60 s; transcript encrypted at rest.
--   * GDPR Art. 5 (1) (c) — file purged on case purge / draft expiry.
--
-- Idempotent.

set local search_path = public, pg_catalog;

create table if not exists public.alert_voice_intake (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid references public.alert_cases (id) on delete cascade,
  draft_id        uuid references public.alert_intake_draft (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_bucket  text not null default 'alert-attachments',
  storage_path    text,
  duration_seconds integer,
  transcript_encrypted bytea,
  transcript_key_version integer,
  transcription_status text not null default 'not_requested'
    check (transcription_status in ('not_requested','queued','processing','completed','failed','disabled')),
  transcription_error text,
  created_at      timestamptz not null default now(),
  check (case_id is not null or draft_id is not null)
);

create index if not exists alert_voice_intake_case_idx
  on public.alert_voice_intake (case_id) where case_id is not null;

create index if not exists alert_voice_intake_draft_idx
  on public.alert_voice_intake (draft_id) where draft_id is not null;

alter table public.alert_voice_intake enable row level security;

-- Reads: case-access list members (when bound to a case); never readable
-- when only bound to a draft (only the reporter with the access_key + the
-- SECURITY DEFINER RPC can fetch).
drop policy if exists alert_voice_intake_select on public.alert_voice_intake;
create policy alert_voice_intake_select
  on public.alert_voice_intake for select
  to authenticated
  using (
    case_id is not null
    and exists (
      select 1 from public.alert_cases c
      where c.id = case_id
        and c.organization_id = public.current_org_id()
    )
  );

-- Inserts: SECURITY DEFINER RPC only (called from edge function).
drop policy if exists alert_voice_intake_block_insert on public.alert_voice_intake;
create policy alert_voice_intake_block_insert
  on public.alert_voice_intake for insert
  with check (false);

-- Bind draft FK on intake_draft now that voice_intake exists.
alter table public.alert_intake_draft
  drop constraint if exists alert_intake_draft_voice_fk;
alter table public.alert_intake_draft
  add constraint alert_intake_draft_voice_fk
    foreign key (voice_intake_id) references public.alert_voice_intake (id) on delete set null
    deferrable initially deferred;

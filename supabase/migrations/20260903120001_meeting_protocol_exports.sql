-- Meetings — protocol exports + content checksum.
--
-- Why (closes ROADMAP §8.21)
--   The print-friendly /meetings/:id/eksport route renders an auditor-
--   facing HTML protocol on demand. For Arbeidstilsynet inspections that
--   demand tamper-evident exports beyond the protocol-lock + signature
--   trail, we need a deterministic content hash that proves the export
--   matches what was signed.
--
--   Approach: at protocol_signed_at we serialize the canonical protocol
--   payload (meeting + agenda items + attendees + decisions + action
--   items + signatures, sorted by id) into JSON, compute sha256 over the
--   UTF-8 bytes, and persist {payload, hash, computed_at} as a single
--   immutable row in `meeting_protocol_exports`. Storage of the rendered
--   PDF itself remains optional/client-side — the hash is over the JSON
--   source of truth, not the rendered output, which keeps the contract
--   storage-agnostic.
--
-- Schema
--   meeting_protocol_exports(
--     id, meeting_id (unique), payload jsonb, payload_sha256 text(64),
--     computed_at, computed_by, sign_checksum (FK shadow of meetings)
--   )
--
-- Trigger
--   No automatic trigger — payload composition is best done client-side
--   where the resolver already knows the full picture. The client calls
--   `meetings.computeAndStoreProtocolChecksum(meetingId)` at sign-time.
--   The migration ships the schema + RLS only.
--
-- Idempotence: CREATE TABLE IF NOT EXISTS.

set local search_path = public, pg_catalog;

create table if not exists public.meeting_protocol_exports (
  id              uuid primary key default gen_random_uuid(),
  meeting_id      uuid not null unique
                    references public.meetings (id) on delete cascade,
  payload         jsonb not null,
  payload_sha256  text not null
                    check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  computed_at     timestamptz not null default now(),
  computed_by     uuid references public.organization_members (id) on delete set null,
  -- Snapshot of meetings.sign_checksum at write time, so a re-issued
  -- export can be cross-checked against the signature trail.
  sign_checksum_at_write text
);

create index if not exists meeting_protocol_exports_meeting_idx
  on public.meeting_protocol_exports (meeting_id);

alter table public.meeting_protocol_exports enable row level security;

drop policy if exists meeting_protocol_exports_select on public.meeting_protocol_exports;
create policy meeting_protocol_exports_select
  on public.meeting_protocol_exports for select
  using (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

-- Append-only for sanity: only INSERT permitted by clients; UPDATE/DELETE
-- block at policy-level (we want the export to be immutable once written).
-- Re-issuing means a new row with computed_at > previous.
drop policy if exists meeting_protocol_exports_insert on public.meeting_protocol_exports;
create policy meeting_protocol_exports_insert
  on public.meeting_protocol_exports for insert
  with check (
    exists (select 1 from public.meetings m where m.id = meeting_id)
  );

-- We do NOT enable UPDATE or DELETE policies — RLS denies by default, so
-- attempts to mutate an export will fail with "new row violates row-level
-- security". The unique constraint on meeting_id (PER ROW above) prevents
-- duplicate exports per meeting at the schema level; clients must delete
-- the row to re-issue, which RLS also blocks. To re-issue, drop the
-- constraint or relax this policy in a future migration.

comment on table public.meeting_protocol_exports is
  'Immutable export record for a signed meeting protocol. payload_sha256 is the canonical content fingerprint.';
comment on column public.meeting_protocol_exports.payload is
  'Canonical JSON of meeting + agenda + attendees + decisions + actions + signatures, with sort-stable child ordering. Source of truth for the sha256.';
comment on column public.meeting_protocol_exports.payload_sha256 is
  'Hex sha256 of UTF-8 bytes of payload (JSON.stringify with sorted child arrays). Auditors can re-compute against the rendered protocol.';

-- ─── Verification ────────────────────────────────────────────────────────
-- After client-side compute + insert:
--   select meeting_id, payload_sha256, computed_at
--     from public.meeting_protocol_exports order by computed_at desc limit 5;
--
-- Re-issue attempt (should fail):
--   delete from public.meeting_protocol_exports where meeting_id = '...';
--   → RLS: "new row violates row-level security policy" — append-only.

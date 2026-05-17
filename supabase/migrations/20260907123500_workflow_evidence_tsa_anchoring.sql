-- workflow_evidence_anchors: external TSA anchoring for the Merkle chain.
--
-- The internal hash-chain (workflow_run_evidence.chain_root_checksum) gives
-- tamper-evidence WITHIN the tenant, but to upgrade it to legally-binding
-- evidence the chain root must be anchored to an external Trust Service
-- Provider (RFC 3161 Time-Stamping Authority) at least monthly. Without
-- this, an attacker with service-role access could rewrite the entire
-- chain and the tenant has no way to prove the original state.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 32 (integritet — sikker
--   integritetsbeskyttelse forutsetter ekstern ankerpunkt),
--   Arkivforskriften § 7 (autentisitet / integritet av elektronisk
--   arkivverdig materiale over tid), eIDAS / Trust Services Regulation
--   (qualified electronic time stamp som rettslig bevis i tilsyn og
--   tvister). Riksrevisjon-blocker: uten dette er sjekkjeden "yellow" —
--   selv-erklært, ikke verifiserbart eksternt.
--   Restrisiko deferred: faktisk vendor-integrasjon (Buypass / DigiCert /
--   Difi-TSA) krever leverandørkontrakt og signert avtale. Substrate her
--   leverer pending-anker som STUB-signeres lokalt; produksjonsignering
--   bytter inn ekte RFC 3161-endpoint via TSA_<PROVIDER>_URL env var.

set local search_path = public, pg_catalog;

create extension if not exists pgcrypto with schema public;

-- ─── 1. workflow_evidence_anchors ──────────────────────────────────────────
-- One row per (org or platform-global, chain_key or "all chains",
-- period). The merkle_root_sha256 is sha256 over sorted concatenation of
-- chain_root_checksum values from workflow_run_evidence rows in the
-- period — see workflow_compose_evidence_anchor for the exact algorithm.
-- Once status flips to 'signed' / 'verified' / 'archived', the row is
-- immutable (enforced by trigger).

create table if not exists public.workflow_evidence_anchors (
  id                      uuid primary key default gen_random_uuid(),
  -- NULL = "platform-global anchor" (cross-org Merkle root, future feature).
  organization_id         uuid references public.organizations(id) on delete cascade,
  -- NULL = "all chains in (org, period)" — the common monthly fan-out.
  chain_key               text,
  period_start            timestamptz not null,
  period_end              timestamptz not null,
  merkle_root_sha256      text not null,
  evidence_count          int not null default 0,
  tsa_provider            text check (tsa_provider is null or tsa_provider in (
                            'buypass', 'digicert', 'difi', 'manual'
                          )),
  tsa_token               bytea,
  tsa_token_storage_path  text,
  tsa_signed_at           timestamptz,
  tsa_serial_number       text,
  status                  text not null default 'pending'
                          check (status in (
                            'pending', 'signed', 'verified', 'failed', 'archived'
                          )),
  failure_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- Idempotency: one anchor per (org, chain_key, period_start, period_end).
  -- Note: NULLs in chain_key are NOT distinct under default unique semantics,
  -- so we use coalesce'd unique expression index instead.
  constraint workflow_evidence_anchors_period_chk
    check (period_end > period_start)
);

-- Unique on (coalesce(org, '00..0'), coalesce(chain_key,''), period_start,
-- period_end) so multiple NULL chain_keys aren't treated as distinct.
create unique index if not exists workflow_evidence_anchors_uniq_idx
  on public.workflow_evidence_anchors (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(chain_key, '__all__'),
    period_start,
    period_end
  );

create index if not exists workflow_evidence_anchors_org_idx
  on public.workflow_evidence_anchors (organization_id, period_end desc);

create index if not exists workflow_evidence_anchors_status_idx
  on public.workflow_evidence_anchors (status, period_end desc);

comment on table public.workflow_evidence_anchors is
  'External TSA anchors over the workflow_run_evidence Merkle chain. One row per (org, chain_key, period). Immutable once status leaves pending. GDPR Art. 32, Arkivforskriften § 7, eIDAS.';

comment on column public.workflow_evidence_anchors.organization_id is
  'NULL = platform-global anchor (cross-org root). Org-scoped anchors are the common case; the global anchor is reserved for future composite-Merkle features.';

comment on column public.workflow_evidence_anchors.chain_key is
  'NULL = "anchor every chain head as of period_end" (sorted concatenation of all chain_root_checksums for the org in the period). Specific chain_key narrows the anchor to a single rule/system-event chain.';

comment on column public.workflow_evidence_anchors.merkle_root_sha256 is
  'sha256 over the sorted concatenation of chain_root_checksum values from workflow_run_evidence rows matching (organization_id, [chain_key]) with created_at in [period_start, period_end). Hex-encoded.';

comment on column public.workflow_evidence_anchors.tsa_token is
  'RFC 3161 TimeStampToken (DER-encoded). For long tokens, the body is stored in Storage at tsa_token_storage_path and this column is left null.';

-- ─── 2. workflow_evidence_anchor_builds — append-only build log ────────────

create table if not exists public.workflow_evidence_anchor_builds (
  id          uuid primary key default gen_random_uuid(),
  anchor_id   uuid not null references public.workflow_evidence_anchors(id) on delete cascade,
  phase       text not null check (phase in ('compose', 'sign', 'verify', 'archive')),
  status      text not null check (status in ('success', 'failed')),
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists workflow_evidence_anchor_builds_anchor_idx
  on public.workflow_evidence_anchor_builds (anchor_id, created_at desc);

comment on table public.workflow_evidence_anchor_builds is
  'Append-only build log for workflow_evidence_anchors. One row per phase transition (compose/sign/verify/archive) with success or failure detail. Service-role writes only.';

-- ─── 3. updated_at trigger on anchors ──────────────────────────────────────

create or replace function public.trg_workflow_evidence_anchors_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists workflow_evidence_anchors_set_updated_at on public.workflow_evidence_anchors;
create trigger workflow_evidence_anchors_set_updated_at
  before update on public.workflow_evidence_anchors
  for each row execute function public.trg_workflow_evidence_anchors_set_updated_at();

-- ─── 4. Immutability triggers ─────────────────────────────────────────────
-- Once status flips out of 'pending', the row is locked. Even service-role
-- can only flip status forward (pending → signed → verified → archived);
-- DELETE is denied unconditionally for non-pending rows.

create or replace function public.trg_workflow_evidence_anchors_immutable()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('signed', 'verified', 'archived') then
      raise exception 'workflow_evidence_anchors: row % is %; delete denied (immutable)',
        old.id, old.status using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Once signed/verified/archived, only certain columns may transition.
    if old.status in ('signed', 'verified', 'archived')
       and (
            new.merkle_root_sha256 is distinct from old.merkle_root_sha256
         or new.period_start       is distinct from old.period_start
         or new.period_end         is distinct from old.period_end
         or new.evidence_count     is distinct from old.evidence_count
         or new.chain_key          is distinct from old.chain_key
         or new.organization_id    is distinct from old.organization_id
         or new.tsa_token          is distinct from old.tsa_token
         or new.tsa_signed_at      is distinct from old.tsa_signed_at
         or new.tsa_serial_number  is distinct from old.tsa_serial_number
       )
    then
      raise exception 'workflow_evidence_anchors: row % is %; core fields are immutable',
        old.id, old.status using errcode = '42501';
    end if;
    -- Forward-only status transition.
    if old.status = 'archived' and new.status <> 'archived' then
      raise exception 'workflow_evidence_anchors: archived rows cannot be transitioned';
    end if;
    if old.status = 'verified' and new.status not in ('verified', 'archived') then
      raise exception 'workflow_evidence_anchors: verified can only transition to archived';
    end if;
    if old.status = 'signed' and new.status not in ('signed', 'verified', 'archived', 'failed') then
      raise exception 'workflow_evidence_anchors: signed can only transition to verified/archived/failed';
    end if;
    return new;
  end if;
  return new;
end;
$$;

drop trigger if exists workflow_evidence_anchors_immutable on public.workflow_evidence_anchors;
create trigger workflow_evidence_anchors_immutable
  before update or delete on public.workflow_evidence_anchors
  for each row execute function public.trg_workflow_evidence_anchors_immutable();

-- Build log is strictly append-only.
create or replace function public.trg_workflow_evidence_anchor_builds_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'workflow_evidence_anchor_builds is append-only; row % cannot be updated', old.id;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'workflow_evidence_anchor_builds is append-only; row % cannot be deleted', old.id;
  end if;
  return null;
end;
$$;

drop trigger if exists workflow_evidence_anchor_builds_no_update on public.workflow_evidence_anchor_builds;
create trigger workflow_evidence_anchor_builds_no_update
  before update on public.workflow_evidence_anchor_builds
  for each row execute function public.trg_workflow_evidence_anchor_builds_append_only();

drop trigger if exists workflow_evidence_anchor_builds_no_delete on public.workflow_evidence_anchor_builds;
create trigger workflow_evidence_anchor_builds_no_delete
  before delete on public.workflow_evidence_anchor_builds
  for each row execute function public.trg_workflow_evidence_anchor_builds_append_only();

-- ─── 5. RLS ───────────────────────────────────────────────────────────────

alter table public.workflow_evidence_anchors enable row level security;
alter table public.workflow_evidence_anchor_builds enable row level security;

-- SELECT: org members for their org; platform admins see global anchors.
drop policy if exists "workflow_evidence_anchors_select" on public.workflow_evidence_anchors;
create policy "workflow_evidence_anchors_select"
  on public.workflow_evidence_anchors for select
  using (
    organization_id = public.current_org_id()
    or (
      organization_id is null
      and exists (
        select 1 from public.platform_admins pa where pa.user_id = (select auth.uid())
      )
    )
  );

-- All mutation goes through service-role (no permissive insert/update/delete).
drop policy if exists "workflow_evidence_anchors_no_user_write" on public.workflow_evidence_anchors;
create policy "workflow_evidence_anchors_no_user_write"
  on public.workflow_evidence_anchors for insert
  with check (false);

drop policy if exists "workflow_evidence_anchors_no_user_update" on public.workflow_evidence_anchors;
create policy "workflow_evidence_anchors_no_user_update"
  on public.workflow_evidence_anchors for update
  using (false);

drop policy if exists "workflow_evidence_anchors_no_user_delete" on public.workflow_evidence_anchors;
create policy "workflow_evidence_anchors_no_user_delete"
  on public.workflow_evidence_anchors for delete
  using (false);

-- SELECT for the build log mirrors the anchor it belongs to.
drop policy if exists "workflow_evidence_anchor_builds_select" on public.workflow_evidence_anchor_builds;
create policy "workflow_evidence_anchor_builds_select"
  on public.workflow_evidence_anchor_builds for select
  using (
    exists (
      select 1 from public.workflow_evidence_anchors a
       where a.id = workflow_evidence_anchor_builds.anchor_id
         and (
              a.organization_id = public.current_org_id()
           or (
                a.organization_id is null
                and exists (
                  select 1 from public.platform_admins pa
                   where pa.user_id = (select auth.uid())
                )
           )
         )
    )
  );

drop policy if exists "workflow_evidence_anchor_builds_no_user_write" on public.workflow_evidence_anchor_builds;
create policy "workflow_evidence_anchor_builds_no_user_write"
  on public.workflow_evidence_anchor_builds for insert
  with check (false);

-- ─── 6. workflow_compose_evidence_anchor ──────────────────────────────────
-- Composes the merkle_root_sha256 for a period across one org. If
-- p_organization_id is null, composes a platform-global anchor across all
-- orgs (sorted concatenation includes organization_id::text as part of
-- the leaf to avoid cross-org collisions).
--
-- Composition algorithm (v0 — sorted concatenation):
--   leaves := sorted asc by (organization_id::text, chain_key,
--                            created_at, id) of (chain_root_checksum)
--             from workflow_run_evidence where created_at in [period)
--   merkle_root := sha256(concat(leaves))
-- This is simpler than a balanced binary Merkle tree and good enough for
-- the substrate. A future migration can swap in a balanced tree without
-- breaking the stored merkle_root_sha256s — verification re-reads the
-- leaves and applies the same algorithm.

create or replace function public.workflow_compose_evidence_anchor(
  p_period_start    timestamptz,
  p_period_end      timestamptz,
  p_organization_id uuid default null,
  p_chain_key       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_concat   text := '';
  v_count    int  := 0;
  v_root     text;
  v_anchor   uuid;
  v_existing uuid;
begin
  if p_period_start is null or p_period_end is null then
    raise exception 'workflow_compose_evidence_anchor: period_start and period_end are required';
  end if;
  if p_period_end <= p_period_start then
    raise exception 'workflow_compose_evidence_anchor: period_end must be > period_start';
  end if;

  -- Idempotency: re-use the existing anchor for this slot if present.
  select id into v_existing
    from public.workflow_evidence_anchors
   where coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and coalesce(chain_key, '__all__') = coalesce(p_chain_key, '__all__')
     and period_start = p_period_start
     and period_end   = p_period_end
   for update;

  -- Sorted concatenation of leaves. We include organization_id and
  -- chain_key in the leaf when composing a global anchor, so two orgs
  -- with the same chain_root_checksum value can't collide.
  with leaves as (
    select
      e.chain_root_checksum,
      e.organization_id,
      e.chain_key,
      e.created_at,
      e.id
      from public.workflow_run_evidence e
     where e.created_at >= p_period_start
       and e.created_at <  p_period_end
       and (p_organization_id is null or e.organization_id = p_organization_id)
       and (p_chain_key is null or e.chain_key = p_chain_key)
       and e.chain_root_checksum is not null
     order by e.organization_id::text, e.chain_key, e.created_at, e.id
  )
  select
    coalesce(string_agg(
      e.organization_id::text || '|' || e.chain_key || '|' || e.chain_root_checksum,
      E'\n'
      order by e.organization_id::text, e.chain_key, e.created_at, e.id
    ), ''),
    count(*)
    into v_concat, v_count
    from leaves e;

  v_root := encode(public.digest(v_concat, 'sha256'), 'hex');

  if v_existing is not null then
    update public.workflow_evidence_anchors
       set merkle_root_sha256 = v_root,
           evidence_count     = v_count,
           updated_at         = now()
     where id = v_existing
       and status = 'pending';
    -- (immutability trigger blocks the update for non-pending anchors —
    -- in that case we still return the existing id without changing it,
    -- so the caller sees the same anchor.)
    insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
    values (
      v_existing, 'compose', 'success',
      jsonb_build_object(
        'merkle_root_sha256', v_root,
        'evidence_count', v_count,
        'idempotent_reuse', true,
        'period_start', p_period_start,
        'period_end', p_period_end
      )
    );
    return v_existing;
  end if;

  insert into public.workflow_evidence_anchors (
    organization_id, chain_key, period_start, period_end,
    merkle_root_sha256, evidence_count, status
  ) values (
    p_organization_id, p_chain_key, p_period_start, p_period_end,
    v_root, v_count, 'pending'
  )
  returning id into v_anchor;

  insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
  values (
    v_anchor, 'compose', 'success',
    jsonb_build_object(
      'merkle_root_sha256', v_root,
      'evidence_count', v_count,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'organization_id', p_organization_id,
      'chain_key', p_chain_key
    )
  );

  return v_anchor;
end;
$$;

revoke all on function public.workflow_compose_evidence_anchor(timestamptz, timestamptz, uuid, text) from public;
grant execute on function public.workflow_compose_evidence_anchor(timestamptz, timestamptz, uuid, text) to service_role;

comment on function public.workflow_compose_evidence_anchor(timestamptz, timestamptz, uuid, text) is
  'Compose an evidence anchor for a period. Idempotent on (coalesce(org), coalesce(chain_key), period_start, period_end). Sorted-concat Merkle composition (v0); future migrations may swap in a balanced tree — verify re-reads via the same algorithm.';

-- ─── 7. workflow_record_anchor_signed ─────────────────────────────────────
-- Called by the workflow-tsa-anchor edge function once the RFC 3161
-- response is received. Verifies the anchor is still pending, commits
-- the TSA fields, flips status to 'signed'.

create or replace function public.workflow_record_anchor_signed(
  p_anchor_id  uuid,
  p_provider   text,
  p_serial     text,
  p_token_path text,
  p_token      bytea default null,
  p_signed_at  timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status text;
begin
  if p_anchor_id is null then
    raise exception 'workflow_record_anchor_signed: anchor_id is required';
  end if;
  if p_provider not in ('buypass', 'digicert', 'difi', 'manual') then
    raise exception 'workflow_record_anchor_signed: unknown provider %', p_provider
      using errcode = '22023';
  end if;

  select status into v_status
    from public.workflow_evidence_anchors
   where id = p_anchor_id
   for update;

  if v_status is null then
    raise exception 'workflow_record_anchor_signed: anchor % not found', p_anchor_id
      using errcode = '42704';
  end if;
  if v_status <> 'pending' then
    raise exception 'workflow_record_anchor_signed: anchor % is % (must be pending)',
      p_anchor_id, v_status using errcode = '42501';
  end if;

  update public.workflow_evidence_anchors
     set tsa_provider           = p_provider,
         tsa_serial_number      = p_serial,
         tsa_token_storage_path = p_token_path,
         tsa_token              = p_token,
         tsa_signed_at          = p_signed_at,
         status                 = 'signed',
         failure_reason         = null
   where id = p_anchor_id;

  insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
  values (
    p_anchor_id, 'sign', 'success',
    jsonb_build_object(
      'tsa_provider', p_provider,
      'tsa_serial_number', p_serial,
      'tsa_token_storage_path', p_token_path,
      'tsa_signed_at', p_signed_at,
      'token_inline_bytes', case when p_token is null then 0 else octet_length(p_token) end
    )
  );
end;
$$;

revoke all on function public.workflow_record_anchor_signed(uuid, text, text, text, bytea, timestamptz) from public;
grant execute on function public.workflow_record_anchor_signed(uuid, text, text, text, bytea, timestamptz) to service_role;

comment on function public.workflow_record_anchor_signed(uuid, text, text, text, bytea, timestamptz) is
  'Commit RFC 3161 token + serial to a pending anchor. Flips status pending → signed and appends a sign-phase build log row. Service-role only — invoked by the workflow-tsa-anchor edge function after a successful TSA roundtrip.';

-- ─── 8. workflow_record_anchor_failed (helper for the edge fn) ────────────

create or replace function public.workflow_record_anchor_failed(
  p_anchor_id uuid,
  p_reason    text,
  p_detail    jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status text;
begin
  select status into v_status
    from public.workflow_evidence_anchors
   where id = p_anchor_id
   for update;
  if v_status is null then
    raise exception 'workflow_record_anchor_failed: anchor % not found', p_anchor_id;
  end if;
  if v_status not in ('pending', 'signed') then
    raise exception 'workflow_record_anchor_failed: anchor % already %', p_anchor_id, v_status;
  end if;
  update public.workflow_evidence_anchors
     set status = 'failed', failure_reason = p_reason
   where id = p_anchor_id;
  insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
  values (
    p_anchor_id,
    case when v_status = 'pending' then 'sign' else 'verify' end,
    'failed',
    coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('reason', p_reason)
  );
end;
$$;

revoke all on function public.workflow_record_anchor_failed(uuid, text, jsonb) from public;
grant execute on function public.workflow_record_anchor_failed(uuid, text, jsonb) to service_role;

comment on function public.workflow_record_anchor_failed(uuid, text, jsonb) is
  'Mark an anchor as failed and record the reason. Used by the TSA edge function when the provider rejects or times out.';

-- ─── 9. workflow_verify_anchor ────────────────────────────────────────────
-- Re-reads the leaves for an anchor's (org, chain_key, period) and
-- re-computes the merkle_root_sha256. If the recomputed root matches the
-- stored value, status → 'verified' and a verify-success row is appended
-- to the build log. If it does not, a critical compliance_notifications
-- row is fanned out to org admins (or platform admins for global
-- anchors) and the anchor is flipped to 'failed'.

create or replace function public.workflow_verify_anchor(p_anchor_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_anchor      public.workflow_evidence_anchors;
  v_concat      text := '';
  v_count       int  := 0;
  v_recomputed  text;
  v_match       boolean;
  v_admin       record;
  v_key         text;
begin
  select * into v_anchor
    from public.workflow_evidence_anchors
   where id = p_anchor_id
   for update;
  if v_anchor.id is null then
    raise exception 'workflow_verify_anchor: anchor % not found', p_anchor_id
      using errcode = '42704';
  end if;

  -- Recompose the leaves using the same algorithm as compose.
  with leaves as (
    select
      e.chain_root_checksum,
      e.organization_id,
      e.chain_key,
      e.created_at,
      e.id
      from public.workflow_run_evidence e
     where e.created_at >= v_anchor.period_start
       and e.created_at <  v_anchor.period_end
       and (v_anchor.organization_id is null or e.organization_id = v_anchor.organization_id)
       and (v_anchor.chain_key is null or e.chain_key = v_anchor.chain_key)
       and e.chain_root_checksum is not null
     order by e.organization_id::text, e.chain_key, e.created_at, e.id
  )
  select
    coalesce(string_agg(
      e.organization_id::text || '|' || e.chain_key || '|' || e.chain_root_checksum,
      E'\n'
      order by e.organization_id::text, e.chain_key, e.created_at, e.id
    ), ''),
    count(*)
    into v_concat, v_count
    from leaves e;

  v_recomputed := encode(public.digest(v_concat, 'sha256'), 'hex');
  v_match := v_recomputed = v_anchor.merkle_root_sha256;

  insert into public.workflow_evidence_anchor_builds (anchor_id, phase, status, detail)
  values (
    p_anchor_id, 'verify',
    case when v_match then 'success' else 'failed' end,
    jsonb_build_object(
      'stored_root', v_anchor.merkle_root_sha256,
      'recomputed_root', v_recomputed,
      'evidence_count_stored', v_anchor.evidence_count,
      'evidence_count_now', v_count,
      'match', v_match
    )
  );

  if v_match then
    -- Forward-transition: signed → verified; pending stays pending until
    -- TSA actually signs; archived stays archived.
    if v_anchor.status = 'signed' then
      update public.workflow_evidence_anchors
         set status = 'verified'
       where id = p_anchor_id;
    end if;
    return true;
  end if;

  -- MISMATCH — chain has been tampered with or evidence rows have been
  -- added since signing (which itself is suspicious for a signed anchor).
  update public.workflow_evidence_anchors
     set status = 'failed',
         failure_reason = format(
           'Merkle root mismatch on verify (stored=%s recomputed=%s evidence_count_stored=%s evidence_count_now=%s)',
           v_anchor.merkle_root_sha256, v_recomputed,
           v_anchor.evidence_count, v_count
         )
   where id = p_anchor_id;

  -- Critical fan-out — org admins for org-scoped anchors, platform
  -- admins for global anchors.
  if v_anchor.organization_id is not null then
    for v_admin in
      select id as user_id from public.profiles
       where organization_id = v_anchor.organization_id
         and is_org_admin = true
    loop
      v_key := 'wf:anchor-mismatch:' || p_anchor_id::text || ':' || v_admin.user_id::text;
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, severity,
        title, body, notification_key, payload
      ) values (
        v_anchor.organization_id, v_admin.user_id,
        'workflow_gov_action', 'critical',
        'Bevis-anker tukling oppdaget',
        format(
          'Et TSA-anker over bevis-kjeden for perioden %s–%s gir ikke samme Merkle-rot ved gjenkomputering. Dette kan tyde på at bevis-rader er blitt endret eller fjernet etter signering.',
          v_anchor.period_start, v_anchor.period_end
        ),
        v_key,
        jsonb_build_object(
          'anchor_id', p_anchor_id,
          'stored_root', v_anchor.merkle_root_sha256,
          'recomputed_root', v_recomputed,
          'period_start', v_anchor.period_start,
          'period_end', v_anchor.period_end
        )
      )
      on conflict (recipient_user_id, notification_key) do nothing;
    end loop;
  else
    -- Global anchor → platform admins.
    for v_admin in
      select pa.user_id from public.platform_admins pa
    loop
      v_key := 'wf:anchor-mismatch-global:' || p_anchor_id::text || ':' || v_admin.user_id::text;
      -- compliance_notifications requires non-null organization_id, so
      -- we attach the platform admin's own organization_id (best-effort)
      -- if they have one; otherwise we skip the in-app fan-out and rely
      -- on the build log + observability.
      insert into public.compliance_notifications (
        organization_id, recipient_user_id, category, severity,
        title, body, notification_key, payload
      )
      select
        p.organization_id, v_admin.user_id,
        'workflow_gov_action', 'critical',
        'Platform-anker tukling oppdaget',
        format(
          'Platform-globalt TSA-anker for perioden %s–%s gir ikke samme Merkle-rot ved gjenkomputering.',
          v_anchor.period_start, v_anchor.period_end
        ),
        v_key,
        jsonb_build_object(
          'anchor_id', p_anchor_id,
          'stored_root', v_anchor.merkle_root_sha256,
          'recomputed_root', v_recomputed
        )
        from public.profiles p
       where p.id = v_admin.user_id
         and p.organization_id is not null
      on conflict (recipient_user_id, notification_key) do nothing;
    end loop;
  end if;

  return false;
end;
$$;

revoke all on function public.workflow_verify_anchor(uuid) from public;
grant execute on function public.workflow_verify_anchor(uuid) to authenticated;
grant execute on function public.workflow_verify_anchor(uuid) to service_role;

comment on function public.workflow_verify_anchor(uuid) is
  'Re-compute the Merkle root for an anchor and compare against the stored value. On match, flips signed → verified; on mismatch, sets status=failed and fans out a critical workflow_gov_action notification to org admins (or platform admins for global anchors). Callable by authenticated org members so the UI "Verifiser nå" button works without elevating to service-role.';

-- ─── 10. Monthly compose-and-fan-out cron ─────────────────────────────────
-- Composes the prior calendar month's anchors per org and a single
-- global anchor (organization_id = NULL).

create or replace function public.workflow_monthly_anchor_compose()
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_count        int := 0;
  v_org          record;
  v_anchor_id    uuid;
  v_url          text;
  v_key          text;
begin
  -- Prior calendar month: [first of last month, first of this month).
  v_period_end   := date_trunc('month', now());
  v_period_start := v_period_end - interval '1 month';

  -- Global anchor (organization_id is null) — covers cross-org root.
  begin
    v_anchor_id := public.workflow_compose_evidence_anchor(
      v_period_start, v_period_end, null::uuid, null::text
    );
    v_count := v_count + 1;
  exception when others then
    raise notice 'workflow_monthly_anchor_compose: global compose failed: %', sqlerrm;
  end;

  -- Per-org anchors — only orgs that have any evidence in the period.
  for v_org in
    select distinct e.organization_id
      from public.workflow_run_evidence e
     where e.created_at >= v_period_start
       and e.created_at <  v_period_end
  loop
    begin
      v_anchor_id := public.workflow_compose_evidence_anchor(
        v_period_start, v_period_end, v_org.organization_id, null::text
      );
      v_count := v_count + 1;
    exception when others then
      raise notice 'workflow_monthly_anchor_compose: org % compose failed: %',
        v_org.organization_id, sqlerrm;
    end;
  end loop;

  -- Best-effort kick the TSA edge function to start signing the pending
  -- anchors. If pg_net is unavailable or the env vars aren't set, the
  -- edge function will be invoked by an external scheduler or manually.
  begin
    v_url := current_setting('app.supabase_url', true);
    v_key := current_setting('app.supabase_service_role_key', true);
  exception when others then
    v_url := null; v_key := null;
  end;

  if v_url is not null and v_key is not null
     and exists (select 1 from pg_extension where extname = 'pg_net')
  then
    -- Fan-out per pending anchor: POST one request per anchor so the
    -- edge function can be horizontally scaled later.
    for v_org in
      select id as anchor_id, organization_id
        from public.workflow_evidence_anchors
       where status = 'pending'
         and period_start = v_period_start
         and period_end   = v_period_end
    loop
      begin
        perform net.http_post(
          url := v_url || '/functions/v1/workflow-tsa-anchor',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || v_key,
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'anchor_id', v_org.anchor_id,
            'organization_id', v_org.organization_id
          )
        );
      exception when others then
        raise notice 'workflow_monthly_anchor_compose: pg_net post failed for anchor %: %',
          v_org.anchor_id, sqlerrm;
      end;
    end loop;
  else
    raise notice 'workflow_monthly_anchor_compose: pg_net/app.supabase_url unavailable — anchors composed but not auto-signed. Invoke workflow-tsa-anchor edge fn manually per anchor_id.';
  end if;

  return v_count;
end;
$$;

revoke all on function public.workflow_monthly_anchor_compose() from public;
grant execute on function public.workflow_monthly_anchor_compose() to service_role;

comment on function public.workflow_monthly_anchor_compose() is
  'Monthly entry point. Composes anchors for the prior calendar month (one global + one per org with any evidence) and best-effort kicks the workflow-tsa-anchor edge function via pg_net. Idempotent: repeats no-op into existing pending anchors.';

-- ─── 11. pg_cron schedule — first day of month 02:00 UTC ──────────────────

do $cron$
declare r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job where jobname = 'workflow_monthly_anchor_compose')
    loop perform cron.unschedule(r.jobid); end loop;
    perform cron.schedule(
      'workflow_monthly_anchor_compose',
      '0 2 1 * *',
      $cmd$select public.workflow_monthly_anchor_compose();$cmd$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end
$cron$;

do $$
begin
  raise notice 'workflow_evidence_anchors substrate installed. STUB-mode TSA signer active until TSA_<PROVIDER>_URL is set on the workflow-tsa-anchor edge function.';
end
$$;

-- TSA evidence anchoring — accept 'stub' as a provider value.
--
-- _123500_workflow_evidence_tsa_anchoring constrained tsa_provider to
-- ('buypass','digicert','difi','manual'). The edge-fn tsa.ts STUB mode
-- builds synthetic tokens with serial 'STUB-…' but cannot persist the
-- fact-of-stubbing in the anchor row because 'stub' isn't a permitted
-- value. Operators have to reverse-engineer the stub-vs-real distinction
-- from serial-prefix strings — not auditable.
--
-- Fix:
--   1. Extend the check constraint to include 'stub'.
--   2. Add a view workflow_evidence_anchors_stub_count for operator
--      monitoring (count of stub-signed anchors per org). The fn-side
--      change to write 'stub' is in supabase/functions/_shared/tsa.ts
--      (separate edit in this same PR).
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: arkivforskriften § 7 — kvalifisert tids-
--   stempel skal være etterprøvbart. En anchor som påstår å være signert
--   av 'buypass' men er reelt STUB-token er falsk attestering — vi må
--   kunne markere det eksplisitt i metadataen. eIDAS Art. 41 (kvalifisert
--   timestamp er bevisst kvalifisert; ikke-kvalifisert må merkes).
--   Restrisiko deferred: en operatør kan fortsatt sette tsa_provider
--   manuelt til 'buypass' via service_role. Aksept: service_role-tilgang
--   er allerede et kompromittert utgangspunkt.

set local search_path = public, pg_catalog;

-- ── 1. Drop existing check + recreate with 'stub' included ──────────────
do $$
declare
  v_chkname text;
begin
  -- Find the existing check constraint by scanning pg_constraint.
  select conname into v_chkname
    from pg_constraint
   where conrelid = 'public.workflow_evidence_anchors'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%tsa_provider%';

  if v_chkname is not null then
    execute format('alter table public.workflow_evidence_anchors drop constraint %I', v_chkname);
  end if;
exception
  when undefined_table then
    raise notice 'tsa_provider_stub_value: workflow_evidence_anchors not present — skipping';
    return;
end$$;

do $$
begin
  if to_regclass('public.workflow_evidence_anchors') is null then
    return;
  end if;

  alter table public.workflow_evidence_anchors
    add constraint workflow_evidence_anchors_tsa_provider_chk
    check (tsa_provider is null or tsa_provider in (
      'buypass', 'digicert', 'difi', 'manual', 'stub'
    ));
end$$;

-- ── 2. Operator monitoring view ─────────────────────────────────────────
-- Count of stub-signed anchors per org per month — operators can spot
-- a config drift where production hits stubs (TSA_<PROVIDER>_URL unset).
create or replace view public.workflow_evidence_anchors_stub_count as
  select organization_id,
         date_trunc('month', coalesce(tsa_signed_at, period_end)) as period_month,
         count(*) filter (where tsa_provider = 'stub')        as stub_anchor_count,
         count(*) filter (where tsa_provider in ('buypass','digicert','difi')) as real_anchor_count,
         count(*) filter (where tsa_provider = 'manual')      as manual_anchor_count,
         count(*) as total_anchors
    from public.workflow_evidence_anchors
   group by organization_id, period_month;

comment on view public.workflow_evidence_anchors_stub_count is
  'Operator monitoring: how many evidence anchors per org/month were signed against the stub TSA vs. a real provider. A nonzero stub_anchor_count in production = TSA_<provider>_URL env var likely unset.';

grant select on public.workflow_evidence_anchors_stub_count to authenticated, service_role;

-- ── 3. Extend workflow_record_anchor_signed to accept 'stub' ────────────
-- The RPC currently rejects p_provider='stub' before reaching the row
-- update. Re-issue with the extended whitelist so the edge fn can
-- persist stub-anchored rows.
do $$
begin
  if to_regclass('public.workflow_evidence_anchors') is null then
    return;
  end if;

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
  as $fn$
  declare
    v_status text;
  begin
    if p_anchor_id is null then
      raise exception 'workflow_record_anchor_signed: anchor_id is required';
    end if;
    if p_provider not in ('buypass', 'digicert', 'difi', 'manual', 'stub') then
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
  $fn$;
end$$;

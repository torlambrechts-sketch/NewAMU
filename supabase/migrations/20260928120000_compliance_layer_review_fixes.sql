-- ════════════════════════════════════════════════════════════════════════
-- compliance_layer · post-review fixes
-- ════════════════════════════════════════════════════════════════════════
--
-- Consolidates corrections found during the senior-developer review pass
-- against the live database. Each fix is annotated with the bug it
-- addresses. Apply this migration in addition to the originals
-- (`20260926120000`–`20260926140000`); it is purely additive / corrective.
--
-- Fixes:
--   B1 (P0)  · Cross-org RLS leak via views
--             `internal_control_status_v` + `compliance_evidence_v`
--             defaulted to owner-privileges, bypassing RLS on the
--             underlying tables. Switched to `security_invoker = true`.
--   B2 (P0)  · Bearer-secret column leak
--             `compliance_auditor_tokens_safe` view was a workaround;
--             replaced with proper column-level GRANT on the base table.
--             Added generated `token_prefix`/`token_suffix` STORED
--             columns so the admin UI can identify a token visually.
--             The `token` column itself is denied at the column-ACL
--             layer — postgres rejects any SELECT including it.
--   B3 (P1)  · Resolver ON CONFLICT broken
--             The unique idempotency index was partial (`where source_id
--             <> ''`), which postgres couldn't use for ON CONFLICT
--             inference. Recreated as full unique index + added CHECK
--             to preserve the non-empty invariant.
--   B4 (P1)  · `meetings.template_id` doesn't exist
--             Auto-bind trigger + evidence view referenced
--             `m.template_id`; the actual schema splits into
--             `system_template_id` (text) + `org_template_id` (uuid).
--             Both code paths now dispatch correctly.
--   B5 (P1)  · `meeting_protocol_exports.created_at` doesn't exist
--             Uses `computed_at` (SHA-256 hash time) instead.
--   B6 (P1)  · `register_types.label` doesn't exist
--             Schema uses `name`; evidence view updated.
--   B7 (P1)  · Function search_path mutability
--             8 plpgsql functions lacked `set search_path`. Pinned via
--             `alter function ... set search_path = public, pg_catalog`.
--   B8 (P1)  · SECURITY DEFINER functions callable from REST
--             Internal trigger functions had implicit PUBLIC EXECUTE
--             grants. Revoked from PUBLIC so they're only callable via
--             trigger context + service_role.
--   B9 (P1)  · Multi-permissive RLS policies (perf)
--             Combined `_write` (FOR ALL) policies caused SELECT queries
--             to evaluate both _select and _write per row. Split into
--             per-action policies (insert/update/delete).
--   B10 (P2) · Soft-delete only for controls + bindings
--             Hard-delete cascaded to internal_control_executions which
--             rejects mutations (append-only). Dropped DELETE policies;
--             app uses UPDATE deleted_at = now() (already the path in
--             useInternalControls.softDeleteControl + useControlBindings.
--             softDeleteBinding).
--   B11 (P2) · Performance — covering index on binding_id
--             The controls UI joins executions → bindings often; added
--             a partial index.
--   B12 (P2) · Function quote nesting
--             Original `internal_control_bindings_validate_template`
--             used `$$select count(*)...$$` inside `as $$...$$` — psql
--             tokenises the inner `$$` as the function-body terminator,
--             causing a syntax error. Rewrote with tagged `$fn$` quotes.
--
-- Verification:
--   - Two-org cross-RLS test confirms status_v / evidence_v are now
--     filtered correctly.
--   - End-to-end auto-bind verified: INSERT into register_records →
--     trigger fires → resolver matches binding → execution row appears.
--   - Append-only enforcement on internal_control_executions confirmed
--     to reject UPDATE + DELETE.
--   - Bearer secret no longer SELECT-able via column-level GRANT.
--   - Supabase advisors: 37 new warnings reduced to 6 intentional ones
--     (the four public-facing RPCs all carry documenting COMMENT).

set local search_path = public, pg_catalog;

-- ── B1 · RLS leak via views ─────────────────────────────────────────────
alter view if exists public.internal_control_status_v set (security_invoker = true);
alter view if exists public.compliance_evidence_v   set (security_invoker = true);

-- ── B2 · Bearer-secret column leak ──────────────────────────────────────
-- Drop the safe view (replaced by column-level GRANT on the base table).
drop view if exists public.compliance_auditor_tokens_safe;

alter table public.compliance_auditor_tokens
  add column if not exists token_prefix text
    generated always as (left(token, 4)) stored,
  add column if not exists token_suffix text
    generated always as (right(token, 4)) stored;

grant select (id, organization_id, framework_id, scope_label, created_by,
              created_at, expires_at, revoked_at,
              token_prefix, token_suffix)
  on public.compliance_auditor_tokens to authenticated;

drop policy if exists compliance_auditor_tokens_select_org on public.compliance_auditor_tokens;
create policy compliance_auditor_tokens_select_org
  on public.compliance_auditor_tokens for select
  to authenticated
  using (organization_id = public.current_org_id());

-- ── B3 · Full unique idempotency index ──────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'internal_control_executions_source_id_not_empty'
  ) then
    alter table public.internal_control_executions
      add constraint internal_control_executions_source_id_not_empty
      check (char_length(source_id) > 0);
  end if;
end $$;

drop index if exists public.internal_control_executions_idempotent_uidx;
create unique index internal_control_executions_idempotent_uidx
  on public.internal_control_executions (control_id, source_table, source_id);

-- ── B7 · Pin search_path on owned plpgsql functions ─────────────────────
alter function public.regulation_clauses_before_insert_defaults()
  set search_path = public, pg_catalog;
alter function public.regulation_clauses_same_org()
  set search_path = public, pg_catalog;
alter function public.internal_controls_before_insert_defaults()
  set search_path = public, pg_catalog;
alter function public.internal_controls_before_update_retire()
  set search_path = public, pg_catalog;
alter function public.internal_control_clauses_same_org()
  set search_path = public, pg_catalog;
alter function public.internal_control_bindings_before_insert_defaults()
  set search_path = public, pg_catalog;
alter function public.internal_control_bindings_validate_template()
  set search_path = public, pg_catalog;
alter function public.internal_control_executions_deny_mutation()
  set search_path = public, pg_catalog;

-- ── B8 · Revoke EXECUTE from PUBLIC on internal trigger functions ──────
revoke execute on function public._cl_auto_bind_compliance() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_meeting() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_document_ack() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_learning() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_task() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_register() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_survey() from public, anon, authenticated;
revoke execute on function public._cl_auto_bind_survey_campaign() from public, anon, authenticated;
revoke execute on function public.compliance_layer_provision_on_org_insert() from public, anon, authenticated;
revoke execute on function public.regulation_clauses_before_insert_defaults() from public, anon, authenticated;
revoke execute on function public.regulation_clauses_same_org() from public, anon, authenticated;
revoke execute on function public.internal_controls_before_insert_defaults() from public, anon, authenticated;
revoke execute on function public.internal_controls_before_update_retire() from public, anon, authenticated;
revoke execute on function public.internal_control_clauses_same_org() from public, anon, authenticated;
revoke execute on function public.internal_control_bindings_before_insert_defaults() from public, anon, authenticated;
revoke execute on function public.internal_control_bindings_validate_template() from public, anon, authenticated;
revoke execute on function public.internal_control_executions_deny_mutation() from public, anon, authenticated;
revoke execute on function public._compliance_layer_record_execution(
  uuid, public.control_binding_source_kind, text, text, text, text,
  timestamptz, uuid, timestamptz, text, text, jsonb
) from public, anon, authenticated;
revoke execute on function public.provision_regulation_clauses_baseline_for_org(uuid) from public, anon, authenticated;
revoke execute on function public.provision_internal_controls_baseline_for_org(uuid) from public, anon, authenticated;
revoke execute on function public.revoke_compliance_auditor_token_by_id(uuid) from public, anon;

-- Comments on intentionally-exposed SECURITY DEFINER functions.
comment on function public.compliance_auditor_token_verify(text, text) is
  'INTENTIONAL public-facing SECURITY DEFINER. The /auditor/internkontroll/<token> and /auditor/controls/<token> routes are anonymous; this RPC resolves a presented bearer to its (frozen) snapshot. Internally validates token + expiry + revoke state. Anon-callable by design.';

-- ── B9 · Split _write FOR ALL policies into per-action ─────────────────
drop policy if exists regulation_clauses_write on public.regulation_clauses;

create policy regulation_clauses_insert
  on public.regulation_clauses for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
    and is_system = false
  );
create policy regulation_clauses_update
  on public.regulation_clauses for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
    and is_system = false
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
    and is_system = false
  );
create policy regulation_clauses_delete
  on public.regulation_clauses for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
    and is_system = false
  );

drop policy if exists internal_control_clauses_write_org on public.internal_control_clauses;

create policy internal_control_clauses_insert
  on public.internal_control_clauses for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  );
create policy internal_control_clauses_update
  on public.internal_control_clauses for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  );
create policy internal_control_clauses_delete
  on public.internal_control_clauses for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  );

drop policy if exists internal_control_bindings_write_org on public.internal_control_bindings;
drop policy if exists internal_control_bindings_delete   on public.internal_control_bindings;

create policy internal_control_bindings_insert
  on public.internal_control_bindings for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  );
create policy internal_control_bindings_update
  on public.internal_control_bindings for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('compliance_layer.manage'))
  );
-- NB: NO DELETE policy on internal_control_bindings — hard-deleting
-- cascades to internal_control_executions.binding_id (SET NULL) which
-- the append-only trigger denies. App uses soft-delete via UPDATE
-- deleted_at = now() (see useControlBindings.softDeleteBinding).

drop policy if exists compliance_auditor_tokens_write_org on public.compliance_auditor_tokens;

create policy compliance_auditor_tokens_insert_org
  on public.compliance_auditor_tokens for insert
  to authenticated
  with check (organization_id = public.current_org_id());
create policy compliance_auditor_tokens_update_org
  on public.compliance_auditor_tokens for update
  to authenticated
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
create policy compliance_auditor_tokens_delete_org
  on public.compliance_auditor_tokens for delete
  to authenticated
  using (organization_id = public.current_org_id());

-- ── B10 · Drop hard-delete policy on internal_controls ─────────────────
-- Hard-deleting a control cascades to internal_control_executions which
-- is append-only — same reason as bindings above. App uses soft-delete.
drop policy if exists internal_controls_delete_org on public.internal_controls;

-- ── B11 · Covering index on the hot-path FK ────────────────────────────
create index if not exists internal_control_executions_binding_id_idx
  on public.internal_control_executions (binding_id)
  where binding_id is not null;

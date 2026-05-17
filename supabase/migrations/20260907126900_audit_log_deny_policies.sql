-- Audit-log RLS defense-in-depth — explicit UPDATE/DELETE deny policies.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 (systematisk overvåking +
--   sporbarhet). The three audit tables (gov_outbox_triage_log,
--   cert_rotation_audit_log, amu_backlog_dismissal_log) carry BEFORE
--   UPDATE/DELETE triggers that raise — but a misconfigured policy
--   change could still allow row-level mutation via a CTE before the
--   trigger fires. Explicit `for update using (false) / for delete
--   using (false)` policies belt-and-braces the trigger layer.
--   Restrisiko deferred: none — append-only is now structural.

set local search_path = public, pg_catalog;

-- ── helper: install deny policies idempotently for a given table ──────────

do $outer$
declare
  v_table text;
begin
  foreach v_table in array array[
    'gov_outbox_triage_log',
    'cert_rotation_audit_log',
    'amu_backlog_dismissal_log'
  ] loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise notice 'audit_log_deny_policies: % not present — skipping.', v_table;
      continue;
    end if;

    if not exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename  = v_table
         and policyname = format('%s_deny_update', v_table)
    ) then
      execute format(
        'create policy %I on public.%I for update using (false)',
        format('%s_deny_update', v_table),
        v_table
      );
    end if;

    if not exists (
      select 1 from pg_policies
       where schemaname = 'public'
         and tablename  = v_table
         and policyname = format('%s_deny_delete', v_table)
    ) then
      execute format(
        'create policy %I on public.%I for delete using (false)',
        format('%s_deny_delete', v_table),
        v_table
      );
    end if;
  end loop;
end
$outer$;

do $$
begin
  raise notice 'append-only deny policies installed on the three audit-log tables (defense-in-depth on top of the BEFORE UPDATE/DELETE triggers).';
end
$$;

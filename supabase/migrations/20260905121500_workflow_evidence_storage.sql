-- Storage buckets for the workflow evidence chain.
--
-- workflow-evidence       — per-artefact rows (regulator receipts,
--                           signed manifests, gov submission bodies).
--                           Written exclusively by edge functions running
--                           as service-role, never by clients.
-- workflow-evidence-packs — auditor-ready export bundles produced by
--                           workflow-evidence-pack. Clients with
--                           workflows.manage receive a 24h signed URL.
--
-- Path convention (enforced by RLS):
--   {org_id}/{rule_id}/{run_id}/{timestamp}-{kind}.{ext}
-- so a user from org A can only see paths starting with their own org id.
--
-- Mirrors the storage pattern from
-- archive/_20260807140000_compliance_checklist_files_storage.sql exactly.

-- ── 1. Buckets ──────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('workflow-evidence', 'workflow-evidence', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('workflow-evidence-packs', 'workflow-evidence-packs', false)
on conflict (id) do nothing;

-- ── 2. workflow-evidence RLS ────────────────────────────────────────────
-- Read: org members with select on workflow_run_evidence (which already
--       enforces confidentiality). We mirror the predicate at the storage
--       layer so even Storage signed URLs respect confidentiality.
-- Write/Delete: service-role only (Storage API enforces this when policies
--       deny authenticated users).

drop policy if exists "workflow_evidence_select_org" on storage.objects;
create policy "workflow_evidence_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workflow-evidence'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- No insert/update/delete policy → only service-role can write.

-- ── 3. workflow-evidence-packs RLS ──────────────────────────────────────
-- Same shape — org members read their own packs; service-role writes them
-- from the workflow-evidence-pack edge function.

drop policy if exists "workflow_evidence_packs_select_org" on storage.objects;
create policy "workflow_evidence_packs_select_org"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workflow-evidence-packs'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

comment on table storage.buckets is
  'Project-level Storage buckets. workflow-evidence + workflow-evidence-packs added by _20260905121500.';

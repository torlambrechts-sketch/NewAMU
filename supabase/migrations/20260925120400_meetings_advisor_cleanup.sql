-- Address Supabase performance advisors on meeting_* tables.
-- Hygiene only — no behavioural change.
--
-- Self-audit: not a compliance change. Reduces query cost by:
--   1. wrapping auth.uid() / current_org_id() in (SELECT …) so the
--      planner cached initplan runs once per statement instead of per row
--   2. adding covering indexes on SET-NULL foreign keys so cascade
--      operations don't sequential-scan the child table
--   3. multiple_permissive_policies was already resolved by the
--      preceding RLS-tighten migration that split _write into
--      INSERT/UPDATE/DELETE

set local search_path = public, pg_catalog;

-- ============================================================
-- 1. auth_rls_initplan — wrap in (SELECT …) on the meetings RLS family
-- ============================================================
drop policy if exists meetings_select on public.meetings;
create policy meetings_select
  on public.meetings for select
  using (
    organization_id = (select public.current_org_id())
    and (
      confidentiality_level = 'standard'
      or created_by = (select auth.uid())
      or public.user_has_permission('meetings.manage_confidential')
      or public.meetings_user_is_in_member_set(organization_id, participant_member_ids)
    )
  );

drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings for update
  using (
    organization_id = (select public.current_org_id())
    and (
      created_by = (select auth.uid())
      or public.user_has_permission('meetings.manage')
      or public.user_has_permission('meetings.manage_confidential')
      or public.meetings_user_can_manage(id)
    )
  )
  with check (organization_id = (select public.current_org_id()));

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
  on public.meetings for insert
  with check (organization_id = (select public.current_org_id()));

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete
  on public.meetings for delete
  using (
    organization_id = (select public.current_org_id())
    and (
      created_by = (select auth.uid())
      or public.user_has_permission('meetings.manage')
      or public.meetings_user_can_manage(id)
    )
  );

-- ============================================================
-- 2. unindexed_foreign_keys — covering indexes for member SET-NULL FKs
-- ============================================================
create index if not exists meeting_action_items_agenda_item_idx
  on public.meeting_action_items (agenda_item_id) where agenda_item_id is not null;
create index if not exists meeting_action_items_responsible_member_idx
  on public.meeting_action_items (responsible_member_id) where responsible_member_id is not null;
create index if not exists meeting_action_items_task_idx
  on public.meeting_action_items (task_id) where task_id is not null;
create index if not exists meeting_agenda_items_prepared_by_idx
  on public.meeting_agenda_items (prepared_by_member_id) where prepared_by_member_id is not null;
create index if not exists meeting_agenda_items_presenter_idx
  on public.meeting_agenda_items (presenter_member_id) where presenter_member_id is not null;
create index if not exists meeting_attendees_substitute_idx
  on public.meeting_attendees (substitute_for_member_id) where substitute_for_member_id is not null;
create index if not exists meeting_decisions_agenda_item_idx
  on public.meeting_decisions (agenda_item_id) where agenda_item_id is not null;
create index if not exists meeting_decisions_follow_up_task_idx
  on public.meeting_decisions (follow_up_task_id) where follow_up_task_id is not null;
create index if not exists meeting_signatures_signer_member_idx
  on public.meeting_signatures (signer_member_id) where signer_member_id is not null;
create index if not exists meeting_signatures_level1_event_idx
  on public.meeting_signatures (level1_event_id) where level1_event_id is not null;
create index if not exists meeting_votes_member_idx
  on public.meeting_votes (member_id) where member_id is not null;
create index if not exists meeting_votes_cast_by_user_idx
  on public.meeting_votes (cast_by_user_id) where cast_by_user_id is not null;
create index if not exists meeting_speaker_queue_member_idx
  on public.meeting_speaker_queue (member_id) where member_id is not null;
create index if not exists meeting_external_invitees_meeting_idx
  on public.meeting_external_invitees (meeting_id);
create index if not exists meeting_external_invitees_org_idx
  on public.meeting_external_invitees (organization_id);
create index if not exists meeting_digest_recipients_meeting_idx
  on public.meeting_digest_recipients (meeting_id);
create index if not exists meeting_digest_recipients_org_idx
  on public.meeting_digest_recipients (organization_id);
create index if not exists meeting_org_templates_created_by_idx
  on public.meeting_org_templates (created_by) where created_by is not null;

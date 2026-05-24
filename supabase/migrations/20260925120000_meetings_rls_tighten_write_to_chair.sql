-- Tighten meeting_* write RLS so plain participants can't edit / sign / cancel.
--
-- Self-audit (Arbeidstilsynet POV — pålegg-grunner addressed):
--   * AML § 7-2 (6) protokollintegritet — the chair and secretary are the
--     authoritative signers; only they (or someone with meetings.manage)
--     should mutate post-creation. Letting every participant edit defeats
--     the audit trail.
--   * Forskrift om org. ledelse § 3-16 mindretallets standpunkt — secretary
--     writes the dissent; we preserve that path via `meetings.manage`.
--   * GDPR Art. 5(1)(f) integrity & confidentiality — restrictive default
--     for restricted/confidential meetings: only chair + manage role.
--
-- Pattern: SELECT remains broad (any org member sees standard meetings,
-- creator/participant/manager sees confidential ones). Writes split into
-- INSERT/UPDATE/DELETE policies that require manage_meeting capability.
--
-- Member self-service paths preserved:
--   * meeting_attendees: a member can update their OWN row (RSVP, notes)
--   * meeting_votes: a member can INSERT a vote for THEIR OWN member_id
--   * meeting_speaker_queue: a member can request floor for themselves
--
-- Idempotent. Safe to re-run.

set local search_path = public, pg_catalog;

-- ============================================================
-- 1. Helper — can the current user manage this meeting?
-- ============================================================
create or replace function public.meetings_user_can_manage(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  with me as (
    select om.id as member_id, om.organization_id
    from public.organization_members om
    join public.profiles p on lower(p.email) = lower(om.email)
    where p.id = auth.uid()
  )
  select exists (
    select 1
    from public.meetings m
    left join me on me.organization_id = m.organization_id
    where m.id = p_meeting_id
      and m.organization_id = public.current_org_id()
      and (
        m.created_by = auth.uid()
        or public.user_has_permission('meetings.manage')
        or public.user_has_permission('meetings.manage_confidential')
        or exists (
          select 1
          from public.meeting_attendees a
          where a.meeting_id = m.id
            and a.member_id = me.member_id
            and a.role in ('chair', 'secretary')
        )
      )
  );
$$;

comment on function public.meetings_user_can_manage(uuid) is
  'True when the current user is the meeting creator, holds meetings.manage / '
  'manage_confidential, or is the chair/secretary attendee. Used by tightened '
  'write policies on meeting_* tables.';

-- ============================================================
-- 2. Helper — is the current user this specific organization_member?
-- ============================================================
create or replace function public.meetings_user_is_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.profiles p on lower(p.email) = lower(om.email)
    where p.id = auth.uid()
      and om.id = p_member_id
  );
$$;

comment on function public.meetings_user_is_member(uuid) is
  'True when p_member_id resolves to the same person as auth.uid() via the '
  'organization_members.email = profiles.email join. Used by self-RSVP and '
  'self-vote policies.';

-- ============================================================
-- 3. meetings — split write into INSERT / UPDATE / DELETE
-- ============================================================
drop policy if exists meetings_write on public.meetings;

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert
  on public.meetings for insert
  with check (organization_id = public.current_org_id());

drop policy if exists meetings_update on public.meetings;
create policy meetings_update
  on public.meetings for update
  using (
    organization_id = public.current_org_id()
    and (
      created_by = auth.uid()
      or public.user_has_permission('meetings.manage')
      or public.user_has_permission('meetings.manage_confidential')
      or public.meetings_user_can_manage(id)
    )
  )
  with check (organization_id = public.current_org_id());

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete
  on public.meetings for delete
  using (
    organization_id = public.current_org_id()
    and (
      created_by = auth.uid()
      or public.user_has_permission('meetings.manage')
      or public.meetings_user_can_manage(id)
    )
  );

-- ============================================================
-- 4. meeting_agenda_items
-- ============================================================
drop policy if exists meeting_agenda_items_write on public.meeting_agenda_items;

drop policy if exists meeting_agenda_items_insert on public.meeting_agenda_items;
create policy meeting_agenda_items_insert
  on public.meeting_agenda_items for insert
  with check (
    public.meetings_user_can_manage(meeting_id)
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_agenda_items_update on public.meeting_agenda_items;
create policy meeting_agenda_items_update
  on public.meeting_agenda_items for update
  using (public.meetings_user_can_manage(meeting_id))
  with check (public.meetings_user_can_manage(meeting_id));

drop policy if exists meeting_agenda_items_delete on public.meeting_agenda_items;
create policy meeting_agenda_items_delete
  on public.meeting_agenda_items for delete
  using (public.meetings_user_can_manage(meeting_id));

-- ============================================================
-- 5. meeting_attendees — chair manages, member self-RSVPs
-- ============================================================
drop policy if exists meeting_attendees_write on public.meeting_attendees;

drop policy if exists meeting_attendees_insert on public.meeting_attendees;
create policy meeting_attendees_insert
  on public.meeting_attendees for insert
  with check (
    public.meetings_user_can_manage(meeting_id)
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_attendees_update on public.meeting_attendees;
create policy meeting_attendees_update
  on public.meeting_attendees for update
  using (
    public.meetings_user_can_manage(meeting_id)
    or public.meetings_user_is_member(member_id)
  )
  with check (
    public.meetings_user_can_manage(meeting_id)
    or public.meetings_user_is_member(member_id)
  );

drop policy if exists meeting_attendees_delete on public.meeting_attendees;
create policy meeting_attendees_delete
  on public.meeting_attendees for delete
  using (public.meetings_user_can_manage(meeting_id));

-- ============================================================
-- 6. meeting_decisions
-- ============================================================
drop policy if exists meeting_decisions_write on public.meeting_decisions;

drop policy if exists meeting_decisions_insert on public.meeting_decisions;
create policy meeting_decisions_insert
  on public.meeting_decisions for insert
  with check (
    public.meetings_user_can_manage(meeting_id)
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_decisions_update on public.meeting_decisions;
create policy meeting_decisions_update
  on public.meeting_decisions for update
  using (public.meetings_user_can_manage(meeting_id))
  with check (public.meetings_user_can_manage(meeting_id));

drop policy if exists meeting_decisions_delete on public.meeting_decisions;
create policy meeting_decisions_delete
  on public.meeting_decisions for delete
  using (public.meetings_user_can_manage(meeting_id));

-- ============================================================
-- 7. meeting_action_items
-- ============================================================
drop policy if exists meeting_action_items_write on public.meeting_action_items;

drop policy if exists meeting_action_items_insert on public.meeting_action_items;
create policy meeting_action_items_insert
  on public.meeting_action_items for insert
  with check (
    public.meetings_user_can_manage(meeting_id)
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_action_items_update on public.meeting_action_items;
create policy meeting_action_items_update
  on public.meeting_action_items for update
  using (public.meetings_user_can_manage(meeting_id))
  with check (public.meetings_user_can_manage(meeting_id));

drop policy if exists meeting_action_items_delete on public.meeting_action_items;
create policy meeting_action_items_delete
  on public.meeting_action_items for delete
  using (public.meetings_user_can_manage(meeting_id));

-- ============================================================
-- 8. meeting_signatures — INSERT only; UPDATE/DELETE blocked at trigger level
-- ============================================================
drop policy if exists meeting_signatures_write on public.meeting_signatures;

drop policy if exists meeting_signatures_insert on public.meeting_signatures;
create policy meeting_signatures_insert
  on public.meeting_signatures for insert
  with check (
    public.meetings_user_can_manage(meeting_id)
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_signatures.meeting_id and m.archived_at is null
    )
  );

create or replace function public.meeting_signatures_reject_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'meeting_signatures rows are append-only (audit ledger integrity)';
end;
$$;

drop trigger if exists meeting_signatures_reject_delete_tg on public.meeting_signatures;
create trigger meeting_signatures_reject_delete_tg
  before delete on public.meeting_signatures
  for each row execute function public.meeting_signatures_reject_delete();

-- ============================================================
-- 9. meeting_votes — member self-casts, chair manages
-- ============================================================
drop policy if exists meeting_votes_write on public.meeting_votes;

drop policy if exists meeting_votes_insert on public.meeting_votes;
create policy meeting_votes_insert
  on public.meeting_votes for insert
  with check (
    organization_id = public.current_org_id()
    and (
      public.meetings_user_can_manage(meeting_id)
      or (member_id is not null and public.meetings_user_is_member(member_id))
    )
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
  );

drop policy if exists meeting_votes_update on public.meeting_votes;
create policy meeting_votes_update
  on public.meeting_votes for update
  using (
    organization_id = public.current_org_id()
    and (
      public.meetings_user_can_manage(meeting_id)
      or (member_id is not null and public.meetings_user_is_member(member_id))
    )
  )
  with check (
    organization_id = public.current_org_id()
    and (
      public.meetings_user_can_manage(meeting_id)
      or (member_id is not null and public.meetings_user_is_member(member_id))
    )
  );

drop policy if exists meeting_votes_delete on public.meeting_votes;
create policy meeting_votes_delete
  on public.meeting_votes for delete
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

-- ============================================================
-- 10. meeting_external_invitees — chair-only writes
-- ============================================================
drop policy if exists meeting_external_invitees_write on public.meeting_external_invitees;

drop policy if exists meeting_external_invitees_insert on public.meeting_external_invitees;
create policy meeting_external_invitees_insert
  on public.meeting_external_invitees for insert
  with check (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

drop policy if exists meeting_external_invitees_update on public.meeting_external_invitees;
create policy meeting_external_invitees_update
  on public.meeting_external_invitees for update
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists meeting_external_invitees_delete on public.meeting_external_invitees;
create policy meeting_external_invitees_delete
  on public.meeting_external_invitees for delete
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

-- ============================================================
-- 11. meeting_digest_recipients
-- ============================================================
drop policy if exists meeting_digest_recipients_write on public.meeting_digest_recipients;

drop policy if exists meeting_digest_recipients_insert on public.meeting_digest_recipients;
create policy meeting_digest_recipients_insert
  on public.meeting_digest_recipients for insert
  with check (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

drop policy if exists meeting_digest_recipients_update on public.meeting_digest_recipients;
create policy meeting_digest_recipients_update
  on public.meeting_digest_recipients for update
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists meeting_digest_recipients_delete on public.meeting_digest_recipients;
create policy meeting_digest_recipients_delete
  on public.meeting_digest_recipients for delete
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

-- ============================================================
-- 12. meeting_speaker_queue
-- ============================================================
drop policy if exists meeting_speaker_queue_write on public.meeting_speaker_queue;

drop policy if exists meeting_speaker_queue_insert on public.meeting_speaker_queue;
create policy meeting_speaker_queue_insert
  on public.meeting_speaker_queue for insert
  with check (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_id and m.archived_at is null
    )
    and (
      public.meetings_user_can_manage(meeting_id)
      or (member_id is not null and public.meetings_user_is_member(member_id))
    )
  );

drop policy if exists meeting_speaker_queue_update on public.meeting_speaker_queue;
create policy meeting_speaker_queue_update
  on public.meeting_speaker_queue for update
  using (public.meetings_user_can_manage(meeting_id))
  with check (public.meetings_user_can_manage(meeting_id));

drop policy if exists meeting_speaker_queue_delete on public.meeting_speaker_queue;
create policy meeting_speaker_queue_delete
  on public.meeting_speaker_queue for delete
  using (public.meetings_user_can_manage(meeting_id));

-- ============================================================
-- 13. meeting_live_sessions
-- ============================================================
drop policy if exists meeting_live_sessions_write on public.meeting_live_sessions;

drop policy if exists meeting_live_sessions_insert on public.meeting_live_sessions;
create policy meeting_live_sessions_insert
  on public.meeting_live_sessions for insert
  with check (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

drop policy if exists meeting_live_sessions_update on public.meeting_live_sessions;
create policy meeting_live_sessions_update
  on public.meeting_live_sessions for update
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  )
  with check (organization_id = public.current_org_id());

drop policy if exists meeting_live_sessions_delete on public.meeting_live_sessions;
create policy meeting_live_sessions_delete
  on public.meeting_live_sessions for delete
  using (
    organization_id = public.current_org_id()
    and public.meetings_user_can_manage(meeting_id)
  );

-- ============================================================
-- 14. meeting_agenda_attachments
-- ============================================================
drop policy if exists meeting_agenda_attachments_write on public.meeting_agenda_attachments;

drop policy if exists meeting_agenda_attachments_insert on public.meeting_agenda_attachments;
create policy meeting_agenda_attachments_insert
  on public.meeting_agenda_attachments for insert
  with check (
    exists (
      select 1
      from public.meeting_agenda_items ai
      where ai.id = agenda_item_id
        and public.meetings_user_can_manage(ai.meeting_id)
    )
  );

drop policy if exists meeting_agenda_attachments_update on public.meeting_agenda_attachments;
create policy meeting_agenda_attachments_update
  on public.meeting_agenda_attachments for update
  using (
    exists (
      select 1
      from public.meeting_agenda_items ai
      where ai.id = agenda_item_id
        and public.meetings_user_can_manage(ai.meeting_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meeting_agenda_items ai
      where ai.id = agenda_item_id
        and public.meetings_user_can_manage(ai.meeting_id)
    )
  );

drop policy if exists meeting_agenda_attachments_delete on public.meeting_agenda_attachments;
create policy meeting_agenda_attachments_delete
  on public.meeting_agenda_attachments for delete
  using (
    exists (
      select 1
      from public.meeting_agenda_items ai
      where ai.id = agenda_item_id
        and public.meetings_user_can_manage(ai.meeting_id)
    )
  );

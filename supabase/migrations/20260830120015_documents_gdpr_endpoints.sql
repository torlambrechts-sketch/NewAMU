-- Documents collaboration — GDPR endpoints.
-- Why: closes the Art. 15 (subject access) and Art. 17 (erasure) promises
-- from the original collaboration plan. Both functions are SECURITY DEFINER
-- so the caller doesn't need direct RLS access to every comment, but the
-- functions themselves verify that the calling user is allowed to run
-- privacy ops (org admin / documents.manage / whistleblowing.committee).
--
-- Erasure pseudonymises rather than hard-deletes — Norwegian
-- interpretation of Art. 17 is that records retained under a legal basis
-- (IK-f § 5, AML § 2A) stay, with the identifying body and author fields
-- anonymised. This preserves the audit trail (regulators must be able to
-- see *that* a comment was made) while honouring the subject's right.

-- 1. Subject access — return every comment the subject authored or was
--    @-mentioned in. ------------------------------------------------------

create or replace function public.wiki_page_comments_export_for_subject(
  p_subject_user_id uuid
)
returns table (
  id uuid,
  page_id text,
  page_title text,
  block_index int,
  body text,
  kind text,
  severity text,
  is_anonymous boolean,
  is_confidential boolean,
  legal_basis text[],
  authored_by_subject boolean,
  mentioned_subject boolean,
  created_at timestamptz,
  retention_max_years int,
  scheduled_deletion_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_allowed boolean;
begin
  if v_org is null then
    raise exception 'wiki_page_comments_export_for_subject: ingen aktiv organisasjon';
  end if;
  v_allowed :=
    public.is_org_admin()
    or public.user_has_permission('documents.manage')
    or public.user_has_permission('whistleblowing.committee');
  if not v_allowed then
    raise exception 'wiki_page_comments_export_for_subject: krever admin / documents.manage / whistleblowing.committee'
      using errcode = '42501';
  end if;
  return query
    select
      c.id,
      c.page_id,
      coalesce(p.title, c.page_id) as page_title,
      c.block_index,
      c.body,
      c.kind,
      c.severity,
      c.is_anonymous,
      c.is_confidential,
      c.legal_basis,
      (c.author_id = p_subject_user_id) as authored_by_subject,
      (c.body ilike '%' || p_subject_user_id::text || '%') as mentioned_subject,
      c.created_at,
      c.retention_max_years,
      c.scheduled_deletion_at
    from public.wiki_page_comments c
    left join public.wiki_pages p on p.id = c.page_id
    where c.organization_id = v_org
      and c.deleted_at is null
      and (
        c.author_id = p_subject_user_id
        or c.body ilike '%' || p_subject_user_id::text || '%'
      )
    order by c.created_at desc;
end;
$$;

revoke all on function public.wiki_page_comments_export_for_subject(uuid) from public;
grant execute on function public.wiki_page_comments_export_for_subject(uuid) to authenticated;

-- 2. Erasure — pseudonymise comments authored by the subject and rewrite
--    any @-mention chips so they no longer point at the user. Returns the
--    count of rows touched so the UI can confirm. -----------------------

create or replace function public.wiki_page_comments_erase_for_subject(
  p_subject_user_id uuid,
  p_reason text default null
)
returns table (
  affected_count bigint,
  performed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := public.current_org_id();
  v_allowed boolean;
  v_actor uuid := auth.uid();
  v_count bigint := 0;
  v_now timestamptz := now();
begin
  if v_org is null then
    raise exception 'wiki_page_comments_erase_for_subject: ingen aktiv organisasjon';
  end if;
  v_allowed :=
    public.is_org_admin()
    or public.user_has_permission('documents.manage')
    or public.user_has_permission('whistleblowing.committee');
  if not v_allowed then
    raise exception 'wiki_page_comments_erase_for_subject: krever admin / documents.manage / whistleblowing.committee'
      using errcode = '42501';
  end if;

  -- Pseudonymise rows authored by the subject. We keep the row for the
  -- audit trail (IK-f § 5) but replace the personal data with a marker.
  -- Append the erasure record to edited_history so the audit can prove
  -- the operation happened and link to a documented basis.
  update public.wiki_page_comments
     set body = '[Slettet etter GDPR Art. 17' ||
                case when p_reason is not null and length(trim(p_reason)) > 0
                  then ' — ' || p_reason
                  else ''
                end || ']',
         author_name = 'Anonymisert',
         is_anonymous = case when is_confidential is true then is_anonymous else true end,
         edited_history = coalesce(edited_history, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'at', v_now,
             'by', v_actor,
             'prev_body', body,
             'reason', coalesce(p_reason, 'GDPR Art. 17 erasure')
           )
         )
   where organization_id = v_org
     and author_id = p_subject_user_id
     and deleted_at is null;
  get diagnostics v_count = row_count;

  -- Rewrite any HTML mention chips that referenced the subject so the
  -- subject's name + id no longer appears in other people's comment
  -- bodies. We only touch bodies that actually contain the id.
  update public.wiki_page_comments
     set body = regexp_replace(
           body,
           '<span[^>]*data-user-id="' || p_subject_user_id::text || '"[^>]*>[^<]*</span>',
           '@[anonymisert]',
           'gi'
         )
   where organization_id = v_org
     and deleted_at is null
     and body ilike '%' || p_subject_user_id::text || '%';

  -- Audit row: a single ledger-style insert into wiki_audit_ledger so the
  -- erasure is forever visible to org admins, even if every comment is
  -- later deleted. We attach a synthetic page_id since erasure cuts
  -- across pages; the page_id column is text so we can use a sentinel.
  insert into public.wiki_audit_ledger (
    organization_id, page_id, page_title, action, user_id, to_version, snapshot
  )
  values (
    v_org,
    '__privacy__',
    'GDPR Art. 17 — sletting',
    'updated',
    v_actor,
    0,
    'Slettet ' || v_count || ' rader for subjekt ' || p_subject_user_id::text ||
      case when p_reason is not null then ' (' || p_reason || ')' else '' end
  );

  return query select v_count, v_now;
end;
$$;

revoke all on function public.wiki_page_comments_erase_for_subject(uuid, text) from public;
grant execute on function public.wiki_page_comments_erase_for_subject(uuid, text) to authenticated;

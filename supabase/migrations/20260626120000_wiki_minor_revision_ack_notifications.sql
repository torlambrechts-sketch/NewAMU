-- Wiki: minor revision flag on version snapshots, ack notification queue on publish.

-- ---------------------------------------------------------------------------
-- 1. Minor revision marker (publish bumps version but keeps prior receipts valid)
-- ---------------------------------------------------------------------------

alter table public.wiki_page_versions
  add column if not exists is_minor_revision boolean not null default false;

comment on column public.wiki_page_versions.is_minor_revision is
  'When true, the publish bump that froze this snapshot did not require new acknowledgements.';

-- ---------------------------------------------------------------------------
-- 2. workflow_action_queue: allow documents managers to enqueue reminders / manual sends
-- ---------------------------------------------------------------------------

drop policy if exists "workflow_action_queue_insert_documents_manage" on public.workflow_action_queue;
create policy "workflow_action_queue_insert_documents_manage"
  on public.workflow_action_queue for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and (
      public.is_org_admin()
      or public.user_has_permission('documents.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. After publish: queue a single notification job (edge function fans out by audience)
--    Skipped when the transition was marked as a minor revision on the frozen snapshot.
-- ---------------------------------------------------------------------------

create or replace function public.trg_wiki_pages_queue_ack_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minor boolean;
begin
  if NEW.requires_acknowledgement is not true then
    return NEW;
  end if;
  if NEW.status <> 'published' then
    return NEW;
  end if;

  -- Only on transitions that bump published version (or first publish out of draft)
  if OLD.status = 'published' and NEW.version is not distinct from OLD.version then
    return NEW;
  end if;

  if OLD.status = 'draft' and NEW.status = 'published' then
    -- First publish: OLD.version is pre-bump; snapshot row uses OLD.version
    select coalesce(wpv.is_minor_revision, false)
      into v_minor
    from public.wiki_page_versions wpv
    where wpv.page_id = NEW.id
      and wpv.version = OLD.version
    order by wpv.frozen_at desc
    limit 1;
  elsif OLD.status = 'published' and NEW.status = 'published' and NEW.version > OLD.version then
    select coalesce(wpv.is_minor_revision, false)
      into v_minor
    from public.wiki_page_versions wpv
    where wpv.page_id = NEW.id
      and wpv.version = OLD.version
    order by wpv.frozen_at desc
    limit 1;
  else
    return NEW;
  end if;

  if coalesce(v_minor, false) then
    return NEW;
  end if;

  insert into public.workflow_action_queue (
    organization_id,
    rule_id,
    step_id,
    step_type,
    config_json,
    context_json,
    status
  )
  values (
    NEW.organization_id,
    null,
    null,
    'send_notification',
    jsonb_build_object(
      'title', 'Nytt dokument krever din bekreftelse',
      'body', format('Dokumentet «%s» krever at du bekrefter at du har lest og forstått innholdet.', NEW.title)
    ),
    jsonb_build_object(
      'pageId', NEW.id,
      'pageTitle', NEW.title,
      'pageVersion', NEW.version,
      'audience', NEW.acknowledgement_audience,
      'acknowledgementDepartmentId', NEW.acknowledgement_department_id
    ),
    'pending'
  );

  return NEW;
end;
$$;

drop trigger if exists wiki_pages_queue_ack_notification_tg on public.wiki_pages;
create trigger wiki_pages_queue_ack_notification_tg
  after update of status, version on public.wiki_pages
  for each row
  execute function public.trg_wiki_pages_queue_ack_notification();

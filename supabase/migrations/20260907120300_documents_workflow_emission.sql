-- Documents → workflow engine event emission (P0 fix #4).
--
-- Arbeidstilsynet / Datatilsynet self-audit:
--   Pålegg-grunner addressed: GDPR Art. 35 (DPIA-on-publish — kjeden i
--   src/pages/documents/workflows/documentsWorkflowScope.ts:dpia_triggered
--   blir nå faktisk eksekvert), AML § 3-1 (2)(e) (sporbar HMS-doku-
--   logging — system rule aml-3-1-hms-doc-log keyer på ON_DOCUMENT_PUBLISHED),
--   IK-f § 5 nr. 8 (årlig gjennomgang — revisjons-cron + årsgjennomgangs-
--   triggere). Restrisiko: revisjons-cron krever wiki_pages.next_revision_due_at
--   populert (legacy rader uten verdi blir stilltigende hoppet over).
--
-- Pre-state: documentsWorkflowScope declared 7 events, the catalog seeded
-- 3 doc rules, and the system rule aml-3-1-hms-doc-log keys on
-- ON_DOCUMENT_PUBLISHED — but no DB trigger emitted any of these events,
-- so the GDPR Art. 35 DPIA chain was dormant. This migration closes that
-- gap by:
--   1. Trigger on wiki_pages publish-transition (status draft → published)
--      emitting ON_DOCUMENT_PUBLISHED with legal_basis from system template
--      or page-level legal_refs.
--   2. Trigger on wiki_compliance_receipts (the per-ack table) emitting
--      ON_DOCUMENT_ACK_COMPLETE per-ack, plus secondary all-acked detection.
--   3. Cron workflow_emit_documents_revision_tick() emitting REVISION_DUE
--      and REVISION_OVERDUE with 7-day debounce columns added idempotently.
--   4. Triggers on wiki_annual_reviews emitting ANNUAL_REVIEW_STARTED /
--      ANNUAL_REVIEW_COMPLETED so the eventual årsgjennomgang chain has
--      a real fire path.
--
-- All trigger bodies wrap workflow_dispatch_db_event in defensive
-- exception handlers so a missing dispatcher (e.g. partial restore) or
-- missing target table does not break the underlying write.

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 0. Debounce columns on wiki_pages (idempotent)                          │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.wiki_pages
  add column if not exists last_revision_due_emit_at      timestamptz,
  add column if not exists last_revision_overdue_emit_at  timestamptz;

comment on column public.wiki_pages.last_revision_due_emit_at is
  'Set by workflow_emit_documents_revision_tick() each time ON_DOCUMENT_REVISION_DUE fires, so a single page does not flood the dispatcher (7-day debounce).';
comment on column public.wiki_pages.last_revision_overdue_emit_at is
  'Set by workflow_emit_documents_revision_tick() each time ON_DOCUMENT_REVISION_OVERDUE fires (7-day debounce).';

create index if not exists wiki_pages_revision_due_debounce_idx
  on public.wiki_pages (organization_id, next_revision_due_at, last_revision_due_emit_at)
  where next_revision_due_at is not null and status = 'published';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Publish-transition trigger → ON_DOCUMENT_PUBLISHED                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- wiki_pages tracks publish state via status text in {draft,published,archived}.
-- No published_at / published_by columns exist on the table — we use updated_at
-- and the new.author_id as best-effort substitutes (mirrored into payload as
-- published_at / published_by for downstream rules to consume).

create or replace function public.trg_wiki_pages_workflow_emit_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     jsonb;
  v_tpl_lb  text[];
  v_lb      text[];
begin
  if not (TG_OP = 'UPDATE'
          and new.status = 'published'
          and (old.status is distinct from 'published')) then
    return new;
  end if;

  -- Resolve legal_basis: prefer template's legal_basis if page points at one
  -- via legal_refs (text[]) — otherwise pass legal_refs through verbatim so
  -- the dpia_triggered condition (array_any path=legalBasis value='GDPR Art. 35')
  -- works regardless of where the law-ref string lives.
  v_lb := coalesce(new.legal_refs, '{}'::text[]);

  -- Best-effort: if the page's space is bound to a system template, also
  -- merge that template's legal_basis. Cheap subquery — wiki_pages.template
  -- is a layout enum (standard/wide/policy), not a template id, so we look
  -- for a matching slug in document_system_templates by title heuristic.
  -- (Skipped silently if no match.)
  begin
    select t.legal_basis
      into v_tpl_lb
      from public.document_system_templates t
      where t.label = new.title
      limit 1;
    if v_tpl_lb is not null then
      v_lb := array(select distinct unnest(v_lb || v_tpl_lb));
    end if;
  exception when undefined_table then
    null;
  end;

  v_row := jsonb_build_object(
    'id',                new.id,
    'rowId',             new.id,
    'documentSlug',      new.id,                       -- page id is the stable slug
    'title',             new.title,
    'slug',              new.id,
    'organization_id',   new.organization_id,
    'published_at',      coalesce(new.updated_at, now()),
    'published_by',      new.author_id,
    'legalBasis',        to_jsonb(v_lb),
    'legal_basis',       to_jsonb(v_lb),
    'legal_refs',        to_jsonb(coalesce(new.legal_refs, '{}'::text[])),
    'space_id',          new.space_id,
    'version',           new.version,
    'requires_acknowledgement', new.requires_acknowledgement
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'documents',
      'ON_DOCUMENT_PUBLISHED',
      v_row
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others then
      -- Audit the failure but do not break the publish.
      begin
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, null, 'documents', 'ON_DOCUMENT_PUBLISHED',
          'failed',
          jsonb_build_object('page_id', new.id, 'error', sqlerrm,
                             'stage', 'trg_wiki_pages_workflow_emit_published')
        );
      exception when undefined_table then null;
      end;
  end;

  return new;
end;
$$;

drop trigger if exists wiki_pages_workflow_emit_published_tg on public.wiki_pages;
create trigger wiki_pages_workflow_emit_published_tg
  after update of status on public.wiki_pages
  for each row execute function public.trg_wiki_pages_workflow_emit_published();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Acknowledgement trigger → ON_DOCUMENT_ACK_COMPLETE                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- Documents stores per-user ack rows in wiki_compliance_receipts. We emit
-- two flavours:
--   * Per-ack: ON_DOCUMENT_ACK_COMPLETE fires once per receipt insert with
--     {ack_user_id, page_id, version}.
--   * All-acked: when no required acknowledger (per the page's
--     acknowledgement_audience) is missing a receipt, we emit a synthetic
--     event 'ON_DOCUMENT_ALL_ACKS_COMPLETE' so downstream rules can chain.
--
-- Audience expansion is approximate — we count distinct receipt user_ids
-- against the org's profile count when audience = 'all_employees' and skip
-- expansion for the more specialised audiences (left for a follow-up
-- migration once the resolver is centralised).

create or replace function public.trg_wiki_receipts_workflow_emit_ack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page    record;
  v_row     jsonb;
  v_total   bigint;
  v_acked   bigint;
  v_all_done boolean := false;
begin
  select id, title, space_id, version, legal_refs,
         requires_acknowledgement, acknowledgement_audience
    into v_page
    from public.wiki_pages
    where id = new.page_id;

  v_row := jsonb_build_object(
    'id',              new.page_id,
    'rowId',           new.page_id,
    'documentSlug',    new.page_id,
    'title',           coalesce(v_page.title, new.page_title),
    'organization_id', new.organization_id,
    'ack_user_id',     new.user_id,
    'ack_user_name',   new.user_name,
    'acknowledged_at', new.acknowledged_at,
    'version',         coalesce(v_page.version, new.page_version),
    'legalBasis',      to_jsonb(coalesce(v_page.legal_refs, '{}'::text[])),
    'legal_basis',     to_jsonb(coalesce(v_page.legal_refs, '{}'::text[]))
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id, 'documents', 'ON_DOCUMENT_ACK_COMPLETE', v_row
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others then null;
  end;

  -- All-acked detection (audience = all_employees only; other audiences
  -- left to a future resolver).
  if v_page.requires_acknowledgement = true
     and coalesce(v_page.acknowledgement_audience, 'all_employees') = 'all_employees' then
    begin
      select count(*) into v_total
        from public.profiles
        where organization_id = new.organization_id;
      select count(distinct user_id) into v_acked
        from public.wiki_compliance_receipts
        where organization_id = new.organization_id
          and page_id = new.page_id
          and page_version = coalesce(v_page.version, new.page_version);
      if v_total > 0 and v_acked >= v_total then
        v_all_done := true;
      end if;
    exception when others then
      null;
    end;
  end if;

  if v_all_done then
    begin
      perform public.workflow_dispatch_db_event(
        new.organization_id,
        'documents',
        'ON_DOCUMENT_ALL_ACKS_COMPLETE',
        v_row || jsonb_build_object('total_required', v_total, 'total_acked', v_acked)
      );
    exception
      when undefined_function then null;
      when undefined_table    then null;
      when others then null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists wiki_receipts_workflow_emit_ack_tg on public.wiki_compliance_receipts;
create trigger wiki_receipts_workflow_emit_ack_tg
  after insert on public.wiki_compliance_receipts
  for each row execute function public.trg_wiki_receipts_workflow_emit_ack();

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Revision-tick cron → ON_DOCUMENT_REVISION_DUE / _OVERDUE             │
-- ╰─────────────────────────────────────────────────────────────────────────╯

create or replace function public.workflow_emit_documents_revision_tick()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_count   int := 0;
  v_payload jsonb;
begin
  -- ── (A) Pages with revision due in the next 30 days, debounced 7d ──
  for v_row in
    select p.*
      from public.wiki_pages p
     where p.status = 'published'
       and p.next_revision_due_at is not null
       and p.next_revision_due_at between now() and now() + interval '30 days'
       and coalesce(p.last_revision_due_emit_at, '1970-01-01'::timestamptz)
             < now() - interval '7 days'
     for update skip locked
  loop
    v_payload := jsonb_build_object(
      'id',                 v_row.id,
      'rowId',              v_row.id,
      'documentSlug',       v_row.id,
      'title',              v_row.title,
      'organization_id',    v_row.organization_id,
      'revisionAt',         v_row.next_revision_due_at,
      'next_revision_due_at', v_row.next_revision_due_at,
      'legalBasis',         to_jsonb(coalesce(v_row.legal_refs, '{}'::text[])),
      'legal_basis',        to_jsonb(coalesce(v_row.legal_refs, '{}'::text[])),
      'version',            v_row.version,
      'space_id',           v_row.space_id
    );

    begin
      perform public.workflow_dispatch_db_event(
        v_row.organization_id, 'documents', 'ON_DOCUMENT_REVISION_DUE', v_payload
      );
      update public.wiki_pages
         set last_revision_due_emit_at = now()
       where id = v_row.id;
      v_count := v_count + 1;
    exception
      when undefined_function then null;
      when undefined_table    then null;
      when others then
        begin
          insert into public.workflow_runs (
            organization_id, rule_id, source_module, event, status, detail
          ) values (
            v_row.organization_id, null, 'documents', 'ON_DOCUMENT_REVISION_DUE',
            'failed',
            jsonb_build_object('page_id', v_row.id, 'error', sqlerrm)
          );
        exception when undefined_table then null;
        end;
    end;
  end loop;

  -- ── (B) Pages overdue, debounced 7d ──
  for v_row in
    select p.*
      from public.wiki_pages p
     where p.status = 'published'
       and p.next_revision_due_at is not null
       and p.next_revision_due_at < now()
       and coalesce(p.last_revision_overdue_emit_at, '1970-01-01'::timestamptz)
             < now() - interval '7 days'
     for update skip locked
  loop
    v_payload := jsonb_build_object(
      'id',                 v_row.id,
      'rowId',              v_row.id,
      'documentSlug',       v_row.id,
      'title',              v_row.title,
      'organization_id',    v_row.organization_id,
      'revisionAt',         v_row.next_revision_due_at,
      'next_revision_due_at', v_row.next_revision_due_at,
      'overdue_seconds',    extract(epoch from (now() - v_row.next_revision_due_at))::bigint,
      'legalBasis',         to_jsonb(coalesce(v_row.legal_refs, '{}'::text[])),
      'legal_basis',        to_jsonb(coalesce(v_row.legal_refs, '{}'::text[])),
      'version',            v_row.version,
      'space_id',           v_row.space_id
    );

    begin
      perform public.workflow_dispatch_db_event(
        v_row.organization_id, 'documents', 'ON_DOCUMENT_REVISION_OVERDUE', v_payload
      );
      update public.wiki_pages
         set last_revision_overdue_emit_at = now()
       where id = v_row.id;
      v_count := v_count + 1;
    exception
      when undefined_function then null;
      when undefined_table    then null;
      when others then
        begin
          insert into public.workflow_runs (
            organization_id, rule_id, source_module, event, status, detail
          ) values (
            v_row.organization_id, null, 'documents', 'ON_DOCUMENT_REVISION_OVERDUE',
            'failed',
            jsonb_build_object('page_id', v_row.id, 'error', sqlerrm)
          );
        exception when undefined_table then null;
        end;
    end;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.workflow_emit_documents_revision_tick() to service_role;

comment on function public.workflow_emit_documents_revision_tick() is
  'Scans wiki_pages for revision due within 30 days (REVISION_DUE) and past-due (REVISION_OVERDUE). Both debounced 7 days via wiki_pages.last_revision_due_emit_at / last_revision_overdue_emit_at. Intended for pg_cron at 04:00 daily.';

-- pg_cron registration — daily 04:00 (mirrors _120100 pattern for compliance).
do $cron$
declare
  r record;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for r in (select jobid from cron.job
                where jobname = 'workflow_emit_documents_revision_tick')
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;
exception
  when undefined_table    then null;
  when undefined_function then null;
end
$cron$;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'workflow_emit_documents_revision_tick',
      '0 4 * * *',
      $cmd$select public.workflow_emit_documents_revision_tick();$cmd$
    );
  end if;
exception
  when undefined_table then
    raise notice 'pg_cron not installed — schedule public.workflow_emit_documents_revision_tick() externally';
  when undefined_function then
    raise notice 'pg_cron.schedule unavailable — schedule public.workflow_emit_documents_revision_tick() externally';
end
$cron$;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 4. Annual-review triggers (insert started / complete completed)         │
-- ╰─────────────────────────────────────────────────────────────────────────╯
--
-- wiki_annual_reviews (status in_progress | completed | overdue) is the
-- canonical årsgjennomgang table. INSERT emits STARTED; UPDATE that flips
-- status → completed emits COMPLETED.

do $migrate$
begin
  if to_regclass('public.wiki_annual_reviews') is null then
    raise notice 'wiki_annual_reviews not present — skipping annual-review triggers';
    return;
  end if;

  -- Trigger function for STARTED.
  execute $fn$
    create or replace function public.trg_wiki_annual_reviews_workflow_started()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_row jsonb;
    begin
      v_row := jsonb_build_object(
        'id',              new.id,
        'rowId',           new.id,
        'organization_id', new.organization_id,
        'year',            new.year,
        'status',          new.status,
        'started_at',      new.started_at,
        'items_total',     new.items_total,
        'legalBasis',      to_jsonb(ARRAY['IK-f § 5 nr. 8']::text[]),
        'legal_basis',     to_jsonb(ARRAY['IK-f § 5 nr. 8']::text[])
      );
      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'documents', 'ON_ANNUAL_REVIEW_STARTED', v_row
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;
      return new;
    end;
    $body$;
  $fn$;

  -- Trigger function for COMPLETED.
  execute $fn$
    create or replace function public.trg_wiki_annual_reviews_workflow_completed()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $body$
    declare
      v_row jsonb;
    begin
      if not (new.status = 'completed' and (old.status is distinct from 'completed')) then
        return new;
      end if;
      v_row := jsonb_build_object(
        'id',              new.id,
        'rowId',           new.id,
        'organization_id', new.organization_id,
        'year',            new.year,
        'status',          new.status,
        'completed_at',    new.completed_at,
        'completed_by',    new.completed_by,
        'items_reviewed',  new.items_reviewed,
        'items_total',     new.items_total,
        'legalBasis',      to_jsonb(ARRAY['IK-f § 5 nr. 8']::text[]),
        'legal_basis',     to_jsonb(ARRAY['IK-f § 5 nr. 8']::text[])
      );
      begin
        perform public.workflow_dispatch_db_event(
          new.organization_id, 'documents', 'ON_ANNUAL_REVIEW_COMPLETED', v_row
        );
      exception
        when undefined_function then null;
        when undefined_table    then null;
        when others             then null;
      end;
      return new;
    end;
    $body$;
  $fn$;

  execute 'drop trigger if exists wiki_annual_reviews_workflow_started_tg on public.wiki_annual_reviews';
  execute 'create trigger wiki_annual_reviews_workflow_started_tg
           after insert on public.wiki_annual_reviews
           for each row execute function public.trg_wiki_annual_reviews_workflow_started()';

  execute 'drop trigger if exists wiki_annual_reviews_workflow_completed_tg on public.wiki_annual_reviews';
  execute 'create trigger wiki_annual_reviews_workflow_completed_tg
           after update of status on public.wiki_annual_reviews
           for each row execute function public.trg_wiki_annual_reviews_workflow_completed()';
end
$migrate$;

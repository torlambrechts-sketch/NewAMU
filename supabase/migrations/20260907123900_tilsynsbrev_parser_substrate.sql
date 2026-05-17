-- Tilsynsbrev-parser substrate (MVP) — AML kapittel 18 (Arbeidstilsynet
-- tilsyn, pålegg, reaksjoner) + GDPR Art. 58 / personopplysningsloven
-- kapittel 7 (Datatilsynets kontrollkompetanse). Substrate-tabeller +
-- storage-bucket + workflow-event for opplastede tilsynsbrev. Selve
-- parser-løpet kjøres i edge-funksjonen tilsynsbrev-parser; denne
-- migrasjonen oppretter bare tabellene som funksjonen + UI leser/skriver.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 18-6 (pålegg + frister må følges
--   opp og dokumenteres — uten et register av selve tilsynsbrevet blir
--   spor til pålegg-kilde ufullstendig); IK-f § 5 nr. 7 (sporbar HMS-
--   doku-logging); GDPR Art. 58 (3) c og Art. 33 (5) (Datatilsynets
--   kontroller skal kunne dokumenteres). Konfidensialitet er default
--   'restricted' siden tilsynssaker rutinemessig inneholder navn på
--   ansatte/avvik som ikke skal være åpne for hele organisasjonen.
--   Restrisiko deferred: PDF-tekstuttrekk i Deno-runtime er ikke løst —
--   edge-funksjonen sender base64-bytes til Claude når API-nøkkel er
--   tilgjengelig, ellers regex-fallback over et heuristisk lest tekst-
--   utdrag. Reell pdfjs/pdf-parse-integrasjon må skje i v0.2.

set local search_path = public, pg_catalog;

-- ── 1. tilsynsbrev_uploads ───────────────────────────────────────────────
create table if not exists public.tilsynsbrev_uploads (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete restrict,
  uploaded_by            uuid references public.profiles(id) on delete set null,
  uploaded_at            timestamptz not null default now(),
  source_type            text not null default 'arbeidstilsynet'
                           check (source_type in (
                             'arbeidstilsynet','datatilsynet','helsetilsynet',
                             'ukom','ldo','other'
                           )),
  storage_path           text not null,
  sha256_checksum        text not null,
  parsed_status          text not null default 'pending'
                           check (parsed_status in ('pending','parsing','parsed','failed')),
  parsed_at              timestamptz,
  parsed_payload         jsonb,
  parser_kind            text,
  parser_version         text,
  manual_review_status   text not null default 'not_reviewed'
                           check (manual_review_status in (
                             'not_reviewed','accepted','edited','rejected'
                           )),
  reviewed_by            uuid references public.profiles(id) on delete set null,
  reviewed_at            timestamptz,
  confidentiality_level  text not null default 'restricted'
                           check (confidentiality_level in ('standard','restricted','confidential')),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists tilsynsbrev_uploads_org_idx
  on public.tilsynsbrev_uploads (organization_id, uploaded_at desc);
create index if not exists tilsynsbrev_uploads_status_idx
  on public.tilsynsbrev_uploads (organization_id, parsed_status);

drop trigger if exists tilsynsbrev_uploads_set_updated_at on public.tilsynsbrev_uploads;
create trigger tilsynsbrev_uploads_set_updated_at
  before update on public.tilsynsbrev_uploads
  for each row execute function public.set_updated_at();

comment on table public.tilsynsbrev_uploads is
  'Uploaded inspeksjonsbrev (PDF) from Arbeidstilsynet / Datatilsynet / Helsetilsynet / UKOM / LDO. Parsed asynkront av edge-funksjonen tilsynsbrev-parser; parsed_payload inneholder { citedParagraphs, deadlines, findings, summary }. Konfidensialitet default ''restricted'' — tilsynssaker rutinemessig sensitive.';
comment on column public.tilsynsbrev_uploads.storage_path is
  'Path inside bucket ''tilsynsbrev'': <org_id>/<filename>.pdf. RLS-prefikssjekk på første path-segment matches mot caller.organization_id.';
comment on column public.tilsynsbrev_uploads.parser_kind is
  'Which extractor produced parsed_payload: ''llm:claude'' (Anthropic Claude via edge fn) or ''regex:fallback'' (no API key configured) or ''manual'' (admin overskrev).';
comment on column public.tilsynsbrev_uploads.parsed_payload is
  'Strukturert ekstraksjon: {summary:text, regulator:text, letterDate:date, citedParagraphs:[{ref,excerpt,severity,deadline}], findings:[{description,severity,suggestedActions[]}]}. Skrevet av edge fn; speilet rad-for-rad i tilsynsbrev_extracted_paragraphs for indexering/filtering.';

-- ── 2. tilsynsbrev_extracted_paragraphs (en rad per sitert paragraf) ─────
create table if not exists public.tilsynsbrev_extracted_paragraphs (
  id              uuid primary key default gen_random_uuid(),
  upload_id       uuid not null references public.tilsynsbrev_uploads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  paragraph_ref   text not null,
  excerpt         text,
  severity        text check (severity in ('info','observasjon','pålegg','tvangsmulkt')),
  deadline_at     timestamptz,
  status          text not null default 'open'
                    check (status in ('open','addressed','contested','closed')),
  linked_task_id  uuid references public.tasks(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tilsynsbrev_paragraphs_upload_idx
  on public.tilsynsbrev_extracted_paragraphs (upload_id);
create index if not exists tilsynsbrev_paragraphs_org_status_idx
  on public.tilsynsbrev_extracted_paragraphs (organization_id, status, deadline_at);
create index if not exists tilsynsbrev_paragraphs_ref_idx
  on public.tilsynsbrev_extracted_paragraphs (paragraph_ref);

drop trigger if exists tilsynsbrev_paragraphs_set_updated_at on public.tilsynsbrev_extracted_paragraphs;
create trigger tilsynsbrev_paragraphs_set_updated_at
  before update on public.tilsynsbrev_extracted_paragraphs
  for each row execute function public.set_updated_at();

comment on table public.tilsynsbrev_extracted_paragraphs is
  'Én rad per sitert paragraf i et tilsynsbrev. Lar oss filtre + drill-down på paragraph_ref (eksakt strengmatch mot law_refs[] på øvrige moduler) uten å åpne parsed_payload-jsonb. linked_task_id settes når en oppgave opprettes via tilsynsbrev_create_task_for_paragraph().';

-- ── 3. RLS ───────────────────────────────────────────────────────────────
alter table public.tilsynsbrev_uploads enable row level security;
alter table public.tilsynsbrev_extracted_paragraphs enable row level security;

-- SELECT: org-medlem; konfidensialitets-gate når restricted/confidential.
-- Vi bruker user_has_permission_strict for konfidensialitet (ingen org-
-- admin-shortcut) for å unngå at admins ser tilsynssaker som ikke er
-- delt — samme mønster som workflow_runs (_120200).
drop policy if exists "tilsynsbrev_uploads_select_org" on public.tilsynsbrev_uploads;
create policy "tilsynsbrev_uploads_select_org"
  on public.tilsynsbrev_uploads for select
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or uploaded_by = (select auth.uid())
      or public.user_has_permission_strict('tilsynsbrev.view_confidential')
    )
  );

drop policy if exists "tilsynsbrev_uploads_insert_perm" on public.tilsynsbrev_uploads;
create policy "tilsynsbrev_uploads_insert_perm"
  on public.tilsynsbrev_uploads for insert
  with check (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

drop policy if exists "tilsynsbrev_uploads_update_perm" on public.tilsynsbrev_uploads;
create policy "tilsynsbrev_uploads_update_perm"
  on public.tilsynsbrev_uploads for update
  using (
    organization_id = public.current_org_id()
    and (
      confidentiality_level = 'standard'
      or uploaded_by = (select auth.uid())
      or public.user_has_permission_strict('tilsynsbrev.view_confidential')
    )
  )
  with check (organization_id = public.current_org_id());

-- DELETE: hard-denied. Tilsynssaker er bevis-bærende; bruk arkivering
-- via manual_review_status='rejected' + notes.
drop policy if exists "tilsynsbrev_uploads_delete_denied" on public.tilsynsbrev_uploads;
create policy "tilsynsbrev_uploads_delete_denied"
  on public.tilsynsbrev_uploads for delete
  using (false);

drop policy if exists "tilsynsbrev_paragraphs_select_org" on public.tilsynsbrev_extracted_paragraphs;
create policy "tilsynsbrev_paragraphs_select_org"
  on public.tilsynsbrev_extracted_paragraphs for select
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.tilsynsbrev_uploads u
       where u.id = tilsynsbrev_extracted_paragraphs.upload_id
         and (
           u.confidentiality_level = 'standard'
           or u.uploaded_by = (select auth.uid())
           or public.user_has_permission_strict('tilsynsbrev.view_confidential')
         )
    )
  );

drop policy if exists "tilsynsbrev_paragraphs_insert_perm" on public.tilsynsbrev_extracted_paragraphs;
create policy "tilsynsbrev_paragraphs_insert_perm"
  on public.tilsynsbrev_extracted_paragraphs for insert
  with check (
    organization_id = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

drop policy if exists "tilsynsbrev_paragraphs_update_perm" on public.tilsynsbrev_extracted_paragraphs;
create policy "tilsynsbrev_paragraphs_update_perm"
  on public.tilsynsbrev_extracted_paragraphs for update
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

drop policy if exists "tilsynsbrev_paragraphs_delete_denied" on public.tilsynsbrev_extracted_paragraphs;
create policy "tilsynsbrev_paragraphs_delete_denied"
  on public.tilsynsbrev_extracted_paragraphs for delete
  using (false);

-- ── 4. Storage bucket ────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tilsynsbrev',
  'tilsynsbrev',
  false,
  25 * 1024 * 1024,
  array['application/pdf']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tilsynsbrev_storage_read on storage.objects;
create policy tilsynsbrev_storage_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tilsynsbrev'
    and nullif(split_part(name, '/', 1), '')::uuid = public.current_org_id()
  );

drop policy if exists tilsynsbrev_storage_write on storage.objects;
create policy tilsynsbrev_storage_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tilsynsbrev'
    and nullif(split_part(name, '/', 1), '')::uuid = public.current_org_id()
    and public.user_has_permission('tilsynsbrev.upload')
  );

-- Update/delete denied for end users — only edge fn (service_role) writes
-- after the initial upload.
drop policy if exists tilsynsbrev_storage_update_denied on storage.objects;
create policy tilsynsbrev_storage_update_denied
  on storage.objects for update
  to authenticated
  using (bucket_id = 'tilsynsbrev' and false);

drop policy if exists tilsynsbrev_storage_delete_denied on storage.objects;
create policy tilsynsbrev_storage_delete_denied
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'tilsynsbrev' and false);

-- ── 5. Workflow event: ON_TILSYNSBREV_UPLOADED ───────────────────────────
-- Trigger fires on insert (status pending → parsing); fires AGAIN when
-- parsed_status transitions to 'parsed' (parser har strukturert payload).
-- Følger samme defensiv-wrap mønster som dokumenter/alerts-emisjonene.

create or replace function public.trg_tilsynsbrev_workflow_emit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb;
  v_event   text;
begin
  -- INSERT fires ON_TILSYNSBREV_UPLOADED. UPDATE to parsed_status='parsed'
  -- fires ON_TILSYNSBREV_PARSED so workflow-regler kan reagere både på
  -- selve mottak (typisk triage-oppgave) og på ferdig parsing (typisk
  -- auto-oppgaver per pålegg).
  if TG_OP = 'INSERT' then
    v_event := 'ON_TILSYNSBREV_UPLOADED';
  elsif TG_OP = 'UPDATE'
        and new.parsed_status = 'parsed'
        and (old.parsed_status is distinct from 'parsed') then
    v_event := 'ON_TILSYNSBREV_PARSED';
  else
    return new;
  end if;

  perform set_config('app.workflow_confidentiality',
                     coalesce(new.confidentiality_level, 'restricted'), true);

  v_payload := jsonb_build_object(
    'id',                   new.id,
    'rowId',                new.id,
    'organization_id',      new.organization_id,
    'source_type',          new.source_type,
    'uploaded_at',          new.uploaded_at,
    'uploaded_by',          new.uploaded_by,
    'parsed_status',        new.parsed_status,
    'parser_kind',          new.parser_kind,
    'parser_version',       new.parser_version,
    'storage_path',         new.storage_path,
    'sha256_checksum',      new.sha256_checksum,
    'confidentiality_level', new.confidentiality_level,
    'parsed_payload',       coalesce(new.parsed_payload, '{}'::jsonb)
  );

  begin
    perform public.workflow_dispatch_db_event(
      new.organization_id,
      'tilsynsbrev',
      v_event,
      v_payload
    );
  exception
    when undefined_function then null;
    when undefined_table    then null;
    when others             then
      begin
        insert into public.workflow_runs (
          organization_id, rule_id, source_module, event, status, detail
        ) values (
          new.organization_id, null, 'tilsynsbrev', v_event,
          'failed',
          jsonb_build_object('upload_id', new.id, 'error', sqlerrm,
                             'stage', 'trg_tilsynsbrev_workflow_emit')
        );
      exception when undefined_table then null;
      end;
  end;

  return new;
end;
$$;

drop trigger if exists tilsynsbrev_uploads_workflow_emit on public.tilsynsbrev_uploads;
create trigger tilsynsbrev_uploads_workflow_emit
  after insert or update of parsed_status on public.tilsynsbrev_uploads
  for each row execute function public.trg_tilsynsbrev_workflow_emit();

comment on function public.trg_tilsynsbrev_workflow_emit() is
  'Dispatcher: emits ON_TILSYNSBREV_UPLOADED on insert and ON_TILSYNSBREV_PARSED when parsed_status flips to ''parsed''. Sets app.workflow_confidentiality GUC so downstream workflow_runs inherit the upload-row gate.';

-- ── 6. RPC: opprett oppgave for ett pålegg ───────────────────────────────
-- Brukes fra detalj-siden når saksbehandler klikker «Opprett oppgave for
-- dette pålegget». Lager en rad i public.tasks med source='tilsynsbrev',
-- source_id=upload_id og knytter linked_task_id på paragraph-raden.

create or replace function public.tilsynsbrev_create_task_for_paragraph(
  p_paragraph_id    uuid,
  p_assignee_user_id uuid default null,
  p_due_at          timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_para  record;
  v_org   uuid;
  v_due   timestamptz;
  v_task  uuid;
begin
  select p.*, u.organization_id as org_id, u.source_type, u.confidentiality_level
    into v_para
    from public.tilsynsbrev_extracted_paragraphs p
    join public.tilsynsbrev_uploads u on u.id = p.upload_id
   where p.id = p_paragraph_id;

  if not found then
    raise exception 'paragraph % not found', p_paragraph_id;
  end if;

  v_org := v_para.org_id;
  if v_org <> public.current_org_id() then
    raise exception 'cross-org access denied';
  end if;
  if not public.user_has_permission('tilsynsbrev.upload') then
    raise exception 'permission denied: tilsynsbrev.upload required';
  end if;

  -- Frist: caller-override > paragraph-deadline > +14d default.
  v_due := coalesce(p_due_at, v_para.deadline_at, now() + interval '14 days');

  insert into public.tasks (
    organization_id, source, source_id, title, description,
    assigned_to, due_at, status, priority, created_by
  ) values (
    v_org,
    'tilsynsbrev',
    v_para.upload_id,
    format('Pålegg: %s', v_para.paragraph_ref),
    coalesce(
      'Tilsynsbrev fra ' || v_para.source_type || E'.\n\n' ||
        coalesce(v_para.excerpt, '(ingen sitat-utdrag)') ||
        E'\n\nReferanse: ' || v_para.paragraph_ref,
      'Pålegg fra tilsynsbrev'
    ),
    p_assignee_user_id,
    v_due,
    'todo',
    case when v_para.severity in ('pålegg','tvangsmulkt') then 'high' else 'normal' end,
    auth.uid()
  )
  returning id into v_task;

  update public.tilsynsbrev_extracted_paragraphs
     set linked_task_id = v_task,
         status         = case when status = 'open' then 'addressed' else status end
   where id = p_paragraph_id;

  return v_task;
end;
$$;

revoke all on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz) from public;
grant execute on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz)
  to authenticated, service_role;

comment on function public.tilsynsbrev_create_task_for_paragraph(uuid, uuid, timestamptz) is
  'Oppretter task fra ekstrahert paragraf. Setter linked_task_id + flytter status til ''addressed''. Aktivert fra detalj-side; per v0 lager admin manuelt — ingen auto-opprettelse på parse-tidspunkt.';

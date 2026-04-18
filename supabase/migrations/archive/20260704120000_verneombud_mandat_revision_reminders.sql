-- Verneombud mandat template, AML §6-1 coverage + max_revision_months, revision reminders helper.

-- ---------------------------------------------------------------------------
-- 1. Optional max_revision_months on legal coverage (24 mnd for valgperiode)
-- ---------------------------------------------------------------------------

alter table public.wiki_legal_coverage_items
  add column if not exists max_revision_months int;

comment on column public.wiki_legal_coverage_items.max_revision_months is
  'When set, revision reminders respect this cap (e.g. 24 for verneombud election term).';

-- ---------------------------------------------------------------------------
-- 2. System template tpl-verneombud-mandat + emergency_stop_procedure on HMS / beredskap
-- ---------------------------------------------------------------------------

insert into public.document_system_templates (
  id, slug, label, description, category, legal_basis, page_payload, sort_order
)
values (
  'tpl-verneombud-mandat',
  'tpl-verneombud-mandat',
  'Verneombudets mandat og valgdokumentasjon',
  'Dokumentasjon av valg, valgperiode, opplæring og ansvarsområde for verneombud — AML §6-1–§6-5.',
  'guide',
  array['AML §6-1', 'AML §6-2', 'AML §6-3', 'AML §6-5']::text[],
  $$
  {
    "title": "Verneombudets mandat og valgdokumentasjon",
    "summary": "Valg, valgperiode (2 år), opplæring (40 t), ansvarsområde og arbeidsgivers plikter.",
    "status": "draft",
    "template": "standard",
    "legalRefs": ["AML §6-1", "AML §6-2", "AML §6-3", "AML §6-4", "AML §6-5"],
    "requiresAcknowledgement": false,
    "revisionIntervalMonths": 24,
    "blocks": [
      {
        "kind": "alert",
        "variant": "info",
        "text": "Verneombud velges for to år om gangen (AML §6-1 (4)). Bruk neste revisjonsdato som påminnelse om nyvalg."
      },
      { "kind": "heading", "level": 1, "text": "Verneombudets mandat og valgdokumentasjon" },
      { "kind": "heading", "level": 2, "text": "Dato for valg av verneombud" },
      { "kind": "text", "body": "<p>[FYLL INN: valgdato]</p>" },
      { "kind": "heading", "level": 2, "text": "Navn på valgt verneombud og stedfortreder" },
      { "kind": "text", "body": "<p>[FYLL INN: verneombud — navn]<br/>[FYLL INN: stedfortreder — navn]</p>" },
      {
        "kind": "module",
        "moduleName": "live_org_chart",
        "params": { "showVerneombud": true, "showAMU": false }
      },
      { "kind": "heading", "level": 2, "text": "Valgperiode" },
      {
        "kind": "text",
        "body": "<p>Valgperiode: <strong>2 år</strong> (AML §6-1 (4)). Fra: [dato] — til: [dato]</p>"
      },
      { "kind": "heading", "level": 2, "text": "Opplæring (40 timer)" },
      {
        "kind": "text",
        "body": "<p>[FYLL INN: Bekreft at obligatorisk verneombudsopplæring (minst 40 timer, AML §6-5) er gjennomført eller planlagt med dato.]</p>"
      },
      { "kind": "heading", "level": 2, "text": "Verneombudets ansvarsområde" },
      {
        "kind": "text",
        "body": "<p>[FYLL INN: avdeling(er), lokasjon(er) eller verneområde som verneombudet dekker.]</p>"
      },
      {
        "kind": "heading",
        "level": 2,
        "text": "Arbeidsgivers plikter overfor verneombudet (AML §6-4)"
      },
      {
        "kind": "text",
        "body": "<p>Arbeidsgiver skal legge til rette for at verneombudet kan utføre vervet, blant annet ved tilstrekkelig tid og informasjon. [FYLL INN: praktiske tiltak hos oss.]</p>"
      },
      { "kind": "module", "moduleName": "emergency_stop_procedure", "params": {} },
      {
        "kind": "law_ref",
        "ref": "AML §6-1",
        "description": "Verneombud — valg og verneområde",
        "url": "https://lovdata.no/lov/2005-06-17-62/§6-1"
      },
      {
        "kind": "law_ref",
        "ref": "AML §6-2",
        "description": "Verneombudets oppgaver",
        "url": "https://lovdata.no/lov/2005-06-17-62/§6-2"
      },
      {
        "kind": "law_ref",
        "ref": "AML §6-3",
        "description": "Rett til å stanse farlig arbeid",
        "url": "https://lovdata.no/lov/2005-06-17-62/§6-3"
      },
      {
        "kind": "law_ref",
        "ref": "AML §6-4",
        "description": "Arbeidsgivers plikter overfor verneombudet",
        "url": "https://lovdata.no/lov/2005-06-17-62/§6-4"
      },
      {
        "kind": "law_ref",
        "ref": "AML §6-5",
        "description": "Opplæring og ressurser",
        "url": "https://lovdata.no/lov/2005-06-17-62/§6-5"
      }
    ]
  }
  $$::jsonb,
  97
)
on conflict (id) do update set
  slug = excluded.slug,
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  page_payload = excluded.page_payload,
  sort_order = excluded.sort_order;

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select coalesce(jsonb_agg(b), '[]'::jsonb)
    from jsonb_array_elements(page_payload->'blocks') as b
    where not (b->>'kind' = 'module' and b->>'moduleName' = 'emergency_stop_procedure')
  ) || jsonb_build_array(jsonb_build_object('kind', 'module', 'moduleName', 'emergency_stop_procedure', 'params', '{}'::jsonb))
)
where id = 'tpl-hms-policy'
  and not exists (
    select 1
    from jsonb_array_elements(page_payload->'blocks') b
    where b->>'kind' = 'module' and b->>'moduleName' = 'emergency_stop_procedure'
  );

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select coalesce(jsonb_agg(b), '[]'::jsonb)
    from jsonb_array_elements(page_payload->'blocks') as b
    where not (b->>'kind' = 'module' and b->>'moduleName' = 'emergency_stop_procedure')
  ) || jsonb_build_array(jsonb_build_object('kind', 'module', 'moduleName', 'emergency_stop_procedure', 'params', '{}'::jsonb))
)
where id = 'tpl-beredskap'
  and not exists (
    select 1
    from jsonb_array_elements(page_payload->'blocks') b
    where b->>'kind' = 'module' and b->>'moduleName' = 'emergency_stop_procedure'
  );

-- ---------------------------------------------------------------------------
-- 3. Legal coverage AML §6-1
-- ---------------------------------------------------------------------------

insert into public.wiki_legal_coverage_items (ref, label, template_ids, max_revision_months)
values ('AML §6-1', 'Verneombud valgt og dokumentert', array['tpl-verneombud-mandat']::text[], 24)
on conflict (ref) do update set
  label = excluded.label,
  template_ids = excluded.template_ids,
  max_revision_months = excluded.max_revision_months;

-- ---------------------------------------------------------------------------
-- 4. Queue revision reminders (~60 days before next_revision_due_at)
--    Call from pg_cron or an Edge Function: select public.wiki_enqueue_revision_reminders();
-- ---------------------------------------------------------------------------

create or replace function public.wiki_enqueue_revision_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ins int;
begin
  insert into public.workflow_action_queue (
    organization_id,
    step_type,
    config_json,
    context_json,
    status
  )
  select
    p.organization_id,
    'send_notification',
    jsonb_build_object(
      'title',
      case
        when p.legal_refs @> array['AML §6-1']::text[] then 'Verneombudets valgperiode utløper snart'
        else 'Dokument nærmer seg revisjonsfrist'
      end,
      'body',
      case
        when p.legal_refs @> array['AML §6-1']::text[] then
          'Verneombudets valgperiode utløper om 60 dager. Nyvalg må gjennomføres.'
        else
          'Dokumentet «' || coalesce(p.title, 'Uten tittel') || '» har revisjonsfrist om 60 dager.'
      end
    ),
    jsonb_build_object(
      'pageId', p.id,
      'nextRevisionDueAt', p.next_revision_due_at,
      'source', 'wiki_revision_reminder'
    ),
    'pending'
  from public.wiki_pages p
  where p.status = 'published'
    and p.next_revision_due_at is not null
    and p.next_revision_due_at between now() + interval '59 days' and now() + interval '61 days'
    and not exists (
      select 1
      from public.workflow_action_queue q
      where q.organization_id = p.organization_id
        and q.status in ('pending', 'processing')
        and (q.context_json->>'pageId')::uuid = p.id
        and coalesce(q.context_json->>'source', '') = 'wiki_revision_reminder'
        and q.created_at > now() - interval '14 days'
    );

  get diagnostics v_ins = row_count;
  return coalesce(v_ins, 0);
end;
$$;

comment on function public.wiki_enqueue_revision_reminders() is
  'Queues send_notification when published wiki_pages.next_revision_due_at is in ~60 days (idempotent). Verneombud mandate pages (legal_refs contains AML §6-1) use election-specific copy.';

-- Meetings — default_confidentiality_level template-level field (H7).
--
-- Why
--   The MeetingsHubView currently uses a slug-regex heuristic to pick
--   the default confidentiality level for drøfting/varsling/MUS
--   templates. Slug-coupling is fragile — promoting it to a real
--   template-level column lets admins control the default per template
--   (system + org-custom) without renaming slugs.
--
-- Strategy
--   Additive column on both meeting_system_templates and
--   meeting_org_templates. CHECK constraint matches the existing
--   meetings.confidentiality_level enum. Backfill the four affected
--   system templates to 'restricted'. All other rows keep 'standard'
--   default.

set local search_path = public, pg_catalog;

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 1. Add column to meeting_system_templates                                │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_system_templates
  add column if not exists default_confidentiality_level text not null
    default 'standard';

alter table public.meeting_system_templates
  drop constraint if exists meeting_system_templates_default_conf_check;

alter table public.meeting_system_templates
  add constraint meeting_system_templates_default_conf_check
  check (default_confidentiality_level in ('standard', 'restricted', 'confidential'));

comment on column public.meeting_system_templates.default_confidentiality_level is
  'Default confidentiality_level set on meetings created from this template. '
  'Auditor-facing privacy default — admin can still override at meeting creation.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 2. Add column to meeting_org_templates                                   │
-- ╰─────────────────────────────────────────────────────────────────────────╯

alter table public.meeting_org_templates
  add column if not exists default_confidentiality_level text not null
    default 'standard';

alter table public.meeting_org_templates
  drop constraint if exists meeting_org_templates_default_conf_check;

alter table public.meeting_org_templates
  add constraint meeting_org_templates_default_conf_check
  check (default_confidentiality_level in ('standard', 'restricted', 'confidential'));

comment on column public.meeting_org_templates.default_confidentiality_level is
  'Default confidentiality_level set on meetings created from this template.';

-- ╭─────────────────────────────────────────────────────────────────────────╮
-- │ 3. Backfill the four sensitive system templates → 'restricted'           │
-- ╰─────────────────────────────────────────────────────────────────────────╯

update public.meeting_system_templates
set default_confidentiality_level = 'restricted',
    updated_at = now()
where id in (
        'drofting-omstilling',
        'drofting-likestilling',
        'varslingsutvalg',
        'mus'
      )
  and default_confidentiality_level <> 'restricted';

-- Verification:
-- expected: 4 rows with 'restricted'; all others 'standard'
-- select id, default_confidentiality_level
-- from public.meeting_system_templates
-- order by default_confidentiality_level desc, sort_order;

-- ═══════════════════════════════════════════════════════════════════════════
-- SURVEY MODULE — Core tables
-- Compliance: AML § 3-1, § 4-1, § 4-3, § 4-4, Kap 6&7
--             IK-forskriften § 5, GDPR (n≥5 anonymity threshold)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Campaigns ──────────────────────────────────────────────────────────────
create table if not exists public.survey_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  title              text not null,
  description        text,
  pillar             text not null default 'psychosocial'
    check (pillar in ('psychosocial','physical','organization','safety_culture','custom')),
  question_set        text not null default 'qpsnordic'
    check (question_set in ('qpsnordic','ark','custom')),
  status             text not null default 'draft'
    check (status in ('draft','open','closed','archived')),
  opens_at           timestamptz,
  closes_at          timestamptz,
  anonymity_threshold integer not null default 5
    check (anonymity_threshold > 0),
  recurrence_months  integer
    check (recurrence_months is null or (recurrence_months between 1 and 120)),
  next_scheduled_at  timestamptz,
  amu_review_required boolean not null default true,
  action_threshold   integer not null default 60
    check (action_threshold between 0 and 100),
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Questions ──────────────────────────────────────────────────────────────
create table if not exists public.survey_questions (
  id                uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references public.survey_campaigns(id) on delete cascade,
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  pillar             text not null
    check (pillar in ('psychosocial','physical','organization','safety_culture','custom')),
  category           text not null,
  question_text      text not null,
  question_type      text not null default 'likert5'
    check (question_type in ('likert5','likert7','yesno','text','nps')),
  source_key         text,
  is_mandatory        boolean not null default false,
  mandatory_law       text
    check (mandatory_law is null or mandatory_law in ('AML_4_3','AML_4_4','AML_6_2')),
  sort_order         integer not null default 0,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now()
);

-- ── Responses (anonymous by design) ───────────────────────────────────────
create table if not exists public.survey_responses (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.survey_campaigns(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  question_id         uuid not null references public.survey_questions(id) on delete cascade,
  respondent_token    text not null,
  department         text,
  answer_numeric     integer,
  answer_text         text,
  answer_bool         boolean,
  submitted_at        timestamptz not null default now()
);

create unique index if not exists survey_responses_token_question_uidx
  on public.survey_responses(respondent_token, question_id);

-- ── Aggregated results cache ───────────────────────────────────────────────
create table if not exists public.survey_results_cache (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.survey_campaigns(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  department         text,
  pillar             text not null,
  category           text not null,
  question_id         uuid references public.survey_questions(id) on delete set null,
  score              numeric(5,2),
  response_count      integer not null check (response_count >= 0),
  is_suppressed      boolean not null default false,
  computed_at         timestamptz not null default now()
);

-- ── Action plans ─────────────────────────────────────────────────────────────
create table if not exists public.survey_action_plans (
  id                   uuid primary key default gen_random_uuid(),
  campaign_id          uuid not null references public.survey_campaigns(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  ik_action_plan_id   uuid references public.ik_action_plans(id) on delete set null,
  pillar              text not null
    check (pillar in ('psychosocial','physical','organization','safety_culture','custom')),
  category             text not null,
  score                numeric(5,2),
  trigger_threshold    integer not null,
  title                text not null,
  description          text,
  status               text not null default 'open'
    check (status in ('open','in_progress','closed')),
  assigned_to         uuid references auth.users(id) on delete set null,
  due_at               timestamptz,
  closed_at            timestamptz,
  closed_by            uuid references auth.users(id) on delete set null,
  created_by          uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── AMU review ────────────────────────────────────────────────────────────
create table if not exists public.survey_amu_reviews (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.survey_campaigns(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  meeting_date        date,
  agenda_item         text,
  amu_chair_signed_at  timestamptz,
  amu_chair_signed_by  uuid references auth.users(id) on delete set null,
  amu_chair_name      text,
  vo_signed_at        timestamptz,
  vo_signed_by         uuid references auth.users(id) on delete set null,
  vo_name              text,
  protocol_text        text,
  status              text not null default 'pending'
    check (status in ('pending','reviewed','signed')),
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Triggers: auto-update updated_at ───────────────────────────────────────
create or replace function public.survey_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists survey_campaigns_updated_at on public.survey_campaigns;
create trigger survey_campaigns_updated_at
  before update on public.survey_campaigns
  for each row execute function public.survey_set_updated_at();

drop trigger if exists survey_action_plans_updated_at on public.survey_action_plans;
create trigger survey_action_plans_updated_at
  before update on public.survey_action_plans
  for each row execute function public.survey_set_updated_at();

drop trigger if exists survey_amu_reviews_updated_at on public.survey_amu_reviews;
create trigger survey_amu_reviews_updated_at
  before update on public.survey_amu_reviews
  for each row execute function public.survey_set_updated_at();

-- ── Useful indexes ───────────────────────────────────────────────────────────
create index if not exists survey_campaigns_org_status_idx
  on public.survey_campaigns(organization_id, status, created_at desc);
create index if not exists survey_questions_campaign_idx
  on public.survey_questions(campaign_id, sort_order) where deleted_at is null;
create index if not exists survey_responses_campaign_idx
  on public.survey_responses(campaign_id);
create index if not exists survey_results_cache_campaign_idx
  on public.survey_results_cache(campaign_id, department, pillar, category);
create index if not exists survey_action_plans_campaign_idx
  on public.survey_action_plans(campaign_id, status);
create index if not exists survey_amu_reviews_campaign_idx
  on public.survey_amu_reviews(campaign_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- survey_campaigns
alter table public.survey_campaigns enable row level security;

drop policy if exists survey_campaigns_select on public.survey_campaigns;
create policy survey_campaigns_select on public.survey_campaigns for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_campaigns_insert on public.survey_campaigns;
create policy survey_campaigns_insert on public.survey_campaigns for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists survey_campaigns_update on public.survey_campaigns;
create policy survey_campaigns_update on public.survey_campaigns for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists survey_campaigns_delete on public.survey_campaigns;
create policy survey_campaigns_delete on public.survey_campaigns for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

-- survey_questions
alter table public.survey_questions enable row level security;

drop policy if exists survey_questions_select on public.survey_questions;
create policy survey_questions_select on public.survey_questions for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (deleted_at is null or public.is_org_admin())
  );

drop policy if exists survey_questions_all on public.survey_questions;
create policy survey_questions_all on public.survey_questions for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- Admins: full CRUD. Members: select only (covered by survey_questions_select).
-- "All" for admins subsumes insert/update/delete; members still use select policy only.

-- survey_responses: raw rows — list visibility restricted; inserts while campaign open
alter table public.survey_responses enable row level security;

drop policy if exists survey_responses_select on public.survey_responses;
create policy survey_responses_select on public.survey_responses for select to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists survey_responses_insert on public.survey_responses;
create policy survey_responses_insert on public.survey_responses for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.survey_campaigns c
      where c.id = survey_responses.campaign_id
        and c.organization_id = public.current_org_id()
        and c.status = 'open'
    )
  );

drop policy if exists survey_responses_update on public.survey_responses;
create policy survey_responses_update on public.survey_responses for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

drop policy if exists survey_responses_delete on public.survey_responses;
create policy survey_responses_delete on public.survey_responses for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

-- survey_results_cache: aggregated, safe to show to all org members
alter table public.survey_results_cache enable row level security;

drop policy if exists survey_results_cache_select on public.survey_results_cache;
create policy survey_results_cache_select on public.survey_results_cache for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_results_cache_write on public.survey_results_cache;
create policy survey_results_cache_write on public.survey_results_cache for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- survey_action_plans
alter table public.survey_action_plans enable row level security;

drop policy if exists survey_action_plans_select on public.survey_action_plans;
create policy survey_action_plans_select on public.survey_action_plans for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_action_plans_write on public.survey_action_plans;
create policy survey_action_plans_write on public.survey_action_plans for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- survey_amu_reviews
alter table public.survey_amu_reviews enable row level security;

drop policy if exists survey_amu_reviews_select on public.survey_amu_reviews;
create policy survey_amu_reviews_select on public.survey_amu_reviews for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists survey_amu_reviews_write on public.survey_amu_reviews;
create policy survey_amu_reviews_write on public.survey_amu_reviews for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- ── Grants ─────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.survey_campaigns to authenticated;
grant select, insert, update, delete on public.survey_questions to authenticated;
grant select, insert, update, delete on public.survey_responses to authenticated;
grant select, insert, update, delete on public.survey_results_cache to authenticated;
grant select, insert, update, delete on public.survey_action_plans to authenticated;
grant select, insert, update, delete on public.survey_amu_reviews to authenticated;

-- ── BEFORE INSERT: org / audit defaults ────────────────────────────────────
create or replace function public.survey_campaigns_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then new.organization_id := public.current_org_id(); end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists survey_campaigns_before_insert_tg on public.survey_campaigns;
create trigger survey_campaigns_before_insert_tg
  before insert on public.survey_campaigns
  for each row execute function public.survey_campaigns_before_insert();

create or replace function public.survey_questions_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  camp_org uuid;
begin
  select c.organization_id into camp_org
  from public.survey_campaigns c where c.id = new.campaign_id;
  if new.organization_id is null then
    new.organization_id := coalesce(camp_org, public.current_org_id());
  end if;
  if camp_org is not null and new.organization_id is distinct from camp_org then
    raise exception 'survey_questions.organization_id must match campaign organization';
  end if;
  return new;
end;
$$;

drop trigger if exists survey_questions_before_insert_tg on public.survey_questions;
create trigger survey_questions_before_insert_tg
  before insert on public.survey_questions
  for each row execute function public.survey_questions_before_insert();

create or replace function public.survey_responses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  q_camp  uuid;
  q_org  uuid;
begin
  select q.campaign_id, q.organization_id into q_camp, q_org
  from public.survey_questions q
  where q.id = new.question_id
    and q.deleted_at is null;
  if q_camp is null then
    raise exception 'Invalid or inactive question_id';
  end if;
  if new.campaign_id is not null and new.campaign_id is distinct from q_camp then
    raise exception 'survey_responses.campaign_id must match question campaign';
  end if;
  new.campaign_id := q_camp;
  new.organization_id := q_org;
  return new;
end;
$$;

drop trigger if exists survey_responses_before_insert_tg on public.survey_responses;
create trigger survey_responses_before_insert_tg
  before insert on public.survey_responses
  for each row execute function public.survey_responses_before_insert();

create or replace function public.survey_action_plans_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select c.organization_id into new.organization_id
    from public.survey_campaigns c where c.id = new.campaign_id;
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists survey_action_plans_before_insert_tg on public.survey_action_plans;
create trigger survey_action_plans_before_insert_tg
  before insert on public.survey_action_plans
  for each row execute function public.survey_action_plans_before_insert();

create or replace function public.survey_amu_reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select c.organization_id into new.organization_id
    from public.survey_campaigns c where c.id = new.campaign_id;
  end if;
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists survey_amu_reviews_before_insert_tg on public.survey_amu_reviews;
create trigger survey_amu_reviews_before_insert_tg
  before insert on public.survey_amu_reviews
  for each row execute function public.survey_amu_reviews_before_insert();

create or replace function public.survey_results_cache_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    select c.organization_id into new.organization_id
    from public.survey_campaigns c where c.id = new.campaign_id;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_results_cache_before_insert_tg on public.survey_results_cache;
create trigger survey_results_cache_before_insert_tg
  before insert on public.survey_results_cache
  for each row execute function public.survey_results_cache_before_insert();

-- ═══════════════════════════════════════════════════════════════════════════
-- Anonymous respond (anon role): public form without auth — same file so SQL
-- editor / partial runs cannot reference survey_questions before it exists.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon;

grant select on public.survey_questions to anon;
grant select on public.survey_campaigns to anon;
grant insert on public.survey_responses to anon;

drop policy if exists survey_questions_select_anon on public.survey_questions;
create policy survey_questions_select_anon on public.survey_questions
  for select to anon
  using (
    deleted_at is null
    and exists (
      select 1 from public.survey_campaigns c
      where c.id = survey_questions.campaign_id
        and c.status = 'open'
        and (c.opens_at is null or c.opens_at <= now())
        and (c.closes_at is null or c.closes_at >= now())
    )
  );

drop policy if exists survey_campaigns_select_anon on public.survey_campaigns;
create policy survey_campaigns_select_anon on public.survey_campaigns
  for select to anon
  using (
    status = 'open'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  );

drop policy if exists survey_responses_insert_anon on public.survey_responses;
create policy survey_responses_insert_anon on public.survey_responses
  for insert to anon
  with check (
    exists (
      select 1 from public.survey_campaigns sc
      where sc.id = survey_responses.campaign_id
        and sc.status = 'open'
        and sc.organization_id = survey_responses.organization_id
        and (sc.opens_at is null or sc.opens_at <= now())
        and (sc.closes_at is null or sc.closes_at >= now())
    )
    and exists (
      select 1 from public.survey_questions q
      where q.id = survey_responses.question_id
        and q.campaign_id = survey_responses.campaign_id
        and q.organization_id = survey_responses.organization_id
        and q.deleted_at is null
    )
  );

-- Rolle-utvidelse + MinID-integrasjon + opplærings-register-kobling
--
-- Coverage:
--   1. Funksjonelle compliance-roller — 16 forhåndsdefinerte roller som
--      utvider den eksisterende 5-roller-modellen (HseRoleGroup). Disse
--      er IKKE permission-roller (rettigheter), men FUNKSJONELLE roller
--      (hvem er verneombud, hvem er AMU-leder osv.) som styrer signoff-
--      ansvar, dokument-tilgang, og auto-tildeling.
--
--      Tabeller:
--        - functional_roles                : system-wide catalog (read-only)
--        - org_functional_role_assignments : per-user assignments per org
--
--   2. MinID lagt til org_integrations.kind-CHECK. MinID er ID-porten-
--      basert pålogging — alternativ til Feide for ikke-utdannings-
--      virksomheter. Brukes også som «sterk pålogging-lite» når BankID
--      ikke er nødvendig.
--
--   3. Opplærings-register-kobling — view som speiler learning_progress
--      mot funksjonelle roller, slik at training_matrix-dokument-modulen
--      kan vise hvilke roller har bestått hvilke kurs.

set local search_path = public, pg_catalog;

-- ── 1. Funksjonelle roller — katalog ─────────────────────────────────────

create table if not exists public.functional_roles (
  slug text primary key,
  label text not null,
  description text not null,
  category text not null check (category in (
    'ledelse',         -- Ledelse og linje
    'hms',             -- HMS-roller (VO, AMU, BHT)
    'tillitsvalgt',    -- Tillits­valgte og medvirknings­roller
    'beredskap',       -- Beredskap, brannvern, førstehjelp
    'personvern',      -- DPO, varslings­mottak
    'eksternt'         -- Tilsyn, ekstern kontakt
  )),
  legal_basis text[] not null default '{}',
  -- Hvilke retningslinjer for hvem (single-incumbent vs multi-incumbent)
  multi_incumbent boolean not null default false,
  -- Hvilke terskler utløser plikt for rollen (info kun)
  required_from_employees int,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.functional_roles is
  'System-wide catalog of 16 functional compliance roles. Read-only for orgs — assigned via org_functional_role_assignments.';

-- Seed: 16 roller
insert into public.functional_roles (slug, label, description, category, legal_basis, multi_incumbent, required_from_employees, sort_order) values
  ('daglig_leder',          'Daglig leder',           'Øverste leder med overordnet HMS-ansvar. Kan ikke delegere ansvar etter § 2-1.', 'ledelse', array['AML § 2-1','AML § 3-5','AML § 19-1'], false, null, 10),
  ('linje_leder',           'Linje­leder med personalansvar', 'Mellom­leder/avdelings­leder med operativt HMS-ansvar for egne ansatte.', 'ledelse', array['AML § 2-1','AML § 3-1','AML § 4-6'], true, null, 20),
  ('hr_leder',              'HR-leder',               'Personal­saker, varslings­mottak, sykefravær, ARP.', 'ledelse', array['AML § 4-6','AML § 14-5','LDL § 26'], false, null, 30),
  ('hms_koordinator',       'HMS-koordinator',        'HMS-leder / HMS-rådgiver. IK-system, opplæring, BHT-samspill.', 'hms', array['AML § 3-1','IK-f § 5'], false, null, 40),
  ('verneombud',            'Verneombud',             'Valgt arbeidstaker-representant per avdeling. Stansings­rett § 6-3.', 'hms', array['AML § 6-1','AML § 6-2','AML § 6-3','AML § 6-5'], true, 10, 50),
  ('hoved_verneombud',      'Hovedverneombud',        'Koordinerer verneombud på tvers av virksomheten ≥ 30 ansatte.', 'hms', array['AML § 6-1','FOLM § 3-2'], false, 30, 60),
  ('amu_leder',             'AMU-leder',              'Veksler annet hvert år mellom arbeidsgiver- og arbeidstaker­siden.', 'hms', array['AML § 7-1','AML § 7-2'], false, 30, 70),
  ('amu_medlem',            'AMU-medlem',             'Paritetisk valgt — like mange fra arbeidsgiver-/arbeidstaker­siden.', 'hms', array['AML § 7-1','AML § 7-2','AML § 7-4'], true, 30, 80),
  ('amu_sekretar',          'AMU-sekretær',           'Saksforberedelse + protokoll­føring. Ofte HMS-leder.', 'hms', array['AML § 7-2','AML § 7-3'], false, 30, 90),
  ('tillitsvalgt',          'Tillitsvalgt',           'Fagforenings­representant. Drøftings­møter etter § 8-1 og § 15-1.', 'tillitsvalgt', array['AML § 8-1','AML § 15-1'], true, null, 100),
  ('bht_kontakt',           'BHT-kontakt',            'Bindeledd mot bedriftshelse­tjenesten. Mottar BHT-årsplan.', 'hms', array['AML § 3-3','Forskrift om BHT'], false, null, 110),
  ('brannvern_leder',       'Brannvern­leder',         'Ansvarlig for brann-/eksplosjons­vern + beredskaps­plan.', 'beredskap', array['Brann- og eksplosjons­vernloven','AML § 4-1'], false, null, 120),
  ('forstehjelp_ansvarlig', 'Førstehjelps­ansvarlig',  'Vedlikeholder førstehjelps­utstyr og kompetanse.', 'beredskap', array['AML § 4-1'], true, null, 130),
  ('dpo',                   'DPO / personvern­ombud', 'Datatilsynets kontakt + intern personvern­ekspert. Pliktig ved storskala behandling av sensitive data.', 'personvern', array['GDPR Art. 37','GDPR Art. 38','GDPR Art. 39'], false, null, 140),
  ('varslings_mottak',      'Varslings­mottak',        'Mottar og behandler varsler etter kap. 2A. Ofte 2-3 personer paritetisk valgt.', 'personvern', array['AML § 2A-2','AML § 2A-4'], true, null, 150),
  ('inspector',             'Ekstern tilsyns­representant', 'Arbeidstilsynet / Datatilsynet / LDO ved tilsyn. Tildeles ad-hoc ved tilsyns­besøk.', 'eksternt', array['AML § 18-6'], true, null, 160)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  category = excluded.category,
  legal_basis = excluded.legal_basis,
  multi_incumbent = excluded.multi_incumbent,
  required_from_employees = excluded.required_from_employees,
  sort_order = excluded.sort_order;

alter table public.functional_roles enable row level security;

drop policy if exists functional_roles_select on public.functional_roles;
create policy functional_roles_select on public.functional_roles
  for select using (true);  -- katalogen er global og lesbar for alle innloggede

-- ── 2. Per-org tildelinger ───────────────────────────────────────────────

create table if not exists public.org_functional_role_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_slug text not null references public.functional_roles (slug),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Scope (valgfritt — kan begrenses til avdeling for verneombud osv.)
  department_id uuid,
  -- Gyldighet
  valid_from date not null default current_date,
  valid_to date,
  -- Audit
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  notes text,
  -- Forsegling: én person kan ha rollen flere ganger hvis i forskjellig department
  -- eller etter at en tidligere periode er utløpt; men ikke flere overlappende
  -- aktive samme department.
  unique (organization_id, role_slug, user_id, department_id, valid_from)
);

create index if not exists ofra_org_role_idx
  on public.org_functional_role_assignments (organization_id, role_slug, valid_to);

create index if not exists ofra_user_idx
  on public.org_functional_role_assignments (user_id, valid_to);

comment on table public.org_functional_role_assignments is
  'Per-user functional role assignments. user_id may have multiple roles; some roles allow multi_incumbent.';

alter table public.org_functional_role_assignments enable row level security;

drop policy if exists ofra_select on public.org_functional_role_assignments;
create policy ofra_select on public.org_functional_role_assignments
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.organization_id = org_functional_role_assignments.organization_id)
  );

drop policy if exists ofra_modify on public.org_functional_role_assignments;
create policy ofra_modify on public.org_functional_role_assignments
  for all using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.organization_id = org_functional_role_assignments.organization_id
              and p.is_org_admin = true)
  ) with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid()
              and p.organization_id = org_functional_role_assignments.organization_id
              and p.is_org_admin = true)
  );

-- Helper-view: aktive rolle­innehavere
create or replace view public.org_active_role_holders as
select
  a.organization_id,
  a.role_slug,
  fr.label as role_label,
  fr.category as role_category,
  a.user_id,
  p.display_name as user_name,
  p.email as user_email,
  a.department_id,
  a.valid_from,
  a.valid_to
from public.org_functional_role_assignments a
join public.functional_roles fr on fr.slug = a.role_slug
join public.profiles p on p.id = a.user_id
where (a.valid_to is null or a.valid_to >= current_date);

comment on view public.org_active_role_holders is
  'Aktive rolle­innehavere — brukes av admin-UI og signature_block for å foreslå riktig signer per rolle.';

-- ── 3. MinID-integrasjon — utvid CHECK ───────────────────────────────────

alter table public.org_integrations
  drop constraint if exists org_integrations_kind_check;

alter table public.org_integrations
  add constraint org_integrations_kind_check
  check (kind in (
    'bankid',
    'eco_online',
    'altinn',
    'lovdata_pro',
    'feide',
    'minid'             -- ID-porten MinID — sterkere enn passord, mindre enn BankID
  ));

-- ── 4. Opplærings-register-view ──────────────────────────────────────────
--
-- Speiler learning_progress mot funksjonelle roller. Brukes av
-- training_matrix-dokument-modulen for å vise hvem (per rolle) har
-- bestått hvilke kurs.

create or replace view public.training_matrix_view as
select
  a.organization_id,
  a.role_slug,
  fr.label as role_label,
  a.user_id,
  p.display_name as user_name,
  lp.course_id,
  c.title as course_title,
  c.law_refs as course_law_refs,
  lp.completed_at,
  lp.started_at,
  c.recertification_months,
  case
    when lp.completed_at is null then 'not_started'
    when c.recertification_months is not null
         and lp.completed_at + (c.recertification_months || ' months')::interval < now()
      then 'expired'
    when c.recertification_months is not null
         and lp.completed_at + ((c.recertification_months - 2) || ' months')::interval < now()
      then 'expiring_soon'
    else 'completed'
  end as completion_status
from public.org_functional_role_assignments a
join public.functional_roles fr on fr.slug = a.role_slug
join public.profiles p on p.id = a.user_id
cross join public.learning_courses c
left join public.learning_course_progress lp on lp.user_id = a.user_id and lp.course_id = c.id
where (a.valid_to is null or a.valid_to >= current_date)
  and c.status = 'published';

comment on view public.training_matrix_view is
  'Cross-join rolle × kurs med opplærings­status. Brukes av training_matrix-dokument-modulen.';

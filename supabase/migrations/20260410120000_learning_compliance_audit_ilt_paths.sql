-- Compliance audit trail, versioning, recertification, external certs, ILT events, learning paths.

-- ---------------------------------------------------------------------------
-- Course versioning (audit: which law version was completed)
-- ---------------------------------------------------------------------------

alter table public.learning_courses
  add column if not exists course_version int not null default 1;

comment on column public.learning_courses.course_version is 'Bump when content changes materially; certificates snapshot this value.';

alter table public.learning_courses
  add column if not exists recertification_months int;

comment on column public.learning_courses.recertification_months is 'If set, certificate expiry = issued_at + N months; cron updates status.';

-- Certificates: one row per (user, course, version) for audit trail
alter table public.learning_certificates
  drop constraint if exists learning_certificates_user_course_unique;

alter table public.learning_certificates
  add column if not exists course_version int not null default 1;

-- Backfill then enforce uniqueness
update public.learning_certificates set course_version = 1 where course_version is null;

alter table public.learning_certificates
  add constraint learning_certificates_user_course_version_unique
  unique (user_id, course_id, course_version);

create index if not exists learning_certificates_course_version_idx
  on public.learning_certificates (course_id, course_version);

-- Immutable completion audit log (Arbeidstilsynet / internal QA)
create table if not exists public.learning_course_completion_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  course_version int not null,
  course_title_snapshot text not null,
  completed_at timestamptz not null default now(),
  certificate_id uuid references public.learning_certificates (id) on delete set null,
  source text not null default 'lms' check (source in ('lms', 'external', 'import')),
  metadata jsonb not null default '{}'
);

create index if not exists learning_completion_audit_org_idx on public.learning_course_completion_audit (organization_id);
create index if not exists learning_completion_audit_user_idx on public.learning_course_completion_audit (user_id, course_id);

alter table public.learning_course_completion_audit enable row level security;

create policy "learning_completion_audit_select"
  on public.learning_course_completion_audit for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );
-- Inserts only via security definer RPCs (bypass RLS as definer)

-- ---------------------------------------------------------------------------
-- Recertification / expiry tracking (cron updates status)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_certification_renewals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id text not null,
  certificate_id uuid references public.learning_certificates (id) on delete cascade,
  expires_at timestamptz not null,
  status text not null default 'compliant' check (status in ('compliant', 'expiring_soon', 'expired', 'renewed')),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, certificate_id)
);

create index if not exists learning_renewals_org_idx on public.learning_certification_renewals (organization_id);
create index if not exists learning_renewals_expires_idx on public.learning_certification_renewals (expires_at) where status <> 'renewed';

alter table public.learning_certification_renewals enable row level security;

create policy "learning_renewals_select"
  on public.learning_certification_renewals for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- External certificates (photo/PDF upload — path in Storage)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_external_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  issuer text,
  valid_until date,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index if not exists learning_external_cert_org_idx on public.learning_external_certificates (organization_id);
create index if not exists learning_external_cert_user_idx on public.learning_external_certificates (user_id);

alter table public.learning_external_certificates enable row level security;

create policy "learning_external_cert_select"
  on public.learning_external_certificates for select
  using (
    organization_id = public.current_org_id()
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

create policy "learning_external_cert_insert_own"
  on public.learning_external_certificates for insert
  with check (organization_id = public.current_org_id() and user_id = auth.uid());

create policy "learning_external_cert_update_manage"
  on public.learning_external_certificates for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- ---------------------------------------------------------------------------
-- ILT / vILT events (linked to course module)
-- ---------------------------------------------------------------------------

create table if not exists public.learning_ilt_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  course_id text not null references public.learning_courses (id) on delete cascade,
  module_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_text text,
  meeting_url text,
  instructor_name text,
  created_at timestamptz not null default now(),
  unique (course_id, module_id)
);

create index if not exists learning_ilt_events_org_idx on public.learning_ilt_events (organization_id);

create table if not exists public.learning_ilt_rsvps (
  event_id uuid not null references public.learning_ilt_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'declined', 'waitlist')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table if not exists public.learning_ilt_attendance (
  event_id uuid not null references public.learning_ilt_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  present boolean not null default false,
  marked_by uuid references auth.users (id) on delete set null,
  marked_at timestamptz,
  primary key (event_id, user_id)
);

alter table public.learning_ilt_events enable row level security;
alter table public.learning_ilt_rsvps enable row level security;
alter table public.learning_ilt_attendance enable row level security;

create policy "learning_ilt_events_select"
  on public.learning_ilt_events for select
  using (organization_id = public.current_org_id());

create policy "learning_ilt_events_insert_manage"
  on public.learning_ilt_events for insert
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_ilt_events_update_manage"
  on public.learning_ilt_events for update
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_ilt_events_delete_manage"
  on public.learning_ilt_events for delete
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_ilt_rsvps_select"
  on public.learning_ilt_rsvps for select
  using (
    exists (select 1 from public.learning_ilt_events e where e.id = event_id and e.organization_id = public.current_org_id())
    and (
      user_id = auth.uid()
      or public.is_org_admin()
      or public.user_has_permission('learning.manage')
    )
  );

create policy "learning_ilt_rsvps_insert_own"
  on public.learning_ilt_rsvps for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.learning_ilt_events e where e.id = event_id and e.organization_id = public.current_org_id())
  );

create policy "learning_ilt_rsvps_update_own"
  on public.learning_ilt_rsvps for update
  using (
    user_id = auth.uid()
    and exists (select 1 from public.learning_ilt_events e where e.id = event_id and e.organization_id = public.current_org_id())
  );

create policy "learning_ilt_attendance_manage"
  on public.learning_ilt_attendance for all
  using (
    exists (select 1 from public.learning_ilt_events e where e.id = event_id and e.organization_id = public.current_org_id())
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  )
  with check (
    exists (select 1 from public.learning_ilt_events e where e.id = event_id and e.organization_id = public.current_org_id())
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

-- ---------------------------------------------------------------------------
-- Learning paths (curricula) + profile-based unlock
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists learning_metadata jsonb not null default '{}';

comment on column public.profiles.learning_metadata is 'Flags e.g. {"is_safety_rep": true} for path auto-enrollment.';

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  description text default '',
  created_at timestamptz not null default now(),
  constraint learning_paths_org_slug unique (organization_id, slug)
);

create table if not exists public.learning_path_courses (
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  course_id text not null,
  sort_order int not null default 0,
  primary key (path_id, course_id)
);

create table if not exists public.learning_path_rules (
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  metadata_key text not null,
  expected_value jsonb not null,
  primary key (path_id, metadata_key)
);

create table if not exists public.learning_path_enrollments (
  user_id uuid not null references auth.users (id) on delete cascade,
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (user_id, path_id)
);

create index if not exists learning_path_enroll_user_idx on public.learning_path_enrollments (user_id);

alter table public.learning_paths enable row level security;
alter table public.learning_path_courses enable row level security;
alter table public.learning_path_rules enable row level security;
alter table public.learning_path_enrollments enable row level security;

create policy "learning_paths_select"
  on public.learning_paths for select
  using (organization_id = public.current_org_id());

create policy "learning_paths_write_manage"
  on public.learning_paths for all
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_path_courses_all"
  on public.learning_path_courses for all
  using (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.organization_id = public.current_org_id())
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_path_rules_all"
  on public.learning_path_rules for all
  using (
    exists (select 1 from public.learning_paths p where p.id = path_id and p.organization_id = public.current_org_id())
    and (public.is_org_admin() or public.user_has_permission('learning.manage'))
  );

create policy "learning_path_enrollments_select"
  on public.learning_path_enrollments for select
  using (
    user_id = auth.uid()
    or public.is_org_admin()
    or public.user_has_permission('learning.manage')
  );
-- Inserts via learning_refresh_path_enrollments_for_user (security definer) only

-- Refresh enrollments from profile.learning_metadata vs rules
create or replace function public.learning_refresh_path_enrollments_for_user(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_meta jsonb;
  r record;
  v_match boolean;
begin
  if p_user_id is null then return; end if;
  select organization_id, coalesce(learning_metadata, '{}'::jsonb) into v_org, v_meta
  from public.profiles where id = p_user_id;
  if v_org is null then return; end if;

  for r in
    select distinct p.id as path_id, pr.metadata_key, pr.expected_value
    from public.learning_paths p
    join public.learning_path_rules pr on pr.path_id = p.id
    where p.organization_id = v_org
  loop
    v_match := (v_meta ? r.metadata_key) and (v_meta->r.metadata_key = r.expected_value);
    if v_match then
      insert into public.learning_path_enrollments (user_id, path_id)
      values (p_user_id, r.path_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

grant execute on function public.learning_refresh_path_enrollments_for_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Issue certificate: snapshot course_version + audit row
-- ---------------------------------------------------------------------------

create or replace function public.learning_issue_certificate(
  p_course_id text,
  p_learner_name text default null
)
returns public.learning_certificates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_uid uuid := auth.uid();
  v_course public.learning_courses%rowtype;
  v_prog public.learning_course_progress%rowtype;
  v_modules int;
  v_done int;
  v_name text;
  v_cert public.learning_certificates%rowtype;
  v_ver text;
  v_cv int;
  v_mods jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  select organization_id into v_org from public.profiles where id = v_uid;
  if v_org is null then
    raise exception 'No organization';
  end if;
  select * into v_course from public.learning_courses where id = p_course_id and organization_id = v_org;
  if not found then
    raise exception 'Course not found';
  end if;
  v_cv := coalesce(v_course.course_version, 1);
  select * into v_prog
  from public.learning_course_progress
  where user_id = v_uid and course_id = p_course_id and organization_id = v_org;
  if not found then
    raise exception 'No progress for course';
  end if;

  if v_course.source_system_course_id is not null
     and not exists (select 1 from public.learning_modules where course_id = p_course_id and organization_id = v_org)
  then
    select l.modules into v_mods
    from public.learning_system_course_locales l
    where l.system_course_id = v_course.source_system_course_id
      and l.locale = coalesce(v_course.catalog_locale, 'nb');
    if v_mods is null then
      select l.modules into v_mods
      from public.learning_system_course_locales l
      where l.system_course_id = v_course.source_system_course_id
        and l.locale = (select default_locale from public.learning_system_courses where id = v_course.source_system_course_id limit 1);
    end if;
    select count(*)::int into v_modules from jsonb_array_elements(coalesce(v_mods, '[]'::jsonb));
    select count(*)::int into v_done
    from jsonb_array_elements(coalesce(v_mods, '[]'::jsonb)) as e(elem)
    where coalesce((v_prog.module_progress -> (e.elem->>'id') ->> 'completed')::boolean, false) = true;
  else
    select count(*)::int into v_modules from public.learning_modules where course_id = p_course_id and organization_id = v_org;
    select count(*)::int into v_done
    from public.learning_modules m
    where m.course_id = p_course_id and m.organization_id = v_org
      and coalesce((v_prog.module_progress -> (m.id::text) ->> 'completed')::boolean, false) = true;
  end if;

  if v_modules = 0 then
    raise exception 'Course has no modules';
  end if;
  if v_done < v_modules then
    raise exception 'Course not completed';
  end if;

  if exists (
    select 1 from public.learning_certificates
    where user_id = v_uid and course_id = p_course_id and course_version = v_cv
  ) then
    select * into v_cert from public.learning_certificates
    where user_id = v_uid and course_id = p_course_id and course_version = v_cv;
    return v_cert;
  end if;

  select display_name into v_name from public.profiles where id = v_uid;
  v_ver := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));

  insert into public.learning_certificates (
    organization_id, course_id, user_id, course_title, learner_name, verify_code, course_version
  ) values (
    v_org,
    p_course_id,
    v_uid,
    v_course.title,
    coalesce(nullif(trim(p_learner_name), ''), nullif(trim(v_name), ''), 'Bruker'),
    v_ver,
    v_cv
  )
  returning * into v_cert;

  insert into public.learning_course_completion_audit (
    organization_id, user_id, course_id, course_version, course_title_snapshot, certificate_id, source
  ) values (
    v_org, v_uid, p_course_id, v_cv, v_course.title, v_cert.id, 'lms'
  );

  update public.learning_course_progress
  set completed_at = coalesce(completed_at, now())
  where user_id = v_uid and course_id = p_course_id;

  if v_course.recertification_months is not null and v_course.recertification_months > 0 then
    insert into public.learning_certification_renewals (
      organization_id, user_id, course_id, certificate_id, expires_at, status
    ) values (
      v_org,
      v_uid,
      p_course_id,
      v_cert.id,
      (now() + (v_course.recertification_months || ' months')::interval),
      'compliant'
    )
    on conflict (user_id, certificate_id) do update set
      expires_at = excluded.expires_at,
      status = 'compliant';
  end if;

  return v_cert;
end;
$$;

create or replace function public.learning_bump_course_version(p_course_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_new int;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then raise exception 'No organization'; end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  update public.learning_courses
  set course_version = course_version + 1, updated_at = now()
  where id = p_course_id and organization_id = v_org
  returning course_version into v_new;
  if v_new is null then raise exception 'Course not found'; end if;
  return v_new;
end;
$$;

grant execute on function public.learning_bump_course_version(text) to authenticated;

create or replace function public.learning_approve_external_certificate(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  r public.learning_external_certificates%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select organization_id into v_org from public.profiles where id = auth.uid();
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;
  select * into r from public.learning_external_certificates where id = p_id and organization_id = v_org;
  if not found then raise exception 'Not found'; end if;
  update public.learning_external_certificates
  set
    status = case when p_approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = p_note
  where id = p_id;

  if p_approve then
    insert into public.learning_course_completion_audit (
      organization_id, user_id, course_id, course_version, course_title_snapshot, source, metadata
    ) values (
      v_org,
      r.user_id,
      'external:' || r.id::text,
      1,
      r.title,
      'external',
      jsonb_build_object('external_certificate_id', r.id, 'issuer', r.issuer, 'valid_until', r.valid_until)
    );
  end if;
end;
$$;

grant execute on function public.learning_approve_external_certificate(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Recertification status refresh (invoke nightly via pg_cron or Edge)
-- ---------------------------------------------------------------------------

create or replace function public.learning_refresh_certification_status()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int := 0;
begin
  update public.learning_certification_renewals r
  set status = case
    when r.expires_at < now() then 'expired'
    when r.expires_at < now() + interval '60 days' then 'expiring_soon'
    else 'compliant'
  end
  where r.status not in ('renewed');
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.learning_refresh_certification_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Compliance matrix for managers
-- ---------------------------------------------------------------------------

create or replace function public.learning_compliance_matrix()
returns table (
  user_id uuid,
  display_name text,
  course_id text,
  course_title text,
  cell_status text,
  completion_pct numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return; end if;
  if not (public.is_org_admin() or public.user_has_permission('learning.manage')) then
    raise exception 'Not allowed';
  end if;

  return query
  with members as (
    select p.id as uid, p.display_name as dn
    from public.profiles p
    where p.organization_id = v_org
  ),
  pub as (
    select c.id as cid, c.title as tl
    from public.learning_courses c
    where c.organization_id = v_org and c.status = 'published'
  ),
  pct as (
    select
      p.user_id as uid,
      p.course_id as cid,
      case
        when exists (
          select 1 from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
        ) then (
          select count(*)::numeric from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
            and coalesce((p.module_progress -> (m.id::text) ->> 'completed')::boolean, false)
        ) / nullif((
          select count(*)::numeric from public.learning_modules m
          where m.course_id = p.course_id and m.organization_id = v_org
        ), 0)
        else null
      end as pval
    from public.learning_course_progress p
    where p.organization_id = v_org
  )
  select
    m.uid,
    m.dn,
    c.cid,
    c.tl,
    case
      when pc.pval is null then 'not_started'
      when pc.pval >= 1 then 'complete'
      when pc.pval > 0 then 'in_progress'
      else 'not_started'
    end,
    coalesce(pc.pval, 0)
  from members m
  cross join pub c
  left join pct pc on pc.uid = m.uid and pc.cid = c.cid
  order by m.dn, c.tl;
end;
$$;

grant execute on function public.learning_compliance_matrix() to authenticated;

-- AMU election module (phase 1): schema, RLS, secret-ballot RPC, audit trail.
-- Vote rows intentionally have NO user_id — linkage is only via cast_amu_vote RPC.

-- ── 1. Tables ───────────────────────────────────────────────────────────────

create table if not exists public.amu_elections (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null,
  status           text not null default 'draft'
    check (status in ('draft', 'nomination', 'voting', 'closed')),
  start_date       timestamptz not null,
  end_date         timestamptz not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists amu_elections_org_status_idx
  on public.amu_elections (organization_id, status, start_date desc);

drop trigger if exists amu_elections_set_updated_at on public.amu_elections;
create trigger amu_elections_set_updated_at
  before update on public.amu_elections
  for each row execute function public.set_updated_at();

create table if not exists public.amu_election_candidates (
  id               uuid primary key default gen_random_uuid(),
  election_id      uuid not null references public.amu_elections (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  manifesto        text not null default '',
  status           text not null default 'nominated'
    check (status in ('nominated', 'approved')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (election_id, user_id)
);

create index if not exists amu_election_candidates_election_idx
  on public.amu_election_candidates (election_id, status);

create index if not exists amu_election_candidates_org_idx
  on public.amu_election_candidates (organization_id);

drop trigger if exists amu_election_candidates_set_updated_at on public.amu_election_candidates;
create trigger amu_election_candidates_set_updated_at
  before update on public.amu_election_candidates
  for each row execute function public.set_updated_at();

create table if not exists public.amu_election_voters (
  id               uuid primary key default gen_random_uuid(),
  election_id      uuid not null references public.amu_elections (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  has_voted        boolean not null default false,
  voted_at         timestamptz,
  created_at       timestamptz not null default now(),
  unique (election_id, user_id)
);

create index if not exists amu_election_voters_election_idx
  on public.amu_election_voters (election_id, has_voted);

create index if not exists amu_election_voters_org_user_idx
  on public.amu_election_voters (organization_id, user_id);

create table if not exists public.amu_election_votes (
  id               uuid primary key default gen_random_uuid(),
  election_id      uuid not null references public.amu_elections (id) on delete cascade,
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  candidate_id     uuid not null references public.amu_election_candidates (id) on delete restrict,
  created_at       timestamptz not null default now()
);

create index if not exists amu_election_votes_election_idx
  on public.amu_election_votes (election_id);

create index if not exists amu_election_votes_candidate_idx
  on public.amu_election_votes (candidate_id);

-- ── 2. BEFORE INSERT: set organization_id (set_org_id) ───────────────────────

create or replace function public.amu_elections_before_insert_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

drop trigger if exists amu_elections_set_org_id_before_insert on public.amu_elections;
create trigger amu_elections_set_org_id_before_insert
  before insert on public.amu_elections
  for each row execute function public.amu_elections_before_insert_set_org_id();

create or replace function public.amu_election_candidates_before_insert_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is null then
    select e.organization_id into v_org
    from public.amu_elections e
    where e.id = new.election_id;
    if v_org is null then
      raise exception 'amu_election_candidates: election_id not found';
    end if;
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists amu_election_candidates_set_org_id_before_insert on public.amu_election_candidates;
create trigger amu_election_candidates_set_org_id_before_insert
  before insert on public.amu_election_candidates
  for each row execute function public.amu_election_candidates_before_insert_set_org_id();

create or replace function public.amu_election_voters_before_insert_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is null then
    select e.organization_id into v_org
    from public.amu_elections e
    where e.id = new.election_id;
    if v_org is null then
      raise exception 'amu_election_voters: election_id not found';
    end if;
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists amu_election_voters_set_org_id_before_insert on public.amu_election_voters;
create trigger amu_election_voters_set_org_id_before_insert
  before insert on public.amu_election_voters
  for each row execute function public.amu_election_voters_before_insert_set_org_id();

create or replace function public.amu_election_votes_before_insert_set_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if new.organization_id is null then
    select e.organization_id into v_org
    from public.amu_elections e
    where e.id = new.election_id;
    if v_org is null then
      raise exception 'amu_election_votes: election_id not found';
    end if;
    new.organization_id := v_org;
  end if;
  return new;
end;
$$;

drop trigger if exists amu_election_votes_set_org_id_before_insert on public.amu_election_votes;
create trigger amu_election_votes_set_org_id_before_insert
  before insert on public.amu_election_votes
  for each row execute function public.amu_election_votes_before_insert_set_org_id();

-- ── 3. Immutable audit log: election lifecycle & status ─────────────────────

drop trigger if exists amu_elections_immutable_audit_log_tg on public.amu_elections;
create trigger amu_elections_immutable_audit_log_tg
  after insert or update or delete on public.amu_elections
  for each row execute function public.hse_audit_trigger();

-- ── 4. RLS (organization isolation) ──────────────────────────────────────────

alter table public.amu_elections enable row level security;
alter table public.amu_election_candidates enable row level security;
alter table public.amu_election_voters enable row level security;
alter table public.amu_election_votes enable row level security;

-- Elections: all authenticated org members may read; writes require manage/admin.
drop policy if exists amu_elections_select on public.amu_elections;
create policy amu_elections_select on public.amu_elections
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_elections_insert on public.amu_elections;
create policy amu_elections_insert on public.amu_elections
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

drop policy if exists amu_elections_update on public.amu_elections;
create policy amu_elections_update on public.amu_elections
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_elections_delete on public.amu_elections;
create policy amu_elections_delete on public.amu_elections
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

grant select, insert, update, delete on public.amu_elections to authenticated;

-- Candidates
drop policy if exists amu_election_candidates_select on public.amu_election_candidates;
create policy amu_election_candidates_select on public.amu_election_candidates
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_election_candidates_write on public.amu_election_candidates;
create policy amu_election_candidates_write on public.amu_election_candidates
  for all to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  )
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

grant select, insert, update, delete on public.amu_election_candidates to authenticated;

-- Voters (eligibility + has_voted flag; not the secret ballot)
drop policy if exists amu_election_voters_select on public.amu_election_voters;
create policy amu_election_voters_select on public.amu_election_voters
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists amu_election_voters_insert on public.amu_election_voters;
create policy amu_election_voters_insert on public.amu_election_voters
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

-- Updates (e.g. roster corrections) are admin-only; has_voted is set only via cast_amu_vote (security definer).
drop policy if exists amu_election_voters_update on public.amu_election_voters;
create policy amu_election_voters_update on public.amu_election_voters
  for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  )
  with check (organization_id = public.current_org_id());

drop policy if exists amu_election_voters_delete on public.amu_election_voters;
create policy amu_election_voters_delete on public.amu_election_voters
  for delete to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

grant select, insert, update, delete on public.amu_election_voters to authenticated;

-- Votes: no direct client insert (secret ballot); select for tally by admins only.
drop policy if exists amu_election_votes_select on public.amu_election_votes;
create policy amu_election_votes_select on public.amu_election_votes
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.is_org_admin() or public.user_has_permission('amu_election.manage'))
  );

revoke insert, update, delete on public.amu_election_votes from authenticated;
grant select on public.amu_election_votes to authenticated;

-- ── 5. Secret ballot RPC (single transaction, row-locked voter) ─────────────

create or replace function public.cast_amu_vote(p_election_id uuid, p_candidate_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_voter_id uuid;
  v_org uuid;
  v_has_voted boolean;
  v_election_status text;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select e.organization_id, e.status
    into v_org, v_election_status
  from public.amu_elections e
  where e.id = p_election_id
  for share;

  if v_org is null then
    raise exception 'Election not found';
  end if;

  if v_election_status is distinct from 'voting' then
    raise exception 'Election is not open for voting';
  end if;

  if not exists (
    select 1 from public.amu_elections e
    where e.id = p_election_id
      and e.start_date <= v_now
      and e.end_date >= v_now
  ) then
    raise exception 'Election is outside the voting window';
  end if;

  select v.id, v.has_voted
    into v_voter_id, v_has_voted
  from public.amu_election_voters v
  where v.election_id = p_election_id
    and v.user_id = v_uid
    and v.organization_id = v_org
  for update;

  if v_voter_id is null then
    raise exception 'Not an eligible voter for this election';
  end if;

  if coalesce(v_has_voted, true) then
    raise exception 'Already voted';
  end if;

  if not exists (
    select 1 from public.amu_election_candidates c
    where c.id = p_candidate_id
      and c.election_id = p_election_id
      and c.organization_id = v_org
      and c.status = 'approved'
  ) then
    raise exception 'Invalid or non-approved candidate for this election';
  end if;

  update public.amu_election_voters
  set has_voted = true,
      voted_at = v_now
  where id = v_voter_id
    and has_voted = false;

  if not found then
    raise exception 'Vote could not be recorded (concurrent update)';
  end if;

  insert into public.amu_election_votes (election_id, organization_id, candidate_id)
  values (p_election_id, v_org, p_candidate_id);
end;
$$;

revoke all on function public.cast_amu_vote(uuid, uuid) from public;
grant execute on function public.cast_amu_vote(uuid, uuid) to authenticated;

-- ── 6. RBAC: amu_election.manage ───────────────────────────────────────────

insert into public.role_permissions (role_id, permission_key)
select rd.id, 'amu_election.manage'
from public.role_definitions rd
where rd.slug = 'admin'
on conflict (role_id, permission_key) do nothing;

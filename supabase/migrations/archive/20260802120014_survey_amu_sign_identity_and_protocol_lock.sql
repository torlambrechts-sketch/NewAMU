-- AMU: bind signatures to auth.uid(), lock protocol fields after first signature.

alter table public.survey_amu_reviews
  add column if not exists amu_chair_signed_by uuid references auth.users (id) on delete set null,
  add column if not exists vo_signed_by uuid references auth.users (id) on delete set null;

comment on column public.survey_amu_reviews.amu_chair_signed_by is 'auth.users.id for AMU chair signature';
comment on column public.survey_amu_reviews.vo_signed_by is 'auth.users.id for VO signature';

create or replace function public.survey_amu_reviews_lock_protocol_after_first_signature()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (
    old.amu_chair_signed_at is not null
    or old.vo_signed_at is not null
  ) then
    if new.meeting_date is distinct from old.meeting_date
      or new.agenda_item is distinct from old.agenda_item
      or new.protocol_text is distinct from old.protocol_text
    then
      raise exception 'Protokoll kan ikke endres etter første signatur.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists survey_amu_reviews_lock_protocol on public.survey_amu_reviews;
create trigger survey_amu_reviews_lock_protocol
  before update on public.survey_amu_reviews
  for each row execute function public.survey_amu_reviews_lock_protocol_after_first_signature();

-- Sign as AMU chair: name from profiles.display_name (fallback email / «Ukjent»).
create or replace function public.survey_amu_review_sign_as_chair(p_review_id uuid)
returns public.survey_amu_reviews language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.survey_amu_reviews;
  nm text;
begin
  if uid is null then
    raise exception 'Ikke innlogget';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('survey.manage')) then
    raise exception 'Ingen tilgang til å signere protokoll';
  end if;

  select * into strict r
  from public.survey_amu_reviews
  where id = p_review_id
    and organization_id = public.current_org_id();

  if r.amu_chair_signed_at is not null then
    raise exception 'Allerede signert som AMU-leder';
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(email), ''))
  into nm
  from public.profiles
  where id = uid
    and organization_id = r.organization_id;

  if nm is null then
    nm := 'Signert bruker';
  end if;

  update public.survey_amu_reviews
  set
    amu_chair_name = nm,
    amu_chair_signed_at = now(),
    amu_chair_signed_by = uid
  where id = p_review_id
    and organization_id = r.organization_id
  returning * into strict r;

  return r;
end;
$$;

grant execute on function public.survey_amu_review_sign_as_chair(uuid) to authenticated;

create or replace function public.survey_amu_review_sign_as_vo(p_review_id uuid)
returns public.survey_amu_reviews language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r public.survey_amu_reviews;
  nm text;
begin
  if uid is null then
    raise exception 'Ikke innlogget';
  end if;

  if not (public.is_org_admin() or public.user_has_permission('survey.manage')) then
    raise exception 'Ingen tilgang til å signere protokoll';
  end if;

  select * into strict r
  from public.survey_amu_reviews
  where id = p_review_id
    and organization_id = public.current_org_id();

  if r.vo_signed_at is not null then
    raise exception 'Allerede signert som vernombud';
  end if;

  select coalesce(nullif(trim(display_name), ''), nullif(trim(email), ''))
  into nm
  from public.profiles
  where id = uid
    and organization_id = r.organization_id;

  if nm is null then
    nm := 'Signert bruker';
  end if;

  update public.survey_amu_reviews
  set
    vo_name = nm,
    vo_signed_at = now(),
    vo_signed_by = uid
  where id = p_review_id
    and organization_id = r.organization_id
  returning * into strict r;

  return r;
end;
$$;

grant execute on function public.survey_amu_review_sign_as_vo(uuid) to authenticated;

notify pgrst, 'reload schema';

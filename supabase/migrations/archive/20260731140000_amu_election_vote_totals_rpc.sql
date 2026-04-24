-- Aggregated vote counts for closed elections (no per-voter data exposed).
-- Readable by any org member when election status is 'closed' (Results tab).

create or replace function public.get_amu_election_vote_totals(p_election_id uuid)
returns table (candidate_id uuid, vote_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.candidate_id, count(*)::bigint as vote_count
  from public.amu_election_votes v
  join public.amu_elections e on e.id = v.election_id
  where v.election_id = p_election_id
    and e.status = 'closed'
    and e.organization_id = public.current_org_id()
    and v.organization_id = public.current_org_id()
  group by v.candidate_id;
$$;

revoke all on function public.get_amu_election_vote_totals(uuid) from public;
grant execute on function public.get_amu_election_vote_totals(uuid) to authenticated;

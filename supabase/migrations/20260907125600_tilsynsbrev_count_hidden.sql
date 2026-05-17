-- Tilsynsbrev hidden-count RPC — security-definer counter so users without
-- the strict tilsynsbrev.view_confidential permission can still see how
-- many confidential/restricted saker exist for their org.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunner addressed: AML § 2A-7 (transparens — admin uten
--   utvidet tilgang må kunne se at det FINNES saker selv om innholdet
--   er gated) + GDPR Art. 5 (1) a (åpenhetsprinsippet — vise antall,
--   ikke innhold). Per-row RLS i _123900 skjuler både rad og count via
--   PostgREST head-count; den hidden-count-linjen i UI returnerte derfor
--   alltid 0, noe som ga falsk inntrykk av at ingen konfidensielle saker
--   eksisterte. SECURITY DEFINER + permission-tilgangsjekk på
--   tilsynsbrev.upload + org-membership-sjekk lekker bare et tall, ikke
--   selve raden eller dens innhold.

set local search_path = public, pg_catalog;

create or replace function public.tilsynsbrev_count_hidden_confidential(p_org_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_count int;
begin
  -- Permission gate: only users with tilsynsbrev.upload may see the
  -- count. (`upload` is the "admin"-tier permission for this module —
  -- users without it have no need to know hidden saker exist.)
  if not public.user_has_permission('tilsynsbrev.upload', auth.uid()) then
    return 0;
  end if;

  -- Org-membership gate: caller must belong to p_org_id. We mirror the
  -- pattern from current_org_id() which reads profiles.organization_id.
  if not exists (
    select 1
      from public.profiles p
     where p.id = auth.uid()
       and p.organization_id = p_org_id
  ) then
    return 0;
  end if;

  select count(*) into v_count
    from public.tilsynsbrev_uploads
   where organization_id = p_org_id
     and confidentiality_level in ('restricted','confidential');

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.tilsynsbrev_count_hidden_confidential(uuid) from public;
grant execute on function public.tilsynsbrev_count_hidden_confidential(uuid)
  to authenticated, service_role;

comment on function public.tilsynsbrev_count_hidden_confidential(uuid) is
  'Returns count of restricted+confidential tilsynsbrev_uploads for the given org. SECURITY DEFINER — bypasses RLS to expose only a number (never row content). Gated on tilsynsbrev.upload permission + caller-in-org. Returns 0 when caller is unauthorised or not in the org. UI calls this for the "X konfidensielle skjult"-line on /admin/tilsynsbrev when the caller lacks tilsynsbrev.view_confidential.';

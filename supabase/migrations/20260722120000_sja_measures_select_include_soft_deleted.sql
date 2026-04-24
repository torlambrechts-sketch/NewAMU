-- Allow reading soft-deleted sja_measures for audit / signing summaries (still scoped to org + non-deleted analysis).
drop policy if exists sja_measures_select on public.sja_measures;
create policy sja_measures_select on public.sja_measures for select to authenticated
  using (
    exists (
      select 1 from public.sja_analyses a
      where a.id = sja_measures.sja_id
        and a.organization_id = public.current_org_id()
        and a.deleted_at is null
    )
  );

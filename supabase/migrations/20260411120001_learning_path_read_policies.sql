-- Allow all org members to read path structure (not only learning.manage).

create policy "learning_path_courses_select_org"
  on public.learning_path_courses for select
  using (
    exists (
      select 1 from public.learning_paths p
      where p.id = path_id and p.organization_id = public.current_org_id()
    )
  );

create policy "learning_path_rules_select_org"
  on public.learning_path_rules for select
  using (
    exists (
      select 1 from public.learning_paths p
      where p.id = path_id and p.organization_id = public.current_org_id()
    )
  );

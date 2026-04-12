-- Broadcast layout template changes to subscribed clients (workplace refetch).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'platform_composer_templates'
  ) then
    alter publication supabase_realtime add table public.platform_composer_templates;
  end if;
end $$;

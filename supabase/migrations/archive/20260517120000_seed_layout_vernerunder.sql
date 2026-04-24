-- Seed default Layout_vernerunder stack template for platform admins.
-- This inserts the default block order and visibility so the Vernerunder tab
-- in the workplace app uses the correct layout immediately.
--
-- The template is inserted for the first platform admin found (order by created_at).
-- If Layout_vernerunder already exists (any admin, published or not), we upsert it
-- to published=true without changing the payload — preserving any manual customisation.
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING for the initial seed, then a separate
-- UPDATE to ensure published=true.

do $$
declare
  v_admin_id uuid;
  v_payload jsonb;
begin
  -- Find the first platform admin user
  select u.id into v_admin_id
  from auth.users u
  where (u.raw_app_meta_data->>'platform_admin')::boolean = true
     or (u.raw_user_meta_data->>'platform_admin')::boolean = true
  order by u.created_at
  limit 1;

  if v_admin_id is null then
    raise notice 'No platform admin found — skipping Layout_vernerunder seed.';
    return;
  end if;

  -- Default stack payload: visible=true for the 5 vernerunder blocks, canonical order
  v_payload := jsonb_build_object(
    'visible', jsonb_build_object(
      'heading1',                    true,
      'scoreStatRow',                true,
      'workplaceTasksActions',       true,
      'table1',                      true,
      'vernerunderScheduleCalendar', true
    ),
    'order', jsonb_build_array(
      'heading1',
      'scoreStatRow',
      'workplaceTasksActions',
      'table1',
      'vernerunderScheduleCalendar'
    )
  );

  -- Insert if not present for this admin
  insert into public.platform_composer_templates (user_id, name, kind, payload, published)
  values (v_admin_id, 'Layout_vernerunder', 'stack', v_payload, true)
  on conflict do nothing;

  -- Ensure any existing Layout_vernerunder row is published
  update public.platform_composer_templates
  set published = true,
      updated_at = now()
  where name = 'Layout_vernerunder'
    and kind = 'stack'
    and published = false;

  raise notice 'Layout_vernerunder seeded/published for admin %', v_admin_id;
end;
$$;

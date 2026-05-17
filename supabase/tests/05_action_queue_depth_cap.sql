-- Invariant: workflow_action_queue.depth is capped at 0..5 by the
-- workflow_action_queue_depth_chk CHECK constraint. depth=6 raises 23514.
-- Covers _20260907121900_workflow_action_queue_depth.sql.

begin;
select plan(3);

set local role postgres;

do $$
declare
  v_org uuid := public.setup_test_org('depth-cap');
begin
  perform set_config('pgtap.org', v_org::text, true);
end$$;

-- (1) depth=0 accepted.
select lives_ok(
  $sql$
    insert into public.workflow_action_queue (
      organization_id, action_type, payload, status, execute_after, depth
    ) values (
      current_setting('pgtap.org')::uuid,
      'send_notification',
      jsonb_build_object('msg','d0'),
      'pending', now(), 0
    )
  $sql$,
  'depth=0 insert succeeds'
);

-- (2) depth=5 accepted (boundary).
select lives_ok(
  $sql$
    insert into public.workflow_action_queue (
      organization_id, action_type, payload, status, execute_after, depth
    ) values (
      current_setting('pgtap.org')::uuid,
      'send_notification',
      jsonb_build_object('msg','d5'),
      'pending', now(), 5
    )
  $sql$,
  'depth=5 insert succeeds (cap boundary)'
);

-- (3) depth=6 rejected by check constraint (sqlstate 23514).
select throws_ok(
  $sql$
    insert into public.workflow_action_queue (
      organization_id, action_type, payload, status, execute_after, depth
    ) values (
      current_setting('pgtap.org')::uuid,
      'send_notification',
      jsonb_build_object('msg','d6'),
      'pending', now(), 6
    )
  $sql$,
  '23514',
  null,
  'depth=6 insert rejected by workflow_action_queue_depth_chk'
);

select * from finish();
rollback;

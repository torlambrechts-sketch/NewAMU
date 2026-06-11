-- OKR key-result auto-progress rollup (H1.2)
--
-- Gap closed: linking a task to a key result (okr_task_links) had no effect
-- on the KR's current_value — the core promise of the planning module was
-- decorative. KRs can now opt into 'task_rollup' mode where current_value is
-- recomputed from the share of linked tasks that are closed.
--
-- Self-audit (Arbeidstilsynet POV): strategy progress is now evidence-backed
-- (it moves when the underlying work closes), supporting "målbart bedre"
-- documentation. Restrisiko: rollup is COUNT-based, not effort-weighted — one
-- large task counts the same as one small one. And it is only defined for
-- normal (higher-is-better) KRs; invert KRs ("lavere = bedre", e.g.
-- sykefravær) stay manual because a task count has no meaningful mapping to a
-- measured downward metric.

alter table public.okr_key_results
  add column if not exists progress_mode text not null default 'manual'
    check (progress_mode in ('manual', 'task_rollup'));

comment on column public.okr_key_results.progress_mode is
  'manual = current_value edited by hand. task_rollup = current_value is '
  'recomputed = target * (closed linked tasks / linked tasks). Invert KRs '
  'are never rolled up (see okr_kr_recompute_rollup).';

-- Recompute one KR's current_value from its linked tasks. No-op unless the KR
-- is in task_rollup mode, is non-invert, and has at least one (non-cancelled,
-- non-deleted) linked task — so flipping to rollup with zero links never wipes
-- a value.
create or replace function public.okr_kr_recompute_rollup(p_kr_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_mode   text;
  v_invert boolean;
  v_target numeric;
  v_linked int;
  v_closed int;
begin
  select progress_mode, invert, target
    into v_mode, v_invert, v_target
    from public.okr_key_results
   where id = p_kr_id;

  if v_mode is distinct from 'task_rollup' then
    return;
  end if;
  if coalesce(v_invert, false) then
    return;  -- rollup undefined for lower-is-better metrics
  end if;

  select
    count(*),
    count(*) filter (where ti.status = 'closed')
    into v_linked, v_closed
    from public.okr_task_links l
    join public.task_items ti on ti.id = l.task_item_id
   where l.key_result_id = p_kr_id
     and ti.status <> 'cancelled'
     and ti.deleted_at is null;

  if coalesce(v_linked, 0) = 0 then
    return;  -- nothing to roll up; leave the value untouched
  end if;

  update public.okr_key_results
     set current_value = round((v_target * v_closed::numeric) / v_linked, 2),
         updated_at = now()
   where id = p_kr_id;
end;
$$;

grant execute on function public.okr_kr_recompute_rollup(uuid) to authenticated;

-- Trigger: a task's status (or soft-delete) changed → recompute every KR it
-- is linked to (a task may be linked to more than one KR).
create or replace function public.okr_kr_rollup_on_task_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
begin
  for r in
    select key_result_id
      from public.okr_task_links
     where task_item_id = new.id
  loop
    perform public.okr_kr_recompute_rollup(r.key_result_id);
  end loop;
  return new;
end;
$$;

drop trigger if exists okr_kr_rollup_after_task_change on public.task_items;
create trigger okr_kr_rollup_after_task_change
  after update of status, deleted_at on public.task_items
  for each row
  when (
    old.status is distinct from new.status
    or old.deleted_at is distinct from new.deleted_at
  )
  execute function public.okr_kr_rollup_on_task_change();

-- Trigger: a link was added or removed → recompute the affected KR (so the
-- denominator updates immediately).
create or replace function public.okr_kr_rollup_on_link_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'DELETE' then
    perform public.okr_kr_recompute_rollup(old.key_result_id);
    return old;
  end if;
  perform public.okr_kr_recompute_rollup(new.key_result_id);
  return new;
end;
$$;

drop trigger if exists okr_kr_rollup_after_link_change on public.okr_task_links;
create trigger okr_kr_rollup_after_link_change
  after insert or delete on public.okr_task_links
  for each row
  execute function public.okr_kr_rollup_on_link_change();

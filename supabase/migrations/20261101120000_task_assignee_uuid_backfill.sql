-- task_items assignee/owner uuid backfill (H1.1)
--
-- Gap closed: tasks identified people by free-text name, so "my work",
-- workload and any future 1:1/performance feature broke the moment a user
-- renamed or left. The assignee_user_id / owner_user_id columns already
-- exist; the UI now writes them, and this backfills historical rows by
-- matching display_name within the same org.
--
-- Self-audit (Arbeidstilsynet POV): the link is now stable across renames,
-- supporting auditable "who is responsible" answers (IK-f § 5 nr. 7).
-- Restrisiko: rows whose name is ambiguous (two members share a display
-- name in the same org) or has no profile match are LEFT as name-only —
-- never guessed. They keep working via the legacy name fallback in the UI.

-- Index supports future server-side "tasks assigned to me" queries
-- (H2.5 reminders, H2.6 workload). Cheap + idempotent.
create index if not exists task_items_assignee_user_idx
  on public.task_items (organization_id, assignee_user_id)
  where assignee_user_id is not null;

create index if not exists task_items_owner_user_idx
  on public.task_items (organization_id, owner_user_id)
  where owner_user_id is not null;

-- Backfill assignee_user_id from a unique same-org profile name match.
update public.task_items t
set assignee_user_id = p.id
from public.profiles p
where t.assignee_user_id is null
  and t.assignee_name is not null
  and btrim(t.assignee_name) <> ''
  and p.organization_id = t.organization_id
  and lower(btrim(p.display_name)) = lower(btrim(t.assignee_name))
  and not exists (
    select 1
    from public.profiles p2
    where p2.organization_id = t.organization_id
      and lower(btrim(p2.display_name)) = lower(btrim(t.assignee_name))
      and p2.id <> p.id
  );

-- Backfill owner_user_id the same way.
update public.task_items t
set owner_user_id = p.id
from public.profiles p
where t.owner_user_id is null
  and t.owner_name is not null
  and btrim(t.owner_name) <> ''
  and p.organization_id = t.organization_id
  and lower(btrim(p.display_name)) = lower(btrim(t.owner_name))
  and not exists (
    select 1
    from public.profiles p2
    where p2.organization_id = t.organization_id
      and lower(btrim(p2.display_name)) = lower(btrim(t.owner_name))
      and p2.id <> p.id
  );

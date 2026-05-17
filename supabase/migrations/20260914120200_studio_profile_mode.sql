-- Studio Builder — per-user sticky mode preference.
--
-- Mode is a sticky per-user setting, not per-content. The same template
-- can be edited Simple today, Advanced tomorrow. Default = 'simple' so
-- new users land on the constrained-palette surface and discover
-- Advanced via the "Open in Advanced" escape hatch (Task 1.3 telemetry).
--
-- Arbeidstilsynet self-audit:
--   No direct pålegg-grunn — this is UX state, not compliance state.
--   But: the sticky preference avoids surprise mode flips between
--   sessions that could lead to a user editing something in Advanced
--   without realising. Set-and-forget per the principle of least
--   astonishment.
--   Restrisiko deferred:
--     - No telemetry on mode flips yet; useStudioMode hook in Task 0.8
--       emits the events.
--
-- Idempotent — `add column if not exists` + guarded constraint add.

set local search_path = public, pg_catalog;

alter table public.profiles
  add column if not exists studio_mode_default text not null default 'simple';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_studio_mode_default_check'
  ) then
    alter table public.profiles
      add constraint profiles_studio_mode_default_check
      check (studio_mode_default in ('simple', 'advanced'));
  end if;
end $$;

comment on column public.profiles.studio_mode_default is
  'Studio Builder — sticky per-user mode preference. Default simple. Set by useStudioMode hook on mode toggle. Permission gate: studio.advanced required to flip to advanced.';

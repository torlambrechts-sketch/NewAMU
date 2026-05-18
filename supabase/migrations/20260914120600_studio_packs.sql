-- Studio Builder Phase 2a Task 2a.2 — pack authoring substrate.
--
-- Two tables:
--   studio_packs           — immutable-on-publish, semver-versioned
--                            published packs. Slug + semver unique.
--                            BEFORE UPDATE trigger blocks edits to rows
--                            with immutable=true AND published_at is not
--                            null (the lock fires after the publish RPC
--                            stamps both fields atomically).
--   studio_pack_drafts     — pre-publish workspace. Edits stay here
--                            until publish_studio_pack(...) promotes the
--                            row into studio_packs and freezes it.
--
-- Pack-as-portable-artifact design decided in §3:
--   - `manifest jsonb` holds the canonical pack contents (scopes, kinds,
--     law_refs, name_i18n). The studio-pack-export edge function reads
--     this column verbatim and emits a ZIP with sha256 checksums per file.
--   - `legal_references` denormalises law-ref strings so the gap matrix
--     planner (specs/compliance-planner.md §3) can read packs cheaply
--     without re-walking every embedded kind row.
--
-- Studio_review_status column carries the pack's own review state separate
-- from member-row review states; the existing compliance_review_status enum
-- is reused (draft / reviewed / approved) for pack lifecycle.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed:
--     IK-f § 5 nr. 5 (avviksbehandling) — immutable-on-publish gives
--     auditors a tamper-evident artifact they can verify byte-by-byte
--     against the original. Bumping semver creates a new row rather than
--     overwriting evidence.
--     AML § 3-1 (1) — systematic HMS depends on stable references; pack
--     versioning is the audit anchor.
--   Restrisiko deferred:
--     - Signed manifest (PGP / sigstore) for cross-tenant trust comes in
--       Phase 4 (marketplace). Phase 2a ships SHA-256 checksums only.
--     - Pack-level RLS — Phase 3 Task 3.3 layers studio.partner_admin
--       on top. Phase 2a ships permissive RLS that admits any
--       organization-scoped admin.
--
-- Idempotent: create table if not exists + add column if not exists +
-- create policy/trigger with do-block existence checks.

set local search_path = public, pg_catalog;

-- ────────────────────────────────────────────────────────────────────
-- 1. studio_packs — published immutable artefacts
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.studio_packs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  semver text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  summary_i18n jsonb not null default '{}'::jsonb,
  accent text,
  kpi_labels jsonb not null default '{}'::jsonb,
  severity_labels jsonb not null default '{}'::jsonb,
  legal_references jsonb not null default '[]'::jsonb,
  manifest jsonb not null default '{}'::jsonb,
  immutable boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles(id),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  review_status compliance_review_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_packs_slug_semver_unique unique (organization_id, slug, semver)
);

comment on table public.studio_packs is
  'Studio Builder — immutable-on-publish, semver-versioned authored compliance packs. Edits to rows with immutable=true AND published_at is not null are blocked by trigger.';
comment on column public.studio_packs.manifest is
  'Canonical pack body — scopes, kinds, simple presets, advanced schemas, law_refs. studio-pack-export reads this verbatim and emits a ZIP.';
comment on column public.studio_packs.legal_references is
  'Denormalised law-ref strings (jsonb array of text) so the compliance-planner gap matrix can read packs without walking embedded kind rows.';

create index if not exists studio_packs_org_status_idx
  on public.studio_packs (organization_id, status, published_at desc);
create index if not exists studio_packs_slug_idx
  on public.studio_packs (slug);

-- Immutability trigger — blocks UPDATE on already-published rows.
create or replace function public.studio_packs_block_published_updates()
returns trigger
language plpgsql
as $fn$
begin
  if old.immutable = true and old.published_at is not null then
    raise exception 'Cannot edit a published immutable pack (id=%, slug=%, semver=%). Create a new version instead.', old.id, old.slug, old.semver
      using errcode = 'P0001';
  end if;
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists studio_packs_block_published on public.studio_packs;
create trigger studio_packs_block_published
  before update on public.studio_packs
  for each row
  execute function public.studio_packs_block_published_updates();

-- ────────────────────────────────────────────────────────────────────
-- 2. studio_pack_drafts — pre-publish workspace
-- ────────────────────────────────────────────────────────────────────

create table if not exists public.studio_pack_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  draft_semver text not null,
  draft_payload jsonb not null default '{}'::jsonb,
  status text not null default 'editing' check (status in ('editing','reviewing','ready_to_publish')),
  last_edited_by uuid references public.profiles(id),
  last_edited_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint studio_pack_drafts_slug_semver_unique unique (organization_id, slug, draft_semver)
);

comment on table public.studio_pack_drafts is
  'Studio Builder — pre-publish pack workspace. Edits live here until publish_studio_pack(...) atomically copies the row into studio_packs and flips immutable=true.';

create index if not exists studio_pack_drafts_org_idx
  on public.studio_pack_drafts (organization_id, last_edited_at desc);

-- ────────────────────────────────────────────────────────────────────
-- 3. RLS — org-scoped read + admin write
-- ────────────────────────────────────────────────────────────────────

alter table public.studio_packs enable row level security;
alter table public.studio_pack_drafts enable row level security;

-- Drop existing policies (named explicitly so the migration stays
-- replay-safe without a dynamic for-loop).
drop policy if exists studio_packs_select_org on public.studio_packs;
drop policy if exists studio_packs_admin_all on public.studio_packs;
drop policy if exists studio_pack_drafts_select_org on public.studio_pack_drafts;
drop policy if exists studio_pack_drafts_admin_all on public.studio_pack_drafts;

create policy studio_packs_select_org on public.studio_packs
  for select to authenticated
  using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy studio_packs_admin_all on public.studio_packs
  for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p
      where p.id = auth.uid() and (p.is_org_admin or public.platform_is_admin())
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p
      where p.id = auth.uid() and (p.is_org_admin or public.platform_is_admin())
    )
  );

create policy studio_pack_drafts_select_org on public.studio_pack_drafts
  for select to authenticated
  using (organization_id in (select organization_id from public.profiles where id = auth.uid()));

create policy studio_pack_drafts_admin_all on public.studio_pack_drafts
  for all to authenticated
  using (
    organization_id in (
      select p.organization_id from public.profiles p
      where p.id = auth.uid() and (p.is_org_admin or public.platform_is_admin())
    )
  )
  with check (
    organization_id in (
      select p.organization_id from public.profiles p
      where p.id = auth.uid() and (p.is_org_admin or public.platform_is_admin())
    )
  );

-- ────────────────────────────────────────────────────────────────────
-- 4. publish_studio_pack(slug, semver) — atomic draft → published
-- ────────────────────────────────────────────────────────────────────
-- Copies a draft row into studio_packs, flips immutable + published_at,
-- and deletes the draft. Caller must be an org admin (RLS enforces) and
-- the slug+semver pair must not already exist in studio_packs.

create or replace function public.publish_studio_pack(p_slug text, p_semver text)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org_id uuid;
  v_draft public.studio_pack_drafts%rowtype;
  v_pack_id uuid;
begin
  select p.organization_id into v_org_id
    from public.profiles p
   where p.id = auth.uid() and (p.is_org_admin or p.is_platform_admin);
  if v_org_id is null then
    raise exception 'Only org admins can publish studio packs.' using errcode = 'P0001';
  end if;

  select * into v_draft
    from public.studio_pack_drafts
   where organization_id = v_org_id and slug = p_slug and draft_semver = p_semver;
  if not found then
    raise exception 'No draft found for slug=% semver=% (org %).', p_slug, p_semver, v_org_id;
  end if;

  insert into public.studio_packs (
    organization_id, slug, semver, manifest, immutable, published_at, published_by, status, review_status
  ) values (
    v_org_id, p_slug, p_semver, v_draft.draft_payload, true, now(), auth.uid(), 'published', 'approved'
  )
  returning id into v_pack_id;

  delete from public.studio_pack_drafts where id = v_draft.id;
  return v_pack_id;
end;
$fn$;

comment on function public.publish_studio_pack is
  'Studio Builder Phase 2a — atomically promote a studio_pack_drafts row into studio_packs with immutable=true. Raises if a row with the same (slug, semver) already exists in the published table.';

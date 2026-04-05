# E-learning migration policy

This document describes how the E-learning feature moves from **browser `localStorage`** to **Supabase (Postgres + RLS)** while staying aligned with existing **organization scoping** and **RBAC**.

## Current baseline (pre-migration)

- Domain types live in `src/types/learning.ts` (`Course`, `CourseModule`, `ModuleContent`, progress, certificates).
- `useLearning` persisted state under `localStorage` key `atics-learning-v1` with bundled seed content (AML course + demo).
- Route access uses `module.view.learning`; course **authoring** is gated with `learning.manage` once the backend exists.

## Principles

1. **Org-scoped data** — Every learning row includes `organization_id` and is only visible to members of that org via RLS.
2. **Server authority** — After cutover with Supabase configured and a profile linked to an org, the database is canonical; `localStorage` is fallback for demo/offline-only use.
3. **JSON module payloads** — `ModuleContent` is stored as `jsonb` on `learning_modules` to avoid a large normalized schema in the first iteration.
4. **Permissions** — `module.view.learning`: access the section. `learning.manage`: create/edit/publish courses and see org-wide progress in admin views. `is_org_admin` retains full learning administration.

## Schema (implemented)

| Table | Purpose |
|-------|---------|
| `learning_system_courses` / `learning_system_course_locales` | Global catalog (e.g. AML); `modules` jsonb per locale (`nb`, `en`) |
| `learning_org_course_settings` | Per org: enable/disable system course; optional `forked_course_id` |
| `learning_courses` | Org row; may reference `source_system_course_id` + `catalog_locale` for catalog-backed modules |
| `learning_modules` | Org-owned module rows (used for custom and forked courses) |
| `learning_course_progress` | Per-user `module_progress` (jsonb), `started_at`, `completed_at` |
| `learning_certificates` | Issued certificates; `verify_code` for display |

RLS policies enforce org membership; certificate **insert** uses a security definer RPC so completion rules stay server-side.

## Rollout

1. Apply migrations in `supabase/migrations/`.
2. Existing orgs: grant `learning.manage` to the **admin** system role via migration; other roles keep `module.view.learning` only until changed in Admin → Roles.
3. First-time orgs: `create_organization_with_brreg` seeds `learning.manage` on the admin role.
4. App: when Supabase + `organization_id` are present, `useLearning` reads/writes these tables; optional one-time seed from bundled AML/demo when the org library is empty (client batch insert, `learning.manage` only).

## Assets and future work

- Keep media as URLs in `jsonb` for now; move large blobs to **Supabase Storage** with org-scoped paths when needed.
- Optional: normalize quiz/flashcard tables if reporting requires SQL-level analytics.

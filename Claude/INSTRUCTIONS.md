# Klarert Document Module — Vibe Coding Instructions

This folder contains detailed implementation specifications for the **Klarert**
document module. Each file is a self-contained feature spec that a coding LLM
can execute from start to finish.

## Folder structure

```
Claude/
├── INSTRUCTIONS.md          ← you are here
├── P0_broken_ux/            ← fix before any new features
├── P1_high_value/           ← highest impact additions
├── P2_medium_value/         ← solid second pass
├── P3_long_term/            ← strategic features
└── compliance/              ← Norwegian labour law gaps
```

## How to use these files

1. Feed **ONE** spec file at a time to the LLM.
2. Never combine multiple spec files in a single session unless the spec
   explicitly says it depends on another.
3. Run the **Validation checklist** at the end of each spec before marking done.
4. Commit and push after each completed spec.

---

## Mandatory anti-hallucination rules

These rules are non-negotiable. If the LLM cannot comply with a rule it **must
stop and ask** instead of guessing.

### Rule 1 — File paths are exact
Every file path in the spec has been verified against the real codebase.
Do **not** rename, move, or create alternative paths. If a referenced path does
not exist on disk, stop and report the discrepancy before touching anything.

### Rule 2 — No invented types
All TypeScript types must come from `src/types/documents.ts` or existing type
files. Add new types to the type file first; never inline `type Foo = …` inside
a component.

### Rule 3 — No undeclared dependencies
Do **not** add npm packages that are not listed in `package.json` without
explicitly stating: (a) the package name, (b) the exact version to install, and
(c) why no existing package covers the need. Preferred packages are listed in
each spec.

### Rule 4 — Database changes need a migration file
Every Supabase schema change (new table, column, index, RLS policy, function)
**must** ship with a migration file in `supabase/migrations/`. Follow the
existing naming convention: `YYYYMMDDHHMMSS_description.sql`. Never alter the
DB by editing the application code alone.

### Rule 5 — Norwegian Bokmål only
All user-facing strings are in Norwegian Bokmål (nb). Do **not** write UI text
in English. Reuse existing patterns from `src/i18n/strings.ts` where available.

### Rule 6 — No stub implementations
Do **not** leave `// TODO`, unimplemented function bodies, or placeholder return
values. Every function must be complete and callable. If a complete
implementation is not possible in one pass, say so explicitly and stop — do not
pretend it is done.

### Rule 7 — TypeScript strict mode
`tsconfig.json` has `strict: true`. All code must compile with zero type errors.
Do **not** use `as any`, `@ts-ignore`, or `@ts-nocheck` unless the spec
explicitly lists it as a named exception.

### Rule 8 — RLS on every new table
Every new Supabase table must have `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and
at least one meaningful policy. Copy the pattern from existing migrations in
`supabase/migrations/archive/`.

### Rule 9 — Self-validate before reporting done
Before saying a task is complete, run through the **Validation checklist** in
the spec and answer each item with ✓ / ✗ / N/A. If any item fails, fix it
before reporting done. Never mark done while a checklist item is ✗.

### Rule 10 — Read before editing
Before editing any file, read its current full content using the Read tool.
Never assume a file's structure from memory or a previous session.

### Rule 11 — Commit message format
`feat(documents): <imperative description>`
Example: `feat(documents): add full-text search with pg tsvector`

Always commit migration files and application code in the **same** commit.

### Rule 12 — One concern per PR
Do not bundle two spec items into a single commit unless they are listed as
dependencies of each other in the spec.

---

## Stack reference

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript strict, React Router 7 |
| Styling | Tailwind CSS 4 |
| Rich text | TipTap 3 |
| Icons | Lucide React |
| Validation | Zod 4 |
| HTML safety | DOMPurify |
| Backend | Supabase (PostgreSQL + RLS + Storage + Realtime) |
| Build | Vite 8 |
| Deployment | Vercel |
| Primary language | Norwegian Bokmål (nb) |

## Key file map

| File | Purpose |
|---|---|
| `src/hooks/useDocuments.tsx` | Central document state — all CRUD (2 056 lines) |
| `src/types/documents.ts` | All document TypeScript types |
| `src/data/documentTemplates.ts` | Page template definitions |
| `src/data/wikiRetentionCategories.ts` | Retention category reference data |
| `src/data/documentsNav.ts` | Navigation structure |
| `src/lib/documentsAccess.ts` | Permission helper functions |
| `src/lib/wikiSpaceAccessGrants.ts` | Folder-level grant evaluation |
| `src/pages/documents/WikiPageEditor.tsx` | Block editor page |
| `src/pages/documents/WikiPageView.tsx` | Published page view |
| `src/pages/documents/WikiBlockRenderer.tsx` | Block type renderer |
| `src/pages/documents/ComplianceDashboard.tsx` | Legal coverage dashboard |
| `src/pages/documents/AnnualReviewPage.tsx` | Annual review workflow |
| `src/components/documents/TipTapRichTextEditor.tsx` | TipTap wrapper |
| `src/components/documents/DocumentEditorWorkbench.tsx` | Editor workbench |
| `supabase/migrations/` | All DB migration files |

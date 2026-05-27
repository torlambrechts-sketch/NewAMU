<!--
  Status: reference / aspirational.

  This file describes a Next.js (App Router) + shadcn/ui + TanStack Table
  stack — NOT the conventions currently in force for this repository.
  The live primer for the actual Vite + React Router codebase is
  `/CLAUDE.md` at the repo root, which is what every Claude Code session
  loads.

  Keep this file untouched as a reference for future migration work or
  for parallel projects that share the same compliance domain.
-->

# CLAUDE.md

Instructions for Claude Code working in this repository.

## Project

Norwegian labor law compliance application. Database-driven, modular architecture where each compliance requirement (inspection rounds, surveys, worker councils, etc.) is a configurable module.

**Stack:** Next.js (App Router) + TypeScript + Supabase + Vercel + Tailwind CSS + shadcn/ui.

## Architecture rules

- **Modules are configurable, not hardcoded.** New compliance requirements should be added by configuration + a registered section component, not by forking page logic.
- **Workflows are cross-module.** Findings auto-create deviations and tasks. Always check `WorkflowAdmin.jsx` definitions before adding side effects in code.
- **Access control lives in Supabase RLS.** Do not duplicate authorization checks in the client. If a query returns nothing, suspect RLS first.
- **Layouts come from `LayoutAdmin.jsx` + `COMPONENT_REGISTRY`.** When adding a new section component, register it in the registry — do not import it directly into a page.
- **Templates are centrally defined.** Reuse existing templates; do not inline new ones.

## UI conventions

This project uses **shadcn/ui** for all UI components. Always prefer a shadcn primitive over a custom build. If a primitive doesn't exist for the need, compose existing ones before writing custom CSS.

### Component mapping (use these by default)

| Need | Component |
|---|---|
| Data table (any list of records) | `Table` + TanStack Table v8 |
| Expandable / hierarchical rows | TanStack `getExpandedRowModel()` + `row.getCanExpand()` |
| Form | `Form` + React Hook Form + Zod |
| Static info / notice | `Alert` |
| Transient notification | `Sonner` (toast) |
| Destructive confirmation | `AlertDialog` |
| Hover hint | `Tooltip` (short) / `HoverCard` (rich) |
| App-wide top nav | `NavigationMenu` |
| Page-level section switcher | `Tabs` |
| Row actions | `DropdownMenu` |
| KPI / stat card | `Card` with stat block pattern |
| Progress (KR, completion %) | `Progress` |
| Status flag (confidence, severity) | `Badge` with semantic variants |
| Modal | `Dialog` |
| Side panel | `Sheet` |

### Table pattern (mandatory)

All tables follow the same file layout — this keeps every module's list view identical except for column defs:

```
features/<module>/
  components/
    <Module>Table.tsx       // wires TanStack + shadcn Table
    columns.tsx             // column definitions only
    <Module>RowDetails.tsx  // expanded row content
```

`columns.tsx` exports `columns: ColumnDef<T>[]`. The table component is dumb — it takes `data` and `columns` and renders. No business logic in the table.

For expandable rows: first column is a chevron toggle (`row.getToggleExpandedHandler()`), expanded row spans all columns and renders `<ModuleRowDetails row={row.original} />`.

### Form pattern (mandatory)

Always `Form` (shadcn) + `useForm` (React Hook Form) + `zodResolver`. Schema lives next to the form in `schema.ts`. Never use uncontrolled inputs with manual state.

## Brand & styling

Conscia visual system. Tokens live in `app/globals.css` as CSS variables.

- **Backgrounds:** white default; dark navy (`--conscia-navy`) and aubergine (`--conscia-aubergine`) for hero cards only.
- **Section labels:** small-caps, bold, tracking-wide (`text-xs font-bold uppercase tracking-wider`).
- **Hero/feature cards:** left-rail → arrow → main card structure.
- **Goal capsules:** pill-shaped (`rounded-full`), used for OKR key results and pillar tags.
- **Spacing:** Tailwind defaults; do not introduce arbitrary `px` values.
- **Map all colors through semantic tokens** (`bg-primary`, `text-muted-foreground`, etc.). Never hardcode hex values in components — extend tokens in `globals.css` instead.

### Confidence / status colors (semantic)

- On track: `bg-emerald-500` / `text-emerald-600`
- At risk: `bg-amber-500` / `text-amber-600`
- Off track: `bg-rose-500` / `text-rose-600`

Use the `Badge` component with these — do not invent new badge variants per module.

## File & code conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Server Components by default; add `"use client"` only when needed (state, effects, browser APIs).
- Supabase queries: server-side in Server Components or Route Handlers. Client-side only for realtime subscriptions.
- Imports use `@/` alias.
- One component per file. Co-locate `columns.tsx`, `schema.ts`, sub-components in a `components/` folder next to the route.
- No default exports except for Next.js pages/layouts.

## What NOT to do

- Don't install a new UI library (MUI, Mantine, Chakra). Compose with shadcn.
- Don't add a new state library (Redux, Zustand) without asking — React state + server state via Supabase is sufficient.
- Don't bypass the `COMPONENT_REGISTRY` to render a section component directly.
- Don't add authorization logic in the client; fix the RLS policy instead.
- Don't write raw SQL in app code. Use Supabase client or a generated migration.
- Don't hardcode strings that vary by module — read them from module config.
- Don't add localStorage/sessionStorage in components that may render on the server.

## When unsure

1. Check `INTEGRATION.md` for module registration patterns.
2. Check `LayoutAdmin.jsx` and `WorkflowAdmin.jsx` for existing definitions.
3. Look for a similar feature already implemented — copy its structure.
4. Ask before introducing a new dependency, a new top-level folder, or a new layout pattern.

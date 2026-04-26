# NEWAMU MODULE GENERATION — RULES (verbatim from project owner)

> **Role:** Expert React, TypeScript, Tailwind CSS, and Supabase developer.
> **Mission:** Build new feature modules for the NewAMU platform following STRICT database-first architecture, specific RLS security models, and a rigid, component-based UI design system. DO NOT invent new UI patterns. DO NOT use raw HTML for interactive elements.

## 1. Architecture & Database (Supabase)
- **Migrations:** New SQL in `supabase/migrations/` (root); historical chain in `supabase/migrations/archive/`.
- **Audit logging:** Core tables MUST have triggers for immutable audit logging.
- **Row Level Security (RLS) — CRITICAL:** All tables enforce isolation by `organization_id`. Use this exact insert-trigger pattern:
  ```sql
  create or replace function public.[table]_before_insert()
  returns trigger language plpgsql security definer set search_path = public as $$
  begin
    if new.organization_id is null then
      new.organization_id := public.current_org_id();
    end if;
    return new;
  end;
  $$;
  ```
- **Immutable rule:** if a record is signed/archived, block updates with `using (status not in ('signed', 'archived', 'approved'))`.

## 2. State Management & Hooks
- File structure: `modules/[module_name]/use[ModuleName].ts`
- Do NOT fetch data inside UI components. Use the central hook.
- **Mandatory authorization pattern:**
  ```ts
  const { organization, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('[module].manage')
  ```
- Errors caught with `getSupabaseErrorMessage(err)` and rendered via `<WarningBox>` — never just `console.log`.

## 3. Strict UI Component Rules
**Forbidden:** copy-pasting Tailwind for inputs/buttons/menus. Use `src/components/ui/`.

| Element | Component | Path |
|---|---|---|
| Buttons | `<Button>` | `src/components/ui/Button` — `variant="primary" | "secondary" | "ghost" | "danger"` |
| Text input | `<StandardInput>` | `src/components/ui/Input` |
| Textarea | `<StandardTextarea>` | `src/components/ui/Textarea` |
| Dropdown | `<SearchableSelect>` | `src/components/ui/SearchableSelect` — `options={[{value,label}]}` |
| Status pill | `<Badge>` | `src/components/ui/Badge` — `variant="neutral" | "info" | "success" | "warning" | "danger"` |
| In-page tabs | `<Tabs>` | `src/components/ui/Tabs` — `items={[{id,label,icon,badgeCount}]}`, `activeId` |
| Legal/Info | `<ComplianceBanner>` | `src/components/ui/ComplianceBanner` — REQUIRED for IK-forskriften / AML refs |
| Alerts | `<InfoBox>` / `<WarningBox>` | `src/components/ui/AlertBox` |
| Toggles | `<YesNoToggle>` | `src/components/ui/FormToggles` (replaces checkboxes) |

## 4. Layout & Visual Patterns
- Page bg `bg-[#F9F7F2]`. White cards. Forest Green `#1a3d32`.
- Severity left-borders on list rows: `border-l-4 border-l-red-500 bg-red-50/30` (critical), `border-l-orange-400 bg-orange-50/20` (high), `border-l-yellow-400` (medium), `border-l-blue-300` (low).

## 4a. Module Layout Primitives (mandatory)
| Element | Component | Path |
|---|---|---|
| Page shell | `<ModulePageShell>` | `src/components/module` — `breadcrumb`, `title`, `description`, `headerActions`, `tabs`, `loading`, `notFound` |
| Section card | `<ModuleSectionCard>` | `src/components/module` |
| Signature card | `<ModuleSignatureCard>` | `src/components/module` — role-based |
| Pre-flight checklist | `<ModulePreflightChecklist>` | `src/components/module` |

Reference: `modules/ros/*` and `modules/inspection/*`.

## 5. Language
All UI text in Norwegian Bokmål. (Påkrevd, Kladd/Aktiv/Signert, Avvik, Avbryt/Lagre/Slett, …)

## 6. Execution protocol
1. DB migrations + RLS + triggers
2. Types + Zod
3. Hook with `canManage` and error rendering
4. UI from `src/components/ui/` + `src/components/module/` only
5. Self-review: any `<button className=`, `<input className=` → rewrite

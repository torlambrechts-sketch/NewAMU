# AI INSTRUCTION SET: NEW MODULE GENERATION
**Role:** You are an Expert React, TypeScript, Tailwind CSS, and Supabase developer building a new feature module for the platform.
**Mission:** Replicate the exact architecture, database-first design, workflow integration, and strict UI/UX style established by the `Inspeksjonsrunder` (Inspection) module. DO NOT drift from these standards. DO NOT invent new UI patterns.

---

## 1. ARCHITECTURE: DATABASE FIRST
Every module must start with the data layer. We use Supabase (PostgreSQL).
- **Migration Files:** Create **new** SQL migrations in `supabase/migrations/` (root). Keep the long historical chain under `supabase/migrations/archive/`.
- **Primary Tables:** Create the core entity tables (e.g., `[module_name]`, `[module_name]_items`).
- **Audit Logging:** Core tables MUST have triggers for immutable audit logging (reference `hse_immutable_audit_log.sql`).
- **Row Level Security (RLS):** ALL tables MUST have strict RLS policies ensuring users only see data for their organization/location.
- **Frontend Data Layer (`modules/[module_name]/`):**
  - `types.ts`: TypeScript interfaces strictly mirroring the Supabase schema.
  - `schema.ts`: Zod schemas for parsing JSONB fields.
  - `use[ModuleName].ts`: A single centralized custom hook for all data fetching/mutations. NEVER fetch data directly inside UI components.

---

## 2. STRICT UI & STYLING RULES (NO DRIFT)
You are **STRICTLY FORBIDDEN** from writing custom inline Tailwind strings for generic inputs, buttons, menus, or badges. You MUST use the platform's global UI library located in `src/components/ui/`.

### 2.1 Atomic UI Component Reference (MANDATORY)
Whenever you need to render an interactive element, you MUST import and use the following components. **DO NOT USE RAW HTML TAGS** (`<button>`, `<input>`, `<select>`, `<span>` for badges).

| Element Needed | Component to Use | Import Path | Notes / Props |
| :--- | :--- | :--- | :--- |
| **Buttons** | `<Button>` | `../../src/components/ui/Button` | `variant="primary|secondary|danger|ghost" size="default|sm|icon"`. Use `icon={<IconName />}` prop for leading icons. |
| **Text Inputs** | `<StandardInput>` | `../../src/components/ui/Input` | Inherits standard HTML input props. |
| **Text Areas** | `<StandardTextarea>` | `../../src/components/ui/Textarea` | Inherits standard HTML textarea props. |
| **Dropdowns** | `<SearchableSelect>` | `../../src/components/ui/SearchableSelect` | Use for all selectable dropdowns. Takes `options={[{value, label}]}` and `onChange`. |
| **Status Pills** | `<Badge>` | `../../src/components/ui/Badge` | `variant="neutral|info|success|warning|high|critical"`. |
| **In-Page Tabs**| `<Tabs>` | `../../src/components/ui/Tabs` | Replaces standard menus. Takes `items={[{id, label, icon, badgeCount}]}` and `activeId`. |
| **Legal/Info** | `<ComplianceBanner>`| `../../src/components/ui/ComplianceBanner` | Use for all legal requirements/IK-forskriften. Takes `title` string and `children` for description. |
| **Alerts** | `<InfoBox>` / `<WarningBox>` | `../../src/components/ui/AlertBox` | Use for form warnings or helpful tips. |
| **Toggles** | `YesNoToggle`, `ToggleSwitch` | `../../src/components/ui/FormToggles` | Use for boolean states instead of checkboxes. |

### 2.2 Page Layout & Shell
- **Background:** The main page background MUST be `bg-[#F9F7F2]`.
- **Max Width:** Content wrappers MUST use `mx-auto max-w-[1400px] px-4 py-6 md:px-8`.
- **Header:** Use `WorkplacePageHeading1` for the top header. Include `breadcrumb`, `title`, `description`, and `headerActions` (Badges and Admin button).
- **Navigation:** Use the `<Tabs>` component directly below the header/description for sub-page navigation.

### 2.3 Cards & Containers
- **Module Cards:** Main content areas must use the pre-defined layout tokens from `src/components/layout/workplaceModuleSurface.ts`.
  - Wrap content in: `<div className={\`\${WORKPLACE_MODULE_CARD} overflow-hidden\`} style={WORKPLACE_MODULE_CARD_SHADOW}>`
- **Separators:** Use `border-b border-neutral-100` or `border-neutral-200` to separate internal card sections.

### 2.4 Forms & Layout Grids
- **Form Wrappers:** Form sections must use the standard layout tokens from `src/components/layout/WorkplaceStandardFormPanel.ts`.
  - Row Grid: `<div className={WPSTD_FORM_ROW_GRID}>`
  - Labels: `<label className={WPSTD_FORM_FIELD_LABEL}>`
  - Explanatory Lead: `<p className={WPSTD_FORM_LEAD}>`

---

## 3. ADMIN & WORKFLOW INTEGRATION
Every module MUST have an Admin Settings area and hook into the global workflow engine.
- **Admin Layout:** Use `ModuleAdminShell` or `WorkplaceSplit7030Layout` in `src/pages/[ModuleName]AdminPage.tsx`.
- **Workflow Triggers:** Define specific triggers for the module (e.g., `ON_[MODULE]_CREATED`, `ON_[MODULE]_STATUS_CHANGED`) so admins can configure automated actions (e.g., CREATE_DEVIATION, SEND_EMAIL).

---

## 4. EXECUTION PROTOCOL
When asked to generate a new module, execute in this exact order:
1. **DB & Types:** `supabase/migrations/*.sql` (and `archive/`) SQL -> `modules/[name]/types.ts` & `schema.ts`.
2. **State:** `modules/[name]/use[Name].ts` handling all Supabase interactions.
3. **Admin:** Build the Admin UI for managing templates.
4. **Workflow:** Register the module's events in the workflow factory.
5. **UI (The Strict Part):** Build the user-facing views utilizing ONLY the approved Layout Shells, Form Grids, and the `src/components/ui/` library components listed in Section 2.1.
6. **Self-Correction:** Before finalizing, scan the generated code. If you see `<input className="...">`, `<button className="...">`, or `<div className="flex gap-2">` acting as a Tab menu, DELETE IT and replace it with `<StandardInput>`, `<Button>`, and `<Tabs>`.

# AI INSTRUCTION SET: NEWAMU MODULE GENERATION & REFACTORING
**Version:** 3.1 (Enterprise Layout Precision)
**Role:** Expert Enterprise React, TypeScript, Tailwind CSS, and Supabase Architect.
**Mission:** Build and refactor feature modules for the NewAMU platform following STRICT database-first architecture, workflow integration, and a rigid UI component design system.

---

## 1. ZERO-TOLERANCE RULES (CRITICAL)
If you violate any of these rules, you have failed the prompt.
1. **NO RAW HTML CONTROLS:** You are strictly forbidden from using `<button>`, `<input>`, `<textarea>`, or `<select>`. You MUST use the `src/components/ui/` library.
2. **NO HARDCODED CONFIGURATION:** Settings such as risk matrices, hazard categories, dropdown options, and templates MUST be managed via the database and Admin UI. Do NOT use hardcoded `const CATEGORIES = [...]` arrays in the frontend.
3. **NO BYPASSING RLS:** Every Supabase query MUST explicitly isolate data by appending `.eq('organization_id', orgId)`.

---

## 2. DATABASE & SECURITY ARCHITECTURE (SUPABASE)
- **Migrations:** Create standard SQL migrations in `supabase/migrations/`.
- **Audit Logging:** Core tables MUST have triggers for immutable audit logging.
- **Row Level Security (RLS) & Auto-Fill:**
  ALL tables must enforce isolation by `organization_id`. You MUST use this exact trigger pattern for inserts to auto-fill the org ID:
  ```sql
  CREATE TRIGGER set_org_id BEFORE INSERT ON public.[table_name]
  FOR EACH ROW EXECUTE FUNCTION public.set_current_org_id();
  ```
- **Immutability (Locking):** If a record (like a ROS or SJA) is signed or approved, it must be locked. Block updates via RLS: `CHECK (status NOT IN ('signed', 'approved'))`.

---

## 3. DATA LAYER & STATE MANAGEMENT (`use[ModuleName].ts`)
ALL data fetching, mutations, and business logic MUST reside in a single custom hook.
1. **Strict Authorization:** You MUST check `isAdmin` alongside module permissions to prevent locking out system admins.
   ```typescript
   const { organization, can, isAdmin } = useOrgSetupContext()
   const canManage = isAdmin || can('[module].manage') // MANDATORY
   ```
2. **Local Immutability Checks:** Before sending an `update` mutation, the hook MUST locally verify the status is not locked (`signed`/`approved`). If it is, reject the mutation.
3. **Zod Validation (`schema.ts`):** Any complex data stored as JSONB in Supabase (e.g., lists of hazards, measures, participants) MUST be strictly typed and parsed through `z.object()` schemas upon fetching.
4. **Error Handling:** Route ALL Supabase errors through `getSupabaseErrorMessage(error)`. Expose a central `error` state string from the hook. NEVER rely solely on `console.error()`.

---

## 4. STRICT UI COMPONENT LIBRARY
You MUST import and use these atomic components. Do not invent inline Tailwind strings for them.

| Element Needed | Component to Use | Import Path | Props / Notes |
| :--- | :--- | :--- | :--- |
| **Buttons** | `<Button>` | `../../src/components/ui/Button` | `variant="primary|secondary|danger|ghost" size="default|sm|icon"`. Use `icon={<IconName />}` for leading icons. |
| **Text Inputs** | `<StandardInput>` | `../../src/components/ui/Input` | Replaces `<input type="text">`. |
| **Text Areas** | `<StandardTextarea>` | `../../src/components/ui/Textarea` | Replaces `<textarea>`. |
| **Dropdowns** | `<SearchableSelect>` | `../../src/components/ui/SearchableSelect`| Use for all selections. Takes `options={[{value, label}]}`. |
| **Status Pills**| `<Badge>` | `../../src/components/ui/Badge` | `variant="neutral|info|success|warning|high|critical"`. |
| **In-Page Tabs**| `<Tabs>` | `../../src/components/ui/Tabs` | Replaces `HubMenu1Bar` and custom flex menus. Takes `items` and `activeId`. |
| **Legal/Info** | `<ComplianceBanner>`| `../../src/components/ui/ComplianceBanner`| **MUST** be used for IK-forskriften / AML references. |
| **Alerts** | `<InfoBox>`/`<WarningBox>`| `../../src/components/ui/AlertBox` | Form warnings or displaying the hook's `error` state. |
| **Toggles** | `YesNoToggle` | `../../src/components/ui/FormToggles` | Boolean states (replaces checkboxes). |

---

## 5. LAYOUT & VISUAL PATTERNS (CRITICAL PRECISION)
- **Backgrounds:** Page background `bg-[#F9F7F2]`. Main content in white cards. 
- **Page Shell:** Use `WorkplacePageHeading1` at the top. The sticky header should NOT have a `border-b` if `<Tabs>` is used directly below it.
- **Card Containers:** Use `WORKPLACE_MODULE_CARD` and `WORKPLACE_MODULE_CARD_SHADOW` from `src/components/layout/workplaceModuleSurface`.
- **Forms:** Wrap rows in `WPSTD_FORM_ROW_GRID` and labels in `WPSTD_FORM_FIELD_LABEL`.

### 5.1 Tab Content Layout Rules
When building content inside a Tab (e.g., `*Tab.tsx`), you MUST follow these structural rules:
1. **Full-Bleed Banners:** If a Tab starts with a `<ComplianceBanner>`, the Tab wrapper MUST NOT have padding. Use `<div className="flex flex-col">`, place the banner at the top (with `className="border-b border-[#1a3d32]/20"`), and wrap the rest of the content in a padded div (e.g., `<div className="p-5 md:p-6 space-y-6">`).
2. **List Toolbars:** If a Tab contains a list of items (e.g., Hazards, Measures, Tasks) that can be added to, the "Add" button MUST NOT float loosely. It MUST be placed in a standardized toolbar above the list:
   ```tsx
   <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-5 py-3">
     <span className="text-sm font-medium text-neutral-700">Item List Title</span>
     <Button variant="primary" icon={<Plus className="h-4 w-4" />}>Add Item</Button>
   </div>
   ```
3. **Severity Borders:** For list rows indicating risk or deviations, use `border-l-4`:
   - Critical: `border-l-red-500 bg-red-50/30`
   - High: `border-l-orange-400 bg-orange-50/20`
   - Medium: `border-l-yellow-400`
   - Low: `border-l-blue-300`

---

## 6. ADMIN SETTINGS & WORKFLOW ENGINE
Every module must expose an Admin UI for customer configuration and hook into the global Workflow Engine.
1. **Admin Page Shell (`[ModuleName]AdminPage.tsx`):**
   - MUST be wrapped in `ModuleAdminShell`.
   - Use `<Tabs>` to separate: "Generelt", "Kategorier/Innstillinger", "Maler", and "Arbeidsflyt".
   - Build CRUD forms (Create, Read, Update, Delete) using `<StandardInput>` and `<Button>` so users can manage dropdown categories and templates dynamically.
2. **Workflow Engine Integration:**
   - The Admin page MUST render `<WorkflowRulesTab module="[module_name]" />`.
   - Register module triggers (e.g., `ON_[MODULE]_CREATED`, `ON_[MODULE]_CRITICAL_RISK`) in `src/components/workflow/workflowRuleFactory.ts`.
   - Ensure the hook (`use[ModuleName].ts`) dispatches these workflow events upon successful mutations (like signing a document).

---

## 7. PRE-FLIGHT VERIFICATION CHECKLIST
Before finalizing any code generation, you MUST self-audit against this checklist:
- [ ] Is every UI string in Norwegian (Bokmål)?
- [ ] Did I use `<button>` or `<input>` anywhere? (If yes, rewrite using `src/components/ui/`).
- [ ] Are Compliance Banners full-bleed (no padding)?
- [ ] Are list actions ("Add item") placed in a `bg-neutral-50` toolbar?
- [ ] Did I hardcode any configuration arrays that should be fetched from Supabase?
- [ ] Does the `canManage` permission check include `isAdmin`?
- [ ] Are JSONB fields parsed through Zod?
- [ ] Is the `<WorkflowRulesTab>` implemented in the Admin page?

# AI INSTRUCTION SET: NEWAMU MODULE GENERATION & REFACTORING
**Version:** 3.3 (Ultimate Enterprise Table & Layout Precision)
**Role:** Expert Enterprise React, TypeScript, Tailwind CSS, and Supabase Architect.
**Mission:** Build and refactor feature modules for the NewAMU platform following STRICT database-first architecture, workflow integration, and a rigid UI component design system.

---

## 1. ZERO-TOLERANCE RULES (CRITICAL)
If you violate any of these rules, you have failed the prompt.
1. NO RAW HTML CONTROLS: You are strictly forbidden from using standard HTML inputs, textareas, selects, or buttons. You MUST use the src/components/ui/ library.
2. NO CARD-BASED LISTS: All data lists MUST use the Enterprise Table Layout (see Section 5.1). No floating divs with left-borders for records.
3. NO HARDCODED CONFIGURATION: Settings such as risk matrices, hazard categories, dropdown options, and templates MUST be managed via the database and Admin UI. 
4. NO BYPASSING RLS: Every Supabase query MUST explicitly isolate data by appending .eq('organization_id', orgId).

---

## 2. DATABASE & SECURITY ARCHITECTURE (SUPABASE)
- Migrations: Create standard SQL migrations in supabase/migrations/archive/. Use the recursive find script (scripts/apply-migrations.sh) to apply them.
- Audit Logging: Core tables MUST have triggers for immutable audit logging.
- Row Level Security (RLS) & Auto-Fill:
  ALL tables must enforce isolation by organization_id. You MUST use the database-native *_before_insert functions to trigger current_org_id() auto-fill.
- Immutability (Locking): If a record (like a ROS or SJA) is signed, approved, or archived, it must be locked. Block updates via RLS:
  CHECK (status NOT IN ('signed', 'approved', 'archived'))

---

## 3. DATA LAYER & STATE MANAGEMENT (use[ModuleName].ts)
ALL data fetching, mutations, and business logic MUST reside in a single custom hook.
1. Strict Authorization: You MUST check isAdmin alongside module permissions to prevent locking out system admins.
    const { organization, can, isAdmin } = useOrgSetupContext()
    const canManage = isAdmin || can('[module].manage')
2. Local Immutability Checks: Before sending an update mutation, the hook MUST locally verify the status is not locked ('signed'/'approved'). If it is, reject the mutation with an error.
3. Zod Validation (schema.ts): Any complex data stored as JSONB in Supabase (e.g., lists of hazards, measures, participants) MUST be strictly typed and parsed through z.object() schemas upon fetching.
4. Error Handling: Route ALL Supabase errors through getSupabaseErrorMessage(error). Expose a central error state string from the hook. NEVER rely solely on console.error().

---

## 4. STRICT UI COMPONENT LIBRARY
You MUST import and use these atomic components. Do not invent inline Tailwind strings for them.

- Buttons: <Button> (variant="primary|secondary|danger|ghost" size="default|sm|icon").
- Text Inputs: <StandardInput>
- Text Areas: <StandardTextarea>
- Dropdowns: <SearchableSelect> (Takes options={[{value, label}]})
- Status Pills: <Badge> (variant="neutral|info|success|warning|high|critical")
- In-Page Tabs: <Tabs> (Replaces HubMenu1Bar and custom flex menus)
- Legal/Info: <ComplianceBanner> (MUST be used for IK-forskriften / AML references)
- Alerts: <InfoBox> / <WarningBox>
- Toggles: YesNoToggle

---

## 5. LAYOUT & VISUAL PATTERNS (CRITICAL PRECISION)
- Backgrounds: Page background bg-[#F9F7F2]. Main content in white cards. 
- Page Shell: Use WorkplacePageHeading1 at the top. The sticky header should NOT have a border-b if <Tabs> is used directly below it.

### 5.1 Standard Enterprise Table Layout (MANDATORY FOR LISTS)
When a module displays a list of records inside a tab (e.g., Hazards, Measures, Deviations), you MUST NOT use floating div cards. You MUST use the Enterprise Table Layout:

1. Structure: Wrap the list in LayoutTable1PostingsShell (src/components/layout/LayoutTable1PostingsShell). If the component is already rendered inside a main white card, pass wrap={false}.
2. Header Actions: Place the primary "Add" <Button> and global filters (like <SearchableSelect>) into the headerActions prop of the shell.
3. The Table: Inside the shell, build a native <table className="w-full text-left text-sm whitespace-nowrap">:
    - <thead> rows must use th with bg-neutral-50 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500.
    - <tbody> rows must use tr with border-b border-neutral-100 hover:bg-neutral-50 transition-colors.
4. Cell Content:
    - Use <Badge> for status and risk levels. DO NOT use border-l-4 card borders for tables.
    - Right-align the "Actions" column. Use <Button variant="ghost" size="icon"> for Edit/Delete icons.

### 5.2 Tab Content DOM Hierarchy (STRICT ORDERING)
When building content inside a Tab (*Tab.tsx), you MUST follow this EXACT top-to-bottom structural skeleton. Do not deviate or nest these incorrectly:

    <div className="flex flex-col space-y-6">
      // 1. TOP DASHBOARD: KPI Stats FIRST
      // Use <LayoutScoreStatRow> on the beige background, OUTSIDE the main white module card.
      
      // 2. FULL-BLEED BANNERS (If applicable)
      // <ComplianceBanner className="border-b border-[#1a3d32]/20">
      
      // 3. MAIN TABLE CARD
      // <LayoutTable1PostingsShell headerActions={<Button>Add</Button>}>
      //    <table>...</table>
      // </LayoutTable1PostingsShell>
      
      // 4. FORMS
      // Any creation/edit forms go at the very bottom, inside a separate card or section.
    </div>

---

## 6. ADMIN SETTINGS & WORKFLOW ENGINE
Every module must expose an Admin UI for customer configuration and hook into the global Workflow Engine.
1. Admin Page Shell ([ModuleName]AdminPage.tsx):
    - MUST be wrapped in ModuleAdminShell.
    - Use <Tabs> to separate: "Generelt", "Kategorier/Innstillinger", "Maler", and "Arbeidsflyt".
    - Build CRUD forms (Create, Read, Update, Delete) using <StandardInput> and <Button> so users can manage dropdown categories and templates dynamically.
2. Workflow Engine Integration:
    - The Admin page MUST render <WorkflowRulesTab module="[module_name]" />.
    - Register module triggers (e.g., ON_[MODULE]_CREATED) in src/components/workflow/workflowTriggerRegistry.ts.
    - Ensure the hook (use[ModuleName].ts) dispatches these workflow events upon successful mutations, or prefer DB-triggers combined with workflow_dispatch_db_event.

---

## 7. PRE-FLIGHT VERIFICATION CHECKLIST
Before finalizing any code generation, you MUST self-audit against this checklist:
- [ ] Is every UI string in Norwegian (Bokmål)?
- [ ] Did I use standard <button> or <input> anywhere? (If yes, rewrite using src/components/ui/).
- [ ] Is the list rendered as a native <table> inside LayoutTable1PostingsShell?
- [ ] Are all "Add" actions placed in the headerActions prop of the table shell instead of floating loosely?
- [ ] Are KPI stats placed at the very top using LayoutScoreStatRow?
- [ ] Are Compliance Banners full-bleed (no padding)?
- [ ] Did I hardcode any configuration arrays that should be fetched from Supabase?
- [ ] Does the canManage permission check include isAdmin?
- [ ] Are JSONB fields parsed through Zod?
- [ ] Does the hook locally block mutations on locked (signed) records?

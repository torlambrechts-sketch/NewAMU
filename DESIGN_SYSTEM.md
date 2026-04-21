# AI INSTRUCTION SET: NEWAMU MODULE GENERATION
**Role:** Expert React, TypeScript, Tailwind CSS, and Supabase developer.
**Mission:** Build new feature modules for the NewAMU platform following STRICT database-first architecture, specific RLS security models, and a rigid, component-based UI design system. DO NOT invent new UI patterns. DO NOT use raw HTML for interactive elements.

---

## 1. ARCHITECTURE & DATABASE (SUPABASE)
Every module starts with the data layer. 
- **Migrations:** Create standard SQL migrations in `supabase/migrations/`.
- **Audit Logging:** Core tables MUST have triggers for immutable audit logging.
- **Row Level Security (RLS) - CRITICAL:**
  ALL tables must enforce isolation by `organization_id`. Use this exact trigger pattern for inserts:
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
Immutable rule: If a record is signed/archived, block updates: using (status not in ('signed', 'archived', 'approved'));2. STATE MANAGEMENT & HOOKSFile Structure: modules/[module_name]/use[ModuleName].tsData Fetching: Do NOT fetch data directly inside UI components. Use the central hook.Authorization Rule: You MUST check isAdmin alongside module permissions to prevent locking out global admins.TypeScriptconst { organization, can, isAdmin } = useOrgSetupContext()
const canManage = isAdmin || can('[module].manage') // MANDATORY PATTERN
Error Handling: Catch errors using getSupabaseErrorMessage(err). Errors MUST be rendered in the UI using a visible banner (e.g., <WarningBox>), never just console.log.3. STRICT UI COMPONENT RULES (NO INLINE TAILWIND FOR CONTROLS)You are STRICTLY FORBIDDEN from copy-pasting long Tailwind strings for inputs, buttons, or menus (e.g., do not use old FIELD_INPUT constants). You MUST use the src/components/ui/ library.Element NeededComponent to UseImport PathProps / NotesButtons<Button>../../src/components/ui/Button`variant="primaryText Inputs<StandardInput>../../src/components/ui/InputReplaces <input type="text">.Text Areas<StandardTextarea>../../src/components/ui/TextareaReplaces <textarea>.Dropdowns<SearchableSelect>../../src/components/ui/SearchableSelectTakes options={[{value, label}]}.Status Pills<Badge>../../src/components/ui/Badge`variant="neutralIn-Page Tabs<Tabs>../../src/components/ui/TabsReplaces HubMenu1Bar. Takes items={[{id, label, icon, badgeCount}]} and activeId.Legal/Info<ComplianceBanner>../../src/components/ui/ComplianceBannerMUST be used for IK-forskriften / AML references.Alerts<InfoBox>/<WarningBox>../../src/components/ui/AlertBoxForm warnings or helpful tips.TogglesYesNoToggle../../src/components/ui/FormTogglesBoolean states (replaces checkboxes).4. LAYOUT & VISUAL PATTERNSBackgrounds: Page background bg-[#F9F7F2]. White cards for content. Primary Brand color is Forest Green (#1a3d32).Page Shell:TypeScript<div className="min-h-screen bg-[#F9F7F2]">
  <header className="sticky top-0 z-30 bg-[#F9F7F2]/95 backdrop-blur-sm">
    <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
      <WorkplacePageHeading1 title="..." description="..." />
      <Tabs items={tabItems} activeId={activeTab} onChange={setActiveTab} />
    </div>
  </header>
  <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
    {/* Module Content / Cards */}
  </div>
</div>
Severity Borders (Lists): If listing risks or deviations, apply border-l-4 to the row.Critical: border-l-red-500 bg-red-50/30High: border-l-orange-400 bg-orange-50/20Medium: border-l-yellow-400Low: border-l-blue-300

4a. MODULE LAYOUT PRIMITIVES (MANDATORY FOR NEW MODULES) — DO NOT hand-roll the page shell above. Use the shared primitives so every module inherits identical spacing, typography and chrome:

Element | Component | Import Path | Notes
Page Shell | `<ModulePageShell>` | `../../src/components/module` | Replaces `<div class="min-h-screen bg-[#F9F7F2]">…`. Takes `breadcrumb`, `title`, `description`, `headerActions`, `tabs`, and optional `loading` / `notFound` states.
Section Card | `<ModuleSectionCard>` | `../../src/components/module` | Replaces manual `${WORKPLACE_MODULE_CARD} overflow-hidden` wrapper. Use for every tab panel surface.
Signature Card | `<ModuleSignatureCard>` | `../../src/components/module` | Role-based signature card (Leder/Verneombud/Ansvarlig …). Do NOT duplicate JSX.
Pre-flight Checklist | `<ModulePreflightChecklist>` | `../../src/components/module` | The “klar for signering” green-circle checklist that appears above `ModuleSignatureCard`s.

Reference implementation: `modules/ros/*` and `modules/inspection/*`. New modules MUST match this structure. See `MODULE_LAYOUT_EVALUATION.md` for the full rationale.

5. LANGUAGE & LOCALIZATIONAll user-facing text MUST be in Norwegian (Bokmål). No English in the UI.Required -> PåkrevdDraft / Active / Signed -> Kladd / Aktiv / SignertFinding / Deviation -> AvvikCancel / Save / Delete -> Avbryt / Lagre / Slett6. EXECUTION PROTOCOLWhen generating a new module, execute sequentially:Database: Migrations + RLS Policies + Triggers.Types & Schema: types.ts and Zod schemas.Hook: use[ModuleName].ts (Enforce canManage and error handling).UI Construction: Build the views using ONLY src/components/ui/ components.Self-Correction: Scan code before submitting. If you wrote <button className="..."> or <input className="...">, rewrite it using the UI library.

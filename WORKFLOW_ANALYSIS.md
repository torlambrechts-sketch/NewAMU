# Workflow Implementation Analysis

Multi-perspective review of the current workflow automation system in NewAMU.
Prepared: 2026-05-01

---

## Current Architecture Summary

Two conceptually separate automation systems co-exist:

| System | Store | Editor | Scope |
|--------|-------|--------|-------|
| **DB-backed rules** | `workflow_rules` + `workflow_steps` tables | `WorkflowFlowBuilder` (visual) + `WorkflowRulesTab` (form) | Cross-module, filtered per `source_module` |
| **Module template rules** | JSON in `module_templates.settings.workflowRules` | `ModuleTemplateWorkflowRulesEditor` | Per module template (5 HSE sub-modules) |

Both systems are surfaced under the same `/workflow` route, creating the illusion of one system.

`WorkflowRulesTab` is independently embedded in **8 module admin settings pages**:
`ros`, `inspection`, `vernerunder`, `action_plan`, `amu_election`, `amu`, `survey`, `internkontroll`

---

## Perspective 1 — Developer

### Finding 1: Three local type definitions for the same concept

`WorkflowRulesTab.tsx` defines its own `WorkflowRule` and `WorkflowStep` types locally.
`WorkflowModulePage.tsx` uses `WorkflowRuleRow`, `WorkflowAction`, `WorkflowCondition` from `types/workflow.ts`.
`ModuleTemplateWorkflowRulesEditor.tsx` uses yet another `WorkflowRule` shape from the module template type.

All three represent "a workflow rule" but are incompatible and cannot be passed between components without mapping.

**Fix**: Consolidate into a single `WorkflowRuleRow` from `types/workflow.ts`. `WorkflowRulesTab` should accept `WorkflowRuleRow[]` as a prop or use `useWorkflows()` directly.

### Finding 2: Deprecated `triggerModule` prop still active in production

```tsx
// WorkflowRulesTabProps
/** @deprecated Prefer `module` — same value as `source_module` in workflow_rules */
triggerModule?: string
```

The deprecated alias is still used in `InternalControlAdminPage` and resolved defensively:
```tsx
const moduleSlug = module ?? triggerModule ?? 'inspection'
```

The fallback to `'inspection'` is a silent bug — any page that passes neither prop loads inspection rules.

**Fix**: Remove `triggerModule`, make `module` required, add a build-time TS error if omitted.

### Finding 3: `WorkflowRulesTab` duplicates Supabase query logic already in `useWorkflows`

`WorkflowRulesTab` runs its own `supabase.from('workflow_rules').select(...)` query including joining `workflow_steps` manually. `useWorkflows` does the same. There are now two query paths that can diverge (e.g. if a column is added to `workflow_steps`, only one path gets it).

**Fix**: Extract shared query logic into `useWorkflows` with an optional `module` filter. `WorkflowRulesTab` becomes a pure presentation component.

### Finding 4: Raw JSON editing exposed in WorkflowModulePage

`conditionText` and `actionsText` are raw `<textarea>` elements shown directly in the production UI:
```tsx
const [conditionText, setConditionText] = useState(JSON.stringify(DEFAULT_CONDITION, null, 2))
const [actionsText, setActionsText] = useState(JSON.stringify(DEFAULT_ACTIONS, null, 2))
```

There is no JSON validation on save — malformed JSON silently corrupts `condition_json`/`actions_json`.

**Fix**: Hide behind a `[DEV]` collapsible toggle, or validate with `JSON.parse()` and show inline error before saving. Long-term: remove in favour of the visual builder.

### Finding 5: `WorkflowPage` (ModuleRulesView) is mounted inside `WorkflowModulePage`

```tsx
import { WorkflowPage as ModuleRulesView } from './WorkflowPage'
// ...
{tab === 'module-rules' && <ModuleRulesView />}
```

`WorkflowPage` is a full page component re-used as a tab child. It has its own internal `useState` for filters, its own heading, and its own permission check — creating two redundant permission gates and two copies of the module list `MODULES` constant.

**Fix**: Extract `ModuleRulesView` logic into a composable component; the page variant wraps it with a heading. Share the `MODULES` constant from a single registry file.

---

## Perspective 2 — UI Designer

### Finding 1: Three editors, three visual languages

| Editor | Visual style | Interaction model |
|--------|-------------|-------------------|
| `WorkflowFlowBuilder` | Drag-and-drop flow graph, node-based | Click node → right panel |
| `WorkflowRulesTab` RuleEditor | Accordion step cards, form fields | Expand/collapse |
| `ModuleTemplateWorkflowRulesEditor` | Flat form with action type dropdown | Inline edit |

An admin who creates a rule in `WorkflowRulesTab` (step-cards) and then opens `WorkflowModulePage` (flow graph) sees what appears to be a completely different product. There is no shared design language between the two.

**Recommendation**: Choose one primary authoring model and use it everywhere. The step-card model in `WorkflowRulesTab` is simpler and more accessible than the flow graph; the flow graph is powerful but requires training. Consider offering both under a toggle ("Enkel / Avansert").

### Finding 2: Save / Publish two-step flow is inconsistent

| Location | Save behaviour |
|----------|---------------|
| `WorkflowRulesTab` | Single "Lagre regel" — saves immediately, rule may be active |
| `WorkflowModulePage` | "Lagre utkast" sets `is_active: false`; separate activation needed |
| `ModuleRulesModuleSection` | "Lagre" (draft) then "Publiser" (live) — two button clicks |

Three different save semantics for the same underlying concept. An admin familiar with one module will be surprised by another.

**Recommendation**: Standardise on a single pattern. Suggested: "Lagre utkast" (always draft) + an explicit "Aktiver" toggle on the rule card. Always show draft state with a yellow "Utkast" badge.

### Finding 3: No cross-module overview

The main `/workflow` page shows the visual flow builder with no indication of how many module-level rules exist. The "Modul-regler" tab shows template rules. The individual module rules from `WorkflowRulesTab` are **not visible at /workflow at all** — they only appear inside each module's settings page.

An admin who wants to answer "what automation is active right now?" must visit 8 separate settings pages.

**Recommendation**: Add an "Alle regler" summary view at `/workflow` that renders all `workflow_rules` rows across all modules in a single filterable table.

### Finding 4: Status badge buried in editor, not visible on list

Rule cards in `WorkflowRulesTab` show the rule name and trigger but not the active/inactive status without opening the editor. Users must click into a rule to see if it is live.

**Recommendation**: Show a coloured status chip (green "Aktiv" / grey "Utkast") on each rule card in the list. Allow toggling active/inactive directly from the list without opening the editor.

---

## Perspective 3 — Usability Designer

### Finding 1: Rules are buried under 8 separate settings pages

An administrator who wants to review all active automation rules must:
1. Know that each module has a "Workflow" or "Arbeidsflyt" settings tab
2. Navigate to each of 8 module admin pages individually
3. Mentally aggregate what they found

There is no "home" for automation in the application. The `/workflow` route exists but is not prominently linked from the main navigation in most module pages.

**Impact**: New admins never discover automation exists. Experienced admins cannot audit rules without a 10-step process.

**Recommendation**: Surface a "Workflow" nav item in the main sidebar with a badge showing the count of active rules. The landing page shows all active rules grouped by module, with direct links to edit each one.

### Finding 2: Cognitive load — "Modul-regler" vs "Design & regler"

Users encounter two distinct concepts under `/workflow`:
- **Design & regler**: Rules stored in `workflow_rules` table (org-level, DB-backed)
- **Modul-regler**: Rules stored in module template JSON (template-level, JSON-backed)

Neither label communicates who owns the rule, what its scope is, or how it differs from the other. The tab names ("Design & regler", "Kjøringer", "Innstillinger", "Modul-regler") require prior knowledge to decode.

**Recommendation**: Rename tabs to user goals:
- "Mine regler" → rules I created / that are active now
- "Kjøringer" → "Historikk / logg"
- "Maler" → "Modul-regler"

Add a one-line description under each tab label explaining what the tab contains.

### Finding 3: No simulation or dry-run

Rules can create tasks, send emails, call webhooks, and create deviations. There is no way to test a rule before activating it. The only way to verify a rule works is to:
1. Activate it (`is_active: true`)
2. Perform the triggering action in the module
3. Check if the expected effect occurred

An accidental misconfiguration emails all members or creates spurious tasks. There is no undo.

**Recommendation**: Add a "Test regel" button that runs the rule against the most recent matching event (or a synthetic one) and shows what WOULD have happened without actually executing actions. At minimum, add a confirmation dialog on activation that lists the rule's actions.

### Finding 4: Run history is detached from rule editing

The "Kjøringer" tab shows all recent rule executions org-wide. But when editing a specific rule in `WorkflowRulesTab`, there is no way to see "this rule ran X times last week with Y failures."

**Recommendation**: Show a "Siste kjøringer" panel in the rule editor (or as an expand section on the rule card) with the last 5 runs for that specific rule, including status (OK/Feil) and timestamp.

### Finding 5: "Aktiver" / "Deaktiver" requires opening the full editor

To enable or disable a rule, a user must:
1. Click the rule card to expand the editor
2. Scroll to find the active/inactive state (or notice the badge)
3. Find the toggle (if one exists)
4. Save

Most users expect a simple on/off toggle on the list view — this is a standard pattern in Zapier, Make, n8n, and every comparable tool.

**Recommendation**: Add a toggle switch on each rule card in the list view. Clicking the toggle shows a brief confirmation ("Aktiver denne regelen? Den vil kjøre ved neste hendelse.") and saves immediately. No editor required for this common operation.

---

## Proposed Changes (Prioritised)

### P0 — Critical UX (implement first)
1. **Active/inactive toggle on rule list cards** in `WorkflowRulesTab` — removes the #1 friction point
2. **"Se alle regler →" link in `WorkflowRulesTab` header** — helps admins discover the central hub
3. **Status badge (Aktiv / Utkast) visible on each rule card** — eliminates hidden state

### P1 — Architecture
4. **Cross-module "Alle regler" overview tab in `WorkflowModulePage`** — answers "what is active right now?"
5. **Remove deprecated `triggerModule` prop** — make `module` required, eliminate silent fallback bug
6. **Move raw JSON editors to collapsible dev section** — prevent accidental corruption

### P2 — Polish
7. **Standardise save semantics** — one save pattern across all three editors
8. **Rename tabs** to user-goal language (Mine regler / Historikk / Maler)
9. **Run history per rule** — inline last-5 runs in the rule card

### P3 — Future
10. **Dry-run / simulation** for rules before activation
11. **Consolidate type definitions** — single `WorkflowRuleRow` used everywhere
12. **Extract `useWorkflows` module filter** — eliminate duplicate Supabase query in `WorkflowRulesTab`

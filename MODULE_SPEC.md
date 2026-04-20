# NewAMU Module Specification
> **Vibe/Cursor/Composer prompt:** "Follow MODULE_SPEC.md exactly. Every new module inherits all patterns defined here — database schema, file structure, hook API, admin page, workflow engine, and UI component styles."

**Kanonisk tillegg for KI og refaktorering (v3.1 — Enterprise Layout Precision):** Les og følg også [`AI_MODULE_SPEC.md`](./AI_MODULE_SPEC.md). Den utvider denne spesifikasjonen med null-toleranse-regler for UI-primitiver, faner og verktøylinjer, full-bleed `ComplianceBanner`, arbeidsflyt-registrering og sjekklister for modulgenerering.

---

## 1. Core Philosophy

- **Database first.** Migration SQL is written before any TypeScript.
- **RLS always.** Every table has Row Level Security. No exceptions.
- **Soft deletes.** Use `deleted_at timestamptz` on every entity table.
- **Organisation-scoped.** Every table has `organization_id uuid NOT NULL` with a trigger that auto-sets it on INSERT.
- **Zod on every fetch.** All Supabase rows are validated with `safeParse` before entering state.
- **One hook per module.** All Supabase calls live in `useXxxModule.ts`. Components never call Supabase directly.
- **No `any`.** TypeScript strict mode. All types are explicit.

---

## 2. Required Supabase Tables

Every module needs **at minimum** these tables. Replace `xxx` with the module slug (e.g. `inspection`, `ros`, `avvik`).

### 2a. Template table (admin-configurable entries)
```sql
CREATE TABLE xxx_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             text NOT NULL,
  definition       jsonb NOT NULL DEFAULT '{}',
  is_active        boolean NOT NULL DEFAULT true,
  deleted_at       timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX xxx_templates_org_idx ON xxx_templates(organization_id, is_active, updated_at DESC);

ALTER TABLE xxx_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY xxx_templates_select ON xxx_templates FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY xxx_templates_write  ON xxx_templates FOR ALL    USING (organization_id = current_org_id());

CREATE TRIGGER xxx_templates_updated_at BEFORE UPDATE ON xxx_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER xxx_templates_defaults BEFORE INSERT ON xxx_templates
  FOR EACH ROW EXECUTE FUNCTION set_org_and_created_by();
```

### 2b. Main records table
```sql
CREATE TYPE xxx_status AS ENUM ('draft', 'active', 'closed');

CREATE TABLE xxx_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id      uuid NOT NULL REFERENCES xxx_templates(id) ON DELETE RESTRICT,
  title            text NOT NULL,
  status           xxx_status NOT NULL DEFAULT 'draft',
  assigned_to      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_for    timestamptz,
  cron_expression  text,
  summary          text,
  completed_at     timestamptz,
  deleted_at       timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX xxx_records_org_status_idx ON xxx_records(organization_id, status, scheduled_for DESC);
CREATE INDEX xxx_records_org_assigned_idx ON xxx_records(organization_id, assigned_to, status);

ALTER TABLE xxx_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY xxx_records_select ON xxx_records FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY xxx_records_write  ON xxx_records FOR ALL    USING (organization_id = current_org_id());

CREATE TRIGGER xxx_records_updated_at BEFORE UPDATE ON xxx_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER xxx_records_defaults BEFORE INSERT ON xxx_records
  FOR EACH ROW EXECUTE FUNCTION set_org_and_created_by();
```

### 2c. Findings / sub-items table
```sql
CREATE TYPE xxx_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE xxx_findings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  record_id        uuid NOT NULL REFERENCES xxx_records(id) ON DELETE CASCADE,
  description      text NOT NULL,
  severity         xxx_severity NOT NULL,
  risk_probability smallint CHECK (risk_probability BETWEEN 1 AND 5),
  risk_consequence smallint CHECK (risk_consequence BETWEEN 1 AND 5),
  risk_score       smallint GENERATED ALWAYS AS (risk_probability * risk_consequence) STORED,
  deviation_id     uuid REFERENCES deviations(id) ON DELETE SET NULL,
  deleted_at       timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX xxx_findings_record_idx      ON xxx_findings(record_id, created_at DESC);
CREATE INDEX xxx_findings_org_severity_idx ON xxx_findings(organization_id, severity, created_at DESC);

ALTER TABLE xxx_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY xxx_findings_select ON xxx_findings FOR SELECT USING (organization_id = current_org_id());
CREATE POLICY xxx_findings_write  ON xxx_findings FOR ALL    USING (organization_id = current_org_id());

CREATE TRIGGER xxx_findings_updated_at BEFORE UPDATE ON xxx_findings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-derive organization_id from parent record
CREATE TRIGGER xxx_findings_org BEFORE INSERT OR UPDATE ON xxx_findings
  FOR EACH ROW EXECUTE FUNCTION derive_org_id_from_record();
```

### 2d. Workflow rules (reuse shared table)
Modules do NOT create their own workflow table. They register rules in the shared `workflow_rules` table:
```sql
INSERT INTO workflow_rules (organization_id, source_module, slug, name, trigger_on, condition_json, actions_json, is_active)
VALUES
  (org_id, 'xxx', 'xxx_critical', 'Kritisk funn', 'insert',
   '{"match":"field_equals","path":"severity","value":"critical"}',
   '[{"type":"create_deviation","dueInDays":1},{"type":"create_task","priority":"high","dueInDays":1}]',
   true);
```

### 2e. Module registration
```sql
INSERT INTO modules (organization_id, slug, display_name, is_active, config)
VALUES (org_id, 'xxx', 'Xxx Modulnavn', true, '{"enablePhotos":true}');
```

---

## 3. Migration File Naming Convention

```
supabase/migrations/archive/
  YYYYMMDDHHMMSS_xxx_schema.sql          -- tables, indexes, RLS, triggers
  YYYYMMDDHHMMSS_xxx_workflow.sql        -- workflow rules
  YYYYMMDDHHMMSS_xxx_seed_templates.sql  -- default templates
  YYYYMMDDHHMMSS_xxx_seed_module.sql     -- modules table registration
```

---

## 4. Module File Structure

```
modules/xxx/
  index.ts                 -- re-exports only (no logic)
  types.ts                 -- TypeScript types (no Zod here)
  schema.ts                -- Zod schemas + parse helpers
  useXxxModule.ts          -- single hook, all Supabase calls
  XxxModuleView.tsx        -- list page (KPI + table + create modal)
  XxxDetailPage.tsx        -- full-page detail (tabs)
  XxxDetailPanel.tsx       -- slide-over panel version (same tabs)
  XxxCreateForm.tsx        -- create form body component

src/pages/
  XxxAdminPage.tsx         -- admin settings (templates / locations / workflow / stats)
```

---

## 5. TypeScript Types (`types.ts`)

```typescript
// Always define status and severity as literal union types
export type XxxStatus   = 'draft' | 'active' | 'closed'
export type XxxSeverity = 'low' | 'medium' | 'high' | 'critical'

export type XxxTemplateRow = {
  id: string
  organization_id: string
  name: string
  definition: unknown          // parsed by schema.ts
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type XxxRecordRow = {
  id: string
  organization_id: string
  template_id: string
  title: string
  status: XxxStatus
  assigned_to: string | null
  scheduled_for: string | null
  cron_expression: string | null
  summary: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type XxxFindingRow = {
  id: string
  organization_id: string
  record_id: string
  description: string
  severity: XxxSeverity
  risk_probability: number | null
  risk_consequence: number | null
  risk_score: number | null        // generated column, read-only
  deviation_id: string | null
  deleted_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Assignable user (fetched from profiles/users)
export type XxxAssignableUser = {
  id: string
  displayName: string
}
```

---

## 6. Hook API (`useXxxModule.ts`)

```typescript
// Shape returned by the hook
type UseXxxModuleReturn = {
  // ── State ──────────────────────────────────────────────────────────────────
  loading: boolean
  error: string | null
  templates: XxxTemplateRow[]
  records: XxxRecordRow[]
  assignableUsers: XxxAssignableUser[]
  findingsByRecordId: Record<string, XxxFindingRow[]>

  // ── Actions ────────────────────────────────────────────────────────────────
  load: () => Promise<void>
  loadDetail: (recordId: string) => Promise<void>
  createRecord: (p: { templateId: string; title: string; assignedTo?: string; scheduledFor?: string; cronExpression?: string }) => Promise<void>
  updateRecord: (p: { recordId: string; title?: string; status?: XxxStatus; summary?: string }) => Promise<void>
  addFinding: (p: { recordId: string; description: string; severity: XxxSeverity; riskProbability?: number; riskConsequence?: number }) => Promise<void>
  deleteFinding: (findingId: string) => Promise<void>
  createTemplate: (p: { name: string }) => Promise<void>
  updateTemplate: (p: { templateId: string; name: string; definition: unknown }) => Promise<void>
}
```

**Hook rules:**
- Always clear `error` at the start of each action.
- Validate every fetched row with Zod `safeParse`. Filter out failed rows.
- Use `let cancelled = false` + cleanup in `useEffect` for async loads.
- Never expose raw Supabase client to components.

---

## 7. Admin Page (`XxxAdminPage.tsx`)

Every module has a settings page at `/xxx/admin`. It always has these **5 tabs** in this order:

| Tab key | Label | Content |
|---|---|---|
| `templates` | Maler | CRUD for templates + definition editor |
| `locations` | Lokasjoner | CRUD for locations (reuse `LocationsCrudTab`) |
| `signoff` | Signering | Dual sign-off configuration dashboard |
| `workflow` | Arbeidsflyt | Workflow rules (reuse `WorkflowRulesTab`) |
| `stats` | Statistikk | KPI stats panel (reuse `HseStatsPanel`) |

```tsx
// XxxAdminPage.tsx skeleton
import { ModuleAdminShell } from '../components/layout/ModuleAdminShell'

const TABS = [
  { key: 'templates', label: 'Maler' },
  { key: 'locations', label: 'Lokasjoner' },
  { key: 'signoff',   label: 'Signering' },
  { key: 'workflow',  label: 'Arbeidsflyt' },
  { key: 'stats',     label: 'Statistikk' },
]

export function XxxAdminPage({ supabase }: { supabase: SupabaseClient | null }) {
  const [tab, setTab] = useState('templates')
  const xxx = useXxxModule({ supabase })

  return (
    <ModuleAdminShell
      title="Xxx — Innstillinger"
      description="Konfigurer maler, lokasjoner og arbeidsflyt."
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      {tab === 'templates' && <TemplatesTab xxx={xxx} />}
      {tab === 'locations' && <LocationsCrudTab supabase={supabase} />}
      {tab === 'signoff'   && <SignoffTab records={xxx.records} />}
      {tab === 'workflow'  && <WorkflowRulesTab supabase={supabase} sourceModule="xxx" />}
      {tab === 'stats'     && <HseStatsPanel records={xxx.records} findings={xxx.findingsByRecordId} />}
    </ModuleAdminShell>
  )
}
```

### Templates tab — mandatory fields for each template item

| Field | Type | UI control |
|---|---|---|
| `key` | string | auto-generated slug |
| `label` | string | text input |
| `required` | boolean | checkbox |
| `fieldType` | `yes_no_na \| text \| number \| photo \| photo_required \| signature` | select |
| `hmsCategory` | `fysisk \| ergonomi \| kjemikalier \| psykososialt \| brann \| maskiner \| annet` | select |
| `helpText` | string | text input |
| `lawRef` | string | text input (e.g. "AML § 4-4") |

---

## 8. Routing

Add these three routes to `src/App.tsx`:

```tsx
<Route path="xxx"        element={<XxxModulePage />} />
<Route path="xxx/admin"  element={<XxxAdminPage />} />
<Route path="xxx/:id"    element={<XxxDetailPage />} />
```

URL convention:
- `/xxx` — list view
- `/xxx/admin` — settings
- `/xxx/:id` — record detail
- `/avvik?sourceId=:id` — deviations filtered by this record (linked from list view)

---

## 9. Workflow Engine

### How rules are stored
```typescript
type WorkflowRule = {
  id: string
  organization_id: string
  source_module: string          // 'xxx'
  slug: string                   // 'xxx_critical_finding'
  name: string                   // display label
  trigger_on: 'insert' | 'update' | 'both'
  condition_json: {
    match: 'field_equals' | 'field_gte' | 'field_lte' | 'always'
    path: string                 // JSONB path, e.g. 'severity'
    value?: string | number
  }
  actions_json: WorkflowAction[]
  is_active: boolean
}

type WorkflowAction =
  | { type: 'create_deviation'; dueInDays?: number; assignFromRecord?: boolean }
  | { type: 'create_task';      title?: string; priority?: 'low'|'normal'|'high'; dueInDays?: number; assignFromRecord?: boolean }
  | { type: 'send_email';       templateKey: string }
  | { type: 'send_notification'; message: string }
  | { type: 'call_webhook';     url: string }
  | { type: 'log_only' }
```

### Trigger events exposed in admin UI
```
record_created      record_activated     record_closed
finding_critical    finding_high         finding_medium     finding_low
```

### DB trigger pattern (on findings INSERT)
```sql
CREATE OR REPLACE FUNCTION process_xxx_finding_workflow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM workflow_rules
    WHERE organization_id = NEW.organization_id
      AND source_module = 'xxx'
      AND trigger_on IN ('insert','both')
      AND is_active = true
  LOOP
    IF workflow_payload_matches_condition(r.condition_json, to_jsonb(NEW), null, 'insert') THEN
      PERFORM execute_xxx_finding_rule_actions(NEW.organization_id, r.id, r.actions_json, NEW);
      INSERT INTO workflow_runs (organization_id, rule_id, source_module, event, status)
        VALUES (NEW.organization_id, r.id, 'xxx', 'finding_insert', 'completed');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER xxx_findings_workflow_tg
  AFTER INSERT ON xxx_findings
  FOR EACH ROW EXECUTE FUNCTION process_xxx_finding_workflow();
```

---

## 10. Color Tokens

These are the ONLY colors used across all modules. Never invent new hex values.

```
Brand green (primary action, selected states, active borders)
  #1a3d32   — GRN — buttons, toggle ON, focus rings, active borders

Brand green dark (hover on GRN elements)
  #142e26   — GRN_DEEP — hover:background on primary buttons

Page background (canvas)
  #f9f7f2   — CANVAS — outermost page bg

Panel background (slide-over, cards)
  #f7f6f2   — PANEL — WorkplaceStandardFormPanel bg

Footer band (inside slide-over and card footers)
  #f0efe9   — FOOTER_BAND — border-t area bg

Inset form section (beige box inside form panel)
  #f4f1ea   — FORM_INSET — WPSTD_FORM_INSET bg

Table header background
  #EFE8DC   — TABLE_HEADER — <th> bg in DataTable

Stat row background
  #f2eee6   — STAT_CREAM — LayoutScoreStatRow card bg
```

Semantic status colors (badges, pills):
```
draft    → bg-neutral-100  text-neutral-700
active   → bg-blue-100     text-blue-800
signed   → bg-green-100    text-green-800
low      → bg-blue-100     text-blue-700
medium   → bg-yellow-100   text-yellow-700
high     → bg-orange-100   text-orange-800
critical → bg-red-100      text-red-700
```

---

## 11. Typography

```
Heading font (H1, H2, card titles):
  font-family: 'Libre Baskerville', Georgia, serif
  Used via: style={{ fontFamily: WORKPLACE_PAGE_SERIF }}

Body font (everything else):
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif
  Applied globally via Tailwind's font-sans

Page H1:       text-3xl font-semibold tracking-tight text-neutral-900  (serif)
Section H2:    text-2xl font-semibold tracking-tight text-neutral-900  (serif)
Card H3:       text-base font-semibold text-neutral-900                (sans)
Field label:   text-[10px] font-bold uppercase tracking-wider text-neutral-800
Body text:     text-sm leading-relaxed text-neutral-600
Table header:  text-[10px] font-bold uppercase tracking-wide text-neutral-500  (or text-neutral-600)
Table cell:    text-sm text-neutral-800
Badge/pill:    text-xs font-semibold
Button (CTA):  text-sm font-bold uppercase tracking-wide
Button (sec):  text-sm font-medium text-neutral-700
```

---

## 12. UI Component Library (Pinpoint Form Style)

All form components live in `modules/xxx/XxxCreateForm.tsx`.
Import the shared constants from `WorkplaceStandardFormPanel`:

```typescript
import {
  WPSTD_FORM_FIELD_LABEL,  // 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
  WPSTD_FORM_LEAD,          // 'text-sm leading-relaxed text-neutral-600'
  WPSTD_FORM_ROW_GRID,      // two-column grid: 40% question / 60% input, border-b between rows
} from '../../src/components/layout/WorkplaceStandardFormPanel'
```

### 12a. Text input
```tsx
const FIELD_INPUT =
  'w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 outline-none transition-colors ' +
  'focus:border-[#1a3d32] focus:ring-1 focus:ring-[#1a3d32]/25'

<p className={WPSTD_FORM_FIELD_LABEL}>Feltnavn</p>
<input className={FIELD_INPUT} style={{ marginTop: '6px' }} placeholder="…" />
```

Rules:
- **NO** `rounded-lg` or any border-radius. All inputs are **square corners**.
- Background is always `bg-white` (never `bg-neutral-50` in this style).
- Focus ring color is always `#1a3d32` (brand green), not black.

### 12b. Textarea
```tsx
<p className={WPSTD_FORM_FIELD_LABEL}>Tekst</p>
<textarea
  rows={4}
  className={FIELD_INPUT + ' resize-none'}
  style={{ marginTop: '6px' }}
/>
```

### 12c. SearchableSelect (dropdown with filter)
Matches screenshot: white trigger, green border+ring when open, chevron rotates 180°, "Filter..." search inside popup.

```tsx
// Trigger (closed):
//   border-neutral-300 bg-white — ChevronDown gray
// Trigger (open):
//   border-[#1a3d32] ring-1 ring-[#1a3d32]/25 — ChevronDown rotated 180° + teal

// Popup:
//   border-neutral-300 bg-white shadow-md
//   Filter input: border-neutral-200 bg-white, placeholder "Filter..."
//   Items: px-3 py-2.5 text-sm, hover:bg-neutral-50
//   Selected item: bg-neutral-100 font-medium text-neutral-900

// Import and use from InspeksjonsrunderCreateForm.tsx — already implemented.
// Copy SearchableSelect function directly into new module's form file.
```

### 12d. YesNoToggle
Matches screenshot: side-by-side equal-width buttons, square corners, green fill + CheckCircle2 when selected, Circle icon when not.

```tsx
// Selected state:  backgroundColor: '#1a3d32', color: 'white'
// Idle state:      backgroundColor: 'white',   color: '#9ca3af'
// Icon selected:   <CheckCircle2 className="h-[18px] w-[18px]" />
// Icon idle:       <Circle       className="h-[18px] w-[18px]" />
// Button padding:  px-4 py-3
// Font:            text-sm font-medium
// Gap icon↔text:  gap-2.5

// Wrapper: mt-1.5 flex w-full overflow-hidden border border-neutral-300
// Divider between Ja/Nei: border-l border-neutral-300
```

### 12e. NumberSpinner (headcount-style)
Matches screenshot: white input + stacked ▲/▼ chevron buttons on the right, divided by a vertical border.

```tsx
// Input:   bg-transparent px-3 py-2.5 text-sm, no native spinners (appearance:textfield)
// Wrapper: flex border border-neutral-300 bg-white mt-1.5
// Arrows:  ChevronUp / ChevronDown h-3 w-3, px-2.5, hover:bg-[#1a3d32] hover:text-white
```

### 12f. ToggleSwitch (iOS-style ON/OFF)
Matches screenshot 3: green pill when ON, gray when OFF, white sliding knob.

```tsx
// Pill:  h-6 w-11, bg-[#1a3d32] (ON) or bg-neutral-300 (OFF)
// Knob:  h-4 w-4 bg-white shadow, translate-x-6 (ON) or translate-x-1 (OFF)
// No border-radius on the pill itself — square.

// Pair with an "ON"/"OFF" text label:
<div className="flex items-center gap-2">
  <ToggleSwitch checked={val} onChange={setVal} />
  <span className={`text-xs font-bold tracking-wider ${val ? 'text-[#1a3d32]' : 'text-neutral-400'}`}>
    {val ? 'ON' : 'OFF'}
  </span>
</div>
```

### 12g. InfoBox and WarningBox

```tsx
// InfoBox — neutral information (use Info icon from lucide)
<div className="flex items-start gap-2.5 border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
  <span>…</span>
</div>

// WarningBox — actionable warning (use AlertCircle icon from lucide)
<div className="flex items-start gap-2.5 border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
  <span>…</span>
</div>

// NEVER use rounded corners on these boxes.
// Text size is always text-sm (14px), never text-xs.
```

### 12h. Form row layout (WPSTD_FORM_ROW_GRID)

```tsx
// Each question is its own row. Left = question text, Right = label + control.
// Rows are separated by a border-b border-neutral-200 line.
// The form wrapper uses negative margins to cancel the panel's own padding:

<div className="-mx-6 -mt-8 sm:-mx-8">

  <div className={WPSTD_FORM_ROW_GRID}>
    <p className={WPSTD_FORM_LEAD}>Question text here</p>
    <div>
      <p className={WPSTD_FORM_FIELD_LABEL}>Field Label</p>
      <input className={FIELD_INPUT} style={{ marginTop: '6px' }} />
    </div>
  </div>

  <div className={WPSTD_FORM_ROW_GRID}>
    <p className={WPSTD_FORM_LEAD}>Another question</p>
    <div>
      <p className={WPSTD_FORM_FIELD_LABEL}>Another Label <span className="ml-1.5 font-normal normal-case tracking-normal text-neutral-400">Valgfri</span></p>
      <SearchableSelect … />
    </div>
  </div>

  {/* Info box at the very bottom */}
  <div className="border-t border-neutral-200 px-4 py-4 md:px-5">
    <InfoBox>…</InfoBox>
  </div>

</div>
```

Grid breakdown: `md:grid-cols-[minmax(0,40%)_minmax(0,60%)]` — 40% question / 60% input on desktop, stacked on mobile.

---

## 13. Page Structure (XxxModuleView.tsx)

Every list page follows this exact order:

```tsx
<div className="space-y-6">

  {/* 1. Header */}
  <WorkplacePageHeading1
    breadcrumb={[{ label: 'HMS' }, { label: 'Xxx Modulnavn' }]}
    title="Xxx Modulnavn"
    description="Short Norwegian description."
    headerActions={
      <div className="flex flex-wrap gap-2">
        {/* Secondary button — square corners, outlined */}
        <button className="border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
          Sekundær
        </button>
        {/* Primary CTA — square corners, brand green, uppercase */}
        <button
          className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition-colors"
          style={{ backgroundColor: '#1a3d32' }}
        >
          Ny post
        </button>
        {/* Icon-only settings link — square corners, outlined */}
        <Link
          to="/xxx/admin"
          className="inline-flex items-center border border-neutral-300 bg-white px-3 py-2 text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    }
  />

  {/* 2. KPI strip — always exactly 3 stats */}
  <LayoutScoreStatRow
    items={[
      { big: String(stats.active),   title: 'Aktive',   sub: 'Under behandling' },
      { big: String(stats.critical), title: 'Kritiske', sub: 'Krever oppfølging' },
      { big: String(stats.closed),   title: 'Lukket',   sub: 'Arkivert' },
    ]}
  />

  {/* 3. Table card */}
  <LayoutTable1PostingsShell
    wrap
    title="Poster"
    description="Alle poster — sortert etter siste aktivitet."
    toolbar={
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          placeholder="Søk …"
          className="w-full border border-neutral-200 bg-white py-2 pl-10 pr-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-[#1a3d32]/25"
        />
      </div>
    }
    footer={<span className="text-neutral-500">{rows.length} poster</span>}
  >
    {/* Table — see section 14 */}
  </LayoutTable1PostingsShell>

  {/* 4. Create modal */}
  <FormModal open={createOpen} onClose={() => setCreateOpen(false)} … >
    <XxxCreateForm … />
  </FormModal>

</div>
```

---

## 14. Table Structure

```tsx
<table className="w-full min-w-[640px] border-collapse text-left text-sm">
  <thead>
    <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
      {/* LAYOUT_TABLE1_POSTINGS_HEADER_ROW = 'border-b border-neutral-200 text-[10px] font-bold uppercase tracking-wide text-neutral-500' */}
      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Ansvarlig</th>
      <th className={LAYOUT_TABLE1_POSTINGS_TH}>Dato</th>
      <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
    </tr>
  </thead>
  <tbody>
    {rows.map((row) => (
      <tr
        key={row.id}
        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
        onClick={() => navigate(`/xxx/${row.id}`)}
      >
        {/* LAYOUT_TABLE1_POSTINGS_BODY_ROW = 'border-b border-neutral-100 hover:bg-neutral-50/80' */}
        <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
        <td className="px-5 py-3">
          <StatusPill status={row.status} />
        </td>
        <td className="px-5 py-3 text-neutral-600">{userNameById.get(row.assigned_to ?? '') ?? '—'}</td>
        <td className="px-5 py-3 text-neutral-600">{formatDate(row.scheduled_for)}</td>
        <td className="w-8 px-3 py-3 text-neutral-300">
          <ChevronRight className="h-4 w-4" />
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Status pill pattern:**
```tsx
function StatusPill({ status }: { status: XxxStatus }) {
  const map: Record<XxxStatus, string> = {
    draft:  'bg-neutral-100 text-neutral-700',
    active: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
  }
  const label: Record<XxxStatus, string> = { draft: 'Kladd', active: 'Aktiv', closed: 'Lukket' }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[status]}`}>
      {label[status]}
    </span>
  )
}
```

---

## 15. Slide-over Panel (FormModal / WorkplaceStandardFormPanel)

```tsx
// Import alias — always use this, never import WorkplaceStandardFormPanel directly in modules
import { FormModal } from '../../src/template'

<FormModal
  open={open}
  onClose={onClose}
  titleId="form-create-xxx"
  title="Ny post"           // serif, 2xl–3xl
  footer={
    <div className="flex justify-end gap-3">
      {/* Cancel — square, outlined */}
      <button
        type="button"
        className="border border-neutral-300 bg-white px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        onClick={onClose}
      >
        Avbryt
      </button>
      {/* Submit — square, brand green, uppercase */}
      <button
        type="button"
        className="px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: '#1a3d32' }}
        onClick={handleSubmit}
      >
        Opprett
      </button>
    </div>
  }
>
  <XxxCreateForm … />
</FormModal>
```

Panel specs:
- Width: `max-w-[min(100vw,920px)]`
- Background: `#f7f6f2`
- Header: `bg-[#f7f6f2]` + serif title
- Footer band: `bg-[#f0efe9]` + `border-t border-neutral-200/90`
- Scrollable body: `px-6 py-8 sm:px-8`
- Z-index: `WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX` (= 100)

---

## 16. Detail Page Tab Structure (XxxDetailPage.tsx)

```tsx
const TABS = ['checklist', 'findings', 'summary', 'signatures', 'history'] as const

// Tab bar: use HubMenu1Bar
<HubMenu1Bar
  ariaLabel="Navigasjon for detaljer"
  items={TABS.map((t) => ({
    key: t,
    label: TAB_LABELS[t],
    icon: TAB_ICONS[t],
    active: tab === t,
    badgeCount: t === 'findings' ? findingCount : undefined,
    onClick: () => setTab(t),
  }))}
/>

// Tab content pattern
{tab === 'checklist'  && <ChecklistTab  record={record} onSave={…} readOnly={record.status === 'signed'} />}
{tab === 'findings'   && <FindingsTab   record={record} findings={findings} onAdd={…} onDelete={…} />}
{tab === 'summary'    && <SummaryTab    record={record} onSave={…} readOnly={…} />}
{tab === 'signatures' && <SignaturesTab record={record} onSign={…} />}
{tab === 'history'    && <HseAuditLogViewer recordId={record.id} supabase={supabase} />}
```

---

## 17. Severity / Risk Colour Mapping

```typescript
// Use these exact classes — never deviate
const SEVERITY_BG: Record<XxxSeverity, string> = {
  low:      'bg-blue-100   text-blue-700',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-800',
  critical: 'bg-red-100    text-red-700',
}

// Risk score interpretation (probability × consequence, 1–25)
// 1–4:   low      (blue)
// 5–9:   medium   (yellow)
// 10–16: high     (orange)
// 17–25: critical (red)
```

---

## 18. New Module Checklist

Copy this checklist when building a new module. Check off each item in order.

### Database
- [ ] Write migration: tables, indexes, enums, RLS, triggers
- [ ] Write migration: workflow_rules seed for critical + high
- [ ] Write migration: modules table registration
- [ ] Write migration: default templates seed

### TypeScript
- [ ] `types.ts` — all row types, status/severity unions, AssignableUser
- [ ] `schema.ts` — Zod schemas for every row type, parse helper functions
- [ ] `useXxxModule.ts` — hook with load, loadDetail, createRecord, addFinding, createTemplate

### Pages
- [ ] `XxxModuleView.tsx` — heading + KPI strip + table + create modal
- [ ] `XxxDetailPage.tsx` — tabbed detail view (5 tabs)
- [ ] `XxxAdminPage.tsx` — 5-tab admin (templates, locations, signoff, workflow, stats)
- [ ] `XxxCreateForm.tsx` — WPSTD_FORM_ROW_GRID layout with SearchableSelect, YesNoToggle, InfoBox

### Routing
- [ ] Add 3 routes to `App.tsx`
- [ ] Register in sidebar nav with required permission keys

### Style verification
- [ ] Buttons: NO `rounded-lg`, all square corners
- [ ] Inputs: `bg-white`, focus ring `#1a3d32`/25
- [ ] Dropdown: green border when open, chevron rotates
- [ ] Table headers: `text-[10px] font-bold uppercase tracking-wide`
- [ ] Status pills: `rounded-full` with correct colour map
- [ ] Warning boxes: `text-sm` (not `text-xs`), amber colours, square corners
- [ ] Primary font: Inter (body), Libre Baskerville (headings)
- [ ] Primary green: `#1a3d32` only — no `#2D403A` or other shades

---

## 19. Reusable Components — Import Paths

```typescript
// Layout shells
import { WorkplacePageHeading1 }      from '../../src/components/layout/WorkplacePageHeading1'
import { LayoutScoreStatRow }          from '../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell }   from '../../src/components/layout/LayoutTable1PostingsShell'
import { FormModal }                   from '../../src/template'
import { HubMenu1Bar }                 from '../../src/components/layout/HubMenu1Bar'

// Form panel constants
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'

// Table kit constants
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../src/components/layout/layoutTable1PostingsKit'

// Reusable form primitives (copy from InspeksjonsrunderCreateForm.tsx)
// SearchableSelect, YesNoToggle, NumberSpinner, ToggleSwitch, InfoBox, WarningBox

// Shared HSE components
import { RecurrencePicker }    from '../../src/components/hse/RecurrencePicker'
import { RiskMatrix }          from '../../src/components/hse/RiskMatrix'
import { DeviationPanel }      from '../../src/components/hse/DeviationPanel'
import { HseAuditLogViewer }   from '../../src/components/hse/HseAuditLogViewer'

// Admin tabs (reuse across all modules)
import { WorkflowRulesTab }    from '../../src/components/workflow/WorkflowRulesTab'
import { LocationsCrudTab }    from '../../src/components/hse/LocationsCrudTab'
import { HseStatsPanel }       from '../../src/components/hse/HseStatsPanel'
```

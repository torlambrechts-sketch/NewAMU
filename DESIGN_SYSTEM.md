# NewAMU Design System & Module Rules
> Paste this file (or relevant sections) into Cursor/Vibe as project context.
> Every new module and UI component must follow these rules without exception.

---

## 1. Brand Colors

| Token | Hex | Tailwind class | Usage |
|---|---|---|---|
| Forest (primary) | `#1a3d32` | `bg-[#1a3d32]` / `text-[#1a3d32]` | Primary buttons, focus rings, active accents, headings |
| Forest hover | `#14312a` | `bg-[#14312a]` | Primary button hover state only |
| Forest tint | `#f4f1ea` | `bg-[#f4f1ea]` | Regulatory info boxes, selected row backgrounds |
| Canvas | `#F9F7F2` | `bg-[#F9F7F2]` | Full-page background behind cards |
| White | `#ffffff` | `bg-white` | Card surfaces, input backgrounds |

**NEVER** use inline `style={{ backgroundColor: '#1a3d32' }}` — always use the Tailwind class `bg-[#1a3d32]`.

---

## 2. Typography Scale

| Role | Class | Weight | Usage |
|---|---|---|---|
| Page title | `text-2xl` or `text-xl` | `font-bold` | WorkplacePageHeading1 only |
| Card/section heading | `text-base` | `font-semibold` | Tab headers inside cards |
| Body / table cells | `text-sm` | `font-normal` or `font-medium` | All default content |
| Item label (checklist, form) | `text-base` | `font-semibold` | Checklist items, form section titles |
| Secondary / helper text | `text-sm` | `font-normal` | Descriptions, helpText, placeholders |
| Field label (uppercase) | `text-[10px] font-bold uppercase tracking-wider text-neutral-600` | — | Form field labels above inputs |
| Badge / pill | `text-[11px] font-semibold` | — | Status pills, count badges |
| Legal reference | `text-xs font-semibold text-[#1a3d32]` | — | IK-forskriften § references |

**Rule:** Never use `text-[10px]` or `text-[11px]` for body text. Only for field labels and badges respectively.

---

## 3. Component Tokens

Copy these constants into every new module file that uses forms or inputs:

```tsx
// ── Design tokens — copy into every module file ───────────────────────────────

const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-600'

const INPUT =
  'mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm ' +
  'text-neutral-900 placeholder:text-neutral-400 ' +
  'focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]/30'

const TEXTAREA = INPUT + ' resize-none'

const BTN_PRIMARY =
  'rounded-lg bg-[#1a3d32] px-4 py-2 text-sm font-semibold text-white ' +
  'hover:bg-[#14312a] transition-colors disabled:opacity-40'

const BTN_SECONDARY =
  'rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium ' +
  'text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-40'

const BTN_GHOST =
  'rounded-lg px-3 py-1.5 text-xs font-semibold text-[#1a3d32] ' +
  'hover:bg-[#1a3d32]/10 transition-colors'

const BTN_DANGER =
  'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white ' +
  'hover:bg-red-700 transition-colors disabled:opacity-40'

const CARD = 'overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm'
const CARD_SHADOW = { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }

const BADGE_BASE = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold'
```

---

## 4. Status Badge Colors

Always use these for status fields. Never invent new color combinations.

```tsx
// Status → badge class
const STATUS_COLORS = {
  // Generic workflow states
  draft:     'border border-neutral-200  bg-neutral-100 text-neutral-700',
  active:    'border border-blue-200    bg-blue-100    text-blue-800',
  signed:    'border border-green-200   bg-green-100   text-green-800',
  approved:  'border border-emerald-200 bg-emerald-100 text-emerald-800',
  closed:    'border border-neutral-200 bg-neutral-100 text-neutral-500',
  stopped:   'border border-red-200     bg-red-100     text-red-800',

  // Severity / risk
  critical:  'bg-red-100    text-red-700',
  high:      'bg-orange-100 text-orange-800',
  medium:    'bg-yellow-100 text-yellow-700',
  low:       'bg-blue-100   text-blue-700',

  // SJA-specific
  awaiting_participants: 'border border-amber-200 bg-amber-50 text-amber-800',
}
```

---

## 5. Severity Left-Border Pattern

Use this on any list row that has a severity / priority / risk level. Apply as `border-l-4` on the row.

```tsx
const SEVERITY_BORDER = {
  critical: 'border-l-red-500   bg-red-50/30',
  high:     'border-l-orange-400 bg-orange-50/20',
  medium:   'border-l-yellow-400',
  low:      'border-l-blue-300',
}

// Usage on a list row:
<div className={`border-b border-l-4 border-neutral-100 px-5 py-4 last:border-b-0 ${SEVERITY_BORDER[item.severity]}`}>
```

---

## 6. Regulatory / Legal Info Box

Use this pattern for IK-forskriften, AML, or law references inside a module. Never use `rounded-none`.

```tsx
<div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] p-4">
  <p className="text-xs font-semibold text-[#1a3d32]">IK-forskriften § 5 — [rule name]</p>
  <p className="mt-1 text-xs text-neutral-500">[Explanation of what the law requires here.]</p>
</div>
```

---

## 7. Page Layout Structure

Every module full page follows this exact structure:

```tsx
// ── Full-page module layout ───────────────────────────────────────────────────

<div className="min-h-screen bg-[#F9F7F2]">

  {/* Sticky header: breadcrumb + title + tabs */}
  <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-[#F9F7F2]/95 backdrop-blur-sm">
    <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-4 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'HMS' }, { label: 'Module Name', to: '/module-path' }, { label: itemTitle }]}
        title={itemTitle}
        description={<p className="max-w-4xl text-xs leading-relaxed text-neutral-600">{subtitle}</p>}
        headerActions={<div className="flex flex-wrap items-center gap-2">{/* action buttons */}</div>}
        menu={<HubMenu1Bar ariaLabel="..." items={hubMenuItems} />}
      />
    </div>
  </header>

  {/* Content area */}
  <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8">
    <div className={`${CARD} overflow-hidden`} style={CARD_SHADOW}>
      {/* Tab content — NO extra header inside the card */}
      {/* Content goes directly here */}
    </div>
  </div>

</div>
```

**Rules:**
- `max-w-[1400px]` on all content wrappers
- `px-4 md:px-8` horizontal padding
- `py-6` vertical padding on content
- Header is always sticky with `backdrop-blur-sm`
- Each tab's content card must NOT repeat the tab title inside the card

---

## 8. List Page Layout Structure

For module overview/list pages (not detail pages):

```tsx
<div className="space-y-6">

  {/* 1. Page heading */}
  <WorkplacePageHeading1
    breadcrumb={[{ label: 'HMS' }, { label: 'Module Name' }]}
    title="Module Name"
    description="One sentence describing what this module does."
    headerActions={
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN_SECONDARY}>Secondary action</button>
        <button type="button" className={BTN_PRIMARY}>Primary action</button>
      </div>
    }
  />

  {/* 2. KPI row — max 4 items */}
  <LayoutScoreStatRow items={[
    { big: '12', title: 'Active rounds', sub: 'In progress' },
    { big: '3',  title: 'Critical findings', sub: 'Need follow-up' },
    { big: '28', title: 'Completed', sub: 'Signed and archived' },
  ]} />

  {/* 3. Data table */}
  <LayoutTable1PostingsShell
    wrap
    title="Items"
    description="All items sorted by last activity."
    toolbar={<SearchInput ... />}
    footer={<span>{count} items</span>}
  >
    <table>...</table>
  </LayoutTable1PostingsShell>

</div>
```

---

## 9. Tab Menu Items (HubMenu1Bar)

```tsx
const hubMenuItems: HubMenu1Item[] = [
  {
    key: 'overview',
    label: 'Oversikt',
    icon: LayoutDashboard,
    active: activeTab === 'overview',
    onClick: () => setActiveTab('overview'),
  },
  {
    key: 'findings',
    label: 'Avvik',
    icon: AlertTriangle,
    active: activeTab === 'findings',
    badgeCount: findings.length > 0 ? findings.length : undefined,  // only show when > 0
    onClick: () => setActiveTab('findings'),
  },
]
```

**Rules:**
- `badgeCount` only for things that need user attention (avvik count, errors)
- Tab labels are Norwegian
- Icon + label on every tab

---

## 10. Checklist / Form Items (Horizontal Split)

For any form where each row has a label and an input/answer, use the horizontal split:

```tsx
// Desktop: label left (flex-1), control right (w-64)
// Mobile: stacked

<div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-6">
  {/* Left: label + help */}
  <div className="min-w-0 flex-1">
    <span className="text-base font-semibold text-neutral-900">{label}</span>
    {helpText && <p className="mt-1 text-sm text-neutral-500">{helpText}</p>}
  </div>

  {/* Right: answer / control */}
  <div className="shrink-0 md:w-64">
    {/* input / buttons / select */}
  </div>
</div>
```

---

## 11. Yes / No / N/A Answer Buttons

```tsx
{(['yes', 'no', 'na'] as const).map((v) => {
  const labels = { yes: 'Ja', no: 'Nei', na: 'N/A' }
  const activeClass = {
    yes: 'bg-green-600 text-white border-green-600 shadow-sm',
    no:  'bg-red-600   text-white border-red-600   shadow-sm',
    na:  'bg-neutral-600 text-white border-neutral-600 shadow-sm',
  }[v]

  return (
    <button
      key={v}
      type="button"
      className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-all ${
        selected === v
          ? activeClass
          : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-400 hover:bg-white'
      }`}
    >
      {labels[v]}
    </button>
  )
})}
```

---

## 12. Signature Cards

For double-signing flows (IK-forskriften dobbel signering):

```tsx
<div className={`rounded-xl border-2 p-5 transition-all ${
  isSigned
    ? 'border-green-300 bg-green-50'
    : canSign
      ? 'border-[#1a3d32]/40 bg-white shadow-sm'
      : 'border-neutral-200 bg-white'
}`}>
  <div className="flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      {isSigned
        ? <CheckCircle2 className="h-7 w-7 shrink-0 text-green-500" />
        : <Circle      className="h-7 w-7 shrink-0 text-neutral-300" />
      }
      <div>
        <p className="text-base font-semibold text-neutral-900">{roleName}</p>
        <p className="text-xs text-neutral-500">{lawReference}</p>
        <p className="mt-0.5 text-xs font-medium text-green-700">✓ Signert …</p>
      </div>
    </div>
    {!isSigned && (
      <button type="button" disabled={!canSign} className={BTN_PRIMARY}>
        Signer som {roleName}
      </button>
    )}
  </div>
</div>
```

---

## 13. Progress Bar

```tsx
<div>
  <div className="flex items-center justify-between mb-2">
    <span className="text-sm text-neutral-500">{answered} / {total} besvart</span>
    <span className={`text-lg font-bold tabular-nums ${pct === 100 ? 'text-green-600' : 'text-[#1a3d32]'}`}>
      {pct}%
    </span>
  </div>
  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
    <div
      className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-[#1a3d32]'}`}
      style={{ width: `${pct}%` }}
    />
  </div>
</div>
```

---

## 14. Law Color System (IK Module)

| Law | Color | Tailwind |
|---|---|---|
| AML (Arbeidsmiljøloven) | `#1a3d32` | `bg-[#1a3d32]` |
| BVL (Brann- og eksplosjonsvernloven) | `#c2410c` | `bg-[#c2410c]` |
| ETL (El-tilsynsloven) | `#d97706` | `bg-[#d97706]` |
| FL (Forurensningsloven) | `#0891b2` | `bg-[#0891b2]` |
| PKL (Produktkontrolloven) | `#6d28d9` | `bg-[#6d28d9]` |

Usage: small pill badges on law register rows, IK pillar cards.

---

## 15. Module File Structure

Every feature module lives in `modules/[module-name]/` and has this structure:

```
modules/[module-name]/
  index.ts                  ← named exports only
  types.ts                  ← all TypeScript types and constants
  schema.ts                 ← Zod validation schemas
  use[ModuleName].ts        ← single data hook (Supabase queries, state)
  [ModuleName]View.tsx      ← list / overview page component
  [ModuleName]DetailPage.tsx ← full-page detail view (optional)
  [SubFeature]Tab.tsx       ← individual tab components (optional)
```

Page wrappers live in `src/pages/[ModuleName]Page.tsx` and are thin:

```tsx
export function InspectionModulePage() {
  const { supabase } = useOrgSetupContext()
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <InspectionModuleView supabase={supabase} />
    </div>
  )
}
```

---

## 16. RLS / Database Rules

Every new table must follow this pattern:

```sql
-- Enable RLS
alter table public.[table_name] enable row level security;

-- Org members can read
create policy "[table]_select" on public.[table_name]
  for select to authenticated
  using (organization_id = public.current_org_id());

-- Org admins can write
create policy "[table]_insert" on public.[table_name]
  for insert to authenticated
  with check (organization_id = public.current_org_id() and public.is_org_admin());

create policy "[table]_update" on public.[table_name]
  for update to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

create policy "[table]_delete" on public.[table_name]
  for delete to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin());

-- BEFORE INSERT trigger to auto-fill organization_id
create or replace function public.[table]_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_org_id();
  end if;
  return new;
end;
$$;

create trigger [table]_before_insert_tg
  before insert on public.[table_name]
  for each row execute function public.[table]_before_insert();
```

**Immutable records:** Signed/archived records must block UPDATE via RLS:

```sql
create policy "[table]_no_update_signed" on public.[table_name]
  for update to authenticated
  using (status not in ('signed', 'archived', 'approved'));
```

---

## 17. Hook Pattern

Every module hook follows this template:

```tsx
export function use[ModuleName]({ supabase }: { supabase: SupabaseClient | null }) {
  const { organization, can, isAdmin } = useOrgSetupContext()
  const orgId = organization?.id
  const canManage = isAdmin || can('[module].manage')  // ALWAYS include isAdmin

  const [items, setItems] = useState<[RowType][]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('[table]')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      if (e) throw e
      setItems((data ?? []) as [RowType][])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [supabase, orgId])

  useEffect(() => { void load() }, [load])

  return { items, loading, error, canManage, load }
}
```

**Critical rule:** `canManage = isAdmin || can('[module].manage')` — never just `can(...)` alone, or org admins will be locked out of their own module.

---

## 18. Error Handling Rules

- Always show `error` state near the relevant UI — never only in the browser console
- `hse.error` / `inspection.error` must render as a visible banner when non-null:

```tsx
{error && (
  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
    {error}
  </div>
)}
```

- Use `getSupabaseErrorMessage(err)` from `src/lib/supabaseError.ts` to format all errors

---

## 19. Norwegian Language Rules

All user-facing text is Norwegian (Bokmål). Specific terms:

| English | Norwegian |
|---|---|
| Required | Påkrevd |
| Yes / No / N/A | Ja / Nei / N/A |
| Draft | Kladd |
| Active | Aktiv |
| Signed | Signert |
| Finding / Deviation | Avvik |
| Checklist | Sjekkliste |
| Template | Mal |
| Location | Lokasjon |
| Responsible | Ansvarlig |
| Summary | Sammendrag |
| Signatures | Signaturer |
| History | Historikk |
| Save | Lagre |
| Cancel | Avbryt |
| Delete | Slett |
| Create | Opprett |
| Note | Merknad |
| Loading… | Laster… |
| Saving… | Lagrer… |

---

## 20. What NOT To Do

| ❌ Don't | ✅ Do instead |
|---|---|
| `style={{ backgroundColor: '#1a3d32' }}` | `className="bg-[#1a3d32]"` |
| `rounded-none` on inputs or cards | `rounded-lg` |
| Repeat tab title inside the card content | Use a thin info strip if context is needed |
| `can('module.manage')` alone | `isAdmin \|\| can('module.manage')` |
| Hard-delete compliance records | Soft-delete with `deleted_at` + justification |
| Pre-fill risk scores in templates | Risk must be assessed fresh in the field |
| English text in UI | Norwegian (Bokmål) |
| `text-[10px]` for body text | `text-sm` |
| Multiple parallel hooks per module | Single `use[Module]` hook per module |
| `console.log` for user-visible errors | Render `error` in UI banner |

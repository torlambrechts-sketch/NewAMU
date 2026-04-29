# UX Pass — 02: Visual Design Best Practices

**Role:** UI Designer  
**Focus:** Consistency, visual hierarchy, spacing, colour, typography, interaction states

---

## Colour inconsistencies

### Two different dark greens in use

| Value | Where used | Name |
|-------|-----------|------|
| `#1a3d32` | `PIN_GREEN` / `SHELL_PRIMARY` | Brand green |
| `#2D403A` | Hard-coded in dashboard, player, certifications | Slightly lighter, different hue |

These are visually similar but not the same. `#2D403A` is not a token — it appears as a magic string in at least 8 places. Should be replaced with `PIN_GREEN` everywhere.

**Example:**
```tsx
// Dashboard — wrong colour token
<h1 className="font-serif text-3xl font-semibold tracking-tight text-[#2D403A]">

// Should be
<h1 className="font-serif text-3xl font-semibold tracking-tight" style={{ color: PIN_GREEN }}>
```

### `text-neutral-400` used for text (WCAG fail)

`#9ca3af` on white = 2.6:1 contrast ratio. Fails WCAG AA for text at any size.

Found in:
- Chapter group labels in player sidebar (`text-neutral-400`)
- Module number prefix in sidebar (`text-xs text-neutral-400`)
- Flashcard card counter (`text-xs text-neutral-500` — this one is fine)

**Fix:** Replace `text-neutral-400` with `text-neutral-500` (minimum) on any text. Use `text-neutral-400` only on purely decorative icon fills.

---

## Card background inconsistency

The Klarert design system defines `--paper: #fbf9f3` as the card background. The AMU Mockup uses this token consistently. The learning module uses `bg-white` on most cards.

**Inventory of bg-white on cards:**

| File | Line pattern | Should be |
|------|-------------|-----------|
| `LearningDashboard.tsx` | KPI cards | `bg-[#fbf9f3]` |
| `LearningDashboard.tsx` | Completion ring card | `bg-[#fbf9f3]` |
| `LearningDashboard.tsx` | Leaderboard section | `bg-[#fbf9f3]` |
| `LearningDashboard.tsx` | Featured course rows | `bg-[#fbf9f3]` |
| `LearningCoursesList.tsx` | Create course form | `bg-[#fbf9f3]` |
| `LearningPlayer.tsx` | Sidebar progress card | `bg-[#fbf9f3]` |
| `LearningPlayer.tsx` | Sidebar content nav | `bg-[#fbf9f3]` |
| `LearningPlayer.tsx` | Module card | `bg-[#fbf9f3]` |
| `LearningCertifications.tsx` | KPI cards | `bg-[#fbf9f3]` |
| `LearningCertifications.tsx` | Table container | `bg-[#fbf9f3]` |
| `LearningInsights.tsx` | Insight cards | `bg-[#fbf9f3]` |
| `LearningExternalTraining.tsx` | Upload form card | `bg-[#fbf9f3]` |
| `LearningParticipants.tsx` | Table container | `bg-[#fbf9f3]` |

Keep `bg-white` on: input fields, table cells, dropdown menus, the course card header gradients.

---

## Border opacity variations

Four different border opacities found with no clear system:

| Class | Value | Usage |
|-------|-------|-------|
| `border-neutral-200` | 100% | Table rows, most cards |
| `border-neutral-200/80` | 80% | KPI cards, featured course rows |
| `border-neutral-200/90` | 90% | Create course form, courses grid cards |
| `border-neutral-100` | 100% | Table row dividers, inner items |

**Recommendation:** Standardise to two values only:
- `border-neutral-200` — card outer borders
- `border-neutral-100` — inner dividers within a card

---

## Button shape inconsistency

The module has two distinct button shapes with no clear rule for which to use:

| Shape | Class | Used for |
|-------|-------|---------|
| Rounded pill | `rounded-full` | Module complete buttons, nav buttons, search inputs |
| Rounded rectangle | `rounded-lg` | Form submit buttons, approval buttons, builder actions |

Both appear in the player within the same card. Example:
- Quiz option buttons: `rounded-lg` (rectangular)
- "Complete quiz" button: `rounded-full` (pill)

**Recommendation:** Define one rule — the Klarert design system uses `rounded-xl` for cards and `rounded-full` for action buttons (CTAs). Rectangular `rounded-lg` should only be used for form inputs.

---

## Typography scale — too many off-system sizes

Non-standard sizes found:
- `text-[10px]` — used for legend labels, chapter counter
- `text-[11px]` — used for progress text, locked course notice
- `text-[11.5px]` (only in html) — not in code

Tailwind's default text scale: `text-xs` = 12px, `text-sm` = 14px, `text-base` = 16px.

**Rule:** Do not use arbitrary `text-[Npx]` values below `text-xs`. Bump `text-[10px]` → `text-xs`. Bump `text-[11px]` → `text-xs`. These items need higher contrast, not smaller text.

---

## Spacing inconsistency in module card

The module card in the player uses:
- `p-6 md:p-8` on the outer card
- Content inside has `mt-6` before the module player

Sidebar cards use `p-3` and `p-4`. The difference in padding between the module content area and the sidebar creates a visual imbalance.

**Recommendation:** Use `p-5` on the module card (matching KPI card pattern) for consistency. Reserve `p-6/p-8` for content-heavy text modules.

---

## Shadow inconsistency

| Shadow class | Used on |
|-------------|---------|
| `shadow-sm` | Most cards |
| `shadow-lg` | Module card in player |
| `shadow-xl` | Flashcard flip button |

The `shadow-lg` on the player module card makes it feel significantly "heavier" than the surrounding interface. This is intentional to focus attention on content, but `shadow-md` would be sufficient and less dramatic.

`shadow-xl` on the flashcard button is good — it creates a tactile 3D quality appropriate for a card you flip.

---

## Progress bar visual variants

Three different progress bar sizes in use across the module:

| Height | Used in |
|--------|---------|
| `h-2` | Main ProgressBar component (player sidebar + module header) |
| `h-1.5` | ProgressBarMini in course cards list |
| `h-1` | Per-module mini bar inside sidebar list item |
| `h-1.5` | ProgressBarMini in participants table |

The `h-1` bar inside the sidebar list is nearly invisible at 4px. It conveys no information that the CheckCircle2 icon doesn't already convey.

**Recommendation:** Remove the `h-1` per-module bar in the sidebar (it's redundant). Standardise on `h-2` for standalone progress bars and `h-1.5` for compact/inline bars.

---

## Flashcard visual design

The flashcard uses `aspect-[9/16]` (portrait phone ratio). On desktop with `max-w-sm` (~384px), the card height is ~683px — requiring scroll on most laptop screens.

The gradient (`from-[#1a3d32] via-[#234d3f] to-[#2f6b52]` on front, `from-[#1e3d35] to-[#2D403A]` on back) is nearly identical front/back, making the flip state visually ambiguous.

**Fixes:**
1. Use `aspect-[3/4]` (`sm:aspect-[9/16]` only for mobile-first sessions)
2. Differentiate front/back more clearly: front = dark green, back = paper `#fbf9f3` with dark text
3. Add a visible flip animation hint (e.g., card corner curl SVG)

---

## Empty state design

Empty states vary significantly:

| Page | Empty state style |
|------|-----------------|
| Course list — no results | Dashed border, centred text ✅ |
| Certifications — no certs | Centred text in table, no icon |
| Insights — no modules | Plain `<li>` text "No modules yet." |
| External training — none | Centred "Ingen dokumenter ennå." |
| Participants — no rows | Icon + text ✅ |

**Recommendation:** All empty states should follow one pattern:
```tsx
<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-[#fbf9f3] py-12 text-center">
  <Icon className="size-8 text-neutral-300" />
  <p className="text-sm text-neutral-500">{message}</p>
  {action ? <Link ...>{actionLabel}</Link> : null}
</div>
```

---

## Loading states

Loading is indicated by `<p className="text-sm text-neutral-500">Laster…</p>`. This is plain text with no animation. Skeleton loaders or even a spinner would be significantly less jarring.

The loading text appears at different positions depending on the page — sometimes inside the card area, sometimes before it.

**Recommendation:** Use a consistent skeleton pattern for the main content area.

---

## Mobile considerations

| Issue | Severity |
|-------|---------|
| Player sidebar is `lg:sticky` — on mobile it appears above content, taking up most of the screen | High |
| Module card prev/next buttons `px-4 py-2` (~36px height) below WCAG 44px touch target minimum | Medium |
| Flashcard `max-w-sm` and `aspect-[9/16]` creates a perfect phone-sized card on mobile ✅ | None |
| Course cards `sm:grid-cols-2 xl:grid-cols-3` — good responsive grid ✅ | None |
| Search inputs `rounded-full` with `min-w-[200px] flex-1` wraps cleanly ✅ | None |

The player's sidebar on mobile appears as a full-width block before the module content. Users must scroll past the entire chapter list to reach the module. On mobile, the sidebar should collapse into a toggled drawer or accordion.

---

## Micro-interaction gaps

| Interaction | Current | Better |
|------------|---------|--------|
| Favourite toggle | Instant star fill | Brief scale animation (transform scale 1.3) |
| Module completion | Jump to next | Momentary green flash on sidebar item before advancing |
| Certificate issue | `alert()` | Inline success state with copy button |
| Quiz answer select | Border change | Subtle slide-in of "Riktig / Feil" label |
| Status select in card | Change immediately | Confirm popover for destructive change (Arkivert) |
| Upload submit | No loading state | Button spinner + disabled |

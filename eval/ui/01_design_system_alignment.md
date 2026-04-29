# UI Pass — 01: Design System Alignment

**Role:** UI/UX Designer  
**Reference:** `Claude/AMU Mockup.html` (canonical Klarert design system)

---

## Design token alignment

### What the design system defines

```css
/* Typography */
font-family: "Inter" (body, 14px base, line-height 1.45)
font-family: "Source Serif 4" (headings, h1–h3)

/* Colours */
--forest:      #1a3d32   ← primary
--forest-dark: #14312a
--forest-soft: #e7efe9   ← tinted bg for compliance strips, highlights
--forest-line: #c5d3c8
--bg:          #f7f5ee   ← page background (warm off-white)
--paper:       #fbf9f3   ← card background
--ink:         #1d1f1c   ← body text
--muted:       #6b6f68   ← secondary text
--line:        #e3ddcc   ← border colour
--critical:    #b3382a   ← red
--warn:        #c98a2b   ← amber
--ok:          #2f7757   ← success green

/* Spacing */
Page padding: 24px 32px
Card border-radius: 8px
Card inner padding: 14–18px
Button border-radius: 6px
Tab border-bottom underline (2px, no pill)
```

### What the e-learning module uses

| Token | Mockup value | Module implementation | Delta |
|-------|-------------|----------------------|-------|
| Primary green | `#1a3d32` | `PIN_GREEN = '#1a3d32'` ✅ | None |
| Page background | `#f7f5ee` | `SHELL_PAGE_BG = WORKPLACE_CREAM` ✅ | None |
| Card background | `#fbf9f3` | `bg-white` ❌ | Cards should be `#fbf9f3` not pure white |
| Body font size | `14px` | Tailwind default `text-sm` (14px) ✅ | None |
| Card radius | `8px` | `rounded-xl` (12px) ⚠️ | Module uses larger radius than design system |
| Button radius | `6px` | `rounded-lg` (8px) or `rounded-full` ❌ | Design has 6px; module uses pill or 8px |
| Tab style | underline 2px | `HubMenu1Bar` pill/underline — varies ⚠️ | AMU mockup uses flush tab underline |
| Border color | `#e3ddcc` | `border-neutral-200` (#e5e7eb) ⚠️ | Cooler; design system is warmer |
| Muted text | `#6b6f68` | `text-neutral-600` (#4b5563) ⚠️ | Slightly darker than design |
| Heading font | Source Serif 4 | `font-serif` (generic) ⚠️ | `font-serif` maps to Georgia if Source Serif 4 not loaded |

### Critical finding: font loading

The AMU mockup explicitly loads **Source Serif 4** from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&...">
```

The e-learning module uses `font-serif` Tailwind class — this will render in **Georgia** unless Source Serif 4 is loaded globally in `index.css` or `index.html`. Verify that `src/index.css` or `index.html` imports this font.

---

## Card inconsistency

The design system uses `.card` = `background: var(--paper)` = `#fbf9f3` (warm white).  
The e-learning module uses `bg-white` (#ffffff) on all cards.

This creates a visual inconsistency — the AMU module looks warm/papery; the learning module looks clinical/cool.

**Fix:** Replace `bg-white` with `bg-[#fbf9f3]` or use a shared Tailwind config token `paper`.

---

## Compliance strip — missing from learning module

The AMU mockup has a **compliance strip** immediately below the page title:

```
┌─────────────────────────────────────────────────────────────┐
│ ✓  AML § 7-1 · § 7-2 · § 7-3 · IK-forskriften § 5 — alle │
│    krav for inneværende periode er oppfylt.                  │
└─────────────────────────────────────────────────────────────┘
```

Styled with `border-left: 3px solid var(--forest)` and `background: var(--forest-soft)`.

The learning module has **no compliance strip**. For a module that governs legally required training, this is a significant omission — administrators need to see at a glance whether their training obligations (AML § 3-1, § 6-5, § 7-4) are being met.

---

## KPI tile design

### Mockup KPI style
```css
.kpi {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 16px;
  /* accent via border-left: 3px solid [color] */
}
.kpi-label { font-size: 11.5px; uppercase; letter-spacing: 0.7px; color: var(--muted); }
.kpi-value { font-family: "Source Serif 4"; font-size: 28px; font-weight: 600; }
.kpi-foot  { font-size: 12px; color: var(--muted); }
```

### Module KPI style (LearningDashboard.tsx)
```tsx
<Link className="flex items-center justify-between rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm">
  <div className="text-3xl font-semibold tabular-nums text-[#2D403A]">{value}</div>
  <div className="mt-1 text-sm text-neutral-600">{label}</div>
  <ArrowRight className="size-5 text-neutral-300" />
</Link>
```

**Differences:**
- Module uses `shadow-sm` (design uses no shadow, uses border only)
- Module has `ArrowRight` icon (design has `kpi-foot` text link)
- Module has no coloured left accent border (design shows `kpi-critical`, `kpi-warn`, `kpi-ok`, `kpi-info`)
- Module uses `#2D403A` for value (design uses `var(--ink)` = `#1d1f1c`)
- KPI labels in module are in `text-sm` English (design: 11.5px uppercase Norwegian)

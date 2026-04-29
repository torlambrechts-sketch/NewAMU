# UI Pass — 04: Accessibility

**Role:** UI/UX Designer  
**Standard:** WCAG 2.1 AA (required for Norwegian public-sector tools; best practice for workplace tools under universal design law)  
**Reference:** Likestillings- og diskrimineringsloven § 17 (universal design of ICT)

---

## Colour contrast

### Primary green on white backgrounds

| Foreground | Background | Ratio | WCAG AA (4.5:1) |
|-----------|-----------|-------|-----------------|
| `#1a3d32` on `#ffffff` | ✅ 10.5:1 | Pass |
| `#1a3d32` on `#f7f5ee` (bg) | ✅ ~9.8:1 | Pass |
| `#1a3d32` on `#fbf9f3` (paper) | ✅ ~9.4:1 | Pass |

### Text on backgrounds

| Text | Background | Ratio | Status |
|------|-----------|-------|--------|
| `text-neutral-600` (#4b5563) on white | ~7.5:1 | ✅ Pass |
| `text-neutral-500` (#6b7280) on white | ~4.6:1 | ✅ Barely passes |
| `text-neutral-400` (#9ca3af) on white | ~2.6:1 | ❌ Fails — used for chapter numbers, time labels |
| White text on `PIN_GREEN` (#1a3d32) | ~10.5:1 | ✅ Pass |

### Critical failures

**`text-neutral-400` used for:**
- Module order numbers (`{i + 1}.`) in sidebar — `src/pages/learning/LearningPlayer.tsx` line ~230
- Completion time `~{m.durationMinutes}` — line ~269
- Module kind display — line ~269
- Flashcard "Card N / N" counter — line ~544

**Fix:** Replace `text-neutral-400` with `text-neutral-500` minimum for 14px text, `text-neutral-600` for 12px and smaller.

---

## Keyboard navigation

### Current issues

**Flashcard module:** The flip button is a `<button>` ✅, but arrow key navigation between cards is not implemented. Users must click/tab to the Previous/Next buttons.

**Module list sidebar:** The sidebar is a list of `<button>` elements. Tab order works, but there is no keyboard shortcut to jump to the next/previous module (arrow keys not handled).

**Quiz options:** Each option is a `<button>` inside a `<li>`. Tab order works, but there is no Enter/Space shortcut explicitly handled — though `<button>` defaults should handle this.

**Recommended keyboard shortcuts:**
- `ArrowLeft` / `ArrowRight` in player → previous/next module
- `F` in flashcard → flip card
- `1`–`9` in quiz → select answer option (common in quiz apps)

### Missing focus styles

The module uses Tailwind default focus styles. These are adequate for keyboard users but should be verified to be visible on all interactive elements, especially:
- Flashcard flip button (large touch target — no visible focus ring defined)
- Progress bar `<div>` elements (should not be focusable, correct)
- Module sidebar buttons (focus ring is Tailwind default outline — ✅)

---

## ARIA labels

### Missing aria-labels

| Element | File | Issue |
|---------|------|-------|
| Progress bar `<div>` | `LearningPlayer.tsx` L14-24 | No `role="progressbar"` or `aria-valuenow` |
| Sidebar nav | `LearningPlayer.tsx` L204 | Has `aria-label="Innhold"` ✅ |
| Chapter group headers `<p>` | L208-210 | Should be `<h3>` not `<p>` |
| Module list `<ol>` | L215 | ✅ Ordered list |
| Completion ring SVG | `LearningDashboard.tsx` L24 | Has `aria-hidden` ✅ |
| Flashcard button | `LearningPlayer.tsx` L546 | No `aria-label` describing current state |
| Favourite button | `LearningCoursesList.tsx` L264 | Has `aria-label` ✅ |
| Quiz option buttons | L625 | No `aria-pressed` or `aria-selected` |

### Progress bar semantic

The `ProgressBar` component in `LearningPlayer.tsx` renders as:
```tsx
<div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
  <div className="h-full rounded-full" style={{ width: `${pct}%` }} />
</div>
```

This should be:
```tsx
<div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
```

---

## Screen reader issues

### `dangerouslySetInnerHTML` content
Rich text modules use `dangerouslySetInnerHTML`. Ensure that the HTML coming from the course builder has proper heading hierarchy. The `RichTextEditor` (`TipTap`-based?) should output `<h2>`, `<h3>` etc. relative to the `<h2>` already used for module title.

### Image alt text
`LearningPlayer.tsx` line 703: `<img src={c.imageUrl} alt="" />`  
Image modules have `caption` field — the caption should be used as alt text:
```tsx
<img src={c.imageUrl} alt={c.caption || ''} />
```

### SVG in course list cards
`LearningCoursesList.tsx`: gradient header div has no aria role. Since it's decorative ✅ that's correct.

---

## Mobile / touch accessibility

| Issue | Severity |
|-------|---------|
| Flashcard `aspect-[9/16]` creates very tall cards on desktop | Medium |
| Sidebar nav scrolls independently — no skip-to-content link | Medium |
| Player buttons "Previous" / "Next" have no minimum touch target (44×44px) | Low — `py-2 px-4` gives ~36px height |
| Video progress ring is 44×44px SVG — adequate for touch ✅ | None |

---

## Language / i18n for screen readers

The `lang="nb"` attribute should be set on the root `<html>` element. If the app supports English (`/en/` prefix or via `LanguageSwitcher`), pages served in English should have `lang="en"`.

Screen readers rely on `lang` to select correct pronunciation engine. Mixed-language content (Norwegian UI + English strings in learning module) will cause incorrect pronunciation.

**Urgency:** Fix English strings first (see UI Pass 02), then ensure `lang` attribute is dynamic.

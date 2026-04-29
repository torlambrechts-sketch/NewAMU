# UI Pass — 03: Course Player UX

**Role:** UI/UX Designer  
**Focus:** Learner-facing player experience, module types, progress feedback

---

## Player layout evaluation

### Current layout (`LearningPlayer.tsx`)

```
┌─────────────────────────────────────────────────────────┐
│ ← Courses                                               │
│                                                         │
│ ┌──────────────┐  ┌──────────────────────────────────┐ │
│ │ Course title │  │ Progress bar (top) [DUPLICATE]   │ │
│ │ Description  │  ├──────────────────────────────────┤ │
│ │ Duration     │  │ Module title + kind + duration   │ │
│ │              │  │ Section progress bar             │ │
│ │ Progress card│  │ Module content                   │ │
│ │ [DUPLICATE]  │  └──────────────────────────────────┘ │
│ │              │                                        │
│ │ Content nav  │  [Previous]              [Next module] │
│ │ (sidebar)    │                                        │
│ │              │  [Complete course & certificate panel] │
│ └──────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

### Issues identified

**1. Duplicate progress bars**
The overall progress bar appears in BOTH the sidebar (`ProgressBar` in "Fremdrift" card) AND the main content area (top of right column). This confuses learners and wastes space.

**Fix:** Remove the duplicate from the right-column top. Keep only the sidebar version.

**2. Certificate section always visible**
The "Complete course & certificate" panel appears at the bottom for ALL learners, even when they have 0% progress. This is premature — it creates a distraction and trivialises the completion milestone.

**Fix:** Show certificate panel only when `overallProgress >= 0.8` (80%+ complete).

**3. "Previous" / "Next module" buttons — English**
Should be "Forrige" / "Neste modul".

**4. Navigation button placement**
Current: navigation buttons are between module content and certificate panel.
The certificate panel should be below a horizontal separator, not mixed with navigation.

**5. Module kind badge**
`current.kind` is shown as raw text (`flashcard`, `quiz`, `text`). Should be Norwegian labels:
- `flashcard` → `Flashkort`
- `quiz` → `Quiz`  
- `text` → `Lese`
- `video` → `Video`
- `checklist` → `Sjekkliste`
- `tips` → `Tips`
- `on_job` → `I praksis`
- `event` → `Arrangement`

---

## Module type UX review

### Flashcard module
- `aspect-[9/16]` aspect ratio is portrait (phone-like). On desktop this is very tall and narrow.
- Gradient background with `#1e3d35` is appropriate but text contrast should be checked (white on dark green).
- "Tap to flip" — on desktop should say "Klikk for å snu"
- After last card, the "Mark deck complete" button appears. Should auto-suggest clicking after all cards seen.

**Fix:** Change aspect ratio to `aspect-[4/3]` on desktop, keep portrait only on mobile. Add `sm:aspect-[4/3]` breakpoint.

### Quiz module  
- Shows all questions at once — standard pedagogical approach ✅
- "Correct" / "Incorrect" feedback in English ❌ → "Riktig" / "Feil"
- "Score: X/Y (Z%)" text in English ❌ → "Resultat: X av Y (Z%)"
- "Complete quiz" button English ❌ → "Fullfør quiz"
- No explanation for wrong answers — missed pedagogical opportunity

### Text module
- Uses `dangerouslySetInnerHTML` with sanitized content ✅
- "Continue" button English ❌ → "Fortsett"
- Back-to-back text hint in amber box is good UX ✅
- Long-read hint is good UX ✅

### Video module
- YouTube self-report checkbox: good fallback ✅
- MP4 progress ring: excellent UX ✅
- "Fullført (X% sett)" completion text is Norwegian ✅
- "Bekreft at du har sett videoen ovenfor" is Norwegian ✅
- But: `kind === 'external'` card has "Eksternt video-innhold" ✅

### Checklist module
- Circular checkbox buttons ✅
- "Complete checklist" English ❌ → "Fullfør sjekkliste"

### Tips module
- Emoji 💡 is inconsistent with the design system (no emojis in AMU mockup)
- "Continue" English ❌ → "Fortsett"

### On-the-job module
- "Confirm on-the-job review" English ❌ → "Bekreft gjennomført"
- QR code for flow-of-work is an excellent UX feature ✅

### Event module
- RSVP buttons: "Meld på" / "Avslå" / "Venteliste" ✅ Norwegian
- "Ingen økt planlagt ennå" ✅ Norwegian
- "Fullfør modul" ✅ Norwegian

---

## Certificate issuance UX

### Current state
At bottom of player:
- Text input "Your full name" (English placeholder)
- "Issue certificate" button

### Issues
- English placeholder and button label
- Freetext name entry is a security/accuracy risk (see Compliance GAP-C GDPR)
- `alert()` is used for certificate success — very poor UX
- "A certificate is already on file for this course in this browser." — browser-specific phrasing wrong for server-backed auth users

### Required state
- Auto-fill name from `profile.display_name` when authenticated
- Replace `alert()` with inline success message with certificate details
- Show "Vis sertifikat" button linking to print view after issuance
- Remove the panel entirely when `!modulesComplete`

---

## Sidebar content nav

### Current state
Chapters labelled "Level 1", "Level 2" etc. — English and generic.

### Design system recommendation
The AMU agenda uses numbered items:
```
① Sak 1 — Åpning og godkjenning av innkalling
② Sak 2 — Gjennomgang av referat
```

For learning, use:
```
Del 1: Grunnleggende HMS     (1–5)
  1. Introduksjon ✓
  2. Risikovurdering  ← active
  3. Verneutstyr
```

- Replace "Level N" with "Del N" or better: actual chapter names from metadata
- Active item: forest-coloured left border (not just `bg-emerald-50`)
- Completed: filled green circle with checkmark

---

## Missing UX features

| Feature | Status | Impact |
|---------|--------|--------|
| Keyboard navigation (arrow keys) between modules | ❌ Missing | Accessibility + efficiency |
| Auto-advance after completing module | ❌ Missing | Smooth learning flow |
| Time remaining estimate per module | ⚠️ Only in sidebar | Should be in module header too |
| Module completion celebration / micro-animation | ❌ Missing | Engagement |
| "Resume where you left off" on re-entry | ⚠️ Partial | Module URL param works, no persistent redirect |
| Offline support (service worker) | ❌ Missing | Field workers with poor connectivity |

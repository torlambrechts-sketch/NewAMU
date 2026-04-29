# UI Pass — 02: Navigation Structure

**Role:** UI/UX Designer  
**Reference:** AMU Mockup tabs + page-head pattern

---

## Page header pattern

### AMU Mockup header structure
```
topbar (breadcrumb + action buttons)
  ↓
page-head (title h1 + subtitle + compliance-strip)
  ↓
page-tabs (tab underlines, count badges)
  ↓
page-body (content)
```

### Learning module header structure
```
WorkplacePageHeading1 (breadcrumb + title + description + HubMenu1Bar)
  ↓
Outlet content
```

**Differences:**
1. **Breadcrumb** — AMU mockup has `Medvirkning › AMU`. Learning has `Workspace › E-læring › [section]`. ✅ Correct pattern, slightly different labels.
2. **Action buttons in topbar** — AMU has "Eksporter årsrapport" and "Nytt møte" in top-right. Learning has "Configure" link in dashboard but no consistent top-right action area.
3. **Compliance strip** — AMU has it; Learning does not. ❌ See Gap UI-04.
4. **Tab badges** — AMU uses `<span class="count">N</span>` in tabs. `HubMenu1Bar` has `badgeCount` — ✅ implemented but not used consistently (e.g. "Kritiske saker" with `count.danger` class not implemented in learning).

---

## Tab labels — language inconsistency

The learning module mixes Norwegian and English tab/section labels.

| View | Tab label | Language | Issue |
|------|-----------|----------|-------|
| Dashboard | "Welcome back" (h1) | English | ❌ Should be Norwegian |
| Dashboard | "Featured courses" | English | ❌ |
| Dashboard | "Configure" (button) | English | ❌ |
| Courses list | "Kurs" | Norwegian | ✅ |
| Course builder | "Module builder" | English | ❌ |
| Course builder | "Preview as learner" | English | ❌ |
| Player | "Previous" / "Next module" | English | ❌ |
| Player | "Complete course & certificate" | English | ❌ |
| Player | "Your full name" placeholder | English | ❌ |
| Player | "Issue certificate" / "Certificate issued" | English | ❌ |
| Certifications | "Certifications" (h1) | English | ❌ |
| Certifications | "Demo certificates stored locally. Not a legally binding credential." | English | ❌ — and the disclaimer is factually problematic for a compliance tool |
| Insights | "Insights" (h1) | English | ❌ |
| Insights | "High-level usage in this browser session." | English | ❌ |
| Participants | "Participants" (h1) | English | ❌ |
| Settings | "Settings" (h1) | English | ❌ |
| Settings | "Reset demo data" | English | ❌ |
| Player quiz | "Correct" / "Incorrect" | English | ❌ |
| Player flashcard | "Question" / "Answer" / "Tap to flip" | English | ❌ |
| Player | "← Courses" nav | English | ❌ |
| Builder nav | "Courses ›" breadcrumb | English | ❌ |

**Verdict:** ~30 English strings in a Norwegian-language product. The AMU module is 100% Norwegian. This is a systematic inconsistency.

---

## Navigation items — naming and ordering

### Current `LearningLayout.tsx` nav items (order)
1. Oversikt (Dashboard) ✅
2. Kurs ✅
3. Sertifiseringer ✅
4. Innsikt ✅
5. Deltakere ✅
6. Team heatmap ✅
7. Læringsstier ✅
8. Ekstern opplæring ✅
9. Innstillinger ✅

### Design system recommendation

The AMU mockup groups nav items under section headers:
- **HMS & samsvar** group
- **Medvirkning** group

The learning nav has 9 flat items — this is too many for a single flat list. Recommendation:

**For learners (non-manager):** Show only: Oversikt, Kurs, Mine sertifikater, Ekstern opplæring  
**For managers:** Show all 9, grouped as:
- **Læringsadmin:** Kurs, Deltakere, Team heatmap, Innsikt, Læringsløp
- **Sertifisering:** Sertifiseringer, Ekstern opplæring
- **System:** Innstillinger

---

## Course player navigation

### Current state
The player has:
- "← Courses" back link (English)
- Left sidebar with chapter list
- "Previous" / "Next module" buttons
- Module content area

### Design system pattern
The AMU meeting room uses a sidebar layout with:
- Left: agenda items with numbered circles
- Active item highlighted with forest border + glow
- Right: participant rail

### Recommendation for learning player
The player sidebar should match the AMU agenda pattern:
- Numbered circles (`1`, `2`, `3`) per module, not checkmarks
- Active module: forest border left (`border-left: 3px solid var(--forest)`)
- Completed: green filled circle with ✓
- Chapter groupings with `nav-section-title` style labels

---

## Empty states

The design system does not show empty state examples, but the module has several:
- `LearningCoursesList`: dashed border box ✅ (good pattern)
- `LearningParticipants`: "Ingen treff" with Users icon ✅
- `LearningComplianceMatrix`: "Ingen data ennå" ✅
- `LearningCertifications`: "No certificates yet." ❌ English

Standardise all empty states to Norwegian.

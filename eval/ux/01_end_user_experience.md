# UX Pass — 01: End User Experience

**Role:** UI Designer + End User  
**Method:** Walked every screen as a learner, then as a manager. Evaluated each interaction against the "Does this make sense to a first-time user with no training?" test.

---

## Dashboard (`LearningDashboard.tsx`)

### What a learner actually sees

The dashboard opens with "Welcome back" (English), then immediately shows **four KPI tiles**: "Published courses", "Drafts", "Certificates issued", "Enrolments". These are **admin metrics** — a learner has no idea what "Drafts" means or why they should care about the total number of published courses.

**Problem:** The dashboard serves two roles (admin and learner) with the same view. A learner visiting for the first time sees org-level stats that mean nothing to them personally.

**Recommendation:** Branch the dashboard by role:
- **Learner view:** "Mine kurs", "Fullførte kurs", "Mine sertifikater", "Tid brukt"
- **Admin view:** Keep current KPI tiles (translated)

### "Configure" button for all users

The "Configure" link (→ `/learning/courses`) appears in the top-right of the dashboard **for all users**, including learners who have no write permissions. Clicking it takes them to a page that shows them "Du har ikke tilgang til å opprette kurs." This is a dead end.

**Fix:** Gate the Configure button behind `canManageLearning`.

### "Featured courses" section

The section heading is "Featured courses" (English) with a "+ Create course" link beside it. For a learner, seeing "+ Create course" next to content they're supposed to learn from is confusing — it looks like they have authoring rights.

Also: "Featured" implies curation, but these are just the first 5 published courses in insertion order. There is no curation mechanism.

**Fix:** Rename to "Anbefalte kurs" for learners; hide "+ Opprett kurs" link from non-managers.

### Completion rings — opaque widget

The SVG ring chart shows three nested rings: "Publisert", "Påmeldt", "Sertifikat". The legend is `text-[10px]` (very small). For most learners, the relationship between these three rings is not immediately obvious.

**Better pattern:** Replace the ring chart for learners with a simple "Du har fullført X av Y kurs" text + single bar. Keep the ring chart for admins.

### Spaced repetition panel — good, but module reference is raw UUID

```tsx
{c?.title ?? r.courseId} — modul {r.moduleId.slice(0, 8)}…
```

"modul abc12345…" means nothing to a user. This should show the module title.

---

## Course List (`LearningCoursesList.tsx`)

### Card header is purely decorative

Every card has a `h-36` dark-green gradient header with no content — just a star button and a status badge. This wastes ~25% of card real estate. A course thumbnail, a category icon, or even the first letter of the course title would make cards immediately distinguishable.

### Status badge shows raw enum

```tsx
{c.status === 'published' ? 'Publisert' : c.status === 'draft' ? 'Utkast' : 'Arkivert'}
```

This is correctly translated — ✅. But the badge uses `uppercase tracking-wide` styling, making it look like a technical status code rather than a user-friendly label.

### Two primary actions on the card footer

For managers, each card has:
- "Åpne kurs" (primary, full-width green button)
- "Bygger" (secondary, outlined)

Plus a status `<select>` dropdown and an "Oppgave" task link. That's **four interactive elements** in the card footer. The select dropdown is especially risky — accidentally changing course status to "Arkivert" is a destructive action with no confirmation.

**Fix:** Move the status select to the course builder. In the card, show status as a read-only badge with an edit icon that opens a small popover.

### "Kursansvarlig" / org avatar

The card footer shows the org initial in a green circle + "Kursansvarlig" label. For a learner, this is noise — all courses have the same org.

---

## Course Player (`LearningPlayer.tsx`)

### Duplicate progress bar — confirmed critical

**Line 259–261:** A standalone `<ProgressBar value={overallProgress} label="Total fremdrift" />` card appears at the top of the main content column. The sidebar already shows "Fremdrift" + "Hele kurset" progress bar. Users see two identical progress indicators 20cm apart.

**Remove the main-content progress bar entirely.** The sidebar is the canonical location for overall progress.

### "← Courses" navigation (English)

Line 182: `← Courses` — the only navigation back to the course list. Shown in English while the rest of the page is Norwegian. Users on mobile who only see this link won't recognise it.

### Certificate panel UX — four problems

1. **Always visible.** The panel is visible even on the first module (0% complete). Users see a disabled "Issue certificate" button before they've done anything, which is confusing.
2. **alert() on success.** `alert('Certificate issued! Code: ${cert.verifyCode}')` — browser alert dialogs are jarring, block the page, and can't be styled. Users can't copy the code from an alert on mobile.
3. **Name input.** The learner must type their full name manually every time. The user's `profile.display_name` is already available.
4. **Placement.** The certificate panel is below the prev/next navigation, requiring scroll. A learner who completes the final module has no reason to know there's more content below the navigation buttons.

### "Level 1 / Level 2" chapter titles

```tsx
title: `Level ${level}`
```

Chapters are titled "Level 1", "Level 2", etc. — generated automatically with no semantic meaning. A 6-module course has "Level 1 (1–5)" and "Level 2 (6)". This doesn't help users understand the course structure.

**Fix:** Either remove chapter grouping for short courses (<10 modules), or allow the course builder to specify chapter titles.

### Back-to-back text module warning — shown to learners

```tsx
{backToBackText ? (
  <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 ...">
    Tips: Veksle tekst med quiz eller flashcards for bedre læring...
  </p>
) : null}
```

This is a **course design advisory** for the course builder, not a learner-facing message. A learner sees "Tips: mix text with quiz for better learning" — which they cannot act on. This should only show in the course builder preview mode, not in the learner player.

### Long-read warning — same issue

```tsx
{longRead ? (
  <p className="mb-3 ...">
    Mikrolæring: vurder å dele opp innhold over ~3 min i flere kortere moduler.
  </p>
) : null}
```

Same problem — a module-structure recommendation shown to the learner. Remove from learner view.

### Flashcard `aspect-[9/16]` on desktop

The flashcard uses `aspect-[9/16]` (phone portrait ratio). On a 1400px-wide layout, `max-w-sm` constrains it to ~384px wide, making the card ~683px tall. This is extremely tall for what is functionally a card. Users must scroll to see the "Mark deck complete" button.

**Fix:** Use `aspect-[4/3]` or `aspect-video` on desktop; `aspect-[9/16]` can be reserved for mobile via responsive modifier.

### Quiz — no visual distinction for wrong answers

When a quiz answer is selected:
- Correct: `border-emerald-600 bg-emerald-50` + "Correct" text
- Incorrect: same `border-emerald-600 bg-emerald-50` on the selected (wrong) option, `text-red-700` for "Incorrect" label

**Problem:** The selected wrong answer still gets a green border. Users expect red/wrong-answer highlighting on the chosen option itself, not just a text label.

**Fix:** Wrong answer should get `border-red-400 bg-red-50` on the selected option, and optionally highlight the correct answer in green.

### No completion celebration

When the last module is completed, the player silently advances to… nowhere (already on last module). No success moment, no confetti, no "Kursbevis klar!" message. The user has no indication they've finished beyond the progress bar reaching 100%.

**Fix:** After completing the final module, show a full-width success state:
```tsx
<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
  <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
  <h3>Gratulerer! Du har fullført {activeCourse.title}</h3>
  <p>Hent kursbeviset ditt nedenfor.</p>
</div>
```

---

## Certifications (`LearningCertifications.tsx`)

### Heading is English
`"Certifications"` — should be "Sertifiseringer"

### "Demo certificates stored locally. Not a legally binding credential."
This is shown prominently under the heading in a production workplace tool. Even if the backend is local/demo, this phrasing destroys user confidence. Replace with professional Norwegian language for the production path.

### No print/download action
There is no way to print or download a certificate from this page. The only visible output is the verify code in a table cell. A learner who needs to show their certificate to a third party has no path.

### Search placeholder is English
`"Search by name, course, or code…"` — should be Norwegian.

### Table columns mix languages
"Course", "Learner", "Issued", "Versjon", "Verify" — inconsistent mix of English and Norwegian.

---

## Insights (`LearningInsights.tsx`)

### Entirely English
All labels ("Insights", "High-level usage in this browser session.", "Courses", "Modules", "Certificates", "Enrolments", "Modules by type", "No modules yet.") are English.

### Module type list shows raw `kind` values
```tsx
<span className="text-neutral-600">{k}</span>
```
Shows "flashcard", "quiz", "on_job" etc. — the raw enum values, not Norwegian labels.

### "High-level usage in this browser session"
This description suggests the data is browser-local only. For Supabase users, it's org-wide. The description misleads.

---

## External Training (`LearningExternalTraining.tsx`)

### Status shown as raw enum
```tsx
<div className="mt-1 text-xs uppercase text-neutral-400">{x.status}</div>
```
Shows "pending", "approved", "rejected" in uppercase — raw enum values. Should be: "Venter godkjenning", "Godkjent", "Avslått".

### Approval uses `alert()` on error
```tsx
if (!r.ok) alert(r.error)
```
Same issue as player — browser alerts for errors. Should be inline error display.

### No empty state description for managers
When there are no pending submissions, managers see "Ingen dokumenter ennå." with no call to action. Should explain what employees need to do to submit.

---

## External Training (`LearningExternalTraining.tsx`)

### No visual feedback during upload
The upload button has no loading state. After clicking "Send inn", nothing happens visually until the hook resolves. Users will click again.

---

## Summary: End User Critical Path

| Step | Issue |
|------|-------|
| 1. Land on dashboard | "Welcome back" (English), admin KPIs as learner, "Configure" visible |
| 2. Find a course | Card header is empty decoration; status badge uppercase |
| 3. Open player | Duplicate progress bar; "← Courses" English back link |
| 4. Complete module | Wrong answer no red highlight; completion not celebrated |
| 5. Finish last module | No celebration state; must scroll past nav to find cert panel |
| 6. Issue certificate | Must type name manually; `alert()` dialog; can't copy code |
| 7. View in certifications | "Demo certificates not legally binding" undermines confidence; no download |

# Documents Module — UX & Design Guidelines

Concrete improvement suggestions for the documents section, based on a review of
the current codebase (`WikiPageEditor`, `DocumentEditorWorkbench`, `WikiPageView`,
`DocumentsHome`, `ComplianceDashboard`, `DocumentTemplatesSettings`).

Each item states the problem, the reasoning, and the concrete fix.

---

## 1. Save & Publish Feedback

### 1.1 Persistent save confirmation
**Problem:** The green "Lagret" banner auto-disappears after a few seconds. If the
user scrolls or switches tabs during that window, they miss it.

**Fix:** Keep the banner visible until the user makes the next edit (i.e. dismiss it
on the same `markDirty` call that already clears `savedMsg`). This is already the
right trigger — just remove any auto-dismiss timer.

### 1.2 In-progress state during save / publish
**Problem:** Clicking "Lagre" or "Lagre og publiser" gives no feedback while the
network call is in flight. The button stays enabled, so users double-click.

**Fix:** Add a `saving` boolean state (mirrors `DocumentEditorWorkbench`), set it
`true` before the `updatePage` call and `false` in `finally`. Disable the save and
publish buttons while `saving` is `true` and optionally show a spinner icon.

### 1.3 Scroll-to-error on save failure
**Problem:** The `WarningBox` for save errors is placed above the content, but users
are usually scrolled down to the block they were editing. They won't see the error.

**Fix:** After setting `saveError`, call `window.scrollTo({ top: 0, behavior: 'smooth' })`
or use a `ref` on the error box and call `.scrollIntoView()`.

### 1.4 Unsaved-changes guard on navigation
**Problem:** Clicking the back button or any nav link while `dirty === true` silently
discards changes.

**Fix:** Add a `beforeunload` listener and a React Router `<Prompt>` (or equivalent
`useBlocker` in v6) that warns the user when `dirty` is `true`. Already have `dirty`
state — just wire it up.

---

## 2. Block Editor (WikiPageEditor)

### 2.1 Image upload instead of URL paste
**Problem:** The image block only accepts a URL. Most users don't have a CDN URL
ready — they want to paste from clipboard or pick a file.

**Fix:** Add a file input (`<input type="file" accept="image/*">`) that uploads to
Supabase Storage and populates the `url` field automatically. Supabase Storage is
already in the stack.

### 2.2 Drag-to-reorder visual affordance
**Problem:** The `GripVertical` drag handle is visible but there is no drag-and-drop
implementation — blocks can only be moved via the up/down arrow buttons.

**Fix:** Either implement HTML5 drag-and-drop (or `@dnd-kit/sortable`) on the block
list, or remove the grip icon to avoid misleading users. Keeping a non-functional
affordance erodes trust.

### 2.3 Law reference field grouping
**Problem:** The three fields (ref, description, URL) for a law reference block are
listed as flat siblings, making the relationship unclear.

**Fix:** Group them under a visually distinct card (border + slight background) with
a "§ Lovhenvisning" label. The existing `ModuleSectionCard` component is a good
candidate.

### 2.4 Module block preview
**Problem:** Inserting a "Dynamisk widget" block shows a static help string
(`// modul: live_org_chart`). There is no preview of what will render.

**Fix:** Render a read-only preview of the module directly inside the block editor
card (reuse the same `WikiBlockRenderer` logic). This also catches mis-configuration
earlier.

---

## 3. Settings Tab (WikiPageEditor)

### 3.1 PII section disclosure
**Problem:** The PII sub-form (categories, legal basis, retention note) appears and
disappears based on a checkbox, which can feel like content is being deleted.

**Fix:** Instead of hiding the fields, keep them visible but visually dimmed
(`opacity-50 pointer-events-none`) when the checkbox is unchecked. This shows users
what information they would be capturing, and the transition feels less disruptive.

### 3.2 Retention year auto-fill communication
**Problem:** Selecting a retention category silently overwrites the min/max year
fields. Users who had custom values lose them without warning.

**Fix:** Before overwriting, check if the current values differ from the preset.
If they do, show a confirmation or display a note: "Verdiene er oppdatert fra
kategori. Juster manuelt om nødvendig."

### 3.3 Settings tab density
**Problem:** At medium viewport widths the settings tab is a single long column,
mixing unrelated concerns (layout template, legal refs, acknowledgement, PII, retention).

**Fix:** Use visual section separators (`<hr>` or `ModuleSectionCard`) to group:
1. Presentation (template, lang)
2. Compliance (legal refs, retention, PII)
3. Acknowledgement
4. Revision schedule

This matches the mental model users have when filling in "what kind of document is this?"

---

## 4. Document Workbench (`DocumentEditorWorkbench`)

### 4.1 Field tiles must be clickable
**Problem:** The six "Utfyllbare felt" tiles (text field, signature, initials, etc.)
have interactive styling (orange border, cursor) but no `onClick` handler. Clicking
them does nothing.

**Fix:** Either implement the insertion logic or remove the tiles until it is ready.
Non-functional interactive elements destroy user confidence.

### 4.2 Specification form save state
**Problem:** The specification panel shows "utkast, ikke lagret" but there is no
save button and no indication of when (or if) the data persists.

**Fix:** Either auto-save specification changes (debounced, same as title) or add an
explicit save button. Remove the "utkast" label once the feature is complete.

### 4.3 Version history: auto-save vs. manual save
**Problem:** The 40-item history mixes auto-snapshots with explicit saves, making it
hard to find meaningful checkpoints.

**Fix:** Label entries differently: auto-saves show as "Automatisk lagring · HH:MM"
and manual saves show as "Lagret manuelt · HH:MM". Consider capping auto-saves at 20
and keeping all manual saves.

---

## 5. Page View (`WikiPageView`)

### 5.1 Acknowledgement signature sticky indicator
**Problem:** If a document requires acknowledgement, the `AcknowledgementFooter` is
at the very bottom of the page. Users who skim the content without scrolling never
see it and don't sign.

**Fix:** Add a sticky bottom banner: "Dette dokumentet krever din bekreftelse ↓" that
is visible until the user either scrolls to the footer or has already signed. Hide it
after signing.

### 5.2 Revision due alert with direct action
**Problem:** The amber "revision due" badge shows the date but offers no next step.

**Fix:** Add a "Start revisjon" button next to the badge that opens the editor
directly (or links to the revision workflow). Users who notice the badge should be
one click from acting on it.

### 5.3 Reading preferences discoverability
**Problem:** Font size and high-contrast preferences are inside a `<details>` element
that most users will never open.

**Fix:** Surface these as a small gear/settings icon in the top-right corner of the
content area, opening a small popover. This is a familiar pattern (e.g. Medium's
reading settings).

### 5.4 Version diff / comparison
**Problem:** Version history shows timestamps but no way to see what changed.

**Fix:** Add a "Sammenlign" button between any two versions that renders a side-by-side
or inline diff of the `blocks` JSON rendered as HTML. This is a high-value feature for
compliance-heavy documents.

---

## 6. Home Screen (`DocumentsHome`)

### 6.1 Empty state and first-run guidance
**Problem:** When an organisation has no documents, the hub renders blank with no
instruction on how to begin.

**Fix:** Add an empty state component that shows:
- An illustration or icon
- A headline: "Ingen dokumenter ennå"
- A call-to-action button: "Opprett første dokument"
- A brief description of what the documents module is for

### 6.2 Visible create-document CTA
**Problem:** It is unclear where to click to create a new document from the home
screen. The create flow is buried inside a space.

**Fix:** Add a prominent "+ Nytt dokument" button in the top-right of the hub header
(consistent with how other modules expose primary actions).

---

## 7. Compliance Dashboard

### 7.1 Actionable gap list
**Problem:** The compliance view identifies missing documents but provides no direct
path to create them.

**Fix:** Each missing-document row should include a "Opprett" link that pre-populates
the new document with the relevant legal basis and template. This closes the loop
between "what's missing" and "how to fix it".

---

## 8. Global Patterns

### 8.1 No loading spinner on async operations
Several editor operations (publish, load page) have no loading indicator. Use the
`Button` component's existing spinner capability (or add one) consistently.

### 8.2 No `useBlocker` for dirty navigation
Applies to both `WikiPageEditor` and `DocumentEditorWorkbench`. A single shared hook
`useDirtyGuard(isDirty: boolean)` should cover both.

### 8.3 Terminology consistency
- Main nav says "Maler" but the settings screen header says "Innstillinger". Pick one
  term for templates/settings and use it everywhere.
- "Lagre utkast" vs "Lagre" vs "Lagre og publiser" — these three labels appear across
  the module with slightly different meanings. Define and document them in a glossary
  (or in this file under a "Terminology" section).

### 8.4 No retry affordance after save error
When save fails, the `WarningBox` explains what happened but offers no retry button.
Add a "Prøv igjen" button inside the error box that re-invokes `handleSave()`.

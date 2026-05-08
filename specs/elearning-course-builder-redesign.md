# E-learning course builder redesign

> **Read this first:** `CLAUDE.md` (engine + IA conventions),
> `specs/elearning-parity.md` (the existing learning architecture).

**Owner of this spec:** human.
**Spec status:** `🚧 draft — design source needed (OQ-CB1)` before
flipping to `📋 ready`.

---

## 1 · One-paragraph framing

The current course builder (`src/pages/learning/LearningCourseBuilder.tsx`)
is a tabbed page with `Informasjon / Moduler / Sertifisering / Deltakere /
Innsikt`. The user wants to redesign it to match a new design from Claude
design (URL captured in OQ-CB1; design content currently unreachable).
Two structural changes called out explicitly:

- **Remove inline `Kursbevis` ("Kursbevis"-kort) from any view that shows
  a course** — today the certificate card lives at the bottom of
  `LearningPlayer.tsx` (under the modules list) and inside the builder's
  `Sertifisering` tab as a static descriptor. Both should go.
- **Introduce a Kursbevis button / tab** as a dedicated surface — admin
  authoring lives in one place, learner issuance lives behind one
  obvious entry point.

Class scope: the redesign sits **under e-learning** (`/learning/...`) and
applies **per course** — every course gets the same builder shape; org-
level certification settings remain on `/learning/certifications`.

---

## 2 · Mapping table — current → target

| Current surface | Target |
|---|---|
| `LearningCourseBuilder.tsx` tabbed page | New design's editor shell (per OQ-CB1 — TBD) |
| `info` / `modules` / `cert` / `participants` / `insights` tabs | Tabs match the new design (likely keep most; "cert" becomes the new Kursbevis tab) |
| `LearningPlayer.tsx` `<ModuleSectionCard>` Kursbevis block (line ~415) | Removed; replaced by a button in the player header that opens the dedicated Kursbevis surface |
| Builder `cert` tab content (currently a static info card + `LearningMetadataSchemaEditor`) | Becomes the Kursbevis tab — explicit issue / preview / verification panel + the metadata schema editor |
| `LearningCompletionMetadataPanel` (slotted into the player above cert) | Stays; it's separate from Kursbevis (drives the values that flow into the cert) |

---

## 3 · Capability map

| Capability | Decision | Notes |
|---|---|---|
| **C-CB-1 Editor shell matches new design** | ✅ in scope | DOM structure + spacing + typography per the design (OQ-CB1). |
| **C-CB-2 Per-course implementation** | ✅ in scope | Existing routing already per-course (`/learning/courses/:courseId`); reuse. |
| **C-CB-3 Remove inline Kursbevis from player** | ✅ in scope | `LearningPlayer.tsx` ~line 415 — drop the entire `Kursbevis`-titled `ModuleSectionCard`; replace with a "Kursbevis" header-button that links into the dedicated tab once issued, or shows status when locked. |
| **C-CB-4 Remove inline Kursbevis from builder cert tab** | ✅ in scope | Today's `cert` tab content (info card + metadata schema editor) folds into the new Kursbevis tab. |
| **C-CB-5 Dedicated Kursbevis tab/button** | ✅ in scope | Tab on the builder side; button on the player side. Both drop into the same surface (`/learning/courses/:courseId/kursbevis` or query-param `?tab=kursbevis`, TBD by design). |
| **C-CB-6 Preserve issuing flow** | ✅ in scope | `useLearning.issueCertificate(courseId, name)` mutation stays — only the UI shell moves. |
| **C-CB-7 Preserve verifyCode display** | ✅ in scope | Same flow; stays in the new Kursbevis tab. |

---

## 4 · Dependency graph

```
T1 (Audit existing course builder + player surfaces; capture the
    current Kursbevis touch points)
  └─ T2 (Rebuild builder shell to match the new design — DOM only,
         keep existing data flow + mutations)
       └─ T3 (Move builder cert-tab content into a dedicated Kursbevis
              tab; preserve the metadata schema editor)
            └─ T4 (Player: remove inline Kursbevis card; add header
                   button that routes to the Kursbevis surface)
                 └─ T5 (Lint + smoke-test the issue/verify flow)
```

Phase A · T1 + T2 (shell)
🛑 Ship checkpoint
Phase B · T3 + T4 + T5 (Kursbevis split)

---

## 5 · Tasks (high-level — flesh out after OQ-CB1 resolves)

### Task T1 · Audit existing surfaces

Find every place "Kursbevis" appears in user-facing strings + every
component that touches certificate state:

- `src/pages/learning/LearningCourseBuilder.tsx` (cert tab)
- `src/pages/learning/LearningPlayer.tsx` (~line 415 — the
  `Kursbevis`-titled section card)
- `src/pages/learning/LearningCompletionMetadataPanel.tsx` (probably
  no certificate concern, but confirm)
- `useLearning.issueCertificate` + `useLearning.certificates`

Acceptance: a one-page inventory in this spec's §6 summarising every
DOM site and the string `Kursbevis` it contains.

### Task T2 · Rebuild builder shell

Match the new design at OQ-CB1. Likely:

- Header band with course title + status badge + version + actions
- Left column: sections / modules tree (existing
  `LearningSectionBuilder` component already does this — keep)
- Right column: editor for the selected module
- Tab strip: per-design (probably reduces today's 5 tabs)

Reuse all existing data flow (`useLearning.updateCourse` etc.).

### Task T3 · Kursbevis tab

- New tab id `kursbevis` (replaces `cert`)
- Surface:
  - Header: "Kursbevis" + course version stamp
  - Issued certificates list (read from `useLearning.certificates`)
  - Issue panel (the existing flow from `LearningPlayer.tsx`,
    moved verbatim — name input, issue button, success card with
    verify code)
  - Metadata schema editor (existing
    `LearningMetadataSchemaEditor`)

### Task T4 · Player cleanup

- Delete the inline `Kursbevis`-titled `ModuleSectionCard` in
  `LearningPlayer.tsx` (the block around line 415).
- Add a "Kursbevis" button to the player header (next to "Tilbake
  til katalog" / "Forhåndsvisning"). Clicks route to the Kursbevis
  tab on the builder, OR opens a small modal with the issue flow
  inline (TBD by design).
- When the user is mid-course (modules incomplete), the button reads
  "Kursbevis (låst)" and is disabled, matching today's gating logic.

### Task T5 · Verify

- TS clean
- Lint clean
- Manual: complete a course, click "Kursbevis", issue, see verify code
- Manual: visit a course where modules aren't all done — button is
  disabled, no inline card present
- Manual: verifyCode resolution still works

---

## 6 · Acceptance criteria for the *whole* port

After T1–T5:
- [ ] Builder shell matches the new design at OQ-CB1
- [ ] No "Kursbevis" copy on any course-detail / player page outside
      the dedicated tab/modal
- [ ] One-click path from any course view → Kursbevis surface
- [ ] Existing certificates + verify codes still resolve
- [ ] No regression on the four other learning surfaces (Catalog,
      Player module navigation, Certifications list page, Course
      builder Modules tab)

---

## 7 · Open questions

| ID | Question | Notes |
|---|---|---|
| **OQ-CB1** | **Design source — what's the canonical reference?** | The URL `https://api.anthropic.com/v1/design/h/o4PhCVaY7Ynx5UZiYZP2Yg?open_file=ui_kits%2Felearning%2Feditor%2Findex.html` returns gzipped binary content via WebFetch and isn't accessible from this session. Need: (a) HTML/JSX export, (b) screenshots, or (c) sharable public-link version of the design before T2 can start. |
| OQ-CB2 | Does the new design keep all five existing tabs? | If not, list which tabs are dropped + where their content goes. |
| OQ-CB3 | Kursbevis as a **tab** inside the builder OR a **separate route** (`/learning/courses/:id/kursbevis`)? | The user's words: "button / tab" — both leave the door open. Tab is simpler. |
| OQ-CB4 | When the player surfaces the Kursbevis button, should it open a modal (in-flow) or navigate to the builder tab (full-page)? | Modal is less disruptive; navigation is more discoverable. |
| OQ-CB5 | Should we keep `LearningCompletionMetadataPanel` intact in the player flow? | It's separate from Kursbevis — drives the metadata that flows into the cert. Probably yes. |

Resolve OQ-CB1 minimum before starting T2. The other OQs can be resolved
during T1 with a side-by-side comparison to the design.

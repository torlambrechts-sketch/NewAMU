# UX Pass — 03: Prioritised Gaps & Cursor Action Prompts

**Role:** UI Designer + End User  
**Use:** Copy each Cursor prompt directly into Cursor agent mode.

---

## GAP-UX01 — Replace `#2D403A` magic string with `PIN_GREEN` token

**Severity:** Medium (design consistency)  
**Files:** `LearningDashboard.tsx`, `LearningPlayer.tsx`, `LearningCertifications.tsx`, `LearningInsights.tsx`, `LearningParticipants.tsx`, `LearningCoursesList.tsx`

### Cursor prompt
```
In all files under src/pages/learning/ and src/components/learning/:

Replace every occurrence of the colour string "#2D403A" with the design token.

The token is imported as: import { PIN_GREEN } from '../../components/learning/LearningLayout'
(adjust relative path per file)

Replace patterns:
  className="... text-[#2D403A]"  →  className="..."  +  style={{ color: PIN_GREEN }}
  style={{ color: '#2D403A' }}    →  style={{ color: PIN_GREEN }}
  backgroundColor: '#2D403A'     →  backgroundColor: PIN_GREEN

Do NOT replace '#2D403A' inside gradient strings (bg-gradient-to-*) if PIN_GREEN is already used
in the same gradient — check each case.

After replacement, verify PIN_GREEN is imported in each file that uses it.
```

---

## GAP-UX02 — Dashboard: role-split view and remove English strings

**Severity:** High (usability + i18n)  
**File:** `src/pages/learning/LearningDashboard.tsx`

### Cursor prompt
```
In src/pages/learning/LearningDashboard.tsx, make the following changes:

1. Import canManageLearning from useLearning or can('learning.manage') from useOrgSetupContext.
   const { can } = useOrgSetupContext()
   const canManage = can('learning.manage')

2. Gate the "Configure" button — only show it when canManage is true:
   {canManage ? (
     <Link to="/learning/courses" className="...">Administrer</Link>
   ) : null}

3. Translate the heading and subtitle:
   "Welcome back"  →  "God dag"
   "Courses, micro-learning modules, and certifications in one place."
     →  "Kurs, mikromoduler og sertifiseringer på ett sted."

4. Translate KPI labels (non-managers see different labels):
   When canManage:
     "Published courses"  →  "Publiserte kurs"
     "Drafts"             →  "Utkast"
     "Certificates issued" →  "Utstedte sertifikater"
     "Enrolments"         →  "Påmeldinger"
   When !canManage, replace the four KPI tiles with learner-relevant stats:
     Label: "Mine kurs"     Value: courses.filter(c => c.status === 'published').length
     Label: "Påbegynte"    Value: progress.filter(p => { const pct = ...; return pct > 0 && pct < 1 }).length
     Label: "Fullførte"    Value: certificates.length
     Label: "Streak"       Value: streakWeeks ?? 0  (with Flame icon)
   (derive values from existing useLearning() data already destructured)

5. Translate the featured courses section:
   "Featured courses"  →  canManage ? "Publiserte kurs" : "Anbefalte kurs"
   "+ Create course"   →  only show when canManage, label "+ Opprett kurs", link to /learning/courses

6. Fix the course card inside featured section:
   "{c.modules.length} modules"  →  `${c.modules.length} ${c.modules.length === 1 ? 'modul' : 'moduler'}`

7. Fix the empty state:
   "No published courses yet. Open Courses to create one."
   →  canManage
        ? "Ingen publiserte kurs ennå. Gå til Kurs for å opprette ett."
        : "Ingen kurs tilgjengelig ennå."
   (hide the link for non-managers)

8. Fix spaced repetition module reference:
   Find: {c?.title ?? r.courseId} — modul {r.moduleId.slice(0, 8)}…
   Replace with: 
     const mod = c?.modules?.find(m => m.id === r.moduleId)
     {c?.title ?? r.courseId} — {mod?.title ?? 'Ukjent modul'}

Do not change any logic, state, or prop types — only UI rendering.
```

---

## GAP-UX03 — Player: fix navigation, remove duplicate progress bar, Norwegian strings

**Severity:** High (usability + i18n)  
**File:** `src/pages/learning/LearningPlayer.tsx`

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, make ALL of the following changes:

1. REMOVE the duplicate progress bar card in the main content column.
   Find and delete this block (~line 259-261):
     <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
       <ProgressBar value={overallProgress} label="Total fremdrift" />
     </div>
   The sidebar already shows overall progress — this is a duplicate.

2. Translate the back link:
   "← Courses"  →  "← Kurs"
   className stays the same.

3. Translate prev/next navigation buttons:
   "Previous"     →  "Forrige"
   "Next module"  →  "Neste modul"

4. Remove the back-to-back text warning shown to learners.
   Find and delete:
     {backToBackText ? (
       <p className="mb-4 rounded-lg border border-amber-200 ...">
         Tips: Veksle tekst med quiz ...
       </p>
     ) : null}
   This is a course-builder advisory, not a learner message.

5. Remove the long-read warning shown to learners.
   Find and delete:
     {longRead ? (
       <p className="mb-3 rounded-lg border border-neutral-200 ...">
         Mikrolæring: vurder å dele opp innhold ...
       </p>
     ) : null}

6. Add Norwegian module kind labels. Find the module header span:
   <span className="text-xs text-neutral-500">
     ~{current.durationMinutes} min · {current.kind}
   </span>
   Replace with:
   const KIND_LABELS: Record<string, string> = {
     flashcard: 'Flashkort', quiz: 'Quiz', text: 'Lese',
     image: 'Bilde', video: 'Video', checklist: 'Sjekkliste',
     tips: 'Tips', on_job: 'I praksis', event: 'Arrangement', other: 'Annet',
   }
   <span className="text-xs text-neutral-500">
     ~{current.durationMinutes} min · {KIND_LABELS[current.kind] ?? current.kind}
   </span>

7. Translate module complete buttons:
   "Mark deck complete"        →  "Fullfør kortsett"
   "Complete quiz"             →  "Fullfør quiz"
   "Continue" (text module)    →  "Fortsett"
   "Continue" (image module)   →  "Fortsett"
   "Complete checklist"        →  "Fullfør sjekkliste"
   "Confirm on-the-job review" →  "Bekreft gjennomført"
   "Continue" (other module)   →  "Fortsett"

8. Translate flashcard strings:
   "Answer"    →  "Svar"
   "Question"  →  "Spørsmål"
   "Tap to flip" →  "Klikk for å snu"
   "Card {N} / {N}"  →  "Kort {N} av {N}"
   "No cards"  →  "Ingen kort"

9. Translate quiz strings:
   "Correct"   →  "Riktig ✓"
   "Incorrect" →  "Feil ✗"
   "Score: {correctCount}/{total} ({scorePct}%)"
     →  `Resultat: ${correctCount} av ${c.questions.length} (${scorePct}%)`
   "No questions"  →  "Ingen spørsmål"

10. Fix image alt text:
    <img src={c.imageUrl} alt="" ...>
    →  <img src={c.imageUrl} alt={c.caption || 'Kursbilde'} loading="lazy" ...>

Do not change any logic, types, or hook calls.
```

---

## GAP-UX04 — Player: fix quiz wrong-answer colour

**Severity:** Medium (clarity)  
**File:** `src/pages/learning/LearningPlayer.tsx`

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, in the quiz section of ModulePlayer,
fix the answer option button colours so wrong answers are highlighted red.

Find the quiz option button className:
  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
    sel === i ? 'border-emerald-600 bg-emerald-50' : 'border-neutral-200 bg-white'
  }`}

Replace with a three-state colour:
  const isSelected = sel === i
  const isCorrect = q.correctIndex === i
  const showResult = sel !== undefined

  let optClass = 'border-neutral-200 bg-white'
  if (showResult && isSelected && isCorrect) optClass = 'border-emerald-600 bg-emerald-50'
  if (showResult && isSelected && !isCorrect) optClass = 'border-red-400 bg-red-50'
  if (showResult && !isSelected && isCorrect) optClass = 'border-emerald-300 bg-emerald-50/50'

  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${optClass}`}

Also update the result label:
  <p className={`mt-2 text-sm ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
    {ok ? 'Riktig ✓' : 'Feil ✗'}
  </p>

This shows: selected-correct = green, selected-wrong = red, correct-when-wrong-selected = pale green hint.
```

---

## GAP-UX05 — Player: course completion celebration + certificate UX overhaul

**Severity:** High (user satisfaction)  
**File:** `src/pages/learning/LearningPlayer.tsx`

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, overhaul the certificate panel to fix
four UX problems: always-visible, alert(), manual name entry, poor placement.

1. Add a state variable: const [certIssued, setCertIssued] = useState<string | null>(null)
   (stores the verifyCode after issuance)

2. Auto-populate learner name from profile:
   Add to imports: import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
   (already imported — just use it)
   After const { can, supabase, organization } = useOrgSetupContext() add:
   const { profile } = useOrgSetupContext()  ← already destructured in the hook call, just add profile

   Set initial name from profile:
   const [learnerName, setLearnerName] = useState('')
   useEffect(() => {
     if (profile?.display_name && !learnerName) setLearnerName(profile.display_name)
   }, [profile?.display_name])

3. Gate certificate panel — only show when modulesComplete is true:
   Find: <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5">
   Wrap the entire cert panel in: {modulesComplete && (

4. Add a completion celebration BEFORE the certificate panel.
   Insert this immediately after the prev/next button row, when modulesComplete && !hasCert:
   {modulesComplete && !hasCert ? (
     <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
       <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
       <h3 className="mt-3 font-serif text-xl font-semibold text-[#1a3d32]">
         Gratulerer! Du har fullført {activeCourse.title}
       </h3>
       <p className="mt-1 text-sm text-neutral-600">
         Alle moduler er gjennomført. Hent kursbeviset ditt nedenfor.
       </p>
     </div>
   ) : null}

5. Replace the certificate panel content:
   - Title: "Complete course & certificate"  →  "Kursbevis"
   - Description: translate to Norwegian, remove "demo certificate" language
   - Name input: add readOnly when profile?.display_name is set
     placeholder="Ditt fulle navn"
     If auto-populated, add a hint: <p className="mt-1 text-xs text-neutral-500">Navn hentet fra profilen din.</p>
   - Replace the alert() call:
     Remove: if (cert !== null) alert(`Certificate issued! Code: ${cert.verifyCode}`)
     Replace with: if (cert !== null) setCertIssued(cert.verifyCode)
   - After the button, show success state when certIssued:
     {certIssued ? (
       <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
         <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
           <CheckCircle2 className="size-4 shrink-0" />
           Kursbevis utstedt
         </p>
         <p className="mt-1 text-xs text-neutral-600">
           Verifiseringskode: <span className="font-mono font-medium">{certIssued}</span>
         </p>
         <Link to="/learning/certifications" className="mt-2 inline-block text-xs text-emerald-800 underline">
           Se alle sertifikater →
         </Link>
       </div>
     ) : null}
   - Translate button:
     "Issue certificate"  →  "Hent kursbevis"
     "Certificate issued" →  "Kursbevis utstedt"
   - Translate helper text:
     "Complete every module to unlock certificate issuance."
       →  "Fullfør alle moduler for å låse opp kursbeviset."
     "A certificate is already on file..."
       →  "Du har allerede et kursbevis for dette kurset."
     "You can issue your demo certificate now."
       →  "Du kan nå hente kursbeviset ditt."

Do not change issueCertificate() logic. Only change the render output.
```

---

## GAP-UX06 — Fix flashcard aspect ratio on desktop

**Severity:** Medium (layout)  
**File:** `src/pages/learning/LearningPlayer.tsx`

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, in the flashcard section of ModulePlayer,
fix the card aspect ratio so it's not excessively tall on desktop.

Find:
  className="relative mx-auto block aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl shadow-xl"

Replace with:
  className="relative mx-auto block aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl shadow-xl sm:aspect-[4/3]"

Also improve front/back visual differentiation so users can clearly tell which side is shown.

Find the button style:
  style={{
    background: flashFlipped
      ? 'linear-gradient(160deg, #1e3d35 0%, #2D403A 100%)'
      : 'linear-gradient(160deg, #3d5a52 0%, #2D403A 100%)',
  }}

Replace with:
  style={{
    background: flashFlipped
      ? '#fbf9f3'                        // back: paper white, light
      : 'linear-gradient(160deg, #1a3d32 0%, #2D403A 100%)',  // front: dark green
  }}

And update the text colours inside to adapt:
  The outer div with text-white: add conditional:
    className={`flex h-full flex-col justify-between p-6 ${flashFlipped ? 'text-[#1a3d32]' : 'text-white'}`}

The label and hint text inside (the "Question"/"Answer" and "Tap to flip" divs):
  className={`text-xs uppercase tracking-widest ${flashFlipped ? 'text-neutral-500 opacity-100' : 'opacity-70'}`}
  className={`text-center text-xs ${flashFlipped ? 'text-neutral-400' : 'opacity-70'}`}

This makes: front = dark green (formal/question), back = paper/cream (answer revealed).
```

---

## GAP-UX07 — Fix all remaining English strings

**Severity:** High (i18n)  
**Files:** `LearningCertifications.tsx`, `LearningInsights.tsx`, `LearningParticipants.tsx`

### Cursor prompt
```
Translate remaining English UI strings to Norwegian (Bokmål).

File: src/pages/learning/LearningCertifications.tsx
  h1 "Certifications"          →  "Sertifiseringer"
  p "Demo certificates stored locally. Not a legally binding credential."
    →  "Sertifikater utstedt ved fullført kurs. Gjelder som dokumentasjon på gjennomført opplæring."
  KPI label "Issued (total)"   →  "Utstedt totalt"
  KPI label "Issued this year" →  "Utstedt i år"
  KPI label "In progress (tracked)" →  "Under gjennomføring"
  search placeholder "Search by name, course, or code…"
    →  "Søk på navn, kurs eller kode…"
  table header "Course"        →  "Kurs"
  table header "Learner"       →  "Deltaker"
  table header "Issued"        →  "Dato"
  table header "Verify"        →  "Verifiseringskode"
  empty state "No certificates yet. Complete a published course in the learner view to issue one."
    →  "Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett."

File: src/pages/learning/LearningInsights.tsx
  h1 "Insights"                →  "Innsikt"
  p "High-level usage in this browser session."
    →  "Aggregert oversikt over gjennomføring i organisasjonen."
  InsightCard label "Courses"  →  "Kurs"
  InsightCard label "Modules"  →  "Moduler"
  InsightCard label "Certificates" →  "Sertifikater"
  InsightCard label "Enrolments"   →  "Påmeldinger"
  h2 "Modules by type"         →  "Moduler etter type"
  In byKind list, replace raw kind key with Norwegian label:
    const KIND_LABELS: Record<string, string> = {
      flashcard: 'Flashkort', quiz: 'Quiz', text: 'Lese',
      image: 'Bilde', video: 'Video', checklist: 'Sjekkliste',
      tips: 'Tips', on_job: 'I praksis', event: 'Arrangement', other: 'Annet',
    }
    <span className="text-neutral-600">{KIND_LABELS[k] ?? k}</span>
  empty li "No modules yet."   →  "Ingen moduler ennå."

File: src/pages/learning/LearningParticipants.tsx
  h1 "Participants"            →  "Deltakere"

Do not change any IDs, keys, prop names, types, or logic.
```

---

## GAP-UX08 — Replace `bg-white` with `bg-[#fbf9f3]` on all cards

**Severity:** Medium (design system)  
**Files:** All `src/pages/learning/*.tsx`

### Cursor prompt
```
In all files under src/pages/learning/:

Replace bg-white with bg-[#fbf9f3] on elements that match ALL of these criteria:
  1. Has a rounded-xl, rounded-2xl, or rounded-lg class
  2. Has a border or shadow-sm class (i.e., it's a card/panel)
  3. Is NOT an input, select, textarea, table cell, or dropdown

Do NOT replace bg-white on:
  - <input>, <select>, <textarea> elements
  - <td>, <th> elements
  - Elements with bg-neutral-50, bg-emerald-50, bg-amber-50, bg-red-50 (coloured panels)
  - The flashcard button (bg is a gradient)

Files to process:
  LearningDashboard.tsx
  LearningCoursesList.tsx (only the create-course form card, not course card headers)
  LearningPlayer.tsx (sidebar cards, module card)
  LearningCertifications.tsx (KPI cards, table wrapper)
  LearningInsights.tsx (insight cards, chart card)
  LearningExternalTraining.tsx (form card, list card)
  LearningParticipants.tsx (table wrapper)
  LearningSettings.tsx

After changes, visually verify no form inputs turned cream.
```

---

## GAP-UX09 — Fix external training: status labels, alert(), upload loading state

**Severity:** Medium (usability)  
**File:** `src/pages/learning/LearningExternalTraining.tsx`

### Cursor prompt
```
In src/pages/learning/LearningExternalTraining.tsx, fix three usability issues:

1. Translate status labels from raw enum to Norwegian.
   Find: <div className="mt-1 text-xs uppercase text-neutral-400">{x.status}</div>
   Replace with:
     const STATUS_LABELS: Record<string, string> = {
       pending: 'Venter godkjenning',
       approved: 'Godkjent',
       rejected: 'Avslått',
     }
     <div className={`mt-1 text-xs font-medium ${
       x.status === 'approved' ? 'text-emerald-700'
       : x.status === 'rejected' ? 'text-red-700'
       : 'text-amber-700'
     }`}>
       {STATUS_LABELS[x.status] ?? x.status}
     </div>

2. Replace alert() on approval error with inline error state.
   Add state: const [approveError, setApproveError] = useState<string | null>(null)
   Replace: if (!r.ok) alert(r.error)
   With:    if (!r.ok) setApproveError(r.error)
   Add below the approve/reject buttons:
     {approveError ? (
       <p className="mt-2 text-xs text-red-700">{approveError}</p>
     ) : null}

3. Add loading state to the upload button.
   Add state: const [uploading, setUploading] = useState(false)
   Wrap upload function:
     setUploading(true)
     const r = await submitExternalCertificate(...)
     setUploading(false)
   Update button:
     disabled={uploading}
     className="... disabled:opacity-60"
   Button text: {uploading ? 'Laster opp…' : 'Send inn'}

Do not change any hook calls or business logic.
```

---

## GAP-UX10 — Standardise empty states across all pages

**Severity:** Low (visual consistency)  
**Files:** `LearningCertifications.tsx`, `LearningInsights.tsx`, `LearningExternalTraining.tsx`

### Cursor prompt
```
Standardise empty states across learning pages to use one consistent pattern.

Target pattern:
  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-200 bg-[#fbf9f3] py-12 text-center">
    <Icon className="size-8 text-neutral-300" aria-hidden />
    <p className="text-sm text-neutral-500">{message}</p>
  </div>

Apply to:

1. LearningCertifications.tsx — replace the table empty state:
   Find: <p className="px-4 py-10 text-center text-sm text-neutral-500">No certificates yet...</p>
   Replace with the pattern above using <Award className="size-8 text-neutral-300" />
   Message: "Ingen sertifikater ennå. Fullfør et publisert kurs for å få utstedt ett."
   Note: place the pattern OUTSIDE the table, conditionally render the whole table only when filtered.length > 0

2. LearningInsights.tsx — replace the "No modules yet" list item:
   Find: <li className="text-neutral-500">No modules yet.</li>
   Replace with the pattern above using <BarChart3 className="size-8 text-neutral-300" />
   Message: "Ingen moduler ennå."

3. LearningExternalTraining.tsx — replace the list empty state:
   Find: <p className="px-4 py-8 text-center text-sm text-neutral-500">Ingen dokumenter ennå.</p>
   Replace with the pattern above using <Award className="size-8 text-neutral-300" />
   Message: "Ingen innsendte dokumenter ennå."
   (manager context): add second line <p className="text-xs text-neutral-400">Ansatte kan sende inn dokumentasjon fra denne siden.</p>

Import required icons at the top of each file if not already imported.
Do not change the empty state in LearningCoursesList (already good) or LearningParticipants (already has icon).
```

---

## GAP-UX11 — Fix `text-neutral-400` contrast failures on text

**Severity:** Medium (accessibility / WCAG)  
**File:** `src/pages/learning/LearningPlayer.tsx`

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, fix WCAG contrast failures caused by text-neutral-400.

text-neutral-400 (#9ca3af) on white has a 2.6:1 contrast ratio — fails WCAG AA.

Find and replace ALL text-neutral-400 on text elements:

1. Chapter group label in sidebar (~line 209):
   className="... text-neutral-400"
   →  className="... text-neutral-500"

2. Module number prefix in sidebar (~line 230):
   <span className="mt-0.5 shrink-0 text-xs text-neutral-400">{i + 1}.</span>
   →  <span className="mt-0.5 shrink-0 text-xs text-neutral-500">{i + 1}.</span>

3. Chapter range span (~line 211):
   <span className="font-normal text-neutral-400">({ch.startIdx + 1}–{ch.endIdx + 1})</span>
   →  <span className="font-normal text-neutral-500">

4. In LearningCoursesList.tsx, flashcard card counter if present.

Do NOT change text-neutral-400 on:
  - Icon elements (aria-hidden icons used decoratively)
  - The ArrowRight icon in KPI cards (purely decorative)
  - The Search icon in search inputs (purely decorative)
  - Progress bar background (not text)

Only change it on actual text content.
```

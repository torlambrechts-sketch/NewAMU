# UI Pass — 05: Prioritised Gaps & Cursor Action Prompts

**Role:** UI/UX Designer  
**Use:** Copy each Cursor prompt directly into Cursor agent mode.

---

## GAP-UI01 — Norwegian language throughout

**Severity:** High  
**File(s):** `LearningDashboard.tsx`, `LearningPlayer.tsx`, `LearningCourseBuilder.tsx`, `LearningCertifications.tsx`, `LearningInsights.tsx`, `LearningSettings.tsx`, `LearningParticipants.tsx`

### Cursor prompt
```
Translate all English UI strings to Norwegian (Bokmål) across the entire e-learning module.

Key replacements (not exhaustive — scan all files in src/pages/learning/):

LearningDashboard.tsx:
  "Welcome back" → "God dag"
  "Courses, micro-learning modules, and certifications in one place." → "Kurs, mikromoduler og sertifiseringer på ett sted."
  "Configure" → "Administrer"
  "Published courses" → "Publiserte kurs"
  "Drafts" → "Utkast"
  "Certificates issued" → "Utstedte sertifikater"
  "Enrolments" → "Påmeldinger"
  "Featured courses" → "Anbefalte kurs"
  "+ Create course" → "+ Opprett kurs"

LearningPlayer.tsx:
  "← Courses" → "← Kurs"
  "Fremdrift" keep ✅ but check all
  "Previous" → "Forrige"
  "Next module" → "Neste modul"
  "Complete course & certificate" → "Fullfør kurs og motta kursbevis"
  "Your full name" placeholder → "Ditt fulle navn"
  "Issue certificate" → "Utsted kursbevis"
  "Certificate issued" → "Kursbevis utstedt"
  "Complete every module to unlock certificate issuance." → "Fullfør alle moduler for å låse opp kursbeviset."
  "This course is not published." → "Dette kurset er ikke publisert."
  "Course not found." → "Kurset ble ikke funnet."
  "Total fremdrift" → keep ✅
  In flashcard: "Question" → "Spørsmål", "Answer" → "Svar", "Tap to flip" → "Klikk for å snu"
  In flashcard: "Mark deck complete" → "Fullfør kortsett"
  In quiz: "Correct" → "Riktig", "Incorrect" → "Feil"
  In quiz: "Score: X/Y (Z%)" → "Resultat: X av Y (Z%)"
  In quiz: "Complete quiz" → "Fullfør quiz"
  In text: "Continue" → "Fortsett"
  In checklist: "Complete checklist" → "Fullfør sjekkliste"
  In on_job: "Confirm on-the-job review" → "Bekreft gjennomført"

LearningCourseBuilder.tsx:
  "Module builder" → "Modulbygger"
  "Preview as learner" → "Forhåndsvis som deltaker"
  "Flashcard story" → "Flashkort"
  "Text" → "Tekst", "Image" → "Bilde", "Video" → "Video"
  "Checklist" → "Sjekkliste", "Practical tips" → "Praktiske tips"
  "On-the-job" → "I jobben", "Event (ILT)" → "Arrangement (ILT)"
  "Other" → "Annet"
  Builder breadcrumb "Courses" → "Kurs"
  "Modules" tab label → "Moduler"
  "Select a module to edit content." → "Velg en modul for å redigere innhold."
  "Module title" → "Modulnavn"
  "Duration (minutes)" → "Varighet (minutter)"
  "No modules in this filter." → "Ingen moduler i dette filteret."
  + Add card → + Legg til kort
  + Add question → + Legg til spørsmål
  + Add item → + Legg til punkt
  + Item → + Punkt
  + Task → + Oppgave

LearningCertifications.tsx:
  "Certifications" → "Sertifiseringer"
  "Demo certificates stored locally. Not a legally binding credential." 
    → "Sertifikater utstedt ved fullført kurs. Gjelder som dokumentasjon på opplæring."
  "Issued (total)" → "Utstedt (totalt)"
  "Issued this year" → "Utstedt i år"
  "In progress (tracked)" → "Under gjennomføring"
  "Course" column → "Kurs"
  "Learner" column → "Deltaker"
  "Issued" column → "Dato"
  "Verify" column → "Verifiseringskode"
  Empty: "No certificates yet. Complete a published course..." → "Ingen sertifikater ennå. Fullfør et publisert kurs..."

LearningInsights.tsx:
  "Insights" → "Innsikt"
  "High-level usage in this browser session." → "Aggregert oversikt for organisasjonen."
  "Courses" → "Kurs", "Modules" → "Moduler", "Certificates" → "Sertifikater", "Enrolments" → "Påmeldinger"
  "Modules by type" → "Moduler etter type"

LearningSettings.tsx:
  "Settings" → "Innstillinger"
  "Reset demo data" → "Tilbakestill demodata"
  "Export / import (JSON)" → keep ✅ (technical)
  "Reset learning data" → "Tilbakestill opplæringsdata"
  Alert text "Reset all learning data in this browser?" → "Tilbakestille alle opplæringsdata i denne nettleseren?"

LearningParticipants.tsx:
  "Participants" → "Deltakere" (h1) ✅ already Norwegian subtitle

Apply changes file by file. Do not change IDs, keys, prop names or logic — only user-visible string literals.
```

---

## GAP-UI02 — Card background from `bg-white` to `bg-[#fbf9f3]`

**Severity:** Medium  
**File(s):** All `src/pages/learning/*.tsx`

### Cursor prompt
```
In all files under src/pages/learning/ and src/components/learning/:

Replace `bg-white` with `bg-[#fbf9f3]` on all card/panel elements that have:
  - `rounded-xl border border-neutral-200`
  - or `rounded-2xl border`

Do NOT replace bg-white on:
  - Input fields (keep white for inputs)
  - Table cells
  - Dropdown menus

This aligns cards with the Klarert design system's "paper" token (#fbf9f3) 
used in the AMU module and referenced in Claude/AMU Mockup.html.
```

---

## GAP-UI03 — Progress bar ARIA semantics

**Severity:** Medium  
**File(s):** `src/pages/learning/LearningPlayer.tsx` line 11-24

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, update the ProgressBar component:

function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(100, Math.max(0, value * 100)))
  return (
    <div className="space-y-1">
      {label ? <div className="text-xs font-medium text-neutral-600" id={`pb-label-${label}`}>{label}</div> : null}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Fremdrift'}
        className="h-2 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: PIN_GREEN }}
        />
      </div>
    </div>
  )
}

Also update ProgressBarMini in LearningCoursesList.tsx and LearningParticipants.tsx with the same role and aria attributes.
```

---

## GAP-UI04 — Compliance strip on learning dashboard

**Severity:** High (ties to compliance pass)  
**File(s):** `src/pages/learning/LearningDashboard.tsx`

### Cursor prompt
```
In src/pages/learning/LearningDashboard.tsx, add a compliance status strip 
immediately after the page heading (before KPI grid).

The strip should:
1. Show green (forest-soft bg, forest border-left) when all tracked obligations are met.
2. Show amber when some are partially met.
3. Show red when critical obligations are unfulfilled.

Logic (use useLearning() data):
- "Sertifiseringer: X av Y gyldige" based on certificationRenewals where status !== 'expired'
- "Verneombud opplæring: X av X påkrevd" (stub: show "Mangler rolledata" if no path tagged verneombud)
- Links to /learning/compliance and /learning/certifications

Render as:
<div className="rounded-sm border border-[#c5d3c8] border-l-4 border-l-[#1a3d32] bg-[#e7efe9] px-3 py-2 text-[12.5px] text-[#1a3d32] flex items-center gap-2">
  <CheckCircle2 className="size-3.5 shrink-0" />
  <span>
    AML § 3-1 · § 6-5 · IK-forskriften § 5 — {summary text}
  </span>
  <Link to="/learning/compliance" className="ml-auto text-xs underline font-medium">Se detaljer</Link>
</div>
```

---

## GAP-UI05 — Duplicate progress bar in player

**Severity:** Medium  
**File(s):** `src/pages/learning/LearningPlayer.tsx` lines 258-261

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, remove the duplicate progress bar 
from the top of the main content area (lines ~258-261):

  <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
    <ProgressBar value={overallProgress} label="Total fremdrift" />
  </div>

The overall progress is already shown in the left sidebar under "Fremdrift".
Remove the duplicate to reduce visual noise. Keep the per-section progress 
bar inside the active module card.
```

---

## GAP-UI06 — Certificate panel gating

**Severity:** Medium  
**File(s):** `src/pages/learning/LearningPlayer.tsx` lines 321-357

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, gate the certificate issuance panel:

Change:
  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5">

To only render when overallProgress >= 0.5 (show panel when halfway through).

Also:
1. Replace the text input for learner name with: 
   const { profile } = useOrgSetupContext()
   Auto-populate value from profile?.display_name when available.
   Make the input read-only when auto-populated (show "Ditt navn er hentet fra profilen din").

2. Replace the alert() call on certificate issuance with an inline success block:
   Show: "Kursbevis utstedt ✓" + verifyCode + a link to /learning/certifications

3. Translate all strings in this panel to Norwegian (see GAP-UI01).
```

---

## GAP-UI07 — Image alt text

**Severity:** Medium (accessibility)  
**File(s):** `src/pages/learning/LearningPlayer.tsx` line 703

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, in the image module section (~line 703):

Change:
  <img src={c.imageUrl} alt="" className="max-h-64 w-full rounded-xl object-cover" />

To:
  <img src={c.imageUrl} alt={c.caption || 'Kursbilde'} className="max-h-64 w-full rounded-xl object-cover" />

Also in LearningCoursesList.tsx, the gradient header div is decorative — 
verify it has aria-hidden="true" or role="presentation". Currently it has no role
which is fine since it's a div, but add aria-hidden to the inner gradient overlay div
if it has any background image.
```

---

## GAP-UI08 — Module type labels in Norwegian

**Severity:** Low  
**File(s):** `src/pages/learning/LearningPlayer.tsx` line ~269

### Cursor prompt
```
In src/pages/learning/LearningPlayer.tsx, where the module kind is displayed:

  <span className="text-xs text-neutral-500">
    ~{current.durationMinutes} min · {current.kind}
  </span>

Replace {current.kind} with a Norwegian label:

const KIND_LABELS: Record<string, string> = {
  flashcard: 'Flashkort',
  quiz: 'Quiz',
  text: 'Lese',
  image: 'Bilde',
  video: 'Video',
  checklist: 'Sjekkliste',
  tips: 'Tips',
  on_job: 'I praksis',
  event: 'Arrangement',
  other: 'Annet',
}

<span className="text-xs text-neutral-500">
  ~{current.durationMinutes} min · {KIND_LABELS[current.kind] ?? current.kind}
</span>
```

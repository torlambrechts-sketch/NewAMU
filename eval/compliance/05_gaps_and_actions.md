# Compliance Pass — 05: Prioritised Gaps & Cursor Action Prompts

**Role:** Compliance officer  
**Use:** Copy each Cursor prompt directly into Cursor agent mode to implement the fix.

---

## GAP-C01 — Verneombud 40-hour tracking

**Severity:** Critical  
**File(s):** `src/hooks/useLearning.ts`, `src/pages/learning/LearningComplianceMatrix.tsx`  
**Regulation:** AML § 6-5

### Current state
The module tracks binary module completion only. No accumulation of hours per role.

### Required state
- Learning path tagged `verneombud` accumulates `durationMinutes` across completed modules
- Separate KPI showing: `X / 2400 min (40 h)` completed for verneombud track
- Red/orange/green status based on completion threshold

### Cursor prompt
```
In src/pages/learning/LearningParticipants.tsx and src/hooks/useLearning.ts:

Add a "Verneombud 40h compliance" section. For each user where profile has is_safety_rep=true,
sum durationMinutes of all completed modules in courses tagged 'verneombud'.
Show progress toward 2400 minutes (40 hours) required by AML § 6-5.
Display as a KPI card: "X min / 2400 min (40 t)" with color: red <1200, amber 1200-2399, green ≥2400.
Add this KPI to the LearningComplianceMatrix page alongside the existing heatmap.
```

---

## GAP-C02 — Auto-assign mandatory courses by role

**Severity:** Critical  
**File(s):** `src/hooks/useLearning.ts`, `src/pages/learning/LearningPathsPage.tsx`  
**Regulation:** AML § 6-5, AML § 7-4

### Current state
Learning paths support `rules` (metadata key/value), but there is no auto-enrollment visible in the UI and no UI for verneombud or AMU member mandatory assignment.

### Required state
- When a user has `profile.is_safety_rep = true`, the `verneombud` learning path auto-enrolls them
- When a user is an AMU member (from council module), they are auto-enrolled in `amu-opplaering` path
- In-app banner to learner: "Du er verneombud — du har lovpålagt opplæring. Start her →"

### Cursor prompt
```
In src/pages/learning/LearningDashboard.tsx:

Add a compliance alert section at the top (before featured courses).
Use useLearning() to get pathEnrollments and learningPaths.
Use useOrgSetupContext() to get profile.

If profile has metadata is_safety_rep=true AND no enrollment exists for a path with slug containing 'verneombud':
  Show a yellow banner: "Du er valgt som verneombud og har lovpålagt grunnopplæring (AML § 6-5 — minst 40 timer).
  [Start opplæring →]" linking to /learning/paths.

If profile has metadata is_amu_member=true AND no enrollment exists for a path with slug containing 'amu':
  Show a blue banner: "Som AMU-medlem har du rett og plikt til opplæring (AML § 7-4).
  [Se læringsløp →]" linking to /learning/paths.

Style with the existing amber/blue banner pattern used elsewhere in the app.
```

---

## GAP-C03 — Version-bump invalidates old certificates

**Severity:** High  
**File(s):** `src/hooks/useLearning.ts` (bumpCourseVersion), `src/pages/learning/LearningCertifications.tsx`  
**Regulation:** IK-forskriften § 5(4)

### Current state
`bumpCourseVersion` increments version in DB but does not update `learning_certification_renewals`.

### Required state
After bumping, all existing certificates for this course get a renewal record with `status = 'expired'`.
`LearningCertifications.tsx` shows a "Fornyelse påkrevd" badge per affected row.

### Cursor prompt
```
In src/hooks/useLearning.ts, update the bumpCourseVersion function:

After the successful RPC call to learning_bump_course_version, call a new RPC:
  supabase.rpc('learning_mark_certs_for_renewal', { p_course_id: courseId })

This RPC (create the SQL separately) should:
  INSERT INTO learning_certification_renewals (organization_id, user_id, course_id, certificate_id, expires_at, status)
  SELECT organization_id, user_id, course_id, id, now(), 'expired'
  FROM learning_certificates
  WHERE course_id = p_course_id
  ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'expired', expires_at = now();

In src/pages/learning/LearningCertifications.tsx:
Add a column "Status" that shows a red badge "Fornyelse påkrevd" when certificationRenewals contains a matching expired record for that certificate.
```

---

## GAP-C04 — Printable certificate with legal fields

**Severity:** High  
**File(s):** `src/pages/learning/LearningCertifications.tsx`  
**Regulation:** AML § 6-5 documentation, IK-forskriften § 5, Arbeidstilsynet inspection

### Current state
Only a data table — no printable document.

### Required state
Print-friendly certificate page per certificate ID with all required fields.

### Cursor prompt
```
Create a new page src/pages/learning/LearningCertificatePrintPage.tsx.

Route: /learning/certificates/:certId/print (add to App.tsx router, nested under LearningLayout or standalone).

The page fetches the certificate from useLearning().certificates by certId param.
It also needs organization name from useOrgSetupContext().organization.name.
It needs courseVersion and a lawRef (stored as a tag on the course, e.g. tag starting with 'lovref:').

Render a print-optimised certificate with:
- Klarert logo / organisation name top-right
- Title: "KURSBEVIS / OPPLÆRINGSBEVIS" (Source Serif 4, 28px)
- Fields: Kurs, Deltaker, Organisasjon, Gjennomført (dd.MM.yyyy), Versjon, Lovhjemmel (from tag), Gyldig til, Verifiser (verifyCode)
- A green/forest coloured bottom bar with verify code and verification URL
- print:hidden on all nav/shell elements
- A "Skriv ut" button that calls window.print()

In src/styles/print.css add:
@media print { nav, .topbar, .page-tabs { display: none !important; } }
```

---

## GAP-C05 — GDPR right to erasure

**Severity:** High  
**File(s):** `src/hooks/useLearning.ts`, `src/pages/learning/LearningSettings.tsx`  
**Regulation:** GDPR Art. 17, Personopplysningsloven

### Current state
No user-triggered or admin-triggered deletion of all learning data for a user.

### Required state
- Admin (learning.manage) can delete all learning data for a specific user ID
- Learner can request deletion of their own data (sends request or directly deletes progress/certs)

### Cursor prompt
```
In src/hooks/useLearning.ts, add a new exported function:

  deleteUserLearningData: async (targetUserId: string) => { ok, error }

  If not canManage and targetUserId !== userId, return error 'Ikke tilgang'.
  Call supabase.rpc('learning_delete_user_data', { p_user_id: targetUserId }).
  On success, call refreshLearning().

In src/pages/learning/LearningSettings.tsx, add a "Slett brukerdata (GDPR)" section visible only to canManage:
  Input for user ID or email search.
  Button "Slett alle opplæringsdata for denne brukeren" with confirm dialog.
  Show confirmation with what will be deleted: progress rows, certificates, quiz reviews, ILT RSVPs.

Also add to the learner's own view (when !canManage):
  "Be om sletting av mine opplæringsdata" button that submits a deletion request or directly deletes own rows.
```

---

## GAP-C06 — Arbeidstilsynet inspection export (CSV)

**Severity:** High  
**File(s):** `src/pages/learning/LearningSettings.tsx`  
**Regulation:** Arbeidstilsynet inspection requirements

### Current state
JSON export only, not human-readable, no expiry status.

### Required state
CSV export: `employee | course | completed_at | course_version | expires_at | status`  
Plus a printable HTML summary page.

### Cursor prompt
```
In src/pages/learning/LearningSettings.tsx, add a new section "Arbeidstilsynet — tilsynseksport":

Add a function exportInspectionCsv() that:
1. Takes progress, certificates, certificationRenewals, courses from useLearning()
2. For each certificate, builds a row:
   learner_name, course_title, completed_at (ISO), course_version,
   expires_at (from matching renewal or 'Ingen utløpsdato'), status (from renewal or 'Gyldig')
3. Outputs as CSV with BOM (for Excel compatibility: ﻿ prefix)
4. Filename: `klarert-tilsynseksport-${date}.csv`

Add a "Last ned tilsynseksport (CSV)" button styled as btn-secondary.
Add helper text: "Inneholder alle gjennomførte kurs, sertifikatversjon og utløpsstatus. Klar for Arbeidstilsynet-inspeksjon."
```

---

## GAP-C07 — K-anonymity for department leaderboard

**Severity:** Medium  
**File(s):** `src/pages/learning/LearningDashboard.tsx`  
**Regulation:** GDPR Art. 5(1)(c) data minimisation

### Cursor prompt
```
In src/pages/learning/LearningDashboard.tsx, in the department leaderboard section (lines ~168-189):

Before rendering each department row, filter out departments where d.memberCount < 5.

Add a note below the list:
  "Avdelinger med færre enn 5 medarbeidere vises ikke for å ivareta personvern (GDPR art. 5)."

Apply the same filter in src/hooks/useLearning.ts where departmentLeaderboard is constructed,
or handle it purely in the display component.
```

---

## GAP-C08 — Privacy notice at first data collection

**Severity:** High  
**File(s):** `src/pages/learning/LearningPlayer.tsx`, `src/pages/learning/LearningCoursesList.tsx`  
**Regulation:** GDPR Art. 13

### Cursor prompt
```
In src/pages/learning/LearningCoursesList.tsx, add a collapsible privacy notice above the course grid.

Show it only once per session (use sessionStorage key 'learning-privacy-ack').
Content (Norwegian):
  "Klarert lagrer din læringsfremdrift, kursresultater og sertifikater på vegne av din arbeidsgiver
   som ledd i dokumentasjon av opplæring (AML § 3-1, IK-forskriften § 5).
   Grunnlaget er arbeidsavtalen (GDPR art. 6(1)(b)).
   Du kan be om innsyn i eller sletting av dine data under Innstillinger."

Include a dismiss button "Jeg forstår" that sets sessionStorage and hides the banner.
Style as a forest-soft (--forest-soft / emerald-50) info banner.
```

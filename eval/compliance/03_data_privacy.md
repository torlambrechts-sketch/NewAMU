# Compliance Pass — 03: Data Privacy (GDPR / Personopplysningsloven)

**Role:** Compliance officer  
**Focus:** Personal data handling in the e-learning module under GDPR and Norwegian law

---

## Legal basis assessment

Training records about named employees constitute **personal data** under GDPR Article 4(1).  
Sensitive categories (Article 9) are not typically involved in standard e-learning, but **quiz answers revealing health/safety knowledge gaps** could be argued sensitive in context.

### Legal bases available

| Processing | Likely legal basis | GDPR Article |
|-----------|-------------------|-------------|
| Progress tracking (employer use) | Legitimate interest / employment contract | Art. 6(1)(b) or (f) |
| Certificate issuance with name | Employment contract obligation | Art. 6(1)(b) |
| Spaced repetition (wrong answers stored) | Legitimate interest | Art. 6(1)(f) — **requires balancing test** |
| Leaderboard / department comparison | Legitimate interest | Art. 6(1)(f) — **needs anonymisation threshold** |
| External certificate storage (file upload) | Employment contract | Art. 6(1)(b) |

---

## Current GDPR gaps

### 1. No documented legal basis in UI

**Severity: High**

There is no privacy notice or processing disclosure shown to learners when they:
- Begin a course (progress tracked)
- Complete a quiz (wrong answers stored for spaced repetition)
- Submit external certificate (file with personal data)

**Required:** Privacy notice (short) before first data collection, linking to organisation's privacy policy.

---

### 2. `learnerName` on certificates — no validation

**Severity: Medium**

`LearningPlayer.tsx` lines 328-350: User types any name before certificate issuance.  
When using Supabase backend, the RPC `learning_issue_certificate` uses `p_learner_name` which is stored permanently.

**Issues:**
- No validation that name matches authenticated user (risk of impersonation)
- Name is stored indefinitely — no retention policy

**Required:** For authenticated users, auto-populate from `profile.display_name`; do not allow freetext override in production. Add `issued_at` + `expires_at` driven retention.

---

### 3. Wrong-answer storage (spaced repetition) — balancing test missing

**Severity: Medium**

`useLearning.ts` lines 1372-1390: `learning_quiz_reviews` table stores each incorrect answer with `question_id`, `user_id`, `course_id`, `module_id`.

This is a legitimate pedagogical tool, but:
- No retention period (items are dismissed by hand or never)
- No automated deletion after e.g. 12 months
- Not disclosed in any privacy notice

**Required:**
- Automated deletion after configurable retention period (default: 12 months)
- Disclosed in privacy notice

---

### 4. Department leaderboard — k-anonymity not enforced in UI

**Severity: Medium**

`LearningDashboard.tsx` lines 168-189: Department leaderboard shows completion % with member count.

There is a `orgSurveyKAnonymity.ts` file in the codebase (noted for surveys), but it is **not applied to the learning leaderboard**.

If a department has 1–2 people, the completion % is effectively individual data.

**Required:** Apply k-anonymity threshold (minimum k=5, same as survey module) — suppress departments with fewer than 5 members.

---

### 5. No right-to-erasure flow

**Severity: High**

GDPR Art. 17 gives data subjects the right to erasure. There is no UI or API mechanism for:
- A learner to request deletion of their progress data
- HR to delete all training data for a departed employee
- Automated deletion when employment ends

**Required:**
- Admin function: delete all learning data for a user ID
- Auto-deletion trigger (or scheduled job) on offboarding event

---

### 6. External certificate file storage — no access control validation documented

**Severity: High**

`LearningExternalTraining.tsx` + `useLearning.ts` lines 1717-1741:  
Files are uploaded to Supabase storage bucket `learning_external_certs` under path `{userId}/{uuid}.{ext}`.

Issues:
- No RLS verification documented in evaluation (bucket policy not visible in frontend code)
- Manager `approveExternalCertificate` can access any certificate — no scope check in frontend
- No virus scan or file-type whitelist beyond client-side MIME check

**Required:**
- Confirm Supabase bucket has RLS: user can only read own files; manager can read org files
- Server-side file-type validation in Edge Function
- Audit log entry when manager views/downloads a certificate file

---

## Summary gap table

| Gap | GDPR Article | Severity |
|----|-------------|----------|
| No privacy notice at data collection | Art. 13 | **High** |
| Learner name freetext — impersonation risk | Art. 5(1)(d) accuracy | **High** |
| No right-to-erasure mechanism | Art. 17 | **High** |
| Wrong-answer retention undefined | Art. 5(1)(e) storage limitation | Medium |
| Leaderboard k-anonymity not enforced | Art. 5(1)(c) data minimisation | Medium |
| External cert file access control unverified | Art. 32 security | **High** |
| No retention schedule for training records | Art. 5(1)(e) | Medium |

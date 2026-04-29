# Compliance Pass — 04: Certificate Requirements

**Role:** Compliance officer  
**Focus:** What a legally credible training certificate must contain for Norwegian workplaces

---

## What Arbeidstilsynet expects on a training certificate

When used as evidence of compliance (especially for verneombud training, equipment operators, chemical handling), a certificate must contain:

| Field | AML / IK basis | Current implementation |
|-------|---------------|----------------------|
| Learner's full name | Identity proof | ✅ `learnerName` (freetext — see GDPR gap) |
| Course title | Traceability | ✅ `courseTitle` |
| Completion date | Timing proof | ✅ `issuedAt` |
| Content version at completion | IK § 5 revision tracking | ✅ `courseVersion` |
| Issuing organisation | Who is responsible | ❌ Not stored — only `organization_id` UUID |
| Legal basis / law reference | Relevance to regulation | ❌ Not stored or displayed |
| Instructor / supervisor (where required) | Accountability | ❌ Not on certificate |
| Expiry date (where relevant) | Renewal tracking | ❌ Not on certificate (only on renewal record) |
| Unique verify code | Anti-forgery | ✅ `verifyCode` (8-char) |
| QR or URL for verification | Digital verification | ❌ No public verification endpoint |
| Score (for knowledge-based courses) | Proficiency evidence | ✅ `score` on progress record (not on cert) |

---

## Certificate display issues

### Current state (`LearningCertifications.tsx`)
The certificates page shows a table with: Course, Learner, Issued, Version, Verify code.

**Missing:**
- No printable/downloadable certificate document (PDF)
- No visual certificate (suitable for wall mounting / portfolio)
- Score is not shown on the certificate record
- Organisation name not on certificate
- Expiry date not shown

### Required certificate format

A printable certificate should include:
```
KURSBEVIS / OPPLÆRINGSBEVIS

Kurs:           [courseTitle]
Deltaker:       [learnerName]
Organisasjon:   [organization.name]
Gjennomført:    [issuedAt formatted as dd.MM.yyyy]
Versjon:        v[courseVersion]
Gyldig til:     [expiresAt or "Ingen utløpsdato"]
Lovhjemmel:     [e.g. AML § 6-5 / IK-forskriften § 5]
Verifiser:      [verifyCode] | [verification URL]
```

---

## Certificate versioning and invalidation

### Current state
- `courseVersion` is bumped manually via "Øk versjon" button in `LearningCourseBuilder.tsx`
- Existing certificates retain their `courseVersion` — correct
- But there is **no mechanism to alert learners** that their certificate is based on an old version
- Managers have no view showing "certificate version mismatch" per employee

### IK-forskriften § 5 requirement
When training content changes materially, employers must **reassess competence**. This means:
- Version bump must trigger a "renewal required" flag on existing certificates
- Learner must be notified and re-enrolled automatically

### Required additions
1. `learning_certification_renewals` table already exists — populate it on `bumpCourseVersion`
2. Renewal status visible on `LearningCertifications.tsx` per row
3. Learner notification (in-app banner or email) when renewal required
4. `LearningComplianceMatrix.tsx` heatmap cell shows orange when cert exists but is stale version

---

## Public verification endpoint

### Requirement
Certificates shown to third parties (new employers, clients, Arbeidstilsynet) should be **independently verifiable**.

### Current state
`verifyCode` exists but there is no public URL like `/verify/[code]` that shows:
- "This certificate is valid" or "This certificate has been revoked"
- Issued to: [name], Course: [title], Date: [date]

### Required additions
1. Public route `/verify/[verifyCode]` (no auth required)
2. Edge Function or server-side rendering for verification
3. Shows: validity status, course title, issue date, organisation name (not learner PII beyond name they consented to show)

---

## Summary gap table

| Gap | Severity | Action |
|----|---------|--------|
| Organisation name missing from certificate | **High** | Add `organization.name` to cert record at issuance |
| Legal basis / law ref not on certificate | **High** | Optional `lawRef` field on course → printed on cert |
| No printable/PDF certificate | **High** | Implement print-CSS certificate template |
| Score not shown on certificate | Medium | Add `score` column to certs table view |
| Expiry date not on certificate | Medium | Show `expiresAt` from renewal record |
| No public verification endpoint | Medium | Add `/verify/[code]` route |
| Version bump does not auto-flag old certs | **High** | Trigger renewal on bumpCourseVersion |
| No learner notification on renewal required | **High** | In-app alert + optional email |

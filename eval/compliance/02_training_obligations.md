# Compliance Pass — 02: Training Obligations & Documentation

**Role:** Compliance officer  
**Focus:** Specific training obligations under Norwegian law that the e-learning module must enforce

---

## AML § 6-5 — Verneombud (Safety Representative) Training

### Requirement
Verneombud must receive at least **40 hours of training** in systematic HMS work before or shortly after election.  
Employer is obligated to **pay for and document** this training.

### Current state
- No concept of "safety representative role" in the learning module
- No hour-accumulation tracking (only binary module completion)
- No mandatory course assignment based on verneombud role
- No 40-hour compliance dashboard for HR/manager

### Required additions
1. `durationMinutes` per module must sum to ≥ 2400 minutes (40 h) for verneombud track
2. Learning path tagged `verneombud` must trigger mandatory enrollment when `profile.is_safety_rep = true`
3. Compliance dashboard shows: hours accumulated / 40 h required, remaining gap
4. Certificate must state "Grunnopplæring verneombud — AML § 6-5"

---

## AML § 7-4 — AMU Member Training

### Requirement
AMU members must receive **necessary training** to fulfil their duties.  
Law does not specify minimum hours, but Arbeidstilsynet expects documented training on AMU rules, meeting procedures, and HMS fundamentals.

### Current state
- No role-gated mandatory course for AMU members
- No linkage between `council` module (AMU) and `learning` module

### Required additions
1. System course tagged `amu-member-training` auto-assigned to AMU member profiles
2. Completion linked back to AMU compliance checklist in `norwegianLabourCompliance.ts`

---

## IK-forskriften § 5(4) — Competence Documentation

### Requirement
Virksomheten (employer) must ensure **documented competence** exists for all safety-critical roles and tasks.  
This is a systematic requirement — point-in-time certificates are insufficient if content changes.

### Current state
- `courseVersion` is stored on certificates — this is good
- But there is no mechanism to **invalidate old certificates** when course version is bumped
- No "competence card" view showing all current valid training per employee

### Required additions
1. When `bumpCourseVersion` is called, mark existing certificates as `pending_renewal`
2. Competence card page: one view per employee showing all training, version, and expiry
3. Manager view: list of employees with expired/pending-renewal competence

---

## Maskinforskriften / Equipment-Specific Training

### Requirement
Training for operating specific machinery (trucker, kran, etc.) must be:
- Role/equipment specific
- With documented practical + theoretical components
- Renewed at defined intervals

### Current state
- `on_job` module type exists — suitable for practical component documentation
- No equipment tagging on courses
- No linkage to specific machines/assets

### Required additions
1. Optional `equipmentTag` field on courses (e.g., `truck`, `forklift`, `crane`)
2. Arbeidstilsynet export filtered by equipment tag for inspection readiness

---

## Arbeidstilsynet Inspection Readiness

### Requirement
On inspection, employer must present within 48 hours:
- Who received training
- When
- What content
- Whether they passed
- Whether training is still valid (not expired)

### Current state
- JSON export available (`LearningSettings.tsx`) — not human-readable
- No per-employee printable training transcript
- `expiresAt` field not surfaced in UI
- No "inspection package" one-click export

### Required additions
1. Printable **employee training transcript**: name, courses, dates, versions, status
2. **Inspection export** (CSV): `employee | course | completed_at | version | expires_at | status`
3. Alert in `LearningCertifications.tsx` when certificates have expired or are expiring within 30 days

---

## Summary gap table

| Obligation | Law ref | Severity | Gap |
|-----------|---------|----------|-----|
| Verneombud 40h tracking | AML § 6-5 | **Critical** | Hour accumulation not tracked |
| Mandatory verneombud enrollment | AML § 6-5 | **Critical** | No auto-assign by role |
| AMU member training track | AML § 7-1, 7-4 | **High** | Not linked to council module |
| Version-invalidated certificate | IK-forskriften § 5 | **High** | Old certs not marked stale |
| Competence card per employee | IK-forskriften § 5 | **High** | Missing view |
| Inspection export (CSV + printable) | Arbeidstilsynet | **High** | JSON only, not human readable |
| Equipment tagging | Maskinforskriften | Medium | No tag/filter |
| 48h readiness | Arbeidstilsynet | Medium | No one-click package |

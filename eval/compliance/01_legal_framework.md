# Compliance Pass — 01: Legal Framework Overview

**Role:** Compliance officer  
**Focus:** Identifying all Norwegian labour law obligations relevant to an e-learning module in a workplace safety platform

---

## Applicable law

### Core statutes

| Law | Relevance to e-learning |
|-----|------------------------|
| **Arbeidsmiljøloven (AML) § 3-1** | Employer must conduct systematic HMS work — training is a documented component |
| **AML § 3-2 (1) litra b** | Employer shall ensure adequate training for working with hazardous work/equipment — must be documented |
| **AML § 6-5** | Verneombud must receive at least 40 hours of documented training |
| **AML § 7-1** | AMU member training obligation — AMU members must receive necessary training |
| **AML § 14-2 (5)** | Workers must be informed of rights and conditions — includes training entitlements |
| **AML § 15-9** | Prohibition of unfair dismissal — training records used as evidence in disputes |
| **AML kap. 4** | Requirements for physical and psychosocial work environment — training = preventive measure |
| **Forskrift om internkontroll (IK-forskriften, FOR 1996-12-06 nr 1127) § 5** | Systematic HMS work must be documented — training is part of § 5(4) competence requirement |
| **Forskrift om organisering, ledelse og medvirkning (FOR 2011-12-06 nr 1355)** | Chapter 3 on training and instruction for specific risk roles |
| **Opplæringsforskriften / Maskinforskriften** | Equipment-specific training with documented competence |
| **GDPR / Personopplysningsloven** | All personal data from training (progress, scores, names) requires legal basis, retention policy, data subject rights |
| **Arbeidstilsynet inspections** | Can demand training records within 48 hours — digital records must be exportable |
| **Tariffavtaler (e.g. Hovedavtalen NHO/LO)** | May impose additional training rights or co-determination on training programmes |

### Key principle

> Norwegian law requires training to be **documented, traceable, and retrievable**. The certificate + completion record must survive the employee relationship and be accessible to Arbeidstilsynet on demand.

---

## Regulatory tiering

### Tier 1 — Legally mandatory (violations attract fines / enforcement)
- Verneombud 40-hour training documentation (AML § 6-5)
- AMU member training documentation (AML § 7-1 + AML § 7-4)
- Equipment-specific operator training (Maskinforskriften)
- IK-forskriften § 5(4): competence records as part of systematic HMS

### Tier 2 — Best practice / inspection triggers
- General onboarding training records (AML § 3-1)
- Training for hazardous work (AML § 3-2)
- Renewal/recertification tracking

### Tier 3 — Risk management
- GDPR retention and deletion rights for training data
- Anonymisation of leaderboard / benchmark data
- Audit trail for certificate issuance and revocation

---

## Current module coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Course completion records | ✅ Implemented | `learning_course_progress` table |
| Certificate issuance | ✅ Implemented | `learning_certificates` table with `verify_code` |
| Certificate versioning | ✅ Implemented | `courseVersion` on certificate |
| Recertification tracking | ⚠️ Partial | `recertificationMonths` stored, no automated expiry alert to learner |
| Verneombud 40h tracking | ❌ Missing | No hour-accumulation logic per role |
| AMU member training | ❌ Missing | No role-gated mandatory course assignment |
| IK-forskriften competence record | ⚠️ Partial | Completion stored, but no printable competence card |
| Arbeidstilsynet export | ⚠️ Partial | JSON export exists but no formatted PDF/CSV audit report |
| GDPR data minimisation | ❌ Missing | `learnerName` stored on cert without documented legal basis |
| GDPR retention policy | ❌ Missing | No automated deletion after retention period |
| GDPR right to erasure | ❌ Missing | No user-triggered deletion flow |
| Audit trail for training edits | ❌ Missing | No immutable log when course content changes after certification |

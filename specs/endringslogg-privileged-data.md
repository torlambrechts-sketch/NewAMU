# Endringslogg — privileged-data classification

When a mutation emits an audit event with `privileged: true`, the
`audit_events_read` view masks the diff and summary for any reader
without the `audit.read.privileged` permission. The row itself
(actor, action, timestamp) stays visible so the trail is still
provable; only the *content* is redacted.

This doc is the **authoritative classification**. Engineers wiring a
mutation that *might* be sensitive look here first. Legal + product
own the entries below; engineering owns translating them into code.

Reviewer sign-off: each entry needs initials + date when added or
changed. Drift is a leakage risk.

---

## Per-module classification

### compliance_checklist (W1 — shipped)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| All mutations | — | **no** | Checklists are operational HMS records, not HR-sensitive. | TBD |

Exception: when a finding references a named individual's
performance, the response body may surface HR data. **Mitigation**:
the privileged flag *can* be set per-event by the saveResponse
caller if the upstream form marks the row as confidential. Currently
no such UI exists; revisit when sjekkliste templates add a
"personrelatert" field type.

### survey (W1)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| All mutations | — | **no** | Surveys are pre-anonymised; k-anonymity floor at aggregation. | TBD |

Exception: response-level events (`besvart`) on **non-anonymous**
campaigns where the respondent is identifiable. Pass
`privileged: true` for those. Detect via
`campaign.respondent_identification = 'identified'`.

### meetings (W2)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| `createMeeting` | `confidentiality_level in ('drøfting','varsling','mus','pgop')` | **yes** | AML § 8-3 + § 15-1 (drøftelse) — names + topic must not leak to non-committee readers. | TBD |
| `setAgendaItem` | parent meeting's confidentiality OR item's own override | **yes** | Same. | TBD |
| `setDecision` | parent meeting's confidentiality | **yes** | Vedtak on drøftelsesmøter carry HR data. | TBD |
| `castVote` | parent meeting's confidentiality | **yes** | Vote direction reveals committee position; legally protected. | TBD |
| `signProtocol` | always | **no** | The *fact* of signing is public-record by AML § 7-2 (4). | TBD |
| `addAttendee` / `removeAttendee` | parent meeting's confidentiality | **yes** | Attendee list of a drøftelsesmøte is itself sensitive. | TBD |
| `setRsvpStatus` | parent meeting's confidentiality | **yes** | Same. | TBD |
| `sendInvitations` (`innkalt`) | parent meeting's confidentiality | **yes** | Recipient list. | TBD |
| `sendDigest` (`delt`) | always | **no** | Recipients see a redacted summary anyway. | TBD |
| GDPR redaction | always | **yes** | The redaction *itself* is privileged; reveals what was redacted. | TBD |

### tasks (W3)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| All mutations | `task.confidentiality = 'restricted'` OR `'confidential'` | **yes** | Tilsynsbrev-spawned tasks + HR-flagged tasks per `tasks.view_confidential` perm. | TBD |
| All mutations | otherwise | **no** | Default task is operational. | TBD |

### documents (W3)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| `updatePage` body diff | `page.legal_basis` array contains `'AML § 2A'`, `'AML § 14-G'`, `'AML § 15-1'`, or any `'GDPR Art.'` ref | **yes** | Pages with these legal bases hold HR/varsling content. | TBD |
| `updatePage` metadata (title, tags) | always | **no** | Metadata is intentionally indexable. | TBD |
| All other mutations | by default | **no** | Most wiki content is intentionally org-wide-readable. | TBD |

### alerts (W4)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| **All mutations** | always | **yes** | Default-true. AML § 2A-7 + GDPR Art. 9 — varsling cases are special-category data. Only `alerts.committee_confidential` + `alerts.dpo` readers see diff content. | TBD |

Special rule: `actor_name` for an `actor.role='ekstern'` case
**MUST** be `'Anonym varsler'` server-side when
`alert_cases.reporter_is_anonymous = true`. The client cannot
override this — enforced inside the alerts-specific `emit_*`
wrapper. Covered by unit test `alerts/audit-anonymity.test.ts` in
the wave-4 PR.

### learning (W5)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| All mutations | — | **no** | Certification dates + course versions are intentionally transparent. | TBD |

Exception: certification revocation events (planned for W5+) on
named individuals should be privileged since the revocation reason
may carry HR context. Add when the revocation flow ships.

### registers (W5)

| Mutation | Trigger | Privileged? | Rationale | Sign-off |
|---|---|---|---|---|
| Injury logs (`register_type.slug` matches `'skadelogg'`, `'narrt-skadet'`) | always | **yes** | AML § 5-2 — injury data is medical. | TBD |
| Near-miss logs | by default | **no** | Pattern-data; not personal. | TBD |
| Risk registers | by default | **no** | Operational. | TBD |
| Custom registers | classifier choice per register_type | **decided by admin** | New register types prompt admin for privilege classification at creation; stored on `register_types.is_privileged boolean`. | TBD |

---

## How engineers consume this

```ts
import { isPrivileged } from '@/lib/audit/privilege'

void emitAuditEvent(supabase, {
  scopeId: 'meetings',
  entityKind: 'meeting',
  entityId: meeting.id,
  actorName,
  action: 'votert',
  summary: { kind: 'preset', preset: 'mote_votert', subject: voteLabel },
  diff,
  privileged: isPrivileged.meeting(meeting, 'castVote'),
  // ^ classified: <classifier-initials>  ← lint rule looks for this
})
```

The lint rule (see `eslint-rules/audit-privileged-classification.js`)
requires that any `privileged: true` literal is paired with a
`// classified:` comment within 3 lines, *or* the value comes from a
call to `isPrivileged.*` (whitelisted). Inline `true` without
classification fails CI.

---

## Change protocol

To add or change a privileged classification:

1. Open a PR titled `privileged-classification: <module>`.
2. Update the relevant row(s) above; include the new sign-off
   initials + date.
3. Update `src/lib/audit/privilege.ts` if a new programmatic
   classifier is added.
4. Request review from one product + one legal stakeholder. Two
   reviewers needed; merge requires both.
5. Mention in the PR description which mutation paths now emit
   differently and link the test that proves it.

A classification change is **not** a backwards-compatible operation:
historical rows keep the privilege flag they were emitted with. If
sensitivity changes for an entire entity class, run a one-off SQL
to flip the historical rows + document the flip in this file.

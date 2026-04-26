# Step 3 — Types

**Replace** `modules/amu/types.ts` entirely with the content below.
Also delete `modules/amu/schema.ts` — its parsing helpers are replaced by Zod `.parse()`.

Depends on: nothing (pure TypeScript).

---

## `modules/amu/types.ts`

Copy verbatim from `Claude/NewAUM/02_TYPES.md` — the full file is already written there. Do not paraphrase; copy the exact schemas.

Checklist before saving:
- [ ] All six `z.object` schemas present: `amuCommitteeSchema`, `amuMemberSchema`, `amuMeetingSchema`, `amuAgendaItemSchema`, `amuDecisionSchema`, `amuComplianceStatusSchema`
- [ ] All enum schemas present: `amuSideSchema`, `amuRoleSchema`, `amuMeetingStatusSchema`, `amuAgendaSourceSchema`, `amuAgendaStatusSchema`, `amuAttendanceStatusSchema`, `amuReportStatusSchema`
- [ ] Six `export type` inferences at the bottom
- [ ] No leftover types from old file (`AmuParticipantRole`, `AmuMeetingChairSide`, `AvvikOption`, etc.)

---

## Additional types to append (not in 02_TYPES.md)

Add these after the inferred types:

```ts
export const amuTopicProposalSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  proposed_by: z.string().uuid().nullable(),
  target_meeting_id: z.string().uuid().nullable(),
  description: z.string().min(1, 'Påkrevd'),
  status: z.enum(['submitted','accepted','rejected','deferred']),
})
export type AmuTopicProposal = z.infer<typeof amuTopicProposalSchema>

export const amuAttendanceSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  meeting_id: z.string().uuid(),
  member_id: z.string().uuid(),
  status: amuAttendanceStatusSchema,
  joined_at: z.string().nullable(),
})
export type AmuAttendance = z.infer<typeof amuAttendanceSchema>

export const amuAnnualReportSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  committee_id: z.string().uuid(),
  year: z.number().int(),
  body: z.record(z.string(), z.string()),
  status: amuReportStatusSchema,
  signed_by_leader: z.string().uuid().nullable(),
  signed_by_deputy: z.string().uuid().nullable(),
  signed_at: z.string().nullable(),
})
export type AmuAnnualReport = z.infer<typeof amuAnnualReportSchema>

export interface AmuCriticalItem {
  item_type: 'unsigned_meeting' | 'draft_annual_report' | 'missing_meeting' | 'hms_training_expired'
  source_id: string
  organization_id: string
  label: string
  source_date: string | null
  severity: 'high' | 'medium' | 'low'
}
```

---

## Commit

```
feat(amu): replace types with new Zod schemas
```

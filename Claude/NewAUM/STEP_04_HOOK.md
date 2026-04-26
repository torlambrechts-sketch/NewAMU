# Step 4 — Hook

**Replace** `modules/amu/useAmu.ts` entirely.

Depends on: Step 3 (types must exist).

---

## `modules/amu/useAmu.ts`

Start from the skeleton in `Claude/NewAUM/03_HOOK.md` and fill in every `/* … */` stub below.

### Imports

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/contexts/OrgSetupContext'
import { supabase } from '../../src/lib/supabase'
import { getSupabaseErrorMessage } from '../../src/lib/errors'
import type {
  AmuCommittee, AmuMember, AmuMeeting, AmuAgendaItem,
  AmuDecision, AmuComplianceStatus, AmuAttendance,
  AmuTopicProposal, AmuAnnualReport, AmuCriticalItem,
} from './types'
```

### State

```ts
const [committee, setCommittee]       = useState<AmuCommittee | null>(null)
const [members, setMembers]           = useState<AmuMember[]>([])
const [meetings, setMeetings]         = useState<AmuMeeting[]>([])
const [agendaItems, setAgendaItems]   = useState<AmuAgendaItem[]>([])
const [decisions, setDecisions]       = useState<AmuDecision[]>([])
const [attendance, setAttendance]     = useState<AmuAttendance[]>([])
const [compliance, setCompliance]     = useState<AmuComplianceStatus | null>(null)
const [criticalQueue, setCriticalQueue] = useState<AmuCriticalItem[]>([])
const [annualReport, setAnnualReport] = useState<AmuAnnualReport | null>(null)
const [loading, setLoading]           = useState(true)
const [error, setError]               = useState<string | null>(null)
```

### `refresh()` — implement all five parallel fetches

```ts
const [c, m, mt, cs, cq] = await Promise.all([
  supabase.from('amu_committees').select('*')
    .eq('organization_id', organization.id).maybeSingle(),
  supabase.from('amu_members').select('*')
    .eq('organization_id', organization.id).eq('active', true),
  supabase.from('amu_meetings').select('*')
    .eq('organization_id', organization.id)
    .order('scheduled_at', { ascending: true }),
  supabase.from('amu_compliance_status').select('*')
    .eq('organization_id', organization.id)
    .eq('year', new Date().getFullYear()).maybeSingle(),
  supabase.from('amu_critical_queue').select('*')
    .eq('organization_id', organization.id),
])
```

Also fetch current year's annual report in `refresh()`:
```ts
const ar = await supabase.from('amu_annual_reports').select('*')
  .eq('organization_id', organization.id)
  .eq('year', new Date().getFullYear()).maybeSingle()
setAnnualReport(ar.data ?? null)
```

### Mutation stubs — implement each fully

**`scheduleMeeting(input: Partial<AmuMeeting>)`**
```ts
const { error } = await supabase.from('amu_meetings').insert({
  ...input,
  organization_id: organization.id,
  status: 'draft',
})
if (error) throw error
await refresh()
```

**`startMeeting(id: string)`**
```ts
const { error } = await supabase.from('amu_meetings')
  .update({ status: 'in_progress' }).eq('id', id)
if (error) throw error
await refresh()
```

**`completeMeeting(id: string)`**
```ts
const { error } = await supabase.from('amu_meetings')
  .update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id)
if (error) throw error
await refresh()
```

**`signMeeting(id: string, leaderId: string, deputyId: string)`** — requires `canChair`
```ts
if (!canChair) throw new Error('Ingen tilgang')
const { error } = await supabase.from('amu_meetings').update({
  status: 'signed',
  signed_at: new Date().toISOString(),
  signed_by_leader: leaderId,
  signed_by_deputy: deputyId,
}).eq('id', id)
if (error) throw error
await refresh()
```

**`recordDecision(input: Partial<AmuDecision>)`**
```ts
const { error } = await supabase.from('amu_decisions')
  .upsert({ ...input, organization_id: organization.id })
if (error) throw error
await refresh()
```

**`updateAttendance(meetingId: string, memberId: string, status: AmuAttendance['status'])`**
```ts
const { error } = await supabase.from('amu_attendance').upsert({
  organization_id: organization.id,
  meeting_id: meetingId,
  member_id: memberId,
  status,
})
if (error) throw error
await refresh()
```

**`generateAutoAgenda(meetingId: string)`**
```ts
// Calls a server-side RPC that populates amu_agenda_items from:
// standard items, open critical avvik, sick-leave aggregate,
// whistleblowing aggregate, inspection findings, HMS-plan items
const { error } = await supabase.rpc('amu_generate_auto_agenda', { p_meeting_id: meetingId })
if (error) throw error
await refresh()
```

**`proposeTopic(description: string, targetMeetingId?: string)`**
```ts
const { error } = await supabase.from('amu_topic_proposals').insert({
  organization_id: organization.id,
  description,
  target_meeting_id: targetMeetingId ?? null,
  status: 'submitted',
})
if (error) throw error
```

**`draftAnnualReport(year: number)`** — requires `canManage`
```ts
if (!canManage) throw new Error('Ingen tilgang')
const { error } = await supabase.rpc('amu_draft_annual_report', {
  p_organization_id: organization.id,
  p_year: year,
})
if (error) throw error
await refresh()
```

**`signAnnualReport(id: string, leaderId: string, deputyId: string)`** — requires `canChair`
```ts
if (!canChair) throw new Error('Ingen tilgang')
const { error } = await supabase.from('amu_annual_reports').update({
  status: 'signed',
  signed_at: new Date().toISOString(),
  signed_by_leader: leaderId,
  signed_by_deputy: deputyId,
}).eq('id', id)
if (error) throw error
await refresh()
```

### `loadMeetingDetail(meetingId: string)` — lazy load for Møterom

```ts
const loadMeetingDetail = useCallback(async (meetingId: string) => {
  const [ai, att, dec] = await Promise.all([
    supabase.from('amu_agenda_items').select('*')
      .eq('meeting_id', meetingId).order('position'),
    supabase.from('amu_attendance').select('*')
      .eq('meeting_id', meetingId),
    supabase.from('amu_decisions').select('*'),
  ])
  if (ai.error) throw ai.error
  setAgendaItems(ai.data ?? [])
  setAttendance(att.data ?? [])
  setDecisions(dec.data ?? [])
}, [])
```

### Return object

```ts
return {
  canManage, canChair, canPropose,
  committee, members, meetings, agendaItems, decisions,
  attendance, compliance, criticalQueue, annualReport,
  loading, error,
  refresh, loadMeetingDetail,
  scheduleMeeting, startMeeting, completeMeeting,
  signMeeting, recordDecision, updateAttendance,
  generateAutoAgenda, proposeTopic,
  draftAnnualReport, signAnnualReport,
}
```

---

## Commit

```
feat(amu): replace useAmu hook
```

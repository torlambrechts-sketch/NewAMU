# 03 · `useAmu` Hook

File: `modules/amu/useAmu.ts`

Single source of truth for the AMU module. UI components do **not** call Supabase directly.

```ts
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../src/contexts/OrgSetupContext'
import { supabase } from '../../src/lib/supabase'
import { getSupabaseErrorMessage } from '../../src/lib/errors'
import type {
  AmuCommittee, AmuMember, AmuMeeting, AmuAgendaItem,
  AmuDecision, AmuComplianceStatus
} from './types'

export function useAmu() {
  const { organization, can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('amu.manage')          // MANDATORY
  const canChair  = isAdmin || can('amu.chair')           // sign referat / årsrapport
  const canPropose = true                                 // any logged-in employee

  const [committee, setCommittee] = useState<AmuCommittee | null>(null)
  const [members, setMembers] = useState<AmuMember[]>([])
  const [meetings, setMeetings] = useState<AmuMeeting[]>([])
  const [compliance, setCompliance] = useState<AmuComplianceStatus | null>(null)
  const [criticalQueue, setCriticalQueue] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!organization?.id) return
    setLoading(true)
    setError(null)
    try {
      const [c, m, mt, cs, cq] = await Promise.all([
        supabase.from('amu_committees').select('*').eq('organization_id', organization.id).maybeSingle(),
        supabase.from('amu_members').select('*').eq('active', true),
        supabase.from('amu_meetings').select('*').order('scheduled_at', { ascending: true }),
        supabase.from('amu_compliance_status').select('*')
          .eq('year', new Date().getFullYear()).maybeSingle(),
        supabase.from('amu_critical_queue').select('*'),
      ])
      if (c.error) throw c.error
      if (m.error) throw m.error
      if (mt.error) throw mt.error
      setCommittee(c.data ?? null)
      setMembers(m.data ?? [])
      setMeetings(mt.data ?? [])
      setCompliance(cs.data ?? null)
      setCriticalQueue(cq.data ?? [])
    } catch (err) {
      setError(getSupabaseErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [organization?.id])

  useEffect(() => { refresh() }, [refresh])

  // ── mutations (all gated on canManage / canChair) ─────────────────
  const scheduleMeeting = async (input: Partial<AmuMeeting>) => { /* … */ }
  const startMeeting    = async (id: string) => { /* set status=in_progress */ }
  const recordDecision  = async (input: Partial<AmuDecision>) => { /* … */ }
  const signMeeting     = async (id: string) => { /* requires canChair */ }
  const generateAutoAgenda = async (meetingId: string) => {
    // server function fills agenda_items from:
    //   - standard items (godkjenning, referat, eventuelt)
    //   - open critical avvik
    //   - sick-leave aggregate (quarterly cadence)
    //   - whistleblowing aggregate
    //   - inspection findings
    //   - HMS-plan items per § 7-2 schedule
  }
  const proposeTopic    = async (description: string, target?: string) => { /* … */ }
  const draftAnnualReport = async (year: number) => { /* server function */ }
  const signAnnualReport  = async (id: string) => { /* requires canChair */ }

  return {
    canManage, canChair, canPropose,
    committee, members, meetings, compliance, criticalQueue,
    loading, error,
    refresh,
    scheduleMeeting, startMeeting, recordDecision, signMeeting,
    generateAutoAgenda, proposeTopic,
    draftAnnualReport, signAnnualReport,
  }
}
```

UI components render `error` via `<WarningBox>{error}</WarningBox>` — never `console.log`.

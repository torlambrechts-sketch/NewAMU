# NewAMU – Access Control & Data Restriction Analysis

> Deep analysis of the current access model across sensitive data domains.  
> Based on direct code review of: `permissionKeys.ts`, `useOrganisation.ts`, `sickLeaveAccess.ts`,  
> `incidentAccess.ts`, `workplaceCaseAccess.ts`, `useWhistleblowing.ts`, `useHrCompliance.ts`,  
> `orgSurveyKAnonymity.ts`.  
> Branch: `claude/org-module-review-Xq8M9` · Prepared: 2026-05-01

---

## 1. The Core Problem

The platform enforces access control at **two separate layers**:

| Layer | What controls it | Enforced by |
|-------|-----------------|-------------|
| Route/module access | `PERMISSION_KEYS` + `ROUTE_PERMISSION` | App router, nav guard |
| Record-level data access | Ad-hoc functions in `*Access.ts` files | App-side, client filter AFTER fetch |

**Critical gap**: Record-level rules run *after* the database has already returned data. If anyone bypasses the React layer (API client, Supabase dashboard, intercepted JWT), the DB returns all records for the organisation with no further restriction. The access functions are a UI affordance, not a security boundary.

This document maps every sensitive domain, identifies every gap, and provides concrete remediation recommendations.

---

## 2. Role Definitions – Current State vs What Is Needed

### 2.1 What exists today

The `role` field on an `OrgEmployee` is a free-text string stored in the organisation payload. Common values visible in seed data:

```
'Leder' | 'Fagansvarlig' | 'Fagmedarbeider' | 'Verneombud'
```

These strings drive access decisions via regex in `sickLeaveAccess.ts` and `incidentAccess.ts`:

```ts
const VO_HINTS = /verneombud|vernetjeneste|hms|sikkerhetsrepresentant/i
```

**This is fragile for three reasons:**

1. A user whose title is changed from "Verneombud" to "HMS-koordinator" silently loses routing to VO-relevant incidents.
2. A user whose title is set to "HMS og Verneombud" inadvertently gains or loses access depending on the exact regex.
3. The app fires the regex against `viewerJobHint` (the viewer's job title) – a field that comes from the employee record. An administrator editing that record changes access silently, with no audit trail.

### 2.2 What formal Norwegian roles require in law

| Role | Legal basis | Access implication |
|------|------------|-------------------|
| Verneombud | AML § 6-1, § 6-2 | Must be notified of: incidents (§ 6-2c), sick-leave trends (aggregated, not individual), relevant ROS/SJA | NOT individual sick-leave records (privacy) |
| Tillitsvalgt | TA-based (collective agreement) | Access to collective-level HR data; NOT individual medical records |
| AMU-representant | AML § 7-1 | Access to AMU meeting materials, aggregate health/safety data |
| Leder/nærmeste leder | AML kap. 2, § 4-2 | Individual sick-leave for own direct reports; incident follow-up as assigned case handler |
| HMS-ansvarlig (daglig leder) | AML § 3-1, IK-forskriften § 4 | Full system-level access is appropriate; maps to `isAdmin` |
| Varslingkomité | AML § 2A-5 | Exclusive access to varsling cases; maps to `whistleblowing.committee` |
| Datatilsynet / tilsyn | Personopplysningsloven | Audit export rights; no production login |

### 2.3 Recommended formal role taxonomy

Replace free-text `role` strings with a typed enum in both the DB schema and frontend:

```ts
// Proposed: src/types/organisation.ts
export type OrgEmployeeRole =
  | 'employee'          // default
  | 'team_lead'         // leder med rapporteringsansvar
  | 'department_head'   // avdelingsleder
  | 'executive'         // direktør / daglig leder → isAdmin in module context
  | 'verneombud'        // AML § 6-1 elected; grants VO-specific data routing
  | 'hoved_verneombud'  // AML § 6-1 (4) central VO
  | 'tillitsvalgt'      // TA-elected; no special data access beyond AMU materials
  | 'amu_member'        // AMU-representant (arbeidsgiver- or arbeidstakersiden)
  | 'amu_chair'         // AMU-leder
  | 'varsling_committee'// AML § 2A-5; maps to permission: whistleblowing.committee
  | 'hms_coordinator'   // administrative HMS-rolle
```

A typed enum:
- Makes the access-control regex unnecessary.
- Creates an auditable chain: role assignment event → access change.
- Allows Supabase RLS policies to check `org_employees.role` directly.

---

## 3. Employee / Personal Data (Organisation Module)

### 3.1 What data is exposed

Every `OrgEmployee` record contains:

| Field | Classification | GDPR Art. 9? |
|-------|---------------|--------------|
| name | Personal identifier | No |
| email | Personal contact | No |
| phone | Personal contact | No |
| jobTitle | Work metadata | No |
| role | Work metadata | No |
| location | Work metadata | No |
| employmentType | `permanent` / `temporary` / `agency` | No, but sensitive in labour-law context |
| startDate | Work metadata | No |
| reportsToId / reportsToName | Org structure | No |
| unitId / unitName | Org structure | No |
| active | Employment status | No |

No Art. 9 special-category data lives here today. However, **phone number and email are personal data under GDPR Art. 4(1)** and require a legitimate purpose to display.

### 3.2 Who can currently read this data

The `/organisation` route is **not listed in `ROUTE_PERMISSION`**. The fallback in `permissionForPath` returns `DASHBOARD_PERMISSION` = `'module.view.dashboard'`.

**Every user with `module.view.dashboard` can see the complete employee list including phone, email, start date, employment type, and reporting line.**

There is no permission key that scopes read access to employee PII.

### 3.3 Specific gaps

| Gap | Risk |
|-----|------|
| No `employee.pii.read` permission key | Contractors, external consultants with dashboard access see all employee contact details |
| Phone numbers displayed openly in employee table | AML § 9-3 duty of confidentiality may require restricting phone to the employee themselves and direct supervisors |
| `employmentType: 'agency'` workers visible to same audience as permanent employees | Agency staff (bemanningsbyrå) may have separate consent/disclosure requirements under AML § 14-12 |
| No audit log for employee record reads | GDPR Art. 30 requires a record of processing; read access to personal data is processing |
| Entire org payload fetched unconditionally via `fetchOrgModulePayload` | Backend must enforce organisation-scoped RLS; if RLS is absent, cross-org leakage is possible |

### 3.4 Recommendations

**Short term (app-side):**
- Add permission key `'employee.pii.read'` and gate the phone/email columns behind it.
- Default: employees can see their own record; managers can see direct reports; HR role sees all.
- Hide phone column from users who lack `employee.pii.read`.

**Medium term (DB):**
```sql
-- Proposed RLS on org_employees (or the JSONB payload table)
CREATE POLICY "org_employees_read" ON org_employees
  FOR SELECT USING (
    organization_id = get_my_organization_id()
    AND (
      auth.uid() = user_id                          -- own record
      OR is_admin_of_org(organization_id)           -- admin
      OR has_permission('employee.pii.read')        -- HR / VO
      OR is_direct_manager_of(id)                   -- line manager
    )
  );
```

**Long term:**
- Introduce column-level masking for phone/email: return `***@company.no` to users without PII permission, full value to those with it.

---

## 4. Sick Leave Data

### 4.1 What data is exposed

Sick-leave cases (`SickLeaveCase`) contain:
- `employeeId` – links to a named individual
- `managerEmployeeId` – the responsible manager
- Start/end dates, duration, type of absence
- Potentially: diagnosis-related fields (if collected) → **GDPR Art. 9 health data**

### 4.2 Current enforcement model

`canViewSickLeaveCase` in `sickLeaveAccess.ts` implements these rules:

```
isAdmin            → see all
VO_HINTS regex     → cannot see individual cases (correct direction)
legacy record      → visible to EVERYONE (backwards compat)
managerEmployeeId  → only matching manager
reportsToId chain  → immediate line manager
```

### 4.3 Gaps

**Gap 1: Legacy records visible to all**
```ts
const legacy = !sc.managerEmployeeId && !sc.employeeId
if (legacy) return true  // ← returns true for ANY viewer
```
Any user with module access can read pre-migration sick-leave cases. These are real employee health data, not demo records, in a live system.

**Gap 2: VO detection via job-title regex is not reliable**
```ts
if (ctx.viewerJobHint && VO_HINTS.test(ctx.viewerJobHint)) return false
```
- Changing a job title string can silently grant access to individual sick-leave records.
- The regex catches `hms` in any position – "HMS-koordinator" hits, but so would a title containing "HMS" that is not an elected VO.
- An elected Verneombud who transitions roles continues to have the access restriction even after losing the formal role.

**Gap 3: No DB-level enforcement**
The query that fetches sick-leave records returns all records for the organisation. Client-side filtering happens after transfer. Anyone with a valid JWT for the org and direct API access gets all records.

**Gap 4: No permission key for sick-leave access**
There is no `sick_leave.read` or `sick_leave.manage` key. Access is entirely implicit (admin) or relationship-based (manager hierarchy). There is no way to grant a dedicated HR role sick-leave access without making them an admin.

**Gap 5: Absence data is Art. 9 health data**
Sick leave, particularly long-term absences and pattern data, qualifies as **health data under GDPR Art. 9**. It requires explicit legal basis (AML § 4-6 or GDPR Art. 9(2)(b) employment law) and **must not be accessible without explicit authorisation**. The current legacy-visible path violates this.

### 4.4 Recommendations

**Immediate fixes:**
1. Remove the legacy-record open-access exception. Migrate old records by running a back-fill that sets `employeeId` from the employee list, and set `managerEmployeeId` to the employee's `reportsToId`. Records that cannot be matched should be visible only to admins.
2. Add a DB migration that sets a `created_by_user_id` backfill on all legacy records, defaulting to the org's primary admin.

**Permission model:**
```ts
// Add to PERMISSION_KEYS
'sick_leave.view'    // managers see own direct reports; VO sees aggregates only
'sick_leave.manage'  // HR role can create/update/delete; admin only
'sick_leave.export'  // can download sick-leave CSV (GDPR Art. 20 portability)
```

**Role-based access matrix for sick leave:**

| Role | Access |
|------|--------|
| Admin / HR manager | All cases, `sick_leave.manage` |
| Direct manager | Own direct reports only (enforced via `managerEmployeeId` OR `reportsToId`) |
| Verneombud (formal role) | Aggregate statistics only – no individual records |
| Employee | Own records only |
| All others | No access |

**DB-level enforcement:**
```sql
CREATE POLICY "sick_leave_read" ON sick_leave_cases
  FOR SELECT USING (
    organization_id = get_my_organization_id()
    AND (
      is_admin_of_org(organization_id)
      OR has_permission('sick_leave.manage')
      OR (
        has_permission('sick_leave.view')
        AND (
          manager_employee_id = get_my_employee_id()
          OR employee_id IN (
            SELECT id FROM org_employees
            WHERE reports_to_id = get_my_employee_id()
          )
        )
      )
      OR employee_id = get_my_employee_id()  -- own record always readable
    )
  );
```

**Aggregate-only view for Verneombud:**
```sql
CREATE VIEW sick_leave_unit_stats AS
SELECT
  organization_id,
  unit_id,
  DATE_TRUNC('month', period_start) AS month,
  COUNT(*) AS case_count,
  AVG(duration_days) AS avg_duration
FROM sick_leave_cases
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 5;  -- k-anonymity: suppress small groups
```

---

## 5. Whistleblower / Varsling Data

### 5.1 What data is exposed

`whistleblowing_cases` rows contain:
- Case description (the reported incident)
- `reporter_user_id` – NULL when anonymous, real UUID otherwise
- `reporter_contact` – optional contact detail for anonymous reporters
- Case status, assigned handler, resolution notes
- Attached notes (sub-table) with committee commentary

### 5.2 Current enforcement model

```ts
const canAccessVault = isAdmin || permissionKeys.has('whistleblowing.committee')
```

Notes are only fetched when `canAccessVault`. Cases are queried directly from `whistleblowing_cases` with the org filter.

### 5.3 Gaps

**Gap 1: `updateStatus` and `closeCase` do not re-check `canAccessVault`**
```ts
// In useWhistleblowing.ts – mutations call supabase directly
// without re-verifying canAccessVault at mutation time
const updateStatus = async (id: string, status: ...) => {
  await supabase.from('whistleblowing_cases').update({ status }).eq('id', id)
}
```
If `canAccessVault` becomes false between mount and mutation (role change mid-session), the mutation will succeed if DB RLS is absent or misconfigured.

**Gap 2: No way to know if DB RLS is actually present**
The app assumes RLS on `whistleblowing_cases` enforces the `whistleblowing.committee` permission at the DB level. This is unverifiable from the app code. If RLS is absent or there is a policy misconfiguration, the `canAccessVault` check is the only guard – and it runs once on mount.

**Gap 3: Anonymous reporters can be re-identified from case content**
Even when `reporter_user_id` is NULL, the case description itself may identify the reporter (e.g., "As the only female welder in unit X..."). There is no mechanism in the current model to detect or warn about quasi-identifiers in case descriptions.

**Gap 4: No differentiation between "see case list" and "see full case details"**
`canAccessVault` is binary. A committee member who is also a subject of a report should be recused – there is no recusal mechanism.

**Gap 5: Case handler assignment is not logged**
The `assignedHandler` field can be changed without an audit event. This means who had access to a case at what time is not auditable – a requirement under AML § 2A-5 (6).

### 5.4 Recommendations

**Immediate fixes:**
1. Add `canAccessVault` check at the top of `updateStatus` and `closeCase`:
```ts
const updateStatus = async (id: string, status: ...) => {
  if (!canAccessVault) throw new Error('Unauthorized')
  await supabase.from('whistleblowing_cases').update(...)
}
```

2. Verify (and document in code) that Supabase RLS policies exist:
```sql
-- Required RLS policy on whistleblowing_cases
CREATE POLICY "whistleblowing_committee_only" ON whistleblowing_cases
  FOR ALL USING (
    organization_id = get_my_organization_id()
    AND (
      is_admin_of_org(organization_id)
      OR has_permission('whistleblowing.committee')
    )
  );

-- Anonymous reporter protection: never return reporter fields to non-admin
CREATE POLICY "whistleblowing_anonymous_protect" ON whistleblowing_cases
  FOR SELECT USING (
    -- reporter fields are always masked in the query result for non-committee
    TRUE  -- RLS cannot mask columns; use a VIEW or RPC instead
  );
```

3. Create an RPC that returns cases with reporter fields conditionally masked:
```sql
CREATE OR REPLACE FUNCTION get_whistleblowing_cases(p_org_id uuid)
RETURNS TABLE (
  id uuid, description text, status text,
  reporter_user_id uuid,  -- NULL unless caller has committee permission
  reporter_contact text,  -- NULL unless caller has committee permission
  ...
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.description, c.status,
    CASE WHEN has_permission('whistleblowing.committee') THEN c.reporter_user_id ELSE NULL END,
    CASE WHEN has_permission('whistleblowing.committee') THEN c.reporter_contact ELSE NULL END,
    ...
  FROM whistleblowing_cases c
  WHERE c.organization_id = p_org_id
    AND (is_admin_of_org(p_org_id) OR has_permission('whistleblowing.committee'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**New permission keys:**
```ts
'whistleblowing.view'    // see case list (status only, no details)
'whistleblowing.manage'  // full committee access (replaces .committee)
'whistleblowing.assign'  // can assign/reassign handlers
```

**Process controls:**
- Add a `recusal_user_ids` array to each case; committee members in that array see only case ID and status, not content.
- All status changes, handler assignments, and case closures must write to an immutable `whistleblowing_events` table (audit log).

---

## 6. Incident Data

### 6.1 What data is exposed

`Incident` records contain:
- `reportedBy` – may be a display name string (legacy) or linked via `reportedByEmployeeId`
- `createdByUserId` – auth UUID (newer records)
- `nearestLeaderEmployeeId` – the assigned case handler
- Description of the incident (may include names of involved parties)
- `routing.verneombudNotified` – boolean flag that changes VO access
- Root cause analysis (restricted write access)

### 6.2 Current enforcement model

```
isAdmin                → see all
legacy (no userId/employeeId) → visible to ALL
createdByUserId match  → own reports
reportedByEmployeeId match → own reports
nearestLeaderEmployeeId match → assigned handler
reportedBy string email/name match → legacy fallback
routing.verneombudNotified + VO_HINTS regex → VO access
```

### 6.3 Gaps

**Gap 1: Four different identity matching methods create ambiguity**
The function uses `userId`, `employeeId`, display name string, and email in a fallback chain. Each adds attack surface:
- Display name matching (`norm(inc.reportedBy) === norm(ctx.viewerDisplayName)`) can be abused by changing a display name to match another user's name.
- Email matching against `reportedBy` (a free-text legacy field) is not reliable – "John Smith (john@co.no)" won't match "john@co.no".

**Gap 2: VO incident routing is opt-in and regex-based**
`routing.verneombudNotified` is a field set by the reporter or system at incident creation. After the fact, changing a job title can add or remove VO access to existing incidents without any audit record.

**Gap 3: Legacy incidents are fully public within the org**
```ts
const legacy = !inc.createdByUserId && !inc.reportedByEmployeeId
if (legacy) return true
```
Incidents reported before the identity fields were added are visible to all users with module access (`module.view.hse`). This includes incident descriptions that may name witnesses, injured parties, or involved managers.

**Gap 4: No "incident.view" permission – it falls through to `module.view.hse`**
Any user with `module.view.hse` access gets incident module access. There is no separate `incident.view` gate. An inspector or external safety consultant with HSE access can see all non-confidential incidents including ones where they are not an involved party.

**Gap 5: Root-cause restriction does not apply at the DB level**
`canEditIncidentRootCause` is checked before saving but there is no corresponding DB constraint. A direct API call can write root-cause data regardless of the app-side check.

### 6.4 Recommendations

**Consolidate identity matching:**
Deprecate display-name and email fallback matching. Instead:
1. For all new incidents: require `createdByUserId` and `reportedByEmployeeId` to be set at creation.
2. Run a one-time migration: link legacy `reportedBy` strings to employees by email/name match, set `reportedByEmployeeId`, flag as "migrated". Remaining unmatched records: admin-visible only.

**Add permission keys:**
```ts
'incident.view'    // see incident list for own org unit
'incident.manage'  // create, update status, assign handler
'incident.export'  // download incident data (GDPR Art. 20)
```

**VO access model:**
Instead of regex, check against the formal `verneombud` role:
```ts
// Replace VO_HINTS regex with role check
const isVO = viewerEmployee?.role === 'verneombud' || viewerEmployee?.role === 'hoved_verneombud'
if (inc.routing?.verneombudNotified && isVO) return true
```

**DB-level enforcement:**
```sql
CREATE POLICY "incident_read" ON incidents
  FOR SELECT USING (
    organization_id = get_my_organization_id()
    AND (
      is_admin_of_org(organization_id)
      OR created_by_user_id = auth.uid()
      OR reported_by_employee_id = get_my_employee_id()
      OR nearest_leader_employee_id = get_my_employee_id()
      OR (
        -- VO access: only for incidents where VO was notified
        routing->>'verneombudNotified' = 'true'
        AND get_my_employee_role() IN ('verneombud', 'hoved_verneombud')
      )
    )
  );
```

---

## 7. HR Discussion Data (§ 15-1 Drøftelsessamtaler)

### 7.1 What data is exposed

`hr_discussion_meetings` rows contain:
- Meeting participants (employee IDs and names)
- Meeting purpose (which AML paragraph)
- Notes/summary of the discussion
- Outcome/decision
- Attached documents

This is among the most sensitive employment data in the system. A § 15-1 drøftelsessamtale is a meeting before a potential dismissal or significant change to employment terms. Notes from such meetings are legally sensitive and contain information about the employee's response, health situation, and union representation.

### 7.2 Current enforcement model

```ts
// In useHrCompliance.ts
const refreshMeetings = async () => {
  const { data } = await supabase
    .from('hr_discussion_meetings')
    .select('*')
    .eq('organization_id', org.id)
  setMeetings(data ?? [])
}
```

**There is no participant filter.** Any user with `module.view.hr_compliance` sees all meetings for the entire organisation regardless of whether they were involved.

### 7.3 Gaps

**Gap 1: Full meeting list returned for all users with module access**
`hr.discussion.manage` is required to create/edit meetings. But `module.view.hr_compliance` is enough to access the page – and once on the page, `refreshMeetings` returns all meetings unconditionally.

**Gap 2: No read-specific permission key**
There is no `hr.discussion.view` key. The only way to restrict read access is to remove `module.view.hr_compliance` entirely, which also removes access to consultation (kap. 8) and O-ROS.

**Gap 3: `fetchCaseDetail` loads full participant list with no access check**
```ts
const fetchCaseDetail = async (id: string) => {
  const { data } = await supabase
    .from('hr_discussion_meetings')
    .select('*, participants(*), comments(*), events(*)')
    .eq('id', id)
    .single()
}
```
No check that the caller was a participant or has manage rights.

**Gap 4: HR discussions may contain § 9-3 health information**
If the employee mentions illness during a § 15-1 meeting, notes could contain health data (Art. 9 GDPR). This data is currently accessible to anyone with HR module access.

### 7.4 Recommendations

**New permission keys:**
```ts
'hr.discussion.view'    // see meetings where you are a participant (employee or manager)
'hr.discussion.manage'  // create/update meetings, add notes, assign participants
'hr.discussion.admin'   // see all meetings in org (HR director role)
```

**Access model:**
| Role | Access |
|------|--------|
| HR Admin | All meetings (`hr.discussion.admin`) |
| Manager | Meetings where they are the responsible manager (`hr.discussion.manage`) |
| Employee | Own meetings only (`hr.discussion.view`) |
| Tillitsvalgt | Meetings where they are registered as union rep |
| All others | No access |

**DB-level enforcement:**
```sql
CREATE POLICY "hr_discussion_participant_read" ON hr_discussion_meetings
  FOR SELECT USING (
    organization_id = get_my_organization_id()
    AND (
      has_permission('hr.discussion.admin')
      OR responsible_manager_id = get_my_employee_id()
      OR employee_id = get_my_employee_id()
      OR EXISTS (
        SELECT 1 FROM hr_discussion_participants p
        WHERE p.meeting_id = hr_discussion_meetings.id
          AND p.employee_id = get_my_employee_id()
      )
    )
  );
```

**App-side fix (immediate):**
Modify `refreshMeetings` to filter by participation before the full list is rendered:
```ts
const { data } = await supabase
  .from('hr_discussion_meetings')
  .select('*')
  .eq('organization_id', org.id)
  .or(`responsible_manager_id.eq.${myEmployeeId},employee_id.eq.${myEmployeeId}`)
```

---

## 8. Workplace Cases (Anonym AML, Konfidensielle saker)

### 8.1 Current enforcement model

```ts
export function canViewWorkplaceCase(c: WorkplaceCase, ctx: WorkplaceCaseViewerContext): boolean {
  if (ctx.isAdmin || ctx.isCommittee) return true
  if (c.confidential) return Boolean(ctx.userId && c.createdByUserId === ctx.userId)
  return true  // ← non-confidential: ALL users with module access
}
```

### 8.2 Gaps

**Gap 1: `isCommittee` derivation is opaque**
`isCommittee` is a boolean passed from context. If it is derived from a permission key (`whistleblowing.committee`), that is correct. If it is derived from a role string, it is fragile. The source of truth for `isCommittee` must be documented and consistently enforced.

**Gap 2: All non-confidential cases visible to all module users**
This includes case descriptions, which may name individuals. A user with `module.view.workplace_reporting` OR `module.view.hse` can access this route (see `ROUTE_PERMISSION_ANY`). That is a broad audience.

**Gap 3: No case-level confidentiality for third-party descriptions**
A case may be submitted about a manager or a team member. The subject of the report has no way to be recused from seeing the case even if they have module access.

### 8.3 Recommendations

**Case visibility tiers:**
| Tier | Condition | Visible to |
|------|-----------|-----------|
| Confidential | `c.confidential = true` | Creator + Admin + Committee |
| Sensitive (new) | `c.involves_named_employee = true` | Creator + Admin + Committee + HR |
| Standard | Default | All with module access |

**Verify `isCommittee` derivation:**
```ts
// Ensure isCommittee is derived from permission key only
const isCommittee = permissionKeys.has('whistleblowing.committee')
// NOT from role string or boolean flag in user metadata
```

---

## 9. Survey Results & k-Anonymity

### 9.1 Current enforcement model

`orgSurveyKAnonymity.ts` implements:
```ts
export const SURVEY_K_ANONYMITY_MIN = 5

export function evaluateSurveyAnonymityGate(targetGroupSize: number, responseCount: number): AnonymityGateResult {
  if (targetGroupSize < SURVEY_K_ANONYMITY_MIN) return { gate: 'blocked', reason: 'group_too_small' }
  if (responseCount < SURVEY_K_ANONYMITY_MIN) return { gate: 'blocked', reason: 'too_few_responses' }
  return { gate: 'open' }
}
```

### 9.2 Gaps

**Gap 1: k-anonymity enforced only at render time**
The survey results API/query returns full aggregated data regardless of group size. The gate is evaluated in the React component after the data has already been transferred. A user with direct Supabase access or who intercepts the API response can see the underlying data.

**Gap 2: k=5 is a minimum – Norwegian practice expects higher**
Datatilsynet's guidance on employee surveys references k=10 or higher for sensitive questions. k=5 is acceptable for general satisfaction items but not for questions touching on health, bullying, or personal safety.

**Gap 3: Percentage responses can re-identify in small groups**
A group of exactly 5 with a 80% score means at most 1 person disagrees – effectively identifying that person. The current gate does not account for this combinatorial re-identification risk.

**Gap 4: No suppression for dominant-response cells**
When one response option has 100% (or 0%) of answers in a cell, the respondent's answer is fully identifiable regardless of group size. This is a standard attack on survey anonymity.

### 9.3 Recommendations

**Enforce k-anonymity at the DB level:**
```sql
CREATE OR REPLACE FUNCTION get_survey_unit_results(p_survey_id uuid, p_unit_id uuid)
RETURNS TABLE (question_id uuid, option_id text, count bigint, percent numeric)
AS $$
DECLARE
  v_respondent_count bigint;
BEGIN
  SELECT COUNT(DISTINCT respondent_id) INTO v_respondent_count
  FROM survey_responses
  WHERE survey_id = p_survey_id AND unit_id = p_unit_id;

  IF v_respondent_count < 10 THEN  -- raise threshold for sensitive surveys
    RETURN;  -- return empty result set, not an error
  END IF;

  RETURN QUERY
  SELECT ...
  FROM survey_responses
  WHERE ...
  GROUP BY question_id, option_id
  HAVING COUNT(DISTINCT respondent_id) >= 3;  -- suppress sparse cells
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Tiered k thresholds:**
| Question category | Minimum k |
|------------------|-----------|
| General satisfaction, engagement | 5 |
| Leadership evaluation | 8 |
| Bullying, harassment, safety | 10 |
| Health and wellbeing | 10 |

**Add dominant-response suppression:**
```ts
// In orgSurveyKAnonymity.ts
export function suppressDominantCells<T extends { count: number; total: number }>(items: T[]): T[] {
  return items.map((item) => {
    const pct = item.count / item.total
    if (pct === 0 || pct === 1) return { ...item, count: -1, suppressed: true }
    return item
  })
}
```

---

## 10. Complete Data Access Matrix

The following matrix defines WHO should have access to WHAT across all sensitive data domains. This should be used as the authoritative source when implementing DB-level RLS policies.

| Data domain | Employee (self) | Line manager | Verneombud | HR Admin | Admin | Varslingskomité | All with module |
|-------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Own employee profile | ✅ Full | ✅ Direct reports | ❌ | ✅ All | ✅ All | ❌ | ❌ |
| Other employees – name/unit | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (directory) |
| Other employees – phone/email | ✅ (own) | ✅ Direct reports | ❌ | ✅ All | ✅ | ❌ | ❌ |
| Sick leave – own | ✅ | ✅ | ❌ Individual | ✅ All | ✅ | ❌ | ❌ |
| Sick leave – aggregate stats | ❌ | ✅ (own unit) | ✅ Aggregate | ✅ | ✅ | ❌ | ❌ |
| Incidents – own reported | ✅ | ✅ (as handler) | ✅ (VO-notified) | ✅ | ✅ | ❌ | ❌ |
| Incidents – others' | ❌ | ✅ (as handler) | ✅ (VO-notified) | ✅ | ✅ | ❌ | ❌ |
| Whistleblower cases | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Whistleblower reporter identity | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ (if not recused) | ❌ |
| HR § 15-1 meetings – own | ✅ | ✅ (as manager) | ❌ | ✅ | ✅ | ❌ | ❌ |
| HR § 15-1 meetings – others' | ❌ | ✅ (own reports) | ❌ | ✅ | ✅ | ❌ | ❌ |
| Survey results – org aggregate | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (if k≥threshold) |
| Survey results – unit breakdown | ❌ | ✅ (own unit) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Survey results – individual | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Workplace cases – standard | ✅ (own) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (should restrict) |
| Workplace cases – confidential | ✅ (own) | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

---

## 11. Missing Permission Keys

The following permission keys should be added to `PERMISSION_KEYS` in `permissionKeys.ts`:

```ts
// Employee data
'employee.pii.read'       // see phone, email, start date of other employees
'employee.sensitive.read' // see employment type, salary band, contract details
'employee.manage'         // create/update/deactivate employee records

// Sick leave
'sick_leave.view'         // see sick leave for own direct reports (aggregate for VO)
'sick_leave.manage'       // create/update/delete any sick leave case

// Incidents
'incident.view'           // see incidents (scoped by involvement)
'incident.manage'         // create/update/close incidents, assign handlers

// HR discussions
'hr.discussion.view'      // see meetings where you are a participant
'hr.discussion.admin'     // see all meetings in org

// Whistleblowing
'whistleblowing.view'     // see case list without reporter identity (committee-lite)
'whistleblowing.assign'   // assign/reassign case handlers

// Survey
'survey.results.view'     // see survey results (gated by k-anonymity)
'survey.results.export'   // download raw/aggregated survey data

// Org data
'org.export'              // export employee/org data (GDPR Art. 20 requests)
```

---

## 12. Priority Remediation Roadmap

### P0 – Fix immediately (legal exposure)

1. **Remove legacy-record open-access in `canViewSickLeaveCase`**. Sick leave is GDPR Art. 9 health data. A back-fill migration must link old records to employees before removing the exception.

2. **Add `canAccessVault` re-check in `updateStatus` and `closeCase`** in `useWhistleblowing.ts`. Mutation paths must not bypass the access check.

3. **Document and test RLS on `whistleblowing_cases`**. If no RLS exists, add it before the next release. This is non-negotiable under AML § 2A-5 and GDPR.

4. **Fix HR discussion `refreshMeetings`** to filter by participant involvement. All § 15-1 meeting data is legally sensitive and must not be broadcast to all module users.

### P1 – Fix within current quarter (architectural risk)

5. **Add `sick_leave.view` and `sick_leave.manage` permission keys** and wire them to the sick-leave page access checks.

6. **Add `hr.discussion.view` and `hr.discussion.admin` permission keys** and implement participant-scoped DB query.

7. **Replace VO_HINTS regex** with formal role enum check in both `sickLeaveAccess.ts` and `incidentAccess.ts`.

8. **Add DB-level RLS on `incidents` table** with a policy matching the app-side `canViewIncident` logic.

9. **Add `employee.pii.read` permission key** and gate phone/email columns in the organisation module behind it.

### P2 – Fix within six months (compliance hardening)

10. **Introduce formal `OrgEmployeeRole` enum** (typed, not free-text) and migrate existing records. This is the foundation for all role-based DB policies.

11. **Move k-anonymity enforcement to DB** via an RPC that returns empty results for groups below threshold.

12. **Implement whistleblower recusal mechanism** (`recusal_user_ids` array on cases) and immutable event audit log.

13. **Add incident legacy-record migration**: link all unlinked records or restrict to admin-only.

14. **Column-level masking** for employee PII (return masked values instead of null for users without PII permission).

### P3 – Ongoing compliance (GDPR Art. 30 maintenance)

15. Add **read-access audit logging** for sick leave, HR discussions, and whistleblower cases. Every SELECT on sensitive tables that returns data must generate an audit event.

16. **GDPR data subject request handler**: implement `org.export` permission and a UI for admins to generate the data export required by Art. 15 (access) and Art. 20 (portability).

17. **Retention policy enforcement**: automatic archiving/deletion of sick leave cases after the statutory retention period (AML § 4-6 reference to folkehelse data retention).

---

## Appendix: Relevant Legal References

| Reference | Requirement |
|-----------|-------------|
| AML § 2A-5 | Varslingkomité: exclusive access to varsling cases; secrecy obligation |
| AML § 6-1, § 6-2 | Verneombud: access to aggregate safety data, NOT individual health/sick leave |
| AML § 7-1 | AMU: access to aggregate health/safety statistics for the workplace |
| AML § 9-3 | Employers may not disclose employee health information beyond what is necessary |
| AML § 15-1 | Drøftelsessamtale notes are confidential employment records |
| GDPR Art. 4(1) | Name, email, phone = personal data |
| GDPR Art. 9 | Sick leave, health conditions = special category data requiring explicit legal basis |
| GDPR Art. 5(1)(f) | Integrity and confidentiality principle: data must be secured against unauthorised access |
| GDPR Art. 25 | Data protection by design: access control must be built in, not bolted on |
| GDPR Art. 30 | Register of processing activities must include access categories |
| GDPR Art. 32 | Appropriate technical measures: RLS, encryption, audit logging |
| Personopplysningsloven § 1 | Applies GDPR in Norway; Datatilsynet is supervisory authority |
| IK-forskriften § 5 | Internkontroll must document who has access to which data |

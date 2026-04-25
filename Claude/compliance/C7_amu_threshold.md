# C7 — AMU-terskel bruker plattformbrukere, ikke ansatte

## Severity: High
## Legal basis: AML §7-1

## Problem

`ComplianceDashboard.tsx` bruker `members.length` (plattformbrukere) som
AMU-terskel. Plattformbrukere ≠ ansatte. Gir både falske positiver og negativer.

AML §7-1 (2): AMU kan også kreves fra 20 ansatte hvis verneombud/fagforening
ber om det. Dette håndteres ikke.

## Acceptance criteria

- [ ] Organisasjonsinnstillinger har eget felt `employee_count`
- [ ] AMU-terskel bruker `employee_count`, ikke `members.length`
- [ ] Advarsel når `employee_count` ikke er satt
- [ ] Note om AML §7-1 (2) for 20–49 ansatte
- [ ] `npm run build` exits 0

## Database migration

```sql
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS employee_count int
    CHECK (employee_count IS NULL OR employee_count >= 0);
```

Verify actual table name from existing migrations.

## Dashboard change

Replace:
```tsx
const employeeCount = members.length
```
With:
```tsx
const { org } = useOrgSetupContext()  // verify field name
const employeeCount = org?.employeeCount ?? null
```

Add warning:
```tsx
{employeeCount === null && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    <strong>Mangler antall ansatte.</strong> Oppgi antall ansatte i
    organisasjonsinnstillingene for korrekt AMU-beregning.
    Plattformbrukere er ikke det samme som ansatte.
  </div>
)}
```

Add 20–49 note:
```tsx
{employeeCount !== null && employeeCount >= 20 && employeeCount < 50 && (
  <p className="mt-2 text-xs text-neutral-500">
    AML §7-1 (2): AMU kan opprettes etter krav fra verneombud eller
    fagforening selv om antall ansatte er under 50.
  </p>
)}
```

## Validation checklist

- [ ] Migration adds `employee_count` column
- [ ] `npm run build` exits 0
- [ ] Org settings has field for antall ansatte
- [ ] ComplianceDashboard uses `employee_count`
- [ ] Warning shown when not set
- [ ] 20–49 note shown for mid-size orgs
- [ ] File reads completed

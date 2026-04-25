# C7 — AMU-terskel bruker antall plattformbrukere, ikke ansatte

## Severity: High
## Legal basis: AML §7-1

## Problem

AML §7-1 (1) sier AMU er obligatorisk når virksomheten "jevnlig sysselsetter
minst 50 arbeidstakere". `ComplianceDashboard.tsx` linje 34 bruker
`members.length` (antall plattformbrukere) som terskel. Plattformbrukere
≠ ansatte. Dette kan gi både falske positiver og falske negativer:

- 60 ansatte, men kun 30 er registrert i plattformen → AMU-sjekk utløses ikke
- 50 brukere inkl. konsulenter og prosjektansatte → AMU-sjekk utløses feil

Også mangler: AML §7-1 (2) sier AMU kan kreves fra 20 ansatte hvis
vernombud eller fagforening ber om det.

## Acceptance criteria

- [ ] Organisasjonsinnstillinger har et eget felt `employee_count` (integer)
- [ ] AMU-terskelberegningen bruker `employee_count`, ikke `members.length`
- [ ] Når `employee_count` ikke er satt, vises en advarsel: "Oppgi antall
  ansatte i organisasjonsinnstillingerne for korrekt AMU-beregning"
- [ ] En note under AMU-seksjonen forklarer at dette ikke er det samme som
  antall plattformbrukere
- [ ] AML §7-1 (2) nevnes som en note for virksomheter med 20–49 ansatte
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/ComplianceDashboard.tsx` | Replace `members.length` with `employee_count` |
| Org settings page | Add `employee_count` field |
| DB migration | Add `employee_count` column to organisations table |

## Files to read first

- `src/pages/documents/ComplianceDashboard.tsx` — lines around `members.length`
- Search for the organisations/org settings table in migrations to find
  the correct table name
- Find the org settings page in `src/pages/` (search for "innstillinger" or
  "settings")

## Database migration

```sql
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS employee_count int
    CHECK (employee_count IS NULL OR employee_count >= 0);
```

Verify the actual table name by reading the existing migrations.

## Dashboard change

Replace:
```tsx
const employeeCount = members.length
```

With:
```tsx
const { org } = useOrgSetupContext()  // verify actual hook/field name
const employeeCount = org?.employeeCount ?? null
```

Add a warning when `employeeCount` is null:

```tsx
{employeeCount === null && (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
    <strong>Mangler antall ansatte.</strong> Oppgi antall ansatte i
    organisasjonsinnstillingene for korrekt AMU- og vernombuds-beregning.
    Plattformbrukere er ikke det samme som ansatte.
  </div>
)}
```

Add a note under AMU-seksjonen for 20–49 ansatte:

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
- [ ] `npm run build` exits 0, zero TS errors
- [ ] Org settings page has a field for antall ansatte
- [ ] ComplianceDashboard uses `employee_count` for AMU threshold
- [ ] Warning is shown when `employee_count` is not set
- [ ] 20–49 employee note is shown for mid-size orgs
- [ ] File reads completed before editing

# C11 — AMU møtefrekvens teller publiseringer, ikke møter

## Severity: Low
## Legal basis: AML §7-3

## Problem

AML §7-3 krever at AMU holder de møtene som er nødvendig — Arbeidstilsynet
tolker dette som minimum 4 møter per år.

`ComplianceDashboard.tsx` linje ~71 teller audit-ledger-hendelser med
`action === 'published'` i AMU-mappen de siste 12 månedene. Dette er en
prositiv feil:

- 8 dokumenter publisert etter ett møte → teller som 8 møter
- 4 møter holdt, men protokoller publisert 2 uker forsinket → teller korrekt

Met rikkens validitet avhenger av en 1:1-korrelasjon mellom publiseringer og
møter, noe som ikke er garantert.

## Acceptance criteria

- [ ] Møtefrekvenssjekken skiller mellom AMU-møtemodulen (primær kilde)
  og wiki-publiseringer (sekundær kilde)
- [ ] Dashbordet viser hvilken kilde som brukes og en forklaring
- [ ] Hvis AMU-møtemodulen har møtedata: vis antall registrerte møter
- [ ] Hvis kun wiki-data er tilgjengelig: vis advarsel om at tallet er et
  estimat basert på protokollpubliseringer
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/ComplianceDashboard.tsx` | Improve meeting count source |

## Files to read first

- `src/pages/documents/ComplianceDashboard.tsx` — `meetingsPublishedLast12m` useMemo
- Search for AMU meeting data in hooks (grep for `amu_meetings`, `meetings`,
  `amuMeetings` in `src/hooks/`) to find if a more accurate source exists

## Implementation

### Find AMU meeting source

Search for hooks or Supabase queries that return AMU meeting records.
If found:

```tsx
const { meetings } = useAmuMeetings()  // verify actual hook name
const amuMeetingsLast12m = meetings.filter(
  (m) => new Date(m.heldAt).getTime() > nowMs - 365 * 86400000
).length
```

Replace the wiki-publication count with this value.

### If no AMU meeting source exists, add a disclaimer

```tsx
<div
  className={`rounded-xl border px-4 py-3 text-sm ${
    meetingsPublishedLast12m >= 4
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-amber-200 bg-amber-50 text-amber-950'
  }`}
>
  <p className="font-medium">AMU-møtefrekvens (AML §7-3)</p>
  <p className="mt-1 text-neutral-800">
    {meetingsPublishedLast12m} av 4 planlagte AMU-protokoller publisert siste år
  </p>
  <p className="mt-1 text-xs text-neutral-500">
    Estimert basert på publiseringer i AMU-mappen. For nøyaktig møtetelling,
    bruk AMU-modulen til å registrere møter direkte.
  </p>
</div>
```

The key change is being honest about the data source. Do not claim
"4 møter registrert" when the data is actually "4 protokoller publisert".

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] The meeting count source is clearly stated in the UI
- [ ] If AMU meeting module data is available, it is used as the primary source
- [ ] If only wiki data is available, a disclaimer explains it is an estimate
- [ ] The label "møter" is not used when the data source is "publiseringer"
- [ ] File reads completed before editing

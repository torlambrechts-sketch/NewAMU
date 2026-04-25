# C11 — AMU møtefrekvens teller publiseringer, ikke møter

## Severity: Low
## Legal basis: AML §7-3

## Problem

Dashbordet teller audit-ledger `published`-hendelser i AMU-mappen som møter.
8 dokumenter publisert etter ett møte teller som 8 møter. Upresist og
potensielt misvisende.

## Acceptance criteria

- [ ] Sjekken skiller mellom AMU-møtemodulen (primær) og wiki-publiseringer (sekundær)
- [ ] UI viser hvilken kilde som brukes
- [ ] Hvis kun wiki-data: advarsel om at tallet er et estimat
- [ ] Etiketten "møter" brukes ikke når kilden er "publiseringer"
- [ ] `npm run build` exits 0

## Implementation

Search for AMU meeting data (grep `amu_meetings`, `amuMeetings` i `src/hooks/`).

If AMU module data available:
```tsx
const amuMeetingsLast12m = meetings.filter(
  (m) => new Date(m.heldAt).getTime() > nowMs - 365 * 86400000
).length
```

If only wiki data available, add disclaimer:
```tsx
<p className="mt-1 text-xs text-neutral-500">
  Estimert basert på publiseringer i AMU-mappen. For nøyaktig telling,
  bruk AMU-modulen til å registrere møter direkte.
</p>
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] Data source stated clearly in UI
- [ ] AMU module data used if available
- [ ] Disclaimer shown when only wiki data available
- [ ] Label "møter" not used when source is "publiseringer"
- [ ] File reads completed

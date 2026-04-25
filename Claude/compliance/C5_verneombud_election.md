# C5 — Verneombuds valgperiode ikke validert

## Severity: High
## Legal basis: AML §6-1, AML §6-5

## Problem

Compliance-dashbordet sjekker om det finnes en publisert side med
`AML §6-1` i `legalRefs`. Dette er en svak proxy. Sjekkens validitet
avhenger av at redaktøren setter korrekt `nextRevisionDueAt` manuelt.

AML §6-1 (3) sier valgperioden er **2 år**. AML §6-5 stiller krav til
selve valgprosessen. Ingen av disse kravene valideres i dag.

## Gaps som må tettes

### Gap 1: Valgperiode basert på faktisk valg, ikke revisjonsdato

Komplianse-sjekken bruker `nextRevisionDueAt` som proxy for når valgperioden
utløper. Dette feltet settes manuelt. Et feil-satt dato gir feil status.

**Fix:** Kryss-referer mot valgets dato i representantmodulen (hvis
tilgjengelig). Søk etter hvordan AMU/verneombud-valg lagres i basen
(`verneombud_elections` eller tilsvarende). Bruk denne datoen + 2 år
som autorisativ kilde for når valgperioden utløper.

### Gap 2: Krav om minst ett verneombud per 20 ansatte (store virksomheter)

AML §6-1 (2) sier at større virksomheter kan ha krav om verneombud per
avdeling. Dashbordet sjekker kun én side.

**Fix:** For virksomheter med >20 ansatte, legg til en soft-warning:
"Vurder om det er behov for verneombud per avdeling (AML §6-1 (2))."

### Gap 3: Valgprosessen er ikke dokumentert

AML §6-5 stiller krav til hvordan valget gjennomføres. Det finnes ingen
sjekk for om selve valgprosessen er dokumentert (hvem stemte, når, resultat).

**Fix:** Legg til et felt eller en kolonne i mandate-malen som dokumenterer
valgprosessen.

## Acceptance criteria

- [ ] Compliance-dashbordet henter valgdato fra representantmodulen (ikke
  manuelt `nextRevisionDueAt`) — eller viser en klar advarsel om at datoen
  må verifiseres manuelt hvis representantdata ikke er tilgjengelig
- [ ] Dashbordet beregner mandatutløp som `electionDate + 2 years`
- [ ] For virksomheter med >20 ansatte: soft-warning om avdelingsverneombud
- [ ] Mal `tpl-verneombud-mandat` inkluderer seksjon for valgdokumentasjon
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/ComplianceDashboard.tsx` | Improve election date source |
| `src/data/documentTemplates.ts` | Add election documentation section to `tpl-verneombud-mandat` |

## Files to read first

- `src/pages/documents/ComplianceDashboard.tsx` — `verneombudMandate` useMemo
- Search for election-related tables/hooks (grep for `election`, `valg`,
  `verneombud` in `src/hooks/`)
- `src/data/documentTemplates.ts` — current `tpl-verneombud-mandat` content

## Implementation

### Find election data source

Grep for `election` or `verneombud` in `src/hooks/` to find if there is an
existing hook that exposes election date. If found:

```tsx
// Example — verify actual field names
const { elections } = useRepresentatives()  // or equivalent hook
const latestElection = elections
  .filter((e) => e.role === 'verneombud')
  .sort((a, b) => new Date(b.electedAt).getTime() - new Date(a.electedAt).getTime())[0]
const mandateExpires = latestElection
  ? new Date(new Date(latestElection.electedAt).setFullYear(
      new Date(latestElection.electedAt).getFullYear() + 2
    )).toISOString()
  : null
```

If no election data is available from a hook, add a warning banner:

```tsx
<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
  Valgdato hentes ikke automatisk. Verifiser at `Neste revisjon`-datoen på
  verneombud-mandat-siden reflekterer faktisk valgperiode (2 år fra siste valg).
</div>
```

### Soft-warning for >20 employees

```tsx
{employeeCount > 20 && (
  <p className="mt-1 text-xs text-neutral-500">
    Med {employeeCount} ansatte bør dere vurdere verneombud per avdeling
    (AML §6-1 (2)).
  </p>
)}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] Dashbordet viser korrekt mandatutløp basert på valgdato (eller advarsel
  om manuell verifisering)
- [ ] Virksomheter med >20 ansatte ser soft-warning om avdelingsverneombud
- [ ] `tpl-verneombud-mandat` har seksjon for valgets gjennomføring
- [ ] File reads completed before editing

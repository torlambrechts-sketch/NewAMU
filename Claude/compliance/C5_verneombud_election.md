# C5 — Verneombuds valgperiode ikke validert

## Severity: High
## Legal basis: AML §6-1, AML §6-5

## Problem

Dashbordet bruker manuelt satt `nextRevisionDueAt` som proxy for mandatutløp.
AML §6-1 (3): valgperioden er 2 år. AML §6-5: stiller krav til valgprosessen.
Ingen av disse valideres.

## Tre gap som må tettes

### Gap 1: Valgperiode fra faktisk valg, ikke revisjonsdato

Se etter valgsdata i representantmodulen (grep etter `election`, `valg`,
`verneombud` i `src/hooks/`). Bruk `electionDate + 2 years` som kilde.

Hvis ikke tilgjengelig, vis advarsel:
```tsx
<div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
  Valgdato hentes ikke automatisk. Verifiser at revisjonsdatoen reflekterer
  faktisk valgperiode (2 år fra siste valg, jf. AML §6-1 (3)).
</div>
```

### Gap 2: Soft-warning for >20 ansatte

```tsx
{employeeCount > 20 && (
  <p className="mt-1 text-xs text-neutral-500">
    Med {employeeCount} ansatte bør dere vurdere verneombud per avdeling (AML §6-1 (2)).
  </p>
)}
```

### Gap 3: Valgprosess dokumentert

Legg til seksjon i `tpl-verneombud-mandat` for valgets gjennomføring
(hvem stemte, når, resultat).

## Acceptance criteria

- [ ] Mandatutløp basert på valgdata eller klar advarsel om manuell verifisering
- [ ] Soft-warning for >20 ansatte om avdelingsverneombud
- [ ] `tpl-verneombud-mandat` har seksjon for valgdokumentasjon
- [ ] `npm run build` exits 0

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] Korrekt mandatutløp vist (eller advarsel)
- [ ] Soft-warning ved >20 ansatte
- [ ] Valgprosess-seksjon i mal
- [ ] File reads completed

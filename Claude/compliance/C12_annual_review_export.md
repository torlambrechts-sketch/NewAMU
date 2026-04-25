# C12 — Årsgjennomgang ikke kryssreferert på inspeksjonseksport

## Severity: Low
## Legal basis: IK-f §5 nr. 5

## Problem

Den årlige gjennomgangen av internkontrollen (IK-f §5 nr. 5) er et av de
viktigste dokumentasjonskravene. Arbeidstilsynet sjekker alltid at dette
er utført og dokumentert.

Inspeksjonseksportsiden (`/documents/compliance/inspection-export`) viser
en oversikt for Arbeidstilsynet, men kryssrefererer **ikke** om årsgjennomgangen
for inneverende eller forrige år er fullført. En inspektør kan se et pent
dashbord uten å merke at årsgjennomgangen er 14 måneder forsinket.

## Acceptance criteria

- [ ] Inspeksjonseksportsiden viser en tydelig status for årsgjennomgangen
  (IK-f §5 nr. 5)
- [ ] Status baseres på `wiki_annual_reviews`-tabellen
- [ ] Manglende eller forsinket årsgjennomgang vises som en rød advarsel øverst
  på eksportsiden
- [ ] En fullført gjennomgang viser dato og lenke til det publiserte
  årsgjennomgangs-dokumentet
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/InspectionArbeidstilsynetExportPage.tsx` | Add annual review status block |

## Files to read first

- `src/pages/documents/InspectionArbeidstilsynetExportPage.tsx` — full file
- `src/api/wikiAnnualReview.ts` — understand how annual review data is fetched
- `src/hooks/useDocuments.tsx` — check if `annualReview` is already exposed

## Annual review status detection

In the inspection export page, add:

```tsx
const currentYear = new Date().getFullYear()
const lastYear = currentYear - 1

// Use the annual review hook/API — check wikiAnnualReview.ts for the correct call
// The review for last year should be completed before Jan 31 of the current year
const reviewStatus = useMemo(() => {
  // Find completed review for last year or current year
  const completed = annualReviews?.find(
    (r) =>
      r.status === 'completed' &&
      (r.year === currentYear || r.year === lastYear)
  )
  if (completed) {
    return {
      ok: true,
      year: completed.year,
      completedAt: completed.completedAt,
      pageId: completed.pageId,
    }
  }
  const inProgress = annualReviews?.find(
    (r) => r.status === 'in_progress' && r.year === currentYear
  )
  return {
    ok: false,
    inProgress: Boolean(inProgress),
    year: lastYear,
  }
}, [annualReviews, currentYear, lastYear])
```

Verify the exact field names (`status`, `year`, `completedAt`, `pageId`) by
reading the annual review API and migration files.

## Status banner JSX

Add this **at the top** of the inspection export page content, above all
other sections:

```tsx
{reviewStatus.ok ? (
  <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
    <div>
      <p className="text-sm font-semibold text-emerald-900">
        Årsgjennomgang {reviewStatus.year} — fullført
      </p>
      <p className="text-xs text-emerald-700">
        Fullført {new Date(reviewStatus.completedAt).toLocaleDateString('no-NO')}
        {reviewStatus.pageId ? (
          <> · <Link to={`/documents/page/${reviewStatus.pageId}`} className="underline">Se rapport</Link></>
        ) : null}
      </p>
    </div>
  </div>
) : (
  <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <div className="size-5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
    <div>
      <p className="text-sm font-semibold text-red-900">
        Årsgjennomgang {reviewStatus.year} — {reviewStatus.inProgress ? 'påbegynt, ikke fullført' : 'mangler'}
      </p>
      <p className="text-xs text-red-700">
        IK-f §5 nr. 5 krever systematisk årlig gjennomgang av internkontrollen.
        <Link to="/documents/aarsgjennomgang" className="ml-1 underline">
          Gå til årsgjennomgang
        </Link>
      </p>
    </div>
  </div>
)}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] Annual review status banner appears at the top of the inspection export page
- [ ] A completed review shows green banner with date and link
- [ ] A missing/overdue review shows red banner with link to annual review page
- [ ] An in-progress review shows amber/red banner distinguishing it from missing
- [ ] Field names verified against actual `wiki_annual_reviews` schema
- [ ] File reads completed before editing

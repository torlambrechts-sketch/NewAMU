# C12 — Årsgjennomgang ikke kryssreferert på inspeksjonseksport

## Severity: Low
## Legal basis: IK-f §5 nr. 5

## Problem

Inspeksjonseksportsiden viser ingen status for årsgjennomgangen (IK-f §5 nr. 5).
En inspektør kan se et pent dashbord uten å merke at årsgjennomgangen
er 14 måneder forsinket.

## Acceptance criteria

- [ ] Status for årsgjennomgang øverst på inspeksjonseksportsiden
- [ ] Basert på `wiki_annual_reviews`-tabellen
- [ ] Manglende/forsinket årsgjennomgang: rød advarsel
- [ ] Fullført: grønn banner med dato og lenke til rapporten
- [ ] `npm run build` exits 0

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/InspectionArbeidstilsynetExportPage.tsx` | Add annual review status block |

## Files to read first

- `src/pages/documents/InspectionArbeidstilsynetExportPage.tsx` — full file
- `src/api/wikiAnnualReview.ts` — how review data is fetched
- Verify field names (`status`, `year`, `completedAt`, `pageId`) from migration

## Status banner JSX

Add **at the top** of the page content:

```tsx
{reviewStatus.ok ? (
  <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
    <div>
      <p className="text-sm font-semibold text-emerald-900">Årsgjennomgang {reviewStatus.year} — fullført</p>
      <p className="text-xs text-emerald-700">
        Fullført {new Date(reviewStatus.completedAt).toLocaleDateString('no-NO')}
        {reviewStatus.pageId && (
          <> · <Link to={`/documents/page/${reviewStatus.pageId}`} className="underline">Se rapport</Link></>
        )}
      </p>
    </div>
  </div>
) : (
  <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
    <div className="size-5 shrink-0 rounded-full bg-red-500" />
    <div>
      <p className="text-sm font-semibold text-red-900">
        Årsgjennomgang {reviewStatus.year} — {reviewStatus.inProgress ? 'påbegynt, ikke fullført' : 'mangler'}
      </p>
      <p className="text-xs text-red-700">
        IK-f §5 nr. 5 krever systematisk årlig gjennomgang.
        <Link to="/documents/aarsgjennomgang" className="ml-1 underline">Gå til årsgjennomgang</Link>
      </p>
    </div>
  </div>
)}
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] Annual review status banner at top of export page
- [ ] Completed review: green banner with date and link
- [ ] Missing review: red banner with link to annual review page
- [ ] In-progress: distinguishable from missing
- [ ] Field names verified against actual schema
- [ ] File reads completed

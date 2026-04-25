# C9 — Oppbevaringstid for interne rutiner er for kort

## Severity: Medium
## Legal basis: IK-f §5, Arbeidstilsynet praksis

## Problem

`wikiRetentionCategories.ts` har `intern_prosedyre` med `minYears: 1`.
Arbeidstilsynet forventer minimum 3 år for HMS-rutiner som del av
internkontrollsystemet.

## Acceptance criteria

- [ ] `intern_prosedyre` `minYears` endret fra `1` til `3`
- [ ] `description` oppdatert med begrunnelse
- [ ] In-editor veiledning når `intern_prosedyre` er valgt
- [ ] Ingen eksisterende sider auto-endres
- [ ] `npm run build` exits 0

## Change in wikiRetentionCategories.ts

```ts
// Before:
{ slug: 'intern_prosedyre', minYears: 1, description: 'Interne rutiner trenger ikke lang oppbevaring etter utfasing' }

// After:
{ slug: 'intern_prosedyre', minYears: 3, description: 'HMS-relaterte rutiner bør oppbevares minimum 3 år. For rutiner som er del av internkontrollen, vurder «HMS-dokumentasjon» (5 år).' }
```

## Editor tooltip

In `WikiPageEditor.tsx`, find the retention category selector. Add:

```tsx
{page.retentionCategory === 'intern_prosedyre' && (
  <p className="mt-1 text-xs text-amber-700">
    For HMS-relaterte rutiner: vurder kategorien «HMS-dokumentasjon» (minimum 5 år, jf. IK-f §5 og AML §18-8).
  </p>
)}
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `WIKI_RETENTION_CATEGORIES_STATIC` `intern_prosedyre` has `minYears: 3`
- [ ] Description updated
- [ ] Tooltip appears when `intern_prosedyre` selected
- [ ] No existing page data auto-modified
- [ ] File reads completed

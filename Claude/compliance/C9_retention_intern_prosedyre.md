# C9 — Oppbevaringstid for interne rutiner er for kort

## Severity: Medium
## Legal basis: IK-f §5, Arbeidstilsynet praksis

## Problem

`src/data/wikiRetentionCategories.ts` definerer `intern_prosedyre` med
`minYears: 1`. I praksis forventer Arbeidstilsynet at HMS-rutiner som
utgjør en del av internkontrollsystemet oppbevares minimum 3 år —
den samme perioden som AMU-protokoller (AML §7-4).

En rutine som arkiveres og slettes etter 1 år etterlater et hull i
revisjonshistorikken som Arbeidstilsynet vil påpeke.

## Acceptance criteria

- [ ] `intern_prosedyre` `minYears` er endret fra `1` til `3`
- [ ] `description` oppdateres for å reflektere begrunnelsen
- [ ] En in-editor veiledning oppfordrer brukere til å velge `hms_dokument`
  (5 år) for HMS-spesifikke rutiner
- [ ] Eksisterende sider med `retentionCategory: 'intern_prosedyre'` er IKKE
  automatisk endret — kun den statiske default-verdien endres
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/wikiRetentionCategories.ts` | Change `minYears: 1` to `minYears: 3` for `intern_prosedyre` |
| `src/pages/documents/WikiPageEditor.tsx` | Add guidance tooltip on retention category selector |

## Files to read first

- `src/data/wikiRetentionCategories.ts` — full file
- `src/pages/documents/WikiPageEditor.tsx` — locate retention category
  selector in the settings tab

## Change in wikiRetentionCategories.ts

```ts
// Before:
{
  slug: 'intern_prosedyre',
  label: 'Interne rutiner og prosedyrer',
  minYears: 1,
  maxYears: null,
  legalRefs: ['IK-f §5'],
  description: 'Interne rutiner trenger ikke lang oppbevaring etter utfasing',
},

// After:
{
  slug: 'intern_prosedyre',
  label: 'Interne rutiner og prosedyrer',
  minYears: 3,
  maxYears: null,
  legalRefs: ['IK-f §5'],
  description: 'HMS-relaterte rutiner bør oppbevares minimum 3 år etter arkivering. For rutiner som er del av internkontrollen, vurder kategorien «HMS-dokumentasjon» (5 år).',
},
```

## Guidance tooltip in editor

In `WikiPageEditor.tsx`, find the retention category `<select>` or dropdown.
Add a helper text below it:

```tsx
{page.retentionCategory === 'intern_prosedyre' && (
  <p className="mt-1 text-xs text-amber-700">
    For HMS-relaterte rutiner: vurder kategorien «HMS-dokumentasjon»
    (minimum 5 år, jf. IK-f §5 og AML §18-8).
  </p>
)}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `WIKI_RETENTION_CATEGORIES_STATIC` `intern_prosedyre` has `minYears: 3`
- [ ] Description is updated
- [ ] Tooltip appears when `intern_prosedyre` is selected in the editor
- [ ] No existing page data is auto-modified
- [ ] File reads completed before editing

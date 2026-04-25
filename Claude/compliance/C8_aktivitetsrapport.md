# C8 — Aktivitetsrapport (Likestillingsloven §26a) ikke sjekket

## Severity: Medium
## Legal basis: Likestillings- og diskrimineringsloven §26a

## Problem

Virksomheter med minst 50 ansatte (og alle offentlige virksomheter) er
pålagt å utarbeide en årlig aktivitets- og redeggjørelsesrapport om
likestilling og diskriminering. Fristen er typisk integrert i årsrapporten
eller innen 30. juni.

Compliance-dashbordet sjekker ikke for dette kravet. Malen
`tpl-likestilling-mangfold` eksisterer men er ikke koblet til en konkret
årlig sjekk.

## Acceptance criteria

- [ ] Compliance-dashbordet viser en rad for `Likestillingsloven §26a`
- [ ] Raden er kun synlig når `employee_count >= 50` (se C7)
- [ ] Sjekken verifiserer at det finnes en publisert aktivitetsrapport
  for inneverende eller forrige år
- [ ] Raden lenker til `tpl-likestilling-mangfold` ved manglende dokument
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/pages/documents/ComplianceDashboard.tsx` | Add Likestillingsloven §26a check |
| `src/data/documentTemplates.ts` | Update `tpl-likestilling-mangfold` legalRefs |
| Legal coverage data file | Add §26a item |

## Files to read first

- `src/pages/documents/ComplianceDashboard.tsx` — full file
- `src/data/documentTemplates.ts` — existing `tpl-likestilling-mangfold`

## Compliance check logic

Add a `useMemo` block in `ComplianceDashboard.tsx`:

```tsx
const aktivitetsrapport = useMemo(() => {
  if (!employeeCount || employeeCount < 50) return { applies: false as const }

  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1

  const found = docs.pages.filter(
    (p) =>
      p.status === 'published' &&
      p.legalRefs.some(
        (r) => r.includes('Likestillingsloven') || r.includes('§26a')
      ) &&
      (new Date(p.updatedAt).getFullYear() === currentYear ||
        new Date(p.updatedAt).getFullYear() === lastYear)
  )

  return {
    applies: true as const,
    covered: found.length > 0,
    page: found[0] ?? null,
  }
}, [docs.pages, employeeCount])
```

Render:

```tsx
{aktivitetsrapport.applies && (
  <tr className={MODULE_TABLE_TR_BODY}>
    <td className="px-4 py-3">
      {aktivitetsrapport.covered ? (
        <CheckCircle2 className="size-5 text-emerald-600" />
      ) : (
        <Circle className="size-5 text-amber-400" />
      )}
    </td>
    <td className="px-4 py-3 font-mono text-xs text-[#1a3d32]">Likestillingsloven §26a</td>
    <td className="px-4 py-3 text-neutral-700">
      Årlig aktivitets- og redeggjørelsesrapport
    </td>
    <td className="px-4 py-3 text-xs text-neutral-600">
      {aktivitetsrapport.covered ? (
        aktivitetsrapport.page?.title
      ) : (
        <span className="text-amber-700">
          Ingen rapport funnet for {new Date().getFullYear()} / {new Date().getFullYear() - 1}
        </span>
      )}
    </td>
  </tr>
)}
```

## Update template legalRefs

Ensure `tpl-likestilling-mangfold` has:
```ts
legalRefs: ['Likestillingsloven §26a', 'Inkluderingsloven'],
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] Row is hidden for orgs with <50 employees
- [ ] Row is visible for orgs with ≥50 employees
- [ ] A published page with `Likestillingsloven §26a` in `legalRefs` marks
  the row as dekket
- [ ] Without a recent (this year / last year) report: row shows mangler
- [ ] File reads completed before editing

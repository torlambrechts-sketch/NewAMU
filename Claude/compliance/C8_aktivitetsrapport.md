# C8 — Aktivitetsrapport (Likestillingsloven §26a) ikke sjekket

## Severity: Medium
## Legal basis: Likestillings- og diskrimineringsloven §26a

## Problem

Virksomheter med ≥50 ansatte er pålagt årlig aktivitets- og
redeggjørelsesrapport om likestilling. Compliance-dashbordet sjekker
ikke dette.

## Acceptance criteria

- [ ] Compliance-dashbordet viser rad for `Likestillingsloven §26a`
- [ ] Kun synlig når `employee_count >= 50` (avhenger av C7)
- [ ] Sjekker publisert rapport for inneverende eller forrige år
- [ ] Rad lenker til `tpl-likestilling-mangfold` ved manglende dokument
- [ ] `npm run build` exits 0

## Compliance check logic

```tsx
const aktivitetsrapport = useMemo(() => {
  if (!employeeCount || employeeCount < 50) return { applies: false as const }
  const currentYear = new Date().getFullYear()
  const found = docs.pages.filter(
    (p) =>
      p.status === 'published' &&
      p.legalRefs.some((r) => r.includes('Likestillingsloven') || r.includes('§26a')) &&
      (new Date(p.updatedAt).getFullYear() === currentYear ||
        new Date(p.updatedAt).getFullYear() === currentYear - 1)
  )
  return { applies: true as const, covered: found.length > 0, page: found[0] ?? null }
}, [docs.pages, employeeCount])
```

## Update template legalRefs

Ensure `tpl-likestilling-mangfold` has:
```ts
legalRefs: ['Likestillingsloven §26a', 'Inkluderingsloven'],
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] Row hidden for orgs with <50 employees
- [ ] Row visible for orgs with ≥50 employees
- [ ] Published page with `Likestillingsloven §26a` in `legalRefs` marks row dekket
- [ ] Without recent report: row shows mangler
- [ ] File reads completed

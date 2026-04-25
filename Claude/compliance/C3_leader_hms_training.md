# C3 — Lederens HMS-opplæring (AML §3-5) ikke sporet

## Severity: Critical
## Legal basis: AML §3-5

## Problem

AML §3-5 pålegger **arbeidsgiver personlig** å gjennomgå opplæring i HMS-arbeid.
Dette er en personlig plikt — den kan ikke delegeres. Compliance-dashbordet
sjekker opplæringsplaner for ansatte (via `tpl-opplaering`) men har ingen
spesifikk kontroll for om den registrerte lederen (admin-rollen) har
gjennomført og dokumentert sin HMS-opplæring.

Arbeidstilsynet spør alltid om dette ved inspeksjon og krever sertifikat
eller skriftlig dokumentasjon.

## Acceptance criteria

- [ ] Compliance-dashbordet har en dedikert rad for `AML §3-5`
- [ ] Raden viser: "Dekket" hvis det finnes en publisert side med `AML §3-5`
  i `legalRefs` OG siden er knyttet til admin-brukeren
- [ ] En ny mal `tpl-leder-hms-opplaering` finnes i `documentTemplates.ts`
- [ ] Malen har et felt for kursdato, kursleverandør og sertifikatnummer
- [ ] Retention: `hms_dokument` (minimum 5 år)
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-leder-hms-opplaering` |
| Legal coverage data file | Add `AML §3-5` item |
| `src/pages/documents/ComplianceDashboard.tsx` | Add AML §3-5 check with admin-user cross-reference |

## Files to read first

- `src/data/documentTemplates.ts` — full file
- `src/pages/documents/ComplianceDashboard.tsx` — full file; understand how
  `verneombudMandate` check works (similar pattern for admin training)
- `src/hooks/useDocuments.tsx` — how `pages` and `auditLedger` are exposed
- `src/hooks/useOrgSetupContext.tsx` — find how `currentUserId` and `members`
  are exposed; identify how to find the org admin user

## Template: tpl-leder-hms-opplaering

```ts
{
  id: 'tpl-leder-hms-opplaering',
  label: 'Arbeidsgivers HMS-opplæring',
  description: 'Dokumentasjon av lederens obligatoriske HMS-opplæring (AML §3-5)',
  legalBasis: ['AML §3-5'],
  category: 'hms_handbook',
  page: {
    title: 'Dokumentasjon — Arbeidsgivers HMS-opplæring',
    summary: 'Bevis på at arbeidsgiver har gjennomført HMS-opplæring (AML §3-5)',
    status: 'draft',
    template: 'policy',
    legalRefs: ['AML §3-5'],
    lang: 'nb',
    requiresAcknowledgement: false,
    revisionIntervalMonths: 24,
    retentionCategory: 'hms_dokument',
    retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §3-5', description: 'Arbeidsgivers plikt til opplæring i HMS-arbeid', url: 'https://lovdata.no/lov/2005-06-17-62/§3-5' },
      { kind: 'alert', variant: 'info', text: 'AML §3-5 pålegger arbeidsgiver personlig å gjennomgå opplæring. Opplæringen skal være dokumentert.' },
      { kind: 'heading', level: 2, text: 'Kursdetaljer' },
      { kind: 'text', body: '<p><strong>Navn på arbeidsgiver:</strong> [Fyll inn]<br><strong>Kurstittel:</strong> [Fyll inn]<br><strong>Kursleverandør:</strong> [Fyll inn]<br><strong>Gjennomført dato:</strong> [Fyll inn]<br><strong>Sertifikatnummer:</strong> [Fyll inn]<br><strong>Neste forfall:</strong> [Fyll inn]</p>' },
      { kind: 'heading', level: 2, text: 'Innhold i opplæringen' },
      { kind: 'text', body: '<p>Opplæringen dekket følgende temaer (sett kryss):<br>□ Systematisk HMS-arbeid og internkontroll<br>□ Risikovurdering og forebyggende tiltak<br>□ Arbeidsmiljølovens krav til arbeidsgiver<br>□ Samarbeid med verneombud og AMU</p>' },
    ],
  },
}
```

## Compliance check logic

In `ComplianceDashboard.tsx`, add a `useMemo` block similar to `verneombudMandate`:

```tsx
const leaderTraining = useMemo(() => {
  const candidates = docs.pages.filter(
    (p) =>
      p.status === 'published' &&
      p.legalRefs.some((r) => r === 'AML §3-5' || r.startsWith('AML §3-5'))
  )
  if (candidates.length === 0) return { status: 'missing' as const, page: null }
  const sorted = [...candidates].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )
  const pick = sorted[0]!
  const overdue = pick.nextRevisionDueAt
    ? new Date(pick.nextRevisionDueAt).getTime() < nowMs
    : false
  return { status: overdue ? ('stale' as const) : ('covered' as const), page: pick }
}, [docs.pages, nowMs])
```

Render a table row for this check in the same style as the verneombud row.

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `tpl-leder-hms-opplaering` in template gallery
- [ ] AML §3-5 row visible in compliance dashboard
- [ ] Without a published AML §3-5 page: row shows “mangler”
- [ ] With a published page: row shows “dekket”
- [ ] With an overdue revision: row shows “foreldet” warning
- [ ] Template pre-fills `retentionCategory: 'hms_dokument'`
- [ ] File reads completed before editing

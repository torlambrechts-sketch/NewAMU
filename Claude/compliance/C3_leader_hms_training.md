# C3 — Lederens HMS-opplæring (AML §3-5) ikke sporet

## Severity: Critical
## Legal basis: AML §3-5

## Problem

AML §3-5: arbeidsgiver er personlig pålagt HMS-opplæring. Compliance-
dashbordet sjekker ikke om den registrerte lederen har dokumentert dette.
Arbeidstilsynet krever alltid sertifikat eller skriftlig dokumentasjon.

## Acceptance criteria

- [ ] Compliance-dashbordet har dedikert rad for `AML §3-5`
- [ ] Rad er dekket hvis publisert side med `AML §3-5` i `legalRefs` finnes
- [ ] Mal `tpl-leder-hms-opplaering` med felt for kursdato, leverandør, sertifikatnr
- [ ] Retensjonskategori: `hms_dokument` (5 år)
- [ ] `npm run build` exits 0

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
    summary: 'Bevis på at arbeidsgiver har gjennomført HMS-opplæring',
    status: 'draft', template: 'policy',
    legalRefs: ['AML §3-5'],
    lang: 'nb', requiresAcknowledgement: false,
    revisionIntervalMonths: 24, retentionCategory: 'hms_dokument', retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §3-5', description: 'Arbeidsgivers personlige plikt til HMS-opplæring', url: 'https://lovdata.no/lov/2005-06-17-62/§3-5' },
      { kind: 'alert', variant: 'info', text: 'AML §3-5 pålegger arbeidsgiver personlig å gjennomgå opplæring. Kan ikke delegeres.' },
      { kind: 'heading', level: 2, text: 'Kursdetaljer' },
      { kind: 'text', body: '<p><strong>Navn på arbeidsgiver:</strong> [Fyll inn]<br><strong>Kurstittel:</strong> [Fyll inn]<br><strong>Leverandør:</strong> [Fyll inn]<br><strong>Gjennomført dato:</strong> [Fyll inn]<br><strong>Sertifikatnummer:</strong> [Fyll inn]</p>' },
      { kind: 'heading', level: 2, text: 'Innhold i opplæringen' },
      { kind: 'text', body: '<p>□ Systematisk HMS-arbeid og internkontroll<br>□ Risikovurdering og forebyggende tiltak<br>□ Arbeidsmiljølovens krav til arbeidsgiver<br>□ Samarbeid med verneombud og AMU</p>' },
    ],
  },
}
```

## Compliance check (useMemo in ComplianceDashboard)

```tsx
const leaderTraining = useMemo(() => {
  const candidates = docs.pages.filter(
    (p) => p.status === 'published' && p.legalRefs.some((r) => r === 'AML §3-5' || r.startsWith('AML §3-5'))
  )
  if (candidates.length === 0) return { status: 'missing' as const, page: null }
  const pick = [...candidates].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]!
  const overdue = pick.nextRevisionDueAt ? new Date(pick.nextRevisionDueAt).getTime() < nowMs : false
  return { status: overdue ? 'stale' as const : 'covered' as const, page: pick }
}, [docs.pages, nowMs])
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `tpl-leder-hms-opplaering` in template gallery
- [ ] AML §3-5 row in compliance dashboard
- [ ] Without published page: mangler
- [ ] With published page: dekket
- [ ] With overdue revision: stale warning
- [ ] File reads completed

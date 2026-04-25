# C2 — Bedriftshelsetjeneste (BHT) ikke kontrollert

## Severity: Critical
## Legal basis: AML §3-3, FOR-2011-12-06-1355 §13-1

## Problem

Virksomheter i risikoutsatte bransjer er lovpålagt å være tilknyttet godkjent
BHT. Compliance-dashbordet har ingen sjekk, ingen mal og ingen lenke til
Arbeidstilsynets bransjeliste.

## Acceptance criteria

- [ ] Mal `tpl-bht-avtale` i `documentTemplates.ts`
- [ ] Legal coverage-element for `AML §3-3`
- [ ] Compliance-dashbordet viser BHT-rad
- [ ] Lenke til Arbeidstilsynets BHT-liste i rad-detalj
- [ ] Retensjonskategori: `hms_dokument` (5 år)
- [ ] `npm run build` exits 0

## Template: tpl-bht-avtale

Påkrevde seksjoner:
1. BHT-leverandør (navn, godkjenningsnr, kontakt)
2. Tjenester (risikovurdering, helseovervåking, rådgivning)
3. Tilgjengelighet for alle ansatte (AML §3-3 (5))
4. Meldeplikt overfor Arbeidstilsynet

```ts
{
  id: 'tpl-bht-avtale',
  label: 'Bedriftshelsetjeneste — samarbeidsavtale',
  description: 'Dokumentasjon av BHT-tilknytning (AML §3-3)',
  legalBasis: ['AML §3-3'],
  category: 'hms_handbook',
  page: {
    title: 'Samarbeidsavtale med bedriftshelsetjeneste',
    summary: 'Dokumentasjon av virksomhetens BHT-tilknytning',
    status: 'draft', template: 'policy',
    legalRefs: ['AML §3-3'],
    lang: 'nb', requiresAcknowledgement: false,
    revisionIntervalMonths: 12, retentionCategory: 'hms_dokument', retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §3-3', description: 'Plikt til BHT i visse bransjer', url: 'https://lovdata.no/lov/2005-06-17-62/§3-3' },
      { kind: 'alert', variant: 'info', text: 'Sjekk om din bransje har BHT-plikt: https://www.arbeidstilsynet.no/hms/bht/' },
      { kind: 'heading', level: 2, text: 'BHT-leverandør' },
      { kind: 'text', body: '<p><strong>Navn:</strong> [Fyll inn]<br><strong>Godkjenningsnummer:</strong> [Fyll inn]<br><strong>Avtaledato:</strong> [Fyll inn]</p>' },
      { kind: 'heading', level: 2, text: 'Tjenester' },
      { kind: 'text', body: '<p>Kartlegging, risikovurdering, helseovervåking, rådgivning og bistand ved tilrettelegging (AML §4-6).</p>' },
      { kind: 'heading', level: 2, text: 'Tilgjengelighet' },
      { kind: 'text', body: '<p>BHT er tilgjengelig for alle ansatte (AML §3-3 (5)). Kontaktinfo på intranett og oppslagstavle.</p>' },
    ],
  },
}
```

## Legal coverage item

```ts
{ ref: 'AML §3-3', label: 'Tilknytning til godkjent bedriftshelsetjeneste', templateIds: ['tpl-bht-avtale'] }
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `tpl-bht-avtale` in template gallery
- [ ] AML §3-3 row in compliance dashboard
- [ ] Link to Arbeidstilsynet BHT page in row detail
- [ ] `retentionCategory: 'hms_dokument'` pre-filled
- [ ] File reads completed

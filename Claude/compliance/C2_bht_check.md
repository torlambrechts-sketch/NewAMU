# C2 — Bedriftshelsetjeneste (BHT) ikke kontrollert

## Severity: Critical
## Legal basis: AML §3-3, FOR-2011-12-06-1355 §13-1 til §13-4

## Problem

Virksomheter i risikoutsatte bransjer er lovpålagt å være tilknyttet en
godkjent bedriftshelsetjeneste (BHT) etter AML §3-3. Compliance-dashbordet
har ingen kontroll for dette — ingen mal, ingen sjekk og ingen lenke til
Arbeidstilsynets bransjeliste. Dette er et fast funn ved Arbeidstilsynet-
inspeksjoner i BHT-pliktige bransjer.

## Acceptance criteria

- [ ] En ny mal `tpl-bht-avtale` finnes i `src/data/documentTemplates.ts`
- [ ] Et legal coverage-element for `AML §3-3` er lagt til
- [ ] Compliance-dashbordet viser en BHT-rad med status dekket/mangler
- [ ] Raden inkluderer en lenke til Arbeidstilsynets BHT-bransjeliste
- [ ] Malen har `retentionCategory: 'hms_dokument'` (5 år, jf. IK-f §5)
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-bht-avtale` |
| Legal coverage data file | Add `AML §3-3` item |
| `src/pages/documents/ComplianceDashboard.tsx` | Add note about Arbeidstilsynet BHT list |

## Files to read first

- `src/data/documentTemplates.ts` — full file; copy an existing template shape
- The legal coverage data file (search for `templateIds` in the codebase)

## Template content: tpl-bht-avtale

Required sections per AML §3-3 and FOR-2011-12-06-1355:

1. BHT-leverandør (navn, godkjenningsnummer, kontaktperson)
2. Avtalens omfang og tjenester (risikovurdering, arbeidsplassvurdering, helseovervåking)
3. Tilgjengelighet (AML §3-3 (5): BHT skal være tilgjengelig for alle ansatte)
4. Meldeplikt overfor Arbeidstilsynet
5. Revisjonsintervall

```ts
{
  id: 'tpl-bht-avtale',
  label: 'Bedriftshelsetjeneste — samarbeidsavtale',
  description: 'Dokumentasjon av BHT-tilknytning og tjenestebeskrivelse (AML §3-3)',
  legalBasis: ['AML §3-3', 'FOR-2011-12-06-1355 §13-1'],
  category: 'hms_handbook',
  page: {
    title: 'Samarbeidsavtale med bedriftshelsetjeneste',
    summary: 'Dokumentasjon av virksomhetens BHT-tilknytning',
    status: 'draft',
    template: 'policy',
    legalRefs: ['AML §3-3', 'FOR-2011-12-06-1355 §13-1'],
    lang: 'nb',
    requiresAcknowledgement: false,
    revisionIntervalMonths: 12,
    retentionCategory: 'hms_dokument',
    retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §3-3', description: 'Plikt til tilknytning til bedriftshelsetjeneste i visse bransjer', url: 'https://lovdata.no/lov/2005-06-17-62/§3-3' },
      { kind: 'alert', variant: 'info', text: 'Sjekk Arbeidstilsynets bransjeliste for å bekrefte at din virksomhet har BHT-plikt: https://www.arbeidstilsynet.no/hms/bht/' },
      { kind: 'heading', level: 2, text: 'BHT-leverandør' },
      { kind: 'text', body: '<p><strong>Navn:</strong> [Fyll inn]<br><strong>Godkjenningsnummer:</strong> [Fyll inn]<br><strong>Kontaktperson:</strong> [Fyll inn]<br><strong>Avtaledato:</strong> [Fyll inn]</p>' },
      { kind: 'heading', level: 2, text: 'Tjenester som inngår i avtalen' },
      { kind: 'text', body: '<p>BHT skal bistå med:<br>- Kartlegging og risikovurdering av arbeidsmiljø<br>- Helseovervåking der dette er påkrevd<br>- Rådgivning om forebyggende tiltak<br>- Bistand ved tilrettelegging (AML §4-6)</p>' },
      { kind: 'heading', level: 2, text: 'Tilgjengelighet for ansatte' },
      { kind: 'text', body: '<p>BHT skal være tilgjengelig for alle ansatte, jf. AML §3-3 (5). Kontaktinformasjon til BHT er tilgjengelig på intranett og oppslagstavle.</p>' },
    ],
  },
}
```

## Legal coverage item

```ts
{
  ref: 'AML §3-3',
  label: 'Tilknytning til godkjent bedriftshelsetjeneste (BHT-pliktige bransjer)',
  templateIds: ['tpl-bht-avtale'],
}
```

## Note in ComplianceDashboard

In the BHT row detail panel, add a link:

```tsx
<a
  href="https://www.arbeidstilsynet.no/hms/bht/"
  target="_blank"
  rel="noreferrer"
  className="text-xs text-[#1a3d32] underline"
>
  Sjekk om din bransje har BHT-plikt (Arbeidstilsynet)
</a>
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `tpl-bht-avtale` appears in template gallery
- [ ] AML §3-3 row visible in compliance dashboard
- [ ] Template pre-fills `retentionCategory: 'hms_dokument'`
- [ ] Link to Arbeidstilsynet BHT page is present in the row detail
- [ ] File reads completed before editing

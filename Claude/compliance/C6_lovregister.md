# C6 — Oversikt over gjeldende lov- og regelverk mangler

## Severity: High
## Legal basis: IK-f §5 (dokumentasjonskravet)

## Problem

Internkontrollforskriften krever at virksomheten har oversikt over hvilke
lover og regler som gjelder for dem. Dette er et eget dokumentasjonskrav —
det holder ikke at systemet har en compliance-sjekk internt. Virksomheten
skal kunne fremlegge et dokument som viser: "disse lovene gjelder for oss,
og vi har kontroll på dem."

Ingen mal for dette finnes i dag, og compliance-dashbordet sjekker det ikke.

## Acceptance criteria

- [ ] En mal `tpl-lovregister` finnes i `documentTemplates.ts`
- [ ] Malen inneholder en tabell over relevante lover per område
- [ ] Et legal coverage-element for IK-f §5 (lovregister) er lagt til
- [ ] Retensjonskategori: `hms_dokument` (5 år)
- [ ] Revisjonsintervall: 12 måneder (lover endres)
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-lovregister` |
| Legal coverage data file | Add IK-f lovregister item |

## Files to read first

- `src/data/documentTemplates.ts` — full file
- The legal coverage data file

## Template content: tpl-lovregister

The template should pre-fill the most commonly applicable Norwegian laws
for workplaces. Users fill in their specific applicability.

```ts
{
  id: 'tpl-lovregister',
  label: 'Lov- og regelverkoversikt',
  description: 'Oversikt over gjeldende lov- og regelverk for virksomheten (IK-f §5)',
  legalBasis: ['IK-f §5'],
  category: 'hms_handbook',
  page: {
    title: 'Oversikt over gjeldende lov- og regelverk',
    summary: 'Virksomhetens register over relevante lover og forskrifter',
    status: 'draft',
    template: 'wide',
    legalRefs: ['IK-f §5'],
    lang: 'nb',
    requiresAcknowledgement: false,
    revisionIntervalMonths: 12,
    retentionCategory: 'hms_dokument',
    retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'IK-f §5', description: 'Krav om oversikt over gjeldende lov- og regelverk som gjelder for virksomheten', url: 'https://lovdata.no/forskrift/1996-12-06-1127/§5' },
      { kind: 'alert', variant: 'info', text: 'Oppdater denne oversikten årlig, eller når lovgivningen endres. Ansvarlig: [Fyll inn navn og rolle].' },
      { kind: 'heading', level: 2, text: 'Arbeidsmiljø og HMS' },
      {
        kind: 'table',
        headers: ['Lov / Forskrift', 'Hjemmel', 'Gjelder for oss', 'Ansvarlig', 'Sist kontrollert'],
        rows: [
          ['Arbeidsmiljøloven', 'LOV-2005-06-17-62', 'Ja', '', ''],
          ['Internkontrollforskriften', 'FOR-1996-12-06-1127', 'Ja', '', ''],
          ['Forskrift om organisering og ledelse', 'FOR-2011-12-06-1355', 'Ja', '', ''],
          ['Bedriftshelsetjenesteforskriften', 'FOR-2011-12-06-1355 kap. 13', 'Vurder', '', ''],
        ],
        caption: 'Arbeidsmiljø og HMS-lovgivning',
      },
      { kind: 'heading', level: 2, text: 'Personvern' },
      {
        kind: 'table',
        headers: ['Lov / Forskrift', 'Hjemmel', 'Gjelder for oss', 'Ansvarlig', 'Sist kontrollert'],
        rows: [
          ['GDPR', 'EU 2016/679', 'Ja', '', ''],
          ['Personopplysningsloven', 'LOV-2018-06-15-38', 'Ja', '', ''],
        ],
        caption: 'Personvernlovgivning',
      },
      { kind: 'heading', level: 2, text: 'Arbeidstakerrettigheter' },
      {
        kind: 'table',
        headers: ['Lov / Forskrift', 'Hjemmel', 'Gjelder for oss', 'Ansvarlig', 'Sist kontrollert'],
        rows: [
          ['Likestillings- og diskrimineringsloven', 'LOV-2017-06-16-51', 'Ja', '', ''],
          ['Ferieloven', 'LOV-1988-04-29-21', 'Ja', '', ''],
          ['Allmennaksjeloven / Aksjeloven', 'LOV-1997-06-13-45', 'Vurder', '', ''],
        ],
        caption: 'Arbeidstakerrettigheter',
      },
    ],
  },
}
```

**Note:** This template depends on the `TableBlock` type from P1.4. Implement
P1.4 before this template, or replace the `table` blocks with `text` blocks
containing an HTML table as a temporary fallback.

## Legal coverage item

```ts
{
  ref: 'IK-f §5 (lovregister)',
  label: 'Oversikt over gjeldende lov- og regelverk som gjelder for virksomheten',
  templateIds: ['tpl-lovregister'],
}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `tpl-lovregister` appears in template gallery
- [ ] IK-f lovregister row visible in compliance dashboard
- [ ] Template pre-fills a table with common Norwegian workplace laws
- [ ] Revision interval is 12 months
- [ ] Note: if P1.4 (table block) is not implemented, fallback to HTML table in text block
- [ ] File reads completed before editing

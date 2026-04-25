# C6 — Oversikt over gjeldende lov- og regelverk mangler

## Severity: High
## Legal basis: IK-f §5

## Problem

IK-f krever at virksomheten har oversikt over hvilke lover som gjelder for dem.
Dette er et eget dokumentasjonskrav — ikke bare et internt dashboard.

## Acceptance criteria

- [ ] Mal `tpl-lovregister` med forhånds-utfylt tabell over vanlige norske lover
- [ ] Legal coverage-element for IK-f (lovregister)
- [ ] Retensjonskategori: `hms_dokument` (5 år), revisjon: 12 måneder
- [ ] `npm run build` exits 0

**Note:** Denne malen bruker `TableBlock` fra P1.4. Implementer P1.4 først,
eller bruk `text`-blokker med HTML-tabell som midlertidig fallback.

## Template: tpl-lovregister

```ts
{
  id: 'tpl-lovregister',
  label: 'Lov- og regelverkoversikt',
  description: 'Oversikt over gjeldende lov- og regelverk (IK-f §5)',
  legalBasis: ['IK-f §5'],
  category: 'hms_handbook',
  page: {
    title: 'Oversikt over gjeldende lov- og regelverk',
    summary: 'Register over lover og forskrifter som gjelder for virksomheten',
    status: 'draft', template: 'wide',
    legalRefs: ['IK-f §5'],
    lang: 'nb', requiresAcknowledgement: false,
    revisionIntervalMonths: 12, retentionCategory: 'hms_dokument', retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'IK-f §5', description: 'Krav om oversikt over gjeldende lov- og regelverk', url: 'https://lovdata.no/forskrift/1996-12-06-1127/§5' },
      { kind: 'alert', variant: 'info', text: 'Oppdater årlig eller når lovgivningen endres. Ansvarlig: [Fyll inn].' },
      { kind: 'heading', level: 2, text: 'Arbeidsmiljø og HMS' },
      {
        kind: 'table',
        headers: ['Lov / Forskrift', 'Hjemmel', 'Gjelder for oss', 'Ansvarlig', 'Sist kontrollert'],
        rows: [
          ['Arbeidsmiljøloven', 'LOV-2005-06-17-62', 'Ja', '', ''],
          ['Internkontrollforskriften', 'FOR-1996-12-06-1127', 'Ja', '', ''],
          ['Forskrift om organisering', 'FOR-2011-12-06-1355', 'Ja', '', ''],
          ['Bedriftshelsetjenesteforskriften', 'FOR-2011-12-06-1355 kap. 13', 'Vurder', '', ''],
        ],
      },
      { kind: 'heading', level: 2, text: 'Personvern' },
      {
        kind: 'table',
        headers: ['Lov / Forskrift', 'Hjemmel', 'Gjelder for oss', 'Ansvarlig', 'Sist kontrollert'],
        rows: [
          ['GDPR', 'EU 2016/679', 'Ja', '', ''],
          ['Personopplysningsloven', 'LOV-2018-06-15-38', 'Ja', '', ''],
        ],
      },
    ],
  },
}
```

## Legal coverage item

```ts
{ ref: 'IK-f §5 (lovregister)', label: 'Oversikt over gjeldende lov- og regelverk', templateIds: ['tpl-lovregister'] }
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `tpl-lovregister` in template gallery
- [ ] IK-f lovregister row in compliance dashboard
- [ ] Revision interval is 12 months
- [ ] File reads completed

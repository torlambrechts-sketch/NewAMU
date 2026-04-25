# C1 — Varslingsprosedyre mangler i compliance-dashbordet

## Severity: Critical
## Legal basis: AML §2A-3

## Problem

AML §2A-3 (1): virksomheter med minst 5 arbeidstakere skal utarbeide rutiner
for intern varsling. Compliance-dashbordet har **ingen sjekk** for dette.

## Acceptance criteria

- [ ] Legal coverage-element for `AML §2A-3` i compliance-dashbordet
- [ ] Mal `tpl-varsling-prosedyre` i `documentTemplates.ts`
- [ ] Malen dekker alle lovpålagte elementer (se nedenfor)
- [ ] Publisert varslingsprosedyre markerer raden som dekket
- [ ] Retensjonskategori: `varslingssak` (3–5 år)
- [ ] `npm run build` exits 0

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-varsling-prosedyre` |
| Legal coverage data file (search for `templateIds`) | Add `AML §2A-3` item |

## Files to read first

- `src/data/documentTemplates.ts` — full file; copy existing template shape
- The legal coverage data file
- `src/data/wikiRetentionCategories.ts` — confirm `varslingssak` slug

## Template: obligatoriske seksjoner

1. Formål og lovgrunnlag (AML §2A-1 – §2A-7)
2. Hva kan varsles om (kritikkverdige forhold, AML §2A-1)
3. Hvem kan varsle (alle arbeidstakere, innleide, lærlinger)
4. Varslingskanåler (intern + ekstern: Arbeidstilsynet)
5. Mottak og behandling (frist, ansvarlig)
6. Konfidensialitet (AML §2A-6)
7. Vern mot gjengjeldelse (AML §2A-2)
8. Dokumentasjon og lagring (3–5 år, GDPR art. 5(1)(e))
9. Oppfølging og lukking (AML §2A-5)

```ts
{
  id: 'tpl-varsling-prosedyre',
  label: 'Varslingsprosedyre',
  description: 'Rutine for intern varsling om kritikkverdige forhold (AML §2A-3)',
  legalBasis: ['AML §2A-1', 'AML §2A-3', 'AML §2A-6'],
  category: 'policy',
  page: {
    title: 'Rutine for varsling om kritikkverdige forhold',
    summary: 'Intern varslingsprosedyre i henhold til AML §2A',
    status: 'draft', template: 'policy',
    legalRefs: ['AML §2A-1', 'AML §2A-3', 'AML §2A-6'],
    lang: 'nb', requiresAcknowledgement: true, acknowledgementAudience: 'all_employees',
    revisionIntervalMonths: 24, retentionCategory: 'varslingssak',
    retainMinimumYears: 3, retainMaximumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §2A-3', description: 'Plikt til å ha rutiner for intern varsling', url: 'https://lovdata.no/lov/2005-06-17-62/§2A-3' },
      { kind: 'heading', level: 2, text: 'Formål og virkeområde' },
      { kind: 'text', body: '<p>Gjelder for alle arbeidstakere, innleide og lærlinger.</p>' },
      { kind: 'heading', level: 2, text: 'Hva kan varsles om' },
      { kind: 'text', body: '<p>Kritikkverdige forhold er brudd på rettsregler, etiske retningslinjer eller etiske normer med bred tilslutning.</p>' },
      { kind: 'heading', level: 2, text: 'Varslingskanåler' },
      { kind: 'text', body: '<p><strong>Internt:</strong> Nærmeste leder, HR, verneombud eller AMU.<br><strong>Eksternt:</strong> Arbeidstilsynet eller andre tilsynsmyndigheter.</p>' },
      { kind: 'heading', level: 2, text: 'Konfidensialitet og vern' },
      { kind: 'alert', variant: 'warning', text: 'Varslerens identitet er konfidensiell (AML §2A-6). Gjengjeldelse er forbudt (AML §2A-2).' },
      { kind: 'heading', level: 2, text: 'Dokumentasjon og lagring' },
      { kind: 'text', body: '<p>Oppbevares minimum 3 år og maksimum 5 år etter avsluttet sak, jf. GDPR art. 5(1)(e).</p>' },
    ],
  },
}
```

## Legal coverage item

```ts
{ ref: 'AML §2A-3', label: 'Rutiner for intern varsling om kritikkverdige forhold', templateIds: ['tpl-varsling-prosedyre'] }
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `tpl-varsling-prosedyre` in template gallery
- [ ] AML §2A-3 row in compliance dashboard
- [ ] Published page marks row as dekket
- [ ] Without published page: row shows mangler
- [ ] `retentionCategory: 'varslingssak'` pre-filled
- [ ] File reads completed

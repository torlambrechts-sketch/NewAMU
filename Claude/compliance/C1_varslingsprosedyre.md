# C1 — Varslingsprosedyre mangler i compliance-dashbordet

## Severity: Critical
## Legal basis: AML §2A-3

## Problem

AML §2A-3 (1) pålegger arbeidsgiver med minst 5 arbeidstakere å utarbeide
rutiner for intern varsling. Compliance-dashbordet (`ComplianceDashboard.tsx`)
har **ingen sjekk** for om en publisert varslingsprosedyre finnes. En virksomhet
kan ha varslingsmodulen konfigurert, men mangler det obligatoriske
prosedyre-dokumentet — og dashbordet vil vise grønt.

Dette er en direkte lovbruddrisiko ved Arbeidstilsynet-inspeksjon.

## Acceptance criteria

- [ ] Et nytt legal coverage-element for `AML §2A-3` finnes i `legalCoverage`-dataen
- [ ] En mal `tpl-varsling-prosedyre` finnes i `src/data/documentTemplates.ts`
- [ ] Malen inneholder obligatoriske seksjoner (se nedenfor)
- [ ] Compliance-dashbordet viser status: dekket / mangler for AML §2A-3
- [ ] Retention-kategori for varslingssaker (`varslingssak`) er forhåndsvalgt
  når malen brukes
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-varsling-prosedyre` template |
| `src/data/wikiLegalCoverageItems.ts` | Add AML §2A-3 coverage item (verify filename) |
| `src/pages/documents/ComplianceDashboard.tsx` | Verify new item renders correctly |

## Files to read first

- `src/data/documentTemplates.ts` — full file; copy the shape of an existing
  template exactly
- The file that defines `legalCoverage` items (search for `legalCoverage` in
  `useDocuments.tsx` or a data file to find the correct path)
- `src/data/wikiRetentionCategories.ts` — confirm `varslingssak` slug

## Template content: tpl-varsling-prosedyre

The template must cover these legally required elements:

1. **Formål** — hensikten med rutinen og lovgrunnlag (AML §2A-1 – §2A-7)
2. **Hva kan varsles om** — kritikkverdige forhold (AML §2A-1)
3. **Hvem kan varsle** — alle arbeidstakere, inkl. innleide og lærlinger
4. **Varslingskanåler** — intern (leder, HR, verneombud), ekstern (Arbeidstilsynet, Finanstilsynet)
5. **Mottak og behandling** — hvem mottar varsler, saksbehandlingsfrist
6. **Konfidensialitet** — AML §2A-6: varslerens identitet er konfidensiell
7. **Beskyttelse mot gjengjeldelse** — AML §2A-2: forbud mot gjengjeldelse
8. **Dokumentasjon og lagring** — minimum 3 år (AML §2A-6), maksimum 5 år (GDPR)
9. **Oppfølging og lukking** — tilbakemelding til varsler (AML §2A-5)

```ts
// Shape to add in documentTemplates.ts:
{
  id: 'tpl-varsling-prosedyre',
  label: 'Varslingsprosedyre',
  description: 'Rutine for intern varsling om kritikkverdige forhold (AML §2A-3)',
  legalBasis: ['AML §2A-1', 'AML §2A-3', 'AML §2A-6'],
  category: 'policy',
  page: {
    title: 'Rutine for varsling om kritikkverdige forhold',
    summary: 'Intern varslingsprosedyre i henhold til AML §2A',
    status: 'draft',
    template: 'policy',
    legalRefs: ['AML §2A-1', 'AML §2A-3', 'AML §2A-6'],
    lang: 'nb',
    requiresAcknowledgement: true,
    acknowledgementAudience: 'all_employees',
    revisionIntervalMonths: 24,
    retentionCategory: 'varslingssak',
    retainMinimumYears: 3,
    retainMaximumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §2A-3', description: 'Plikt til å ha rutiner for intern varsling', url: 'https://lovdata.no/lov/2005-06-17-62/§2A-3' },
      { kind: 'heading', level: 2, text: 'Formål og virkeområde' },
      { kind: 'text', body: '<p>Denne rutinen gjelder for alle arbeidstakere, innleide og lærlinger i virksomheten.</p>' },
      { kind: 'heading', level: 2, text: 'Hva kan varsles om' },
      { kind: 'text', body: '<p>Kritikkverdige forhold er brudd på rettsregler, virksomhetens egne etiske retningslinjer, eller etiske normer det er bred tilslutning til i samfunnet.</p>' },
      { kind: 'heading', level: 2, text: 'Varslingskanåler' },
      { kind: 'text', body: '<p><strong>Internt:</strong> Nærmeste leder, HR-avdeling, verneombud eller AMU.<br><strong>Eksternt:</strong> Arbeidstilsynet, Finanstilsynet eller andre relevante tilsynsmyndigheter.</p>' },
      { kind: 'heading', level: 2, text: 'Konfidensialitet og vern mot gjengjeldelse' },
      { kind: 'alert', variant: 'warning', text: 'Varslerens identitet er konfidensiell (AML §2A-6). Gjengjeldelse mot varsler er forbudt (AML §2A-2).' },
      { kind: 'heading', level: 2, text: 'Saksbehandling og oppfølging' },
      { kind: 'text', body: '<p>Varselet skal bekreftes mottatt innen 7 dager. Varselet skal behandles innen rimelig tid. Varsler har rett på tilbakemelding om utfallet (AML §2A-5).</p>' },
      { kind: 'heading', level: 2, text: 'Dokumentasjon og lagring' },
      { kind: 'text', body: '<p>Varslingssaker oppbevares minimum 3 år og maksimum 5 år etter at saken er avsluttet, jf. GDPR art. 5 (1)(e).</p>' },
    ],
  },
}
```

## Legal coverage item to add

Find where `legalCoverage` items are defined (search for `IK-f §5` or
`templateIds` in the codebase). Add:

```ts
{
  ref: 'AML §2A-3',
  label: 'Rutiner for intern varsling om kritikkverdige forhold',
  templateIds: ['tpl-varsling-prosedyre'],
}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `tpl-varsling-prosedyre` appears in the template gallery
- [ ] Compliance dashboard shows AML §2A-3 row
- [ ] A published page using the template marks the row as “dekket”
- [ ] Without a published varslingsprosedyre page, the row shows “mangler”
- [ ] Template has `retentionCategory: 'varslingssak'` pre-filled
- [ ] File reads completed before editing

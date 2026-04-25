# C10 — Psykososialt arbeidsmiljø (AML §4-3) mangler

## Severity: Medium
## Legal basis: AML §4-3

## Problem

AML §4-3 krever at arbeidsmiljøet er tilrettelagt slik at arbeidstakere er
vernet mot trakassering, vold, trusler og andre belastninger av psykososial
art. Virksomheten skal ha skriftlige rutiner for dette.

Det finnes ingen mal for psykososialt arbeidsmiljø og ingen sjekk i
compliance-dashbordet. For mange norske virksomheter er dette det
høyeste-risiko-området ved HMS-inspeksjon.

## Acceptance criteria

- [ ] En mal `tpl-psykososialt` finnes i `documentTemplates.ts`
- [ ] Malen dekker: trakassering, konflikthåndtering, arbeidsrelatert stress,
  vold og trusler, og varslingskanal for psykososiale problemer
- [ ] Et legal coverage-element for `AML §4-3` er lagt til
- [ ] `npm run build` exits 0, zero TS errors

## Files to modify

| File | Change |
|---|---|
| `src/data/documentTemplates.ts` | Add `tpl-psykososialt` |
| Legal coverage data file | Add `AML §4-3` item |

## Template content: tpl-psykososialt

Obligatoriske seksjoner:

1. Formål og lovgrunnlag (AML §4-3)
2. Definisjon av trakassering og seksuell trakassering
3. Rutine for å melde fra om psykososiale problemer
4. Konflikthåndteringsrutine
5. Forebygging av arbeidsrelatert stress
6. Tiltak ved vold og trusler på arbeidsplassen (AML §4-3 (4))
7. Oppfølging og sanksjonering
8. Lederes ansvar

```ts
{
  id: 'tpl-psykososialt',
  label: 'Psykososialt arbeidsmiljø',
  description: 'Policy og rutiner for psykososialt arbeidsmiljø, trakassering og konflikthåndtering (AML §4-3)',
  legalBasis: ['AML §4-3'],
  category: 'policy',
  page: {
    title: 'Rutine for psykososialt arbeidsmiljø',
    summary: 'Policy for forebygging av trakassering og ivaretakelse av psykososialt arbeidsmiljø',
    status: 'draft',
    template: 'policy',
    legalRefs: ['AML §4-3'],
    lang: 'nb',
    requiresAcknowledgement: true,
    acknowledgementAudience: 'all_employees',
    revisionIntervalMonths: 24,
    retentionCategory: 'hms_dokument',
    retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §4-3', description: 'Krav til psykososialt arbeidsmiljø — vern mot trakassering og belastninger', url: 'https://lovdata.no/lov/2005-06-17-62/§4-3' },
      { kind: 'heading', level: 2, text: 'Formål' },
      { kind: 'text', body: '<p>Denne rutinen skal sikre et arbeidsmiljø fritt for trakassering, utilbørlig atferd, og urimelig arbeidsbelastning. Rutinen gjelder alle ansatte, innleide og besøkende.</p>' },
      { kind: 'heading', level: 2, text: 'Definisjon av trakassering' },
      { kind: 'text', body: '<p>Trakassering er handlinger, unnlatelser eller ytringer som virker krenkende, skremmende, fiendtlig eller nedverdigende. Seksuell trakassering er enhver form for uvelkommen seksuell oppmerksomhet.</p>' },
      { kind: 'heading', level: 2, text: 'Slik melder du fra' },
      { kind: 'alert', variant: 'info', text: 'Du kan melde fra til nærmeste leder, lederens overordnede, HR-avdeling eller verneombud. Du kan også bruke varslingssystemet anonymt.' },
      { kind: 'heading', level: 2, text: 'Konflikthåndtering' },
      { kind: 'text', body: '<p>1. Forsøk å løse konflikten direkte med den det gjelder.<br>2. Involver leder hvis direkte dialog ikke fører frem.<br>3. HR bistår med mekling ved behov.<br>4. Ekstern mekling kan benyttes i alvorlige tilfeller.</p>' },
      { kind: 'heading', level: 2, text: 'Forebygging av stress' },
      { kind: 'text', body: '<p>Arbeidsbelastning skal være forsvarlig (AML §4-1). Ledere skal jævnlig kartlegge arbeidsbelastning i 1:1-samtaler og i medarbeidersamtalen.</p>' },
      { kind: 'heading', level: 2, text: 'Vold og trusler' },
      { kind: 'alert', variant: 'warning', text: 'Ved umiddelbar fare: ring 112. Alle hendelser med vold eller trusler skal registreres som avvik.' },
      { kind: 'module', moduleName: 'action_button', params: { label: 'Meld avvik', route: '/avvik/ny' } },
    ],
  },
}
```

## Legal coverage item

```ts
{
  ref: 'AML §4-3',
  label: 'Psykososialt arbeidsmiljø — vern mot trakassering og belastninger',
  templateIds: ['tpl-psykososialt'],
}
```

## Validation checklist

- [ ] `npm run build` exits 0, zero TS errors
- [ ] `tpl-psykososialt` appears in template gallery
- [ ] AML §4-3 row visible in compliance dashboard
- [ ] Template has `requiresAcknowledgement: true` (all employees must read this)
- [ ] File reads completed before editing

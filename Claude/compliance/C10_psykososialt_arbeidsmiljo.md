# C10 — Psykososialt arbeidsmiljø (AML §4-3) mangler

## Severity: Medium
## Legal basis: AML §4-3

## Problem

AML §4-3 krever vern mot trakassering, vold og psykososiale belastninger.
Ingen mal og ingen dashbord-sjekk eksisterer.

## Acceptance criteria

- [ ] Mal `tpl-psykososialt` i `documentTemplates.ts`
- [ ] Legal coverage-element for `AML §4-3`
- [ ] `requiresAcknowledgement: true` (alle ansatte må lese denne)
- [ ] `npm run build` exits 0

## Template: tpl-psykososialt

Obligatoriske seksjoner:
1. Formål (AML §4-3)
2. Definisjon av trakassering og seksuell trakassering
3. Rutine for å melde fra
4. Konflikthåndtering
5. Forebygging av stress
6. Vold og trusler (AML §4-3 (4))
7. Lederes ansvar

```ts
{
  id: 'tpl-psykososialt',
  label: 'Psykososialt arbeidsmiljø',
  description: 'Policy for trakassering og psykososialt arbeidsmiljø (AML §4-3)',
  legalBasis: ['AML §4-3'],
  category: 'policy',
  page: {
    title: 'Rutine for psykososialt arbeidsmiljø',
    summary: 'Policy for forebygging av trakassering og ivaretakelse av psykososialt miljø',
    status: 'draft', template: 'policy',
    legalRefs: ['AML §4-3'],
    lang: 'nb', requiresAcknowledgement: true, acknowledgementAudience: 'all_employees',
    revisionIntervalMonths: 24, retentionCategory: 'hms_dokument', retainMinimumYears: 5,
    blocks: [
      { kind: 'law_ref', ref: 'AML §4-3', description: 'Psykososialt arbeidsmiljø — vern mot trakassering', url: 'https://lovdata.no/lov/2005-06-17-62/§4-3' },
      { kind: 'heading', level: 2, text: 'Formål' },
      { kind: 'text', body: '<p>Rutinen sikrer et arbeidsmiljø fritt for trakassering og urimelig belastning. Gjelder alle ansatte, innleide og besøkende.</p>' },
      { kind: 'heading', level: 2, text: 'Definisjon av trakassering' },
      { kind: 'text', body: '<p>Trakassering er handlinger eller ytringer som virker krenkende, skremmende eller nedverdigende. Seksuell trakassering er enhver uvelkommen seksuell oppmerksomhet.</p>' },
      { kind: 'heading', level: 2, text: 'Slik melder du fra' },
      { kind: 'alert', variant: 'info', text: 'Meld til nærmeste leder, lederens overordnede, HR eller verneombud. Varslingssystem er tilgjengelig for anonym varsling.' },
      { kind: 'heading', level: 2, text: 'Konflikthåndtering' },
      { kind: 'text', body: '<p>1. Forsøk direkte dialog.<br>2. Involver leder.<br>3. HR bistår med mekling.<br>4. Ekstern mekling ved behov.</p>' },
      { kind: 'heading', level: 2, text: 'Vold og trusler' },
      { kind: 'alert', variant: 'warning', text: 'Ved umiddelbar fare: ring 112. Alle hendelser med vold eller trusler skal registreres som avvik.' },
      { kind: 'module', moduleName: 'action_button', params: { label: 'Meld avvik', route: '/avvik/ny' } },
    ],
  },
}
```

## Legal coverage item

```ts
{ ref: 'AML §4-3', label: 'Psykososialt arbeidsmiljø — vern mot trakassering', templateIds: ['tpl-psykososialt'] }
```

## Validation checklist

- [ ] `npm run build` exits 0
- [ ] `tpl-psykososialt` in template gallery
- [ ] AML §4-3 row in compliance dashboard
- [ ] `requiresAcknowledgement: true`
- [ ] File reads completed

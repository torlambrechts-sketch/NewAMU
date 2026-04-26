# C_AMU-A — AMU-sammensetning valideres ikke (AML §7-3 og §7-4)

## Alvorlighetsgrad: Critical
## Juridisk grunnlag: AML §7-3, AML §7-4

## Problem

AML §7-3 første ledd:
> «Arbeidsmiljøutvalget skal bestå av like mange representanter fra
> arbeidsgiveren og arbeidstakerne.»

AML §7-4 første ledd:
> «Representantene for arbeidstakerne velges blant og av de verneombud som er
> valgt i virksomheten.»

I dag kan et AMU-møte signeres og arkiveres selv om:
- Alle deltakere er arbeidsgiverrepresentanter
- Ingen verneombud deltar
- Arbeidstakersiden har null representanter

Et signert referat fra et slikt møte er formelt ugyldig og vil ikke bestå et
tilsyn fra Arbeidstilsynet.

### Berørte filer (les disse FØR du redigerer noe)

- `modules/amu/AmuParticipantsTable.tsx` — hele filen (211 linjer)
- `modules/amu/AmuDetailView.tsx` — linjene 419–430 (preflight-sjekkliste),
  580–628 (planleggingsfane), 703–730 (signeringsknapp-logikk)
- `modules/amu/useAmu.ts` — linjene 549–583 (`signMeetingAsChair`)
- `supabase/migrations/archive/20260731120000_amu_module_core.sql` — RLS-policy
  for `amu_meetings` update (linjene 323–342) og `amu_participants` (linjene
  343–370)

## Hva som trengs for å oppfylle loven

1. **Visuell advarsel** i deltakertabellen når sammensetning er ufullstendig.
2. **Preflight-punkt** som blokkerer signering uten balansert representasjon.
3. **Database-nivå blokkering** er *ikke* implementert her — det er en P3
   arkitekturendring (se C_AMU-A-db-constraint). Preflight er tilstrekkelig for
   Arbeidstilsynets formål.

_Spesifikasjon for trinn 1 og 2 er dekket i **P1.2_participant_balance_warning.md**.
Les den spesifikasjonen og implementer den FØRSTE._

## Utfyllende juridisk analyse

### AML §7-3 — Sammensetning

| Krav | Status | Risiko ved tilsyn |
|------|--------|-------------------|
| Like mange repr. fra begge sider | Ikke validert | Høy — møtet er ugyldig |
| Minimum 1 verneombud på ansattsiden | Ikke validert | Høy |
| Leder alternerer mellom sidene | Ikke sporet | Medium (se C_AMU-C) |

### AML §7-4 — Verneombudets plass

Verneombudet *skal* representere arbeidstakerne. Å la møtet gjennomføres uten
verneombud bryter §7-4.

### Arbeidstilsynets inspeksjonspraksis

Arbeidstilsynet vil ved tilsyn be om:
1. Liste over AMU-medlemmer med dokumenterte roller
2. Referater som viser at begge sider var representert
3. Bevis på at verneombud var valgt og deltok

## Acceptance criteria (denne spesifikasjonen)

Denne spesifikasjonen fokuserer på én tilleggsendring utover P1.2:
signeringsknappen i `AmuDetailView.tsx` skal ikke bare vise advarselen i
preflight, men det femte preflight-punktet (`participantBalanceOk`) skal *også*
deaktivere selve signeringsknappen.

### Endring i `AmuDetailView.tsx`

Les linjene 719–730. Legg til `!participantBalanceOk` i `disabled`-betingelsen
for `ModuleSignatureCard`:

```tsx
<ModuleSignatureCard
  ...
  disabled={
    !amu.canManage ||
    readOnly ||
    !hasAgenda ||
    !allDecided ||
    !hasMinutes ||
    !hasChair ||
    !participantBalanceOk ||
    saving
  }
  ...
/>
```

### Forklarende tekst i signerings-fanen

Legg til under `ModulePreflightChecklist` (linje 687), men KUN synlig når
`!participantBalanceOk`:

```tsx
{!participantBalanceOk && !readOnly && (
  <InfoBox>
    <strong>AML §7-3 og §7-4:</strong> Signering er blokkert fordi
    representasjonen ikke er i balanse. Gå til Planlegging-fanen og juster
    roller slik at begge sider har like mange representanter og minst ett
    verneombud er inkludert.
  </InfoBox>
)}
```

## Migrasjonsfil

Ingen ny migrasjonsfil nødvendig for denne spesifikasjonen. Database-nivå
constraint vurderes i en fremtidig P3-spesifikasjon.

## Avhengigheter

Denne spesifikasjonen **avhenger av P1.2_participant_balance_warning.md**.
Implementer P1.2 FØR du implementerer denne spesifikasjonen.
`participantBalanceOk` state og `onBalanceChange`-prop defineres i P1.2.

## Valideringscheckliste

- [ ] Lest og implementert **P1.2_participant_balance_warning.md** først
- [ ] Lest `AmuDetailView.tsx` linjene 703–730 i sin helhet
- [ ] `!participantBalanceOk` er lagt til i `disabled`-betingelsen for
  `ModuleSignatureCard`
- [ ] `InfoBox` vises i signerings-fanen når `!participantBalanceOk && !readOnly`
- [ ] `InfoBox` importeres fra `AlertBox`
- [ ] Testen: Opprett et møte uten verneombud → signerings-knapp er deaktivert
- [ ] Testen: Legg til verneombud og balansert repr. → signerings-knapp aktiveres
- [ ] `npm run build` exits 0

# C4 — Kvitteringsrate viser antall, ikke prosent

## Severity: High
## Legal basis: IK-f §5 nr. 4, AML §3-1

## Problem

Dette er det samme tekniske funnet som P1.2, men beskrives her fra et
lovgivningsperspektiv.

`ComplianceDashboard.tsx` linje ~438 viser `{recs.length} signert` uten
å oppgi målgruppens størrelse. En virksomhet med 80 ansatte og en policy
som krever kvittering fra alle kan vise "3 signert" — dashbordet gir ingen
advarsel. Dette er en aktiv feilrepresentasjon av compliance-status.

**Ved Arbeidstilsynet-inspeksjon:** Inspektøren vil spørre om ansatte er
kjent med HMS-rutinene (AML §3-1). Å vise et dashbord med grønn status når
kun 4 % har lest og bekreftet, oppfyller ikke kravet.

## Acceptance criteria

Se **P1.2** for full teknisk implementasjonsbeskrivelse. Nedenfor er de
juridiske kravene denne fixen må oppfylle:

- [ ] Kvitteringsprosent er basert på målgruppens faktiske størrelse
- [ ] Farge-koding: rød ved <60 %, gul ved 60–89 %, grønn ved ≥90 %
- [ ] En side som er tilgjengelig for alle ansatte må vise `X av Y ansatte (Z %)`
- [ ] Administrasjonen kan se hvem som IKKE har signert (for oppfølging)
- [ ] "Send påminnelse"-knapp er til stede (kan være stub, se P1.2)

## Legal justification

**IK-f §5 nr. 4** krever at virksomheten har rutiner for å avdekke og rette
opp overtredelser. Å godkjenne et system som ikke kan bekrefte at rutiner er
kjent for ansatte, er i strid med dette kravet.

**AML §3-1 (2)** krever at arbeidstakere gis nødvendig informasjon og
opplæring. Dokumentert bekreftelse på at informasjonen er mottatt er det
eneste beviset på dette ved inspeksjon.

## Implementation

Se `Claude/P1_high_value/P1.2_acknowledgement_completion_rate.md` for
full implementasjonsbeskrivelse.

## Ekstra: Hvem har IKKE signert

I tillegg til P1.2-kravene, legg til en "Vis ikke-signerte" ekspanderbar
seksjon per side i dashbordet:

```tsx
// Compute unsigned members
const signedIds = new Set(recs.map((r) => r.userId))
const unsigned = members.filter((m) => /* in audience */ && !signedIds.has(m.userId))
```

Render som en kollapsbar liste (bruk `<details><summary>`) med navn på de
som ikke har signert. Vis kun for admin-rollen.

## Validation checklist

- [ ] Se P1.2 validation checklist — alle punkter må være oppfylt
- [ ] Admin kan se liste over ikke-signerte ansatte per side
- [ ] Listen er skjult for ikke-admin brukere
- [ ] Grønn/gul/rød farge-koding reflekterer prosenten korrekt
- [ ] `npm run build` exits 0, zero TS errors

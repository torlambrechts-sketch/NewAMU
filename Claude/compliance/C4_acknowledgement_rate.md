# C4 — Kvitteringsrate viser antall, ikke prosent

## Severity: High
## Legal basis: IK-f §5 nr. 4, AML §3-1

## Problem

`ComplianceDashboard.tsx` viser `{recs.length} signert` uten målgruppens
størrelse. 3 av 80 ansatte ser like bra ut som 80 av 80. Dette er en aktiv
feilrepresentasjon av compliance-status.

**Teknisk implementasjon:** Se `Claude/P1_high_value/P1.2_acknowledgement_completion_rate.md`.

## Juridisk begrunnelse

**IK-f §5 nr. 4** krever rutiner for å avdekke og rette overtredelser. Et
system som ikke kan bekrefte at rutiner er kjent for ansatte oppfyller ikke dette.

**AML §3-1 (2)** krever at arbeidstakere gis nødvendig informasjon. Dokumentert
kvittering er eneste bevis ved inspeksjon.

## Ekstra krav utover P1.2

- [ ] Admin kan se liste over **ikke-signerte** ansatte per side

```tsx
const signedIds = new Set(recs.map((r) => r.userId))
const unsigned = members.filter((m) => /* in audience */ && !signedIds.has(m.userId))
```

Render som kollapsbar `<details><summary>` liste. Kun synlig for admin.

## Validation checklist

- [ ] Alle punkter fra P1.2 validation checklist oppfylt
- [ ] Admin ser liste over ikke-signerte per side
- [ ] Listen er skjult for ikke-admin
- [ ] Grønn/gul/rød farge-koding korrekt
- [ ] `npm run build` exits 0

# C_AMU-B — Møtefrekvens under 4/år varsles ikke (AML §7-3)

## Alvorlighetsgrad: High
## Juridisk grunnlag: AML §7-3 fjerde ledd

## Problem

AML §7-3 fjerde ledd:
> «Arbeidsmiljøutvalget skal ha minst fire ordinære møter i løpet av et
> kalenderår.»

Plattformen viser ikke om denne plikten er oppfylt. Compliance-dashbordet og
AMU-listevisningen teller kun totalt antall møter uten å skille på år eller om
møtene faktisk ble gjennomført.

En organisasjon med 10 planlagte (men ennå ikke avholdte) møter i Q4 ser ut
til å «oppfylle» kravet selv om ingen møter er fullført.

### Berørte filer (les disse FØR du redigerer noe)

- `modules/amu/AmuPage.tsx` — linjene 89–104 (`kpiItems`), 147–165 (body)
- `modules/amu/types.ts` — `AmuMeeting`, `AmuMeetingStatus`
- `src/pages/documents/ComplianceDashboard.tsx` — søk etter AMU-relaterte
  sjekker (C7-spesifikasjonen beskriver `members.length`-buggen)

## Juridisk analyse

### Hva AML §7-3 faktisk krever

- **Minimum**: 4 ordinære møter per kalenderår
- Møter med status `scheduled` eller `active` teller IKKE
- Kun møter med status `completed` eller `signed` teller som gjennomførte
- Ekstraordinære møter (§7-3 tredje ledd) teller ikke mot kvoten

### Arbeidstilsynets inspeksjonspraksis

Arbeidstilsynet vil spørre: «Vis oss AMU-referater fra de siste to kalenderår.»
De forventer minst 4 signerte referater per år. Manglende møtefrekvens er en
av de vanligste §7-3-overtredelsene og kan føre til pålegg.

### Hva som mangler i dag

| Gap | Fil | Konsekvens |
|-----|-----|------------|
| KPI teller totalt, ikke fullført i år | `AmuPage.tsx` L89–104 | Falsk trygghet |
| Compliance-dashbordet bruker wiki-antall | `ComplianceDashboard.tsx` | Se C11-spec |
| Ingen advarsel ved < 4 fullførte | `AmuPage.tsx` | Ingen varsling til admin |

## Acceptance criteria

_Hoveddelen av implementasjonen er definert i **P2.1_annual_cycle_kpi.md**._
Les og implementer P2.1 FØRST.

Denne spesifikasjonen legger til én tilleggsendring:

### Compliance-dashbordet

Hvis `ComplianceDashboard.tsx` eksisterer og viser en AMU-møtesjekk, skal den
sjekken endres til å bruke `amu_meetings`-tabellen direkte i stedet for
wiki-antall.

#### Ny Supabase-spørring i `ComplianceDashboard.tsx`

```typescript
const { data: amuMeetingsThisYear } = await supabase
  .from('amu_meetings')
  .select('id, status, meeting_date')
  .eq('organization_id', orgId)
  .in('status', ['completed', 'signed'])
  .gte(
    'meeting_date',
    `${new Date().getFullYear()}-01-01`,
  )
  .lt(
    'meeting_date',
    `${new Date().getFullYear() + 1}-01-01`,
  )

const amuMeetingCount = amuMeetingsThisYear?.length ?? 0
const amuFrequencyOk = amuMeetingCount >= 4
```

Bruk `amuMeetingCount` og `amuFrequencyOk` i den eksisterende
AMU-frekvens-raden i Compliance-dashbordet. Legg til en note:
```tsx
{amuMeetingCount < 4 && (
  <p className="mt-1 text-xs text-neutral-500">
    AML §7-3: {4 - amuMeetingCount} møte(r) gjenstår for å oppfylle
    lovkravet om minst fire ordinære AMU-møter per kalenderår.
  </p>
)}
```

#### Viktig forhåndssjekk

Før du redigerer `ComplianceDashboard.tsx`: søk etter strenger som «AMU», «amu»
og «møte» i filen. Finn nøyaktig hvilke linjenummer og variabler som brukes i
dag for AMU-møtesjekkene. Rediger KUN det som er dokumentert i filen — gjett
aldri på linjenummer.

## Migrasjonsfil

Ingen ny migrasjonsfil nødvendig. Spørringen mot `amu_meetings` er dekket av
eksisterende RLS-policy (`amu_meetings_select`, migrasjon
`20260731120000_amu_module_core.sql` linjene 292–296).

## Avhengigheter

- **Avhenger av P2.1_annual_cycle_kpi.md** for KPI-endringen i `AmuPage.tsx`
- **Leser C11_amu_meeting_count.md** for `ComplianceDashboard`-kontekst

## Valideringscheckliste

- [ ] Lest og implementert **P2.1_annual_cycle_kpi.md** først
- [ ] Lest `ComplianceDashboard.tsx` i sin helhet FØR endringer
- [ ] Søkt etter «AMU», «amu», «møte» i `ComplianceDashboard.tsx`
- [ ] Spørringen bruker `amu_meetings`-tabellen (ikke wiki-antall)
- [ ] Spørringen filtrerer på `status IN ('completed', 'signed')`
- [ ] Spørringen filtrerer på `meeting_date` i inneværende år
- [ ] Antall vises med referanse til AML §7-3
- [ ] Note om gjenstående møter vises når `amuMeetingCount < 4`
- [ ] `npm run build` exits 0

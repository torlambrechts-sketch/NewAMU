# C_AMU-D — Referat distribueres ikke til partene (AML §7-2(6))

## Alvorlighetsgrad: High
## Juridisk grunnlag: AML §7-2 sjette ledd, IKF §5

## Problem

AML §7-2 sjette ledd:
> «Referatene fra arbeidsmiljøutvalgets møter skal underskrives av møtelederen
> og gjøres tilgjengelige for alle arbeidstakere i virksomheten.»

I dag signeres referater og låses, men:
1. Ingen deltakere mottar en kopi (e-post, varsel, nedlastbar lenke).
2. Det finnes ingen bekreftelse på at referatet er «gjort tilgjengelig».
3. Arbeidstakere som ikke er AMU-deltakere (dvs. alle øvrige ansatte) har ingen
   enkel tilgang til å lese signerte referater.

### Berørte filer (les disse FØR du redigerer noe)

- `modules/amu/AmuDetailView.tsx` — linjene 677–744 (signeringsfanen)
- `modules/amu/useAmu.ts` — linjene 549–583 (`signMeetingAsChair`)
- `supabase/migrations/archive/20260731120300_amu_default_agenda_and_workflow.sql`
  — workflow-trigger `ON_AMU_MEETING_SIGNED` (linjene ~30–60)
- `src/components/workflow/WorkflowRulesTab.tsx` — for kontekst om
  arbeidsflytssystemet
- `src/pages/AmuModuleAdminPage.tsx` — arbeidsflyt-fanen (linjene 332–344)

## Juridisk analyse

### AML §7-2(6) i praksis

«Gjøres tilgjengelig» er ikke presist definert. Arbeidstilsynet aksepterer:
- Oppslag på intranet/intern portal
- E-postdistribusjon til alle AMU-deltakere
- Klarert-plattformen der alle ansatte har tilgang til å lese referater

### Hva plattformen allerede gjør

Eksisterende RLS (`amu_meetings_select`, `amu_decisions_select`): Alle
innloggede brukere i organisasjonen kan lese alle AMU-møter og vedtak.
Dette betyr at **plattformen i seg selv oppfyller tilgjengelighetskravet** —
*forutsatt at alle ansatte har tilgang til plattformen.*

### Hva som fortsatt mangler

| Gap | Konsekvens |
|-----|------------|
| Ingen varsel til deltakere om signert referat | Deltakere vet ikke når de kan lese det |
| Ingen bekreftelse på at distribusjon har skjedd | Kan ikke dokumentere overfor Arbeidstilsynet |
| Ingen lenke fra signerings-UI til PDF-eksport | Brukeren vet ikke at PDF-eksport finnes (P1.4) |

## Løsning i to deler

### Del 1 — Workflow-trigger for distribusjon (eksisterende infrastruktur)

`ON_AMU_MEETING_SIGNED`-triggeren i `amu_default_agenda_and_workflow.sql` er
allerede implementert. Administratoren kan konfigurere en arbeidsflyt i
`AmuModuleAdminPage` → Arbeidsflyt-fanen for å sende e-post/Teams-melding.

**Denne spesifikasjonen legger til:**
En InfoBox i arbeidsflyt-fanen som informerer administratoren om den juridiske
plikten og anbefaler en konkret regeloppsett.

### Del 2 — Distribusjonsstempel på møtet

Ny kolonne `distributed_at` i `amu_meetings` for å dokumentere når referatet
ble distribuert.

#### Migrasjonsfil

Fil: `supabase/migrations/YYYYMMDDHHMMSS_amu_distributed_at.sql`
(Bruk neste timestamp etter `C_AMU-C`-migrasjonen)

```sql
-- Sporingskolonne for distribusjon av signert referat (AML §7-2(6))
ALTER TABLE public.amu_meetings
  ADD COLUMN IF NOT EXISTS distributed_at timestamptz;

COMMENT ON COLUMN public.amu_meetings.distributed_at IS
  'Tidspunkt da signert referat ble distribuert til deltakere og ansatte.
   NULL = ikke distribuert. AML §7-2(6).';
```

#### TypeScript-endringer

**`modules/amu/types.ts`** — legg til i `AmuMeeting`:
```typescript
distributed_at: string | null
```

**`modules/amu/schema.ts`** — legg til i `AmuMeetingDbRowSchema` og
`AmuMeetingSchema`:
```typescript
distributed_at: z.string().nullable().optional().default(null),
```

I `parseAmuMeetingFromDb`:
```typescript
distributed_at: raw.distributed_at ?? null,
```

**`modules/amu/useAmu.ts`** — legg til i `updateMeeting`-patchtypen:
```typescript
| 'distributed_at'
```

Legg til i `dbPatch`-mapping:
```typescript
if (patch.distributed_at !== undefined)
  dbPatch.distributed_at = patch.distributed_at
```

#### UI-endring i signeringsfanen (`AmuDetailView.tsx`)

Etter det grønne «Møtet er signert»-kortet (linjene 732–742), legg til
en distribusjonsbekreftelse:

```tsx
{meeting.status === 'signed' && (
  <div className="rounded-xl border border-neutral-200 bg-white p-5">
    <h3 className="text-sm font-semibold text-neutral-900">
      Distribusjon av referat (AML §7-2(6))
    </h3>
    {meeting.distributed_at ? (
      <p className="mt-1 text-sm text-green-700">
        ✓ Distribuert{' '}
        {new Date(meeting.distributed_at).toLocaleDateString('nb-NO', {
          day: 'numeric', month: 'long', year: 'numeric',
        })}
      </p>
    ) : (
      <>
        <p className="mt-1 text-sm text-neutral-600">
          Referatet er ikke markert som distribuert. AML §7-2(6) krever at
          referatet gjøres tilgjengelig for alle arbeidstakere.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Alle ansatte med tilgang til Klarert kan allerede lese dette
          referatet. Klikk nedenfor for å bekrefte distribusjon og loggføre
          tidspunktet.
        </p>
        {amu.canManage && (
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              const next = await amu.updateMeeting(meeting.id, {
                distributed_at: new Date().toISOString(),
              })
              if (next) setMeeting(next)
              setSaving(false)
            }}
          >
            Bekreft distribusjon
          </Button>
        )}
      </>
    )}
  </div>
)}
```

#### Informasjonsboks i arbeidsflyt-fanen (`AmuModuleAdminPage.tsx`)

I arbeidsflyt-fanen (linjene 332–344), legg til en `InfoBox` FØR
`WorkflowRulesTab`:

```tsx
<InfoBox>
  <strong>AML §7-2(6) — Distribusjonsplikten:</strong> Signerte referater
  skal gjøres tilgjengelige for alle arbeidstakere. Sett opp en arbeidsflyt
  for <strong>ON_AMU_MEETING_SIGNED</strong> for å sende e-post automatisk
  til AMU-deltakere og/eller publisere en lenke på intranett.
</InfoBox>
```

Importer `InfoBox` fra `../components/ui/AlertBox` (legg til i eksisterende
import på linje 20).

## Anti-patterns

- **Ikke** send e-post direkte fra React-klienten — bruk workflow-systemet.
- **Ikke** blokker signering inntil distribusjon er bekreftet — distribusjon
  skjer naturlig *etter* signering.
- **Ikke** fjern `distributed_at` fra `updateMeeting` patch-type selv om det
  virker spesifikt — det holder `updateMeeting` generisk.

## Avhengigheter

- **Avhenger av P1.4_meeting_pdf_export.md** — PDF-eksportknappen bør stå
  ved siden av distribusjonsbekreftelsen. Implementer P1.4 FØRST.

## Valideringscheckliste

- [ ] Migrasjonsfil opprettet med korrekt timestamp
- [ ] `distributed_at`-kolonne lagt til i `amu_meetings`
- [ ] `AmuMeeting`-interfacet oppdatert i `types.ts`
- [ ] `AmuMeetingSchema` og `AmuMeetingDbRowSchema` oppdatert i `schema.ts`
- [ ] `parseAmuMeetingFromDb` mapper `distributed_at`
- [ ] `updateMeeting` i `useAmu.ts` håndterer `distributed_at`-patch
- [ ] «Bekreft distribusjon»-knapp vises for usignerte referater (status signed,
  distributed_at = null)
- [ ] Bekreftelsestekst vises når `distributed_at` er satt
- [ ] `InfoBox` med distribusjonsplikten vist i arbeidsflyt-fanen
- [ ] `InfoBox` importert i `AmuModuleAdminPage.tsx`
- [ ] `npm run build` exits 0

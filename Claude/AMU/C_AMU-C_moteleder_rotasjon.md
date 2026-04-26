# C_AMU-C — Møtelederrotasjon spores ikke (AML §7-5)

## Alvorlighetsgrad: Medium
## Juridisk grunnlag: AML §7-5

## Problem

AML §7-5 første ledd:
> «Ledelsen av arbeidsmiljøutvalget veksler mellom arbeidsgivernes og
> arbeidstakernes representanter. Ledervervet innehavs vekselvis for ett år
> om gangen, med mindre utvalget beslutter noe annet.»

I dag har `amu_meetings`-tabellen kun `meeting_chair_user_id` (en `uuid`
som peker på hvilken bruker som er møteleder). Det er ingenting som:

1. Kobler møtelederen til arbeidsgiver- eller arbeidstakersiden.
2. Varsler administratoren om hvilken side som skal ha ledervervet i år.
3. Hinder at samme side har ledervervet to år på rad.

### Berørte filer (les disse FØR du redigerer noe)

- `supabase/migrations/archive/20260731120200_amu_meetings_referat_minutes.sql`
  — legg til `chair_side`-kolonne
- `modules/amu/types.ts` — `AmuMeeting`-interface
- `modules/amu/schema.ts` — `AmuMeetingSchema` / `AmuMeetingDbRowSchema`
- `modules/amu/useAmu.ts` — `updateMeeting`, `signMeetingAsChair`,
  `parseAmuMeetingFromDb`
- `modules/amu/AmuDetailView.tsx` — signeringsfanen (linjene 686–744)
- `src/pages/AmuModuleAdminPage.tsx` — generelt-fanen (linjene 199–212)

## Juridisk analyse

### Hva AML §7-5 krever i praksis

- Ledervervet veksler MELLOM to sider (arbeidsgiver/arbeidstaker).
- Ikke: veksler mellom to konkrete navngitte personer.
- Vekslingen skjer normalt hvert kalenderår.
- AMU kan selv vedta en annen ordning (f.eks. halvårlig).

### Arbeidstilsynets inspeksjonspraksis

Arbeidstilsynet sjekker ikke dette aktivt i alle tilsyn, men vil spørre om
det ved tematilsyn på «samarbeid og medvirkning». Risikoen er Medium.

## Database-migrasjon

Ny migrasjonsfil:
`supabase/migrations/YYYYMMDDHHMMSS_amu_chair_side.sql`

Bytt ut `YYYYMMDDHHMMSS` med neste tilgjengelige timestamp (etter
`20260731120200`).

```sql
-- Sporingskolonne for hvilken side som leder møtet (AML §7-5)
ALTER TABLE public.amu_meetings
  ADD COLUMN IF NOT EXISTS chair_side text
    CHECK (chair_side IS NULL OR chair_side IN ('employer', 'employee'));

COMMENT ON COLUMN public.amu_meetings.chair_side IS
  'Hvilken side (arbeidsgiver/arbeidstaker) som leder møtet — AML §7-5.
   NULL = ikke satt. employer = arbeidsgiversiden. employee = arbeidstakersiden.';
```

Ingen endring i RLS — eksisterende `amu_meetings_update`-policy gjelder.

## TypeScript-endringer

### `modules/amu/types.ts`

Legg til `chair_side` i `AmuMeeting`-interfacet:

```typescript
chair_side: 'employer' | 'employee' | null
```

### `modules/amu/schema.ts`

I `AmuMeetingDbRowSchema` (legg til felt):

```typescript
chair_side: z.enum(['employer', 'employee']).nullable().optional().default(null),
```

I `AmuMeetingSchema`:

```typescript
chair_side: z.enum(['employer', 'employee']).nullable(),
```

I `parseAmuMeetingFromDb`-funksjonen, map `raw.chair_side`:

```typescript
chair_side: raw.chair_side ?? null,
```

### `modules/amu/useAmu.ts`

I `updateMeeting`-patchtypen (linjene 620–632), legg til:

```typescript
| 'chair_side'
```

I `dbPatch`-mappingen (linjene 646–654), legg til:

```typescript
if (patch.chair_side !== undefined) dbPatch.chair_side = patch.chair_side
```

## UI-endringer

### `modules/amu/AmuDetailView.tsx` — signeringsfanen

Legg til `chairSide`-state (etter `chairUserId`, ca. linje 128):

```tsx
const [chairSide, setChairSide] = useState<'employer' | 'employee' | ''>('')
```

Synkroniser ved innlasting i `refreshMeetingBundle` (etter `setChairUserId`):

```tsx
setChairSide(m.chair_side ?? '')
```

I signeringsfanen (linjene 686–744), legg til side-velger UNDER møteleder-velgeren:

```tsx
{!readOnly && (
  <div className={WPSTD_FORM_ROW_GRID}>
    <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="amu-chair-side">
      Møteleder representerer (AML §7-5)
    </label>
    <SearchableSelect
      value={chairSide}
      options={[
        { value: '', label: 'Ikke angitt' },
        { value: 'employer', label: 'Arbeidsgiversiden' },
        { value: 'employee', label: 'Arbeidstakersiden' },
      ]}
      onChange={(v) => setChairSide(v as 'employer' | 'employee' | '')}
      disabled={!amu.canManage}
    />
  </div>
)}
{meeting.chair_side && readOnly && (
  <p className="text-sm text-neutral-700">
    Møteledet av:{' '}
    <strong>
      {meeting.chair_side === 'employer'
        ? 'Arbeidsgiversiden'
        : 'Arbeidstakersiden'}
    </strong>
    {' '}(AML §7-5)
  </p>
)}
```

Oppdater `onSignMeeting` (linjene 403–417) for å inkludere `chair_side`:

```tsx
await amu.updateMeeting(meeting.id, {
  meeting_chair_user_id: chairUserId || null,
  chair_side: (chairSide as 'employer' | 'employee') || null,
})
```

### `src/pages/AmuModuleAdminPage.tsx` — Generelt-fane

I generelt-fanen (linjene 199–212), legg til informasjonsboks om rotasjonsregel:

```tsx
<div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
  <h3 className="text-sm font-semibold text-neutral-900">Møtelederrotasjon (AML §7-5)</h3>
  <p className="mt-1 text-sm text-neutral-600">
    Ledervervet skal veksle mellom arbeidsgiver- og arbeidstakersiden for ett
    år om gangen. Registrer hvilken side som leder hvert møte i signeringsfanen.
    Systemet varsler ikke automatisk om rotasjonsplikten — dette er
    organisasjonens ansvar å overholde.
  </p>
</div>
```

## Anti-patterns

- **Ikke** automatisk beregn hvilken side som skal lede — dette avhenger av
  organisasjonens vedtakde rotasjonsordning og kan ikke utledes av data.
- **Ikke** blokker signering ved manglende `chair_side` — dette er en
  dokumentasjonsplikt, ikke en formell ugyldighetsbetingelse.
- **Ikke** legg `chair_side` inn i preflight-sjekklisten som blokkerende — det
  er informativt, ikke obligatorisk.

## Valideringscheckliste

- [ ] Migrasjonsfil opprettet med korrekt timestamp (etter `20260731120200`)
- [ ] `chair_side`-kolonne lagt til i `amu_meetings` med CHECK constraint
- [ ] `AmuMeeting`-interfacet oppdatert i `types.ts`
- [ ] `AmuMeetingSchema` oppdatert i `schema.ts`
- [ ] `parseAmuMeetingFromDb` mapper `chair_side`
- [ ] `updateMeeting` i `useAmu.ts` håndterer `chair_side`-patch
- [ ] `chairSide`-state eksisterer i `AmuDetailView`
- [ ] Side-velger vises i signeringsfanen (kun ikke-signerte møter)
- [ ] Signert møte viser valgt side som tekst
- [ ] Informasjonsboks lagt til i AmuModuleAdminPage generelt-fane
- [ ] `npm run build` exits 0

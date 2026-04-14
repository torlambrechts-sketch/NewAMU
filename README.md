# Klarert — arbeidsplass, samsvar og internkontroll

**Logo:** Bytt ut `public/favicon.svg` og `public/brand/klarert-mark.svg` med eksport fra design (samme kvadratiske merke brukes i `KlarertLogo`).

React (Vite) + TypeScript + Tailwind CSS. Run `npm install`, then `npm run dev`.

- **Navigation** — Two-level header with module groups (Workspace, Arbeidsplassrapportering, Compliance, Council, Library). **Section submenu** switches with the route. Home is via the **Klarert** logo.
- **/** — Project dashboard (Adobe Analytics replica) with departments table and expandable row.
- **/tasks** — Task management: add/edit/delete tasks, status workflow; stored in `localStorage`.
- **/council** — Arbeidsmiljøråd: styre/valg, **årshjul** (mål 4 ordinære møter/år), **foreslått agenda per kvartal**, **møteforberedelse**, **revisjonslogg** (diskusjon, notater, vedtak). Ikke juridisk rådgivning.
- **/members** — Valg av arbeidstakerrepresentanter (valgfritt **anonymt**), **50/50**-kontroll, roller (leder/nestleder/medlem), **opplæringskrav per rolle**, **valgperioder**, **revisjonslogg**. Ikke juridisk rådgivning.
- **/org-health** — Medarbeiderundersøkelser (Likert + fritekst, valgfritt **anonymt** — fritekst lagres ikke, kun aggregat), **NAV/sykefravær** (manuell registrering), **AML-indikatorer**, **anonym AML-rapportering** (hendelse, nestenulykke, trakassering, vold, psykososialt, varsling, annet — fritekst lagres ikke; kun kategori/hastegrad/indikator), **revisjonslogg**. **/org-health/settings** — **veikart** (bl.a. planlagt bedriftsomtale for å eksponere rapportering og valg for hele selskapet).
- **/internal-control** — **Internkontroll** (demo): **varslingssaker** med status (mottatt → … → intern revisjon → avsluttet), kobling fra anonyme org.health-meldinger, **ROS**-tabell (risikoscore), **årsgjennomgang** av internkontrollen, hendelseslogg. **Ikke juridisk komplett** — se disclaimer i UI.
- **/hse** — HMS / verneombud: **vernerunder** med AML-sjekkliste, **inspeksjoner** (tabell + klassisk logg), **konfigurerbare inspeksjonsrunder** (typer, maler, felt, lokasjoner, planer, avvik) under **/hse/inspection-settings**, **hendelser/nestenulykker**, AML-strukturoversikt, **revisjonslogg**. Med innlogget org lagres HMS i **Supabase** (`org_module_payloads`, `module_key = hse`); uten: **localStorage**.
- **/tasks** — **Samlet oppgaveliste** på tvers av moduler (kilde, rolle, frist), **digital signatur** (utfører + valgfri ledelsesgodkjenning), **oppgavelogg**; moduler lenker hit med forutfylt skjema.
- **/learning** — **Læringsmodul** (Pinpoint-inspirert layout: krem `#FCF8F0` + skoggrønn `#2D403A`): **kursliste**, **kursbygger** med primær-/sekundærfaner (modultyper: flashcards, quiz, **rik tekst** (Quill) for tekst-/«annet»-moduler, bilde, video, sjekkliste, praktiske tips, on-the-job), **forhåndsvisning** for deltakere (HTML vises trygt via DOMPurify), **sertifiseringer**, **innsikt**, **deltakere**, **Settings**: **export/import JSON** (full tilstand eller under **Per kurs og andre deler**: ett kurs, all fremdrift, alle sertifikater — delimport **flettes** inn), **reset** (localStorage).
- **/hrm/employees** & **/hrm/salary** — HRM module screens (lime accent) from the second design.

## Deployment (SPA routing)

This app uses client-side routes. The host must serve `index.html` for all paths (refresh/deep links), or you get **404 NOT_FOUND**.

- **Vercel:** `vercel.json` includes rewrites to `index.html`.
- **Netlify:** `public/_redirects` sends `/*` to `/index.html` with 200.

For **Cloudflare Pages**, add a `_redirects` file in the **build output** root (same rule as Netlify) or use **Pages → Settings → Functions → SPA fallback** / a `_routes.json` or **Workers** rewrite as in their docs.

## Supabase (valgfritt)

Uten Supabase kjører appen fortsatt med **localStorage** i moduler som ikke er koblet til database. For multi-tenant auth, organisasjon og RBAC:

1. **Prosjekt** i [Supabase](https://supabase.com): kopier **Project URL** og **anon public** API-nøkkel.
2. **Vercel → Environment Variables**: enten bruk variablene Vercel fyller inn (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — Vite er satt opp med `envPrefix` så de blir med i bygget — eller legg til `VITE_SUPABASE_URL` og **anon/publishable key** som `VITE_SUPABASE_ANON_KEY` **eller** `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (samme verdi som «anon public» i Supabase).
3. **Database schema:** kjør SQL-filene i `supabase/migrations/` i **Supabase → SQL Editor**, eller bruk **direkte Postgres** (se under). Koden i repoet kan ikke oppdatere databasen din uten at **du** gir en tilkoblingsstreng i miljøet ditt (lokalt, CI eller agent med tilgang til hemmeligheter).
4. **Ikke** eksponer `service_role`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL_NON_POOLING`, eller Postgres-passord i **frontend** (Vite bygger inn `VITE_*`). Disse er for **server**, **CLI** eller **CI** — ikke for nettleserappen.

### Migrasjoner med `psql` (lokalt eller CI)

1. **Postgres-URL** fra Supabase (**Settings → Database**): f.eks. non-pooling / connection string — samme type som `POSTGRES_URL_NON_POOLING` i Vercel.
2. **`psql`** installert (`postgresql-client` på Linux, `libpq` på macOS).
3. Eksporter én av: `DATABASE_URL`, `POSTGRES_URL_NON_POOLING`, `DIRECT_URL` eller `POSTGRES_URL`, deretter:

```bash
npm run db:migrate
```

**GitHub Actions:** Workflow **Apply Supabase migrations** (`workflow_dispatch`). Legg inn repository secret **`DATABASE_URL`** eller **`POSTGRES_URL_NON_POOLING`**.

**Språk (profil):** Kjør migrasjon **`20260406120000_profiles_locale.sql`** for `profiles.locale` (`nb` / `en`). Brukerens valg lagres i databasen; **`/profile`** og språkvelger i toppfeltet.

5. **Ny deploy** etter at variablene er satt.

**Cursor MCP** til Supabase hjelper IDE/agent med database/SQL; det erstatter ikke at nettleseren får URL + anon-nøkkel ved build.

Tabeller og **Row Level Security (RLS)** må settes opp i Supabase før klienten trygt kan lese/skrive data.

### Organisasjon og onboarding (database)

1. Kjør SQL fra `supabase/migrations/20260401120000_org_structure.sql`, deretter **`20260402120000_rbac_invites.sql`**, **`20260402120100_org_creation_admin_roles.sql`**, og ved **500-feil på `/profiles`**: **`20260405120000_fix_profiles_rls_no_recursion.sql`**. Ved org.nr. som allerede finnes: **`20260405130000_create_org_join_if_exists.sql`**. Ved behov: **`20260405140000_org_rpc_user_facing_messages.sql`**, **`20260405150000_profiles_update_rls_split.sql`**, **`20260405160000_profiles_rls_no_subquery_recursion.sql`**, **`20260404180000_profile_full_name_metadata.sql`**.
2. **Authentication → Providers**: slå på **Email** (passord).
3. **`/signup`** og **`/login`**. Kjør migrasjon **`20260404180000_profile_full_name_metadata.sql`** hvis du har eldre SQL.
4. **Roller:** se `src/lib/permissionKeys.ts`; **`get_my_effective_permissions()`** i klienten.
5. **Invitasjoner:** **`/admin`** → `create_invitation` → `/invite/:token` → `accept_invitation`.
6. **Delegering:** tabell `role_delegations` (Admin-UI).

Brønnøysund-proxy: `/brreg-api/...` (Vite + Vercel). `organization_members` er HR-katalog; `profiles` kobler innlogget bruker til `organizations`.

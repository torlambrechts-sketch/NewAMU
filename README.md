# atics — task & workspace UI

React (Vite) + TypeScript + Tailwind CSS. Run `npm install`, then `npm run dev`.

- **Navigation** — Two-level header: **Council** is a separate highlighted group on the left of the primary row (then a divider), followed by Members, Org health, HSE, **Internkontroll** (varslingssaker med status, ROS-mal, årsgjennomgang — med disclaimer), Tasks, E-learning. **Section submenu** switches with the route. Home/project dashboard is via the **atics** logo.
- **/** — Project dashboard (Adobe Analytics replica) with departments table and expandable row.
- **/tasks** — Task management: add/edit/delete tasks, status workflow; stored in `localStorage`.
- **/council** — Arbeidsmiljøråd: styre/valg, **årshjul** (mål 4 ordinære møter/år), **foreslått agenda per kvartal**, **møteforberedelse**, **revisjonslogg** (diskusjon, notater, vedtak). Ikke juridisk rådgivning.
- **/members** — Valg av arbeidstakerrepresentanter (valgfritt **anonymt**), **50/50**-kontroll, roller (leder/nestleder/medlem), **opplæringskrav per rolle**, **valgperioder**, **revisjonslogg**. Ikke juridisk rådgivning.
- **/org-health** — Medarbeiderundersøkelser (Likert + fritekst, valgfritt **anonymt** — fritekst lagres ikke, kun aggregat), **NAV/sykefravær** (manuell registrering), **AML-indikatorer**, **anonym AML-rapportering** (hendelse, nestenulykke, trakassering, vold, psykososialt, varsling, annet — fritekst lagres ikke; kun kategori/hastegrad/indikator), **revisjonslogg**. **/org-health/settings** — **veikart** (bl.a. planlagt bedriftsomtale for å eksponere rapportering og valg for hele selskapet).
- **/internal-control** — **Internkontroll** (demo): **varslingssaker** med status (mottatt → … → intern revisjon → avsluttet), kobling fra anonyme org.health-meldinger, **ROS**-tabell (risikoscore), **årsgjennomgang** av internkontrollen, hendelseslogg. **Ikke juridisk komplett** — se disclaimer i UI.
- **/hse** — HMS / verneombud: **vernerunder** med AML-sjekkliste, **inspeksjoner**, **hendelser/nestenulykker**, AML-strukturoversikt, **streng revisjonslogg** (append-only).
- **/tasks** — **Samlet oppgaveliste** på tvers av moduler (kilde, rolle, frist), **digital signatur** (utfører + valgfri ledelsesgodkjenning), **oppgavelogg**; moduler lenker hit med forutfylt skjema.
- **/learning** — **Læringsmodul** (Pinpoint-inspirert layout: krem `#FCF8F0` + skoggrønn `#2D403A`): **kursliste**, **kursbygger** med primær-/sekundærfaner (modultyper: flashcards, quiz, **rik tekst** (Quill) for tekst-/«annet»-moduler, bilde, video, sjekkliste, praktiske tips, on-the-job), **forhåndsvisning** for deltakere (HTML vises trygt via DOMPurify), **sertifiseringer**, **innsikt**, **deltakere**, **Settings**: **export/import JSON** (full tilstand eller under **Per kurs og andre deler**: ett kurs, all fremdrift, alle sertifikater — delimport **flettes** inn), **reset** (localStorage).
- **/hrm/employees** & **/hrm/salary** — HRM module screens (lime accent) from the second design.

## Deployment (SPA routing)

This app uses client-side routes. The host must serve `index.html` for all paths (refresh/deep links), or you get **404 NOT_FOUND**.

- **Vercel:** `vercel.json` includes rewrites to `index.html`.
- **Netlify:** `public/_redirects` sends `/*` to `/index.html` with 200.

For **Cloudflare Pages**, add a `_redirects` file in the **build output** root (same rule as Netlify) or use **Pages → Settings → Functions → SPA fallback** / a `_routes.json` or **Workers** rewrite as in their docs.

## Supabase (valgfritt)

Denne appen er ellers **kun klient + localStorage**. For å koble til Supabase:

1. **Prosjekt** i [Supabase](https://supabase.com): kopier **Project URL** og **anon public** API-nøkkel.
2. **Vercel → Environment Variables**: enten bruk variablene Vercel fyller inn (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — Vite er satt opp med `envPrefix` så de blir med i bygget — eller legg til `VITE_SUPABASE_URL` og **anon/publishable key** som `VITE_SUPABASE_ANON_KEY` **eller** `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (samme verdi som «anon public» i Supabase).
3. **Database schema:** kjør SQL-filene i `supabase/migrations/` i **Supabase → SQL Editor** (eller CLI mot prosjektet). Koden herfra kan ikke oppdatere din eksterne database uten dine hemmelige nøkler.
4. **Ikke** eksponer `service_role`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL_NON_POOLING`, eller Postgres-passord i **frontend** (Vite bygger inn `VITE_*`). Disse er for **server**, **CLI** eller **CI** — ikke for nettleserappen. De løser ikke innlogging i seg selv.
5. **Ny deploy** etter at variablene er satt. På **prosjektforsiden** (`/`) vises et **Supabase**-kort som sjekker `/auth/v1/health`.

**Cursor MCP** til Supabase hjelper IDE/agent med database/SQL; det erstatter ikke at nettleseren får URL + anon-nøkkel ved build.

Tabeller og **Row Level Security (RLS)** må settes opp i Supabase før klienten trygt kan lese/skrive data.

### Organisasjon og onboarding (database)

1. Kjør SQL fra `supabase/migrations/20260401120000_org_structure.sql`, deretter **`20260402120000_rbac_invites.sql`** og **`20260402120100_org_creation_admin_roles.sql`**, i **Supabase → SQL Editor** (rekkefølge: org → RBAC → org creation patch).
2. **Authentication → Providers**: slå på **Email** (passord). **Anonymous** kan skrus av i produksjon når e-post/invitasjoner brukes.
3. **Registrering og innlogging:** **`/signup`** (fullt navn + e-post + passord) og **`/login`**. Feilmeldinger er oversatt til norsk der det er mulig. Hvis Supabase krever **bekreftet e-post**, må brukeren åpne lenken i mailen før innlogging fungerer — ellers ser det ut som «tilbake til pålogging» uten tydelig årsak. Kjør også migrasjon **`20260404180000_profile_full_name_metadata.sql`** hvis du allerede har kjørt eldre SQL (oppdaterer `handle_new_user` til å bruke `full_name` fra metadata).
4. **Roller og rettigheter:** Tillatelsesnøkler som `module.view.council`, `users.invite`, `roles.manage` m.m. — se `src/lib/permissionKeys.ts`. Funksjonen **`get_my_effective_permissions()`** brukes i klienten; **org-admin** får alle nøkler som finnes i orgens roller.
5. **Invitasjoner:** Admin bruker **`/admin`** → RPC `create_invitation` (lenke `/invite/:token`). Mottaker registrerer seg / logger inn med **samme e-post** og åpner lenken; `accept_invitation` kobler profil til org og tildeler roller.
6. **Delegering:** Tabell `role_delegations` — admin kan gi midlertidig samme rettigheter som en rolle til en annen bruker (styres i **Admin**-fanen).
7. **Import/eksport:** På **`/admin`** kan brukerlisten eksporteres som JSON (Auth-brukere må fortsatt inviteres for ekte kontoer).

Brønnøysund-proxy: `/brreg-api/...` (Vite + Vercel). `organization_members` er HR-katalog; `profiles` kobler innlogget bruker til `organizations`.

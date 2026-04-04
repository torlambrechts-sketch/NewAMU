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
2. **Vercel → Environment Variables**: enten bruk variablene Vercel fyller inn (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — Vite er satt opp med `envPrefix` så de blir med i bygget — eller legg til `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY` med samme verdier.
3. **Ikke** eksponer `service_role`, `SUPABASE_SECRET_KEY`, eller Postgres-passord i frontend; de hører hjemme i server/Edge Functions.
4. **Ny deploy** etter at variablene er satt. På **prosjektforsiden** (`/`) vises et **Supabase**-kort som sjekker `/auth/v1/health`.

**Cursor MCP** til Supabase hjelper IDE/agent med database/SQL; det erstatter ikke at nettleseren får URL + anon-nøkkel ved build.

Tabeller og **Row Level Security (RLS)** må settes opp i Supabase før klienten trygt kan lese/skrive data.

### Organisasjon og onboarding (database)

1. Kjør SQL fra `supabase/migrations/20260401120000_org_structure.sql` i **Supabase → SQL Editor** (eller CLI).
2. **Authentication → Providers**: slå på **Anonymous sign-ins** (midlertidig, til ekte signup finnes på plass).
3. Etter deploy med Supabase-env: brukere uten fullført oppsett sendes til **`/onboarding`**. Veiviseren henter virksomhet fra **Brønnøysund** (`/brreg-api/...` — proxy i Vite dev og `vercel.json` i prod), oppretter rad i `organizations` via RPC `create_organization_with_brreg`, og lar deg legge inn **avdelinger**, **team**, **lokasjoner** og **personer** (katalog, ikke auth-brukere ennå).
4. `organization_members` er HR-/org-struktur; `profiles` kobler innlogget bruker til `organizations`.

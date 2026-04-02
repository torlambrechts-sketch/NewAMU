# atics — task & workspace UI

React (Vite) + TypeScript + Tailwind CSS. Run `npm install`, then `npm run dev`.

- **Navigation** — Two-level header: **Council** is a separate highlighted group on the left of the primary row (then a divider), followed by Members, Org health, HSE, **Internkontroll**, **Prosesser**, **Dashboards** (samlet KPI: ledelse, internkontroll, org health, læring, oppgaver, compliance, AMU, prosesser, HSE), Tasks, E-learning. **Section submenu** switches with the route. Home/project dashboard is via the **atics** logo.
- **/** — Project dashboard (Adobe Analytics replica) with departments table and expandable row.
- **/tasks** — Task management: add/edit/delete tasks, status workflow; stored in `localStorage`.
- **/council** — Arbeidsmiljøråd: styre/valg, **årshjul** (mål 4 ordinære møter/år), **foreslått agenda per kvartal**, **møteforberedelse**, **revisjonslogg** (diskusjon, notater, vedtak). Ikke juridisk rådgivning.
- **/members** — Valg av arbeidstakerrepresentanter (valgfritt **anonymt**), **50/50**-kontroll, roller (leder/nestleder/medlem), **opplæringskrav per rolle**, **valgperioder**, **revisjonslogg**. Ikke juridisk rådgivning.
- **/org-health** — Undersøkelser: **medarbeider/NPS** (0–10, drivere, seksjoner), **psykososial AML-mal**, NPS-pulse, egne spørsmål (Likert, NPS, flervalg, fritekst, seksjoner); **svarprosent** mot estimert populasjon; **NPS-score** + fordeling; **oppfølgingsoppgave** til **Tasks** med resultatsammendrag. Valgfritt **anonymt** (fritekst lagres ikke). I tillegg: **NAV/sykefravær**, **AML-indikatorer**, **anonym AML-rapportering**, **revisjonslogg**. **/org-health/settings** — veikart.
- **/internal-control** — **Internkontroll** (demo): **varslingssaker** med status (mottatt → … → intern revisjon → avsluttet), kobling fra anonyme org.health-meldinger, **ROS**-tabell (risikoscore), **årsgjennomgang** av internkontrollen, hendelseslogg. **Ikke juridisk komplett** — se disclaimer i UI.
- **/workflows** — **Prosessbygger**: maler (medvirkning, ROS, tiltak) eller tom prosess; rediger steg, rekkefølge, rolle-hint, veiledende frist, snarvei til modul; **Oppgave fra steg** prefyller Tasks med kilde `workflow_step`. Erstatter ikke AMU/BHT — støtte for planlegging.
- **/dashboards** — **Samlet oversikt**: KPI-kort og tabeller på tvers av internkontroll (varsling, ROS-risiko, årsgjennomgang), dokumenter, org health (undersøkelser, NAV-trend), læring (fullføring), oppgaver (status/modul), compliance-matrise, Council (valg, møter), prosesser, HSE.
- **/hse** — HMS / verneombud: **vernerunder** med AML-sjekkliste, **inspeksjoner**, **hendelser/nestenulykker**, AML-strukturoversikt, **streng revisjonslogg** (append-only).
- **/tasks** — **Samlet oppgaveliste** på tvers av moduler (kilde, rolle, frist), **digital signatur** (utfører + valgfri ledelsesgodkjenning), **oppgavelogg**; moduler lenker hit med forutfylt skjema.
- **/documents** — **Dokumentsenter**: bibliotek med **kategorifilter**, maler, wiki-lenker, **vedlegg** (PDF/bilde/TXT, demo-lagring), **interne kilder** (forhåndsdefinerte lenker til Council, HSE, internkontroll, læring m.m. + egne stier), **/documents/checklist** (dokumentasjonsplan med alle påkrevde/anbefalte punkter og fremdrift), **/documents/search**, **/documents/compliance**; **/documents/settings** eksport/import (inkl. master-sjekkliste) og veikart fase 3.
- **/learning** — **Læringsmodul** (Pinpoint-inspirert layout: krem `#FCF8F0` + skoggrønn `#2D403A`): **kursliste**, **kursbygger** med primær-/sekundærfaner (modultyper: flashcards, quiz, **rik tekst** (Quill) for tekst-/«annet»-moduler, bilde, video, sjekkliste, praktiske tips, on-the-job), **forhåndsvisning** for deltakere (HTML vises trygt via DOMPurify), **sertifiseringer**, **innsikt**, **deltakere**, **Settings**: **export/import JSON** (full tilstand eller under **Per kurs og andre deler**: ett kurs, all fremdrift, alle sertifikater — delimport **flettes** inn), **reset** (localStorage).
- **/hrm/employees** & **/hrm/salary** — HRM module screens (lime accent) from the second design.

## Deployment (SPA routing)

This app uses client-side routes. The host must serve `index.html` for all paths (refresh/deep links), or you get **404 NOT_FOUND**.

- **Vercel:** `vercel.json` includes rewrites to `index.html`.
- **Netlify:** `public/_redirects` sends `/*` to `/index.html` with 200.

For **Cloudflare Pages**, add a `_redirects` file in the **build output** root (same rule as Netlify) or use **Pages → Settings → Functions → SPA fallback** / a `_routes.json` or **Workers** rewrite as in their docs.

# atics — task & workspace UI

React (Vite) + TypeScript + Tailwind CSS. Run `npm install`, then `npm run dev`.

- **/** — Project dashboard (Adobe Analytics replica) with departments table and expandable row.
- **/tasks** — Task management: add/edit/delete tasks, status workflow; stored in `localStorage`.
- **/council** — Arbeidsmiljøråd: styre/valg, **årshjul** (mål 4 ordinære møter/år), **foreslått agenda per kvartal**, **møteforberedelse**, **revisjonslogg** (diskusjon, notater, vedtak). Ikke juridisk rådgivning.
- **/members** — Valg av arbeidstakerrepresentanter (valgfritt **anonymt**), **50/50**-kontroll, roller (leder/nestleder/medlem), **opplæringskrav per rolle**, **valgperioder**, **revisjonslogg**. Ikke juridisk rådgivning.
- **/org-health** — Medarbeiderundersøkelser (Likert + fritekst, valgfritt **anonymt** — fritekst lagres ikke, kun aggregat), **NAV/sykefravær** (manuell registrering), **AML-indikatorer** (ROS, varsling, HMS-timer, m.m.), **revisjonslogg**.
- **/hrm/employees** & **/hrm/salary** — HRM module screens (lime accent) from the second design.

## Deployment (SPA routing)

This app uses client-side routes. The host must serve `index.html` for all paths (refresh/deep links), or you get **404 NOT_FOUND**.

- **Vercel:** `vercel.json` includes rewrites to `index.html`.
- **Netlify:** `public/_redirects` sends `/*` to `/index.html` with 200.

For **Cloudflare Pages**, add a `_redirects` file in the **build output** root (same rule as Netlify) or use **Pages → Settings → Functions → SPA fallback** / a `_routes.json` or **Workers** rewrite as in their docs.

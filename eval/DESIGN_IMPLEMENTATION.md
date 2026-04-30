# E-læring — Design-implementering (AMU Mockup)

## Hva ble gjort

Full design-implementering av Klarert AMU-designsystemet i alle e-læringsider.
Endringene er basert på `Claude/AMU Mockup.html` og eval-filene i `eval/ux/`.

---

## Designsystem som er implementert

### Fargetokens (CSS-variabler i `src/index.css`)
| Token | Verdi | Bruk |
|-------|-------|------|
| `--forest` | `#1a3d32` | Primær grønn, knapper, aktiv tilstand |
| `--forest-soft` | `#e7efe9` | Grønn bakgrunn (compliance-stripe, suksess) |
| `--forest-line` | `#c5d3c8` | Grønn border |
| `--bg` | `#f7f5ee` | Sidebagrunn, tabelloverskrift |
| `--paper` | `#fbf9f3` | Kortbakgrunn (erstatter bg-white) |
| `--line` | `#e3ddcc` | Alle kortborder (erstatter border-neutral-200) |
| `--ink` | `#1d1f1c` | Primær tekst |
| `--muted` | `#6b6f68` | Sekundær tekst (erstatter text-neutral-500/600) |
| `--ok` | `#2f7757` | Suksess (grønn) |
| `--critical` | `#b3382a` | Kritisk (rød) |
| `--warn` | `#c98a2b` | Advarsel (amber) |

### Typografi
- **Overskrifter:** Source Serif 4 (lagt til Google Fonts import)
- **Brødtekst:** Inter 14px (uendret)
- KPI-verdier bruker `font-serif text-[28px]` — matches mockup

---

## Endringer per fil

### `src/index.css`
- Google Fonts import for Source Serif 4
- `--font-serif` oppdatert til Source Serif 4 + Libre Baskerville fallback
- Alle 15 AMU designtokens lagt til i `:root`

### `LearningLayout.tsx`
- Sidebakgrunn oppdatert til `var(--bg)` (#f7f5ee)

### `LearningDashboard.tsx`
- KPI-kort: ny design med venstresidig accent-border (3px), serif-tall, uppercase etikett
- Compliance-stripe lagt til etter overskrift (AML § 3-1 · § 6-5 · IK-forskriften § 5)
- "Configure"-knapp skjult for ikke-administratorer
- Rollebasert dashboard: admin ser org-statistikk, deltaker ser personlig statistikk
- Kurskort: fjernet `shadow-sm`, oppdatert til `--paper`/`--line`-farger
- Alle engelske strenger oversatt til norsk

### `LearningPlayer.tsx`
- Duplikat fremdriftsmåler fjernet fra hovedinnhold
- Fremdriftsmåler: `h-[6px]`, `rounded-sm`, `border-[#e3ddcc]`, `bg-[#f7f5ee]`
- Modulkort: fjernet `shadow-lg`, oppdatert til designsystem-farger
- Navigasjonsknapper: `rounded-md` (ikke pill), norske etiketter
- Kursbevis-panel: oversatt, riktig plassering
- Flashkort: nytt aspektforhold `4:3`, tydelig for/bak-visuell differensiering
- Quiz: feil svar vises med rød farge (`border-red-400 bg-red-50`)
- Alle engelske strenger oversatt (Fortsett, Fullfør, Riktig, Feil, osv.)
- Kursrådgiving (back-to-back text, long-read) fjernet fra deltakervisning

### `LearningCoursesList.tsx`
- Kurskort: `rounded-lg`, `bg-[#fbf9f3]`, `border-[#e3ddcc]`, ingen skygge
- Fremdriftsmåler: designsystem-variant med ARIA-attributter
- Handlingsknapper: `rounded-md` (konsistent)
- Søkefelt: oppdatert farger

### `LearningCertifications.tsx`
- KPI-kort: samme design som dashboard (venstre accent-border)
- Tabell: `bg-[#f7f5ee]` overskrift, norske kolonnenavn
- Tom tilstand: ikon + norsk tekst
- Alle engelske strenger oversatt

### `LearningInsights.tsx`
- Statistikkort: designsystem-variant
- Modultype-liste: norske etiketter (Flashkort, Quiz, Lese osv.)
- Alle engelske strenger oversatt

### `LearningParticipants.tsx`
- Tabell: oppdatert til designsystem
- Fremdriftsmåler: designsystem-variant
- Forfallsindikatorer bruker `--critical` (#b3382a)

### `LearningExternalTraining.tsx`
- Statuser oversatt: "Venter godkjenning" / "Godkjent" / "Avslått" med farger
- `alert()` fjernet — erstattet med inline feilmelding
- Lastestatus på opplastingsknapp
- Godkjenn/Avslå-knapper: designsystem-farger

### `LearningSettings.tsx`
- Alle kort: `--paper`/`--line`-farger
- GDPR Art. 13 personvernerklæring lagt til (sammenleggbar `<details>`)
- Engelske strenger oversatt

---

## Visuell effekt

**Før:** Hvite kort med neutral-200 border, skygger, blandet norsk/engelsk tekst, engelske knapper
**Etter:** Varm kremhvit (#fbf9f3) kort med linjefarger (#e3ddcc), ingen skygger, konsistent norsk tekst, compliance-stripe, rolledelt dashbord

Grensesnittet følger nå samme visuelle logikk som AMU-modulen — same papirfølelse, same typografisk hierarki, same grønne aksentfarge.

---

## Hva som gjenstår (se eval/ux/03_gaps_and_actions.md)

- `LearningCourseBuilder.tsx` — engelske "add kind"-etiketter og byggereditor
- `LearningComplianceMatrix.tsx` og `LearningPathsPage.tsx` — ikke berørt av denne runden
- Sertifikatutskrift (`/learning/certificates/:id/print`) — ny side
- Verneombud 40t-sporing (GAP-C01/C02)

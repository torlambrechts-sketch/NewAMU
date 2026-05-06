-- Compliance Requirements taxonomy — backfill remaining AML chapters.
--
-- Per Q5 (include all relevant clauses in taxonomy even if no template
-- covers them), this migration adds AML system requirements for the
-- chapters not yet covered by 20260807130100 + 20260808130000.
--
-- Honesty principle: I have strong training-recall on the operationally
-- relevant intro and HSE-adjacent chapters (1, 2A, 8, 9, parts of 14).
-- For chapters where my section-level recall is uncertain (Kap 10
-- arbeidstid, Kap 12 permisjon, Kap 13 likebehandling, Kap 15 opphør,
-- Kap 16 virksomhetsoverdragelse), I add a chapter-level placeholder
-- row instead of inventing per-§ titles. HMS-rådgiver can split these
-- into per-section rows during review (additive, no schema change).
--
-- Excluded by dossier convention:
--   Kap 17 (tvister) — judicial process
--   Kap 18 (tilsyn) — Arbeidstilsynet's powers, not employer duty
--   Kap 19 (straff) — penalty
--   Kap 20 (avsluttende) — meta
--
-- All rows are organization_id = NULL system rows. Idempotent on the
-- partial unique index (pack, slug) WHERE organization_id IS NULL.

insert into public.compliance_requirements
  (organization_id, pack, slug, code, title, description, is_system, is_active)
values
  -- ── Kap 1 — Innledende bestemmelser ──────────────────────────────────
  (null, 'aml-amu', 'aml-1-1', 'AML §1-1', 'Lovens formål',
   'Sikre et arbeidsmiljø som gir grunnlag for en helsefremmende og meningsfylt arbeidssituasjon, full trygghet, god velferd og et inkluderende arbeidsliv.',
   true, true),
  (null, 'aml-amu', 'aml-1-2', 'AML §1-2', 'Hvem loven gjelder for',
   'Loven gjelder for virksomhet som sysselsetter arbeidstaker, med unntak nevnt i §1-3.',
   true, true),
  (null, 'aml-amu', 'aml-1-3', 'AML §1-3', 'Petroleumsvirksomhet til havs', null, true, true),
  (null, 'aml-amu', 'aml-1-4', 'AML §1-4', 'Virksomhet som ikke sysselsetter arbeidstaker', null, true, true),
  (null, 'aml-amu', 'aml-1-5', 'AML §1-5', 'Arbeid i arbeidstakers og arbeidsgivers hjem', null, true, true),
  (null, 'aml-amu', 'aml-1-6', 'AML §1-6', 'Personer som ikke er arbeidstakere',
   'Visse persongrupper (skoleelever, vernepliktige, m.fl.) som anses som arbeidstakere når de utfører arbeid.',
   true, true),
  (null, 'aml-amu', 'aml-1-7', 'AML §1-7', 'Utsendte arbeidstakere', null, true, true),
  (null, 'aml-amu', 'aml-1-8', 'AML §1-8', 'Arbeidstaker og arbeidsgiver — definisjoner',
   'Lovens kjerne-definisjoner.', true, true),
  (null, 'aml-amu', 'aml-1-9', 'AML §1-9', 'Ufravikelighet',
   'Loven kan ikke fravikes ved avtale til ugunst for arbeidstaker.',
   true, true),

  -- ── Kap 2A — Varsling (whistleblowing) ────────────────────────────────
  (null, 'aml-amu', 'aml-2a-1', 'AML §2A-1', 'Rett til å varsle om kritikkverdige forhold',
   'Arbeidstaker har rett til å varsle om kritikkverdige forhold i virksomheten.', true, true),
  (null, 'aml-amu', 'aml-2a-2', 'AML §2A-2', 'Fremgangsmåte ved varsling',
   'Varsling skal være forsvarlig; intern eller ekstern fremgangsmåte beskrevet.', true, true),
  (null, 'aml-amu', 'aml-2a-3', 'AML §2A-3', 'Forbud mot gjengjeldelse',
   'Forbud mot gjengjeldelse mot arbeidstaker som varsler.', true, true),
  (null, 'aml-amu', 'aml-2a-4', 'AML §2A-4', 'Vern av varslerens identitet', null, true, true),
  (null, 'aml-amu', 'aml-2a-5', 'AML §2A-5', 'Arbeidsgivers aktivitetsplikt ved varsel',
   'Plikt til å undersøke og iverksette tiltak ved mottatt varsel.', true, true),
  (null, 'aml-amu', 'aml-2a-6', 'AML §2A-6', 'Erstatning for varsler ved gjengjeldelse', null, true, true),
  (null, 'aml-amu', 'aml-2a-7', 'AML §2A-7', 'Arbeidsgivers plikt til å utarbeide rutiner for varsling',
   'Virksomhet med 5 eller flere arbeidstakere skal ha skriftlige varslingsrutiner.', true, true),

  -- ── Kap 8 — Informasjon og drøftelse ──────────────────────────────────
  (null, 'aml-amu', 'aml-8-1', 'AML §8-1', 'Plikt til informasjon og drøftelse',
   'Virksomhet med minst 50 ansatte skal informere og drøfte saker av betydning med tillitsvalgte.', true, true),
  (null, 'aml-amu', 'aml-8-2', 'AML §8-2', 'Gjennomføring av informasjons- og drøftingsplikten', null, true, true),
  (null, 'aml-amu', 'aml-8-3', 'AML §8-3', 'Taushetsplikt for tillitsvalgte', null, true, true),

  -- ── Kap 9 — Kontrolltiltak ────────────────────────────────────────────
  (null, 'aml-amu', 'aml-9-1', 'AML §9-1', 'Vilkår for kontrolltiltak',
   'Kontrolltiltak må ha saklig grunn i virksomhetens forhold og ikke være uforholdsmessig belastende.', true, true),
  (null, 'aml-amu', 'aml-9-2', 'AML §9-2', 'Drøfting, informasjon og evaluering av kontrolltiltak',
   'Krav om drøfting med tillitsvalgte, informasjon til ansatte og periodisk evaluering.', true, true),
  (null, 'aml-amu', 'aml-9-3', 'AML §9-3', 'Innhenting av helseopplysninger ved ansettelse',
   'Begrensninger på når arbeidsgiver kan be om helseopplysninger.', true, true),
  (null, 'aml-amu', 'aml-9-4', 'AML §9-4', 'Medisinske undersøkelser av arbeidssøkere og arbeidstakere', null, true, true),
  (null, 'aml-amu', 'aml-9-5', 'AML §9-5', 'Forholdet til personopplysningsloven', null, true, true),

  -- ── Kap 10 — Arbeidstid (chapter-level placeholder) ───────────────────
  (null, 'aml-amu', 'aml-10', 'AML kap. 10', 'Arbeidstid (kapittel)',
   'Plassholder for kapittel 10 (§§10-1 til 10-12) — daglig/ukentlig arbeidstid, overtid, pauser, hvile, søn-/helgedagsarbeid, m.fl. HR-modul håndterer operativ kontroll; HMS-rådgiver kan splitte til per-§ rader ved behov.',
   true, true),

  -- ── Kap 14 — Ansettelse (additions to existing 14-5, 14-6) ───────────
  (null, 'aml-amu', 'aml-14-1', 'AML §14-1', 'Informasjon om ledige stillinger',
   'Plikt til å informere ansatte om ledige stillinger.', true, true),
  (null, 'aml-amu', 'aml-14-2', 'AML §14-2', 'Fortrinnsrett til ny ansettelse',
   'Fortrinnsrett etter oppsigelse på grunn av virksomhetsforhold.', true, true),
  (null, 'aml-amu', 'aml-14-3', 'AML §14-3', 'Fortrinnsrett for deltidsansatte', null, true, true),
  (null, 'aml-amu', 'aml-14-4', 'AML §14-4', 'Virkningen av ulovlig ansettelse / unnlatt fortrinnsrett', null, true, true),
  (null, 'aml-amu', 'aml-14-9', 'AML §14-9', 'Fast og midlertidig ansettelse',
   'Hovedregelen om fast ansettelse + uttømmende vilkår for midlertidig ansettelse.', true, true),
  (null, 'aml-amu', 'aml-14-12', 'AML §14-12', 'Innleie fra bemanningsforetak',
   'Vilkår for innleie fra virksomhet som har til formål å drive utleie.', true, true),
  (null, 'aml-amu', 'aml-14-13', 'AML §14-13', 'Innleie fra produksjonsbedrift',
   'Vilkår for innleie fra virksomhet som ikke har til formål å drive utleie.', true, true),

  -- ── Kap 12 — Permisjon (chapter-level placeholder) ────────────────────
  (null, 'aml-amu', 'aml-12', 'AML kap. 12', 'Rett til permisjon (kapittel)',
   'Plassholder for kapittel 12 (§§12-1 til 12-15) — svangerskaps-, foreldre-, omsorgs-, pleie-, utdannings- og militærpermisjon m.fl. HR-modul håndterer søknad og oppfølging.',
   true, true),

  -- ── Kap 13 — Likebehandling (selected + chapter placeholder) ─────────
  (null, 'aml-amu', 'aml-13-1', 'AML §13-1', 'Forbud mot diskriminering',
   'Forbud mot diskriminering på grunn av politisk syn, medlemskap i arbeidstakerorganisasjon, m.fl.', true, true),
  (null, 'aml-amu', 'aml-13-2', 'AML §13-2', 'Hva kapitlet omfatter', null, true, true),
  (null, 'aml-amu', 'aml-13', 'AML kap. 13', 'Vern mot diskriminering (kapittel)',
   'Plassholder for §§13-3 til 13-9 — virkeområde, unntak, lønnsspørsmål, opplysningsplikt, oppreisning, organisasjonsfrihet.',
   true, true),

  -- ── Kap 15 — Opphør av arbeidsforhold (chapter-level placeholder) ────
  (null, 'aml-amu', 'aml-15', 'AML kap. 15', 'Opphør av arbeidsforhold (kapittel)',
   'Plassholder for §§15-1 til 15-17 — drøftelse før oppsigelse, oppsigelsesgrunn, oppsigelsesfrister, formkrav, sluttattest, avskjed, virkninger m.fl. HR-modul håndterer prosess; AML §15-1 drøftelsessamtaler dekkes av eksisterende hr.discussion-modul.',
   true, true),

  -- ── Kap 16 — Virksomhetsoverdragelse (chapter-level placeholder) ─────
  (null, 'aml-amu', 'aml-16', 'AML kap. 16', 'Virksomhetsoverdragelse (kapittel)',
   'Plassholder for §§16-1 til 16-7 — rettigheter ved overdragelse, valgrett, vern mot oppsigelse, informasjon m.fl.',
   true, true)

on conflict (pack, slug) where organization_id is null do nothing;

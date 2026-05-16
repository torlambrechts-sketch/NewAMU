-- AML fullgjennomgang — bro fra sjekklisteposter til oppgaver, del 1/2.
--
-- Coverage gap closed:
--   Sjekklisteposter i AML-fullgjennomgangen må kunne spawne oppgaver
--   som dukker opp i TasksAllePage med eksplisitt sourcekategori — uten
--   å maskeres som generiske "tiltak". Dette gjør at HMS-ansvarlig kan
--   filtrere "alle oppgaver fra siste AML-gjennomgang" i én chip.
--
-- Self-audit (Arbeidstilsynet POV):
--   * AML § 3-1 (1) krever systematisk arbeid med HMS — å spore
--     oppfølgingsoppgaver tilbake til kildekravet er en
--     dokumentasjonsplikt etter § 5 nr. 6 i internkontrollforskriften.
--   * Påvirker ingen eksisterende task_items-rader (alle får null i
--     source_item_key som default).
--
-- Hvorfor delt opp i to migrasjoner:
--   PostgreSQL tillater ikke at en ny enum-verdi brukes i samme
--   transaksjon som den legges til (feilkode 55P04). Denne filen kun
--   gjør tillegget. Indeks + check-bruk lever i _120001-filen som
--   kjøres i en separat tx.

set local search_path = public, pg_catalog;

-- Utvid task_source_category-enumet. Idempotent via IF NOT EXISTS (PG 12+).
alter type public.task_source_category
  add value if not exists 'compliance_checklist_item';

-- source_item_key kolonne på task_items.
alter table public.task_items
  add column if not exists source_item_key text;

comment on column public.task_items.source_item_key is
  $c$Sjekkliste-postens item.key når source_category =
  'compliance_checklist_item'. Sammen med source_id (= execution_uuid)
  gir dette en stabil ref tilbake til den enkelte AML-paragrafen i en
  fullgjennomgang. Null for alle andre source_category-verdier.$c$;

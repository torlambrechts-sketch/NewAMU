-- Polymorf peker fra standard saksliste til konkret kilde (avvik, sykefravær, …)
alter table public.amu_default_agenda_items
  add column if not exists source_id uuid;

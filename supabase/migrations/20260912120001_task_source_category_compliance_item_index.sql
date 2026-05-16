-- AML fullgjennomgang — bro fra sjekklisteposter til oppgaver, del 2/2.
--
-- Coverage gap closed:
--   Etter at _120000 har committed enum-verdien 'compliance_checklist_item',
--   kan vi opprette delvis indeks som bruker den i WHERE-klausulen.

set local search_path = public, pg_catalog;

create index if not exists task_items_source_item_idx
  on public.task_items (organization_id, source_id, source_item_key)
  where source_category = 'compliance_checklist_item' and deleted_at is null;

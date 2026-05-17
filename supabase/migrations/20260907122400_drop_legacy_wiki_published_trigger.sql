-- B-3 fix: drop the legacy workflow_wiki_published trigger.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: IK-f § 5 nr. 7 — automatiserte tiltak må være
--   sporbare. Den legacy-triggeren fra archive/_420120000 ble re-issued i
--   archive/_508120000 og kallet workflow_execute_actions med XOR-branch-
--   index i 5. argument-slot. P1-signatur-endringen i _121800 ga den
--   posisjonen ny mening (p_parent_depth) — så ethvert publish-event ble
--   plassert på depth=5 og umiddelbart droppet av kø-arbeideren. Den nye
--   emitteren wiki_pages_workflow_emit_published_tg fra _120300/_121500
--   dekker samme overflate via workflow_dispatch_db_event med riktig
--   dybde-sporing.
--   Restrisiko deferred: ingen — drop er rein opprydding.

-- Verifiser at den nye emitteren faktisk er installert før vi dropper
-- den legacy. Hvis _120300/_121500 av en eller annen grunn ikke har
-- kjørt vil dette feile fast med en tydelig melding.
do $$
begin
  if not exists (
    select 1 from pg_trigger
     where tgname like 'wiki_pages_workflow_emit_published%'
  ) then
    raise exception 'new wiki publish emitter missing — refusing to drop legacy';
  end if;
end $$;

drop trigger if exists workflow_wiki_published on public.wiki_pages;
drop function if exists public.workflow_on_wiki_page_published();

-- P2: Remove stale "kommende funksjon" alerts from system-doc templates.
--
-- Context:
--   Six tpl-sysdok-* templates were seeded (_120001) with alert blocks that
--   said "live data coming soon". The live-block renderers (live_risk_feed,
--   action_button, live_org_chart) are now shipped and working in
--   WikiBlockRenderer. The stale alerts misrepresent the product state
--   and would trigger questions during an Arbeidstilsynet demo.
--
-- Self-audit (Arbeidstilsynet POV):
--   Not a legal gap — purely product quality. Zero restrisiko.
--   The live module blocks remain; only the "coming soon" overlay is removed.

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(b order by ordinality)
    from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
    where not (
      b->>'kind' = 'alert'
      and (b->>'text') like '%kommende funksjon%'
    )
  )
)
where id in (
  'tpl-sysdok-risikovurdering',
  'tpl-sysdok-psykososialt',
  'tpl-sysdok-kjemisk',
  'tpl-sysdok-avvik',
  'tpl-sysdok-opplaering',
  'tpl-sysdok-sykefraværsoppfølging'
)
  and page_payload::text like '%kommende funksjon%';

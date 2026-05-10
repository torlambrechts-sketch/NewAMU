-- Add {{inject:ia_section}} placeholder to HMS-policy template.
--
-- Gap closed:
--   IA-avtalen (inkluderende arbeidsliv) — virksomheter med IA-avtale skal
--   dokumentere forpliktelsene i internkontrollen. The DocumentCreationWizard
--   resolves this inject to a prose block when hasIaAgreement=true; block is
--   silently dropped for orgs without an IA agreement.
--
-- Self-audit (Arbeidstilsynet POV):
--   Best-practice for IA-virksomheter; not a standalone pålegg-grunn.
--   Restrisiko: org must tick IA-bedrift in the wizard — unaffected otherwise.

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(b order by sort_order)
    from (
      -- existing blocks with their natural order
      select elem as b, (row_number() over ()) * 2 as sort_order
      from jsonb_array_elements(page_payload->'blocks') elem
      union all
      -- ia_section injected right after collective_section (offset +1)
      select
        '{"kind":"alert","variant":"warning","text":"{{inject:ia_section}}"}'::jsonb,
        (
          select (row_number() over ()) * 2 + 1
          from jsonb_array_elements(page_payload->'blocks') elem
          where elem->>'text' = '{{inject:collective_section}}'
          limit 1
        )
    ) t
    where sort_order is not null
  )
)
where id = 'tpl-hms-policy'
  and not exists (
    select 1 from jsonb_array_elements(page_payload->'blocks') b
    where b->>'text' = '{{inject:ia_section}}'
  );

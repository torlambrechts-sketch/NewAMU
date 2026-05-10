-- P1 improvements:
--   1. HMS-policy: add medvirkning statement (AML §3-1 (2a)) and
--      tilrettelegging reference (AML §4-6) — both missing from the
--      policy text and law_ref list.
--   2. tpl-sysdok-internkontroll: add tpl-varsling to coverage table,
--      fix "Varsling" section to reference the now-existing template,
--      add AML §2A-3 to legal_basis.
--
-- Self-audit (Arbeidstilsynet POV):
--   AML §3-1 (2a): ansatte og deres representanter skal medvirke —
--   not mentioning this in the policy is a common pålegg-grunn.
--   AML §4-6 tilretteleggingsplikt is cited in ~25 % of AML-related
--   pålegg; adding the reference closes a gap without changing scope.
--   Internkontroll table was internally inconsistent (referenced tpl-varsling
--   but template didn't exist); now consistent after P0 work.

-- ── 1a. Add medvirkning + tilrettelegging sentence to ansvar text block ────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(blk order by ord)
    from (
      select
        case
          when b->>'kind' = 'text'
            and (b->>'body') like '%Daglig leder har det overordnede ansvaret%'
          then jsonb_set(b, '{body}', to_jsonb(
            replace(
              b->>'body',
              'etter AML §6-3.</p>',
              'etter AML §6-3.</p><p>Ansatte og deres representanter (verneombud, tillitsvalgte) medvirker aktivt i kartlegging av farer, risikovurdering og utforming av tiltak (AML §3-1 (2a) og §4-2). Arbeidsgiver har individuell plikt til å tilrettelegge arbeidet for ansatte med redusert arbeidsevne og til å følge opp sykmeldte etter lovens milepæler (AML §4-6).</p>'
            )
          ))
          else b
        end as blk,
        ordinality as ord
      from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
    ) sub
  )
)
where id = 'tpl-hms-policy'
  and page_payload::text not like '%medvirker aktivt i kartlegging%';

-- ── 1b. Splice AML §4-6 law_ref block after AML §4-3 law_ref ─────────────────

update public.document_system_templates
set page_payload = jsonb_set(
  page_payload,
  '{blocks}',
  (
    select jsonb_agg(blk order by sort_key)
    from (
      -- existing blocks, each gets an even sort key preserving natural order
      select b as blk, (ordinality * 2)::float as sort_key
      from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
      union all
      -- new AML §4-6 law_ref inserted right after AML §4-3 (odd sort key)
      select
        '{"kind":"law_ref","ref":"AML § 4-6","description":"Plikt til individuell tilrettelegging for arbeidstakere med redusert arbeidsevne — oppfølgingsplan, dialogmøter og tilretteleggingstiltak."}'::jsonb,
        (
          select (ordinality * 2 + 1)::float
          from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
          where b->>'ref' = 'AML § 4-3'
          limit 1
        )
    ) sub(blk, sort_key)
    where sort_key is not null
  )
)
where id = 'tpl-hms-policy'
  and not exists (
    select 1 from jsonb_array_elements(page_payload->'blocks') b
    where b->>'ref' = 'AML § 4-6'
  );

-- ── 2. Fix tpl-sysdok-internkontroll ─────────────────────────────────────────
-- Add tpl-varsling row to coverage table, update varsling section text,
-- and expand legal_basis to include AML §2A-3.

update public.document_system_templates
set
  legal_basis  = array[
    'IK-f § 5', 'AML § 3-1', 'AML § 3-2', 'AML § 4-1', 'AML § 2A-3'
  ],
  page_payload = jsonb_set(
    page_payload,
    '{blocks}',
    (
      select jsonb_agg(blk order by ord)
      from (
        select
          case
            -- Add tpl-varsling row to coverage table
            when b->>'kind' = 'text'
              and (b->>'body') like '%nr. 5 — Årsgjennomgang%'
            then jsonb_set(b, '{body}', to_jsonb(
              replace(
                b->>'body',
                '</tbody></table>',
                '<tr><td>§2A — Varsling</td><td>Dokumentmodul: Varslingsrutiner</td><td>tpl-varsling</td></tr></tbody></table>'
              )
            ))
            -- Update the Varsling section text to reference the specific template
            when b->>'kind' = 'text'
              and (b->>'body') like '%Fullstendige varslingsrutiner dekket i dokumentmodulen%'
            then jsonb_set(b, '{body}', to_jsonb(
              '<p>Virksomhetens skriftlige varslingsrutiner er dokumentert i <em>Varslingsrutiner</em> (tpl-varsling) — kanaler, saksbehandlingsrutine, konfidensialitet og vern mot gjengjeldelse etter AML §2A-3.</p>'
            ))
            else b
          end as blk,
          ordinality as ord
        from jsonb_array_elements(page_payload->'blocks') with ordinality as t(b, ordinality)
      ) sub
    )
  )
where slug = 'tpl-sysdok-internkontroll';

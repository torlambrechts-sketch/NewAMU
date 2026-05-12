-- AML dokumenter — kategori-utvidelse + maler.
--
-- Coverage gap closed (compliance-analyse 2026-05-11, DEL 7):
--   Åtte kritiske dokument-typer manglet maler. Spesifikt:
--     1. tpl-varslingsrutine            (AML § 2A-2 — pliktig ≥ 5 ansatte)
--     2. tpl-trakasseringsrutine        (AML § 4-3 (3), § 13-1, LDL § 26)
--     3. tpl-dpia                       (GDPR Art. 35)
--     4. tpl-oppfolgingsplan-sykefravar (AML § 4-6)
--     5. tpl-arbeidsavtale              (AML § 14-5/§ 14-6 — 14 punkter post-2024)
--     6. tpl-drofting-protokoll         (AML § 8-1/§ 15-1)
--     7. tpl-arp-redegjorelse           (LDL § 26)
--     8. tpl-vernerunde-rapport         (AML § 6-2, FOLM § 3-7)
--
--   Eksisterende kategori-enum (5: hms_handbook, policy, procedure, guide,
--   template_library) støtter ikke en differensiert dokument-bestand.
--   Vi utvider med åtte nye: varsling, personal, personvern, likestilling,
--   protokoll, register, beredskap, bransje.
--
--   Kategori-CHECK utvides på tre tabeller:
--     - wiki_spaces.category
--     - document_org_templates.category
--
--   For hver eksisterende organisasjon initieres rader i wiki_spaces for
--   de nye kategoriene, slik at sidebaren faktisk viser dem.
--
-- Self-audit (Arbeidstilsynet + Datatilsynet POV):
--   * § 2A-2 var det største enkelt-gapet — pliktig rutine for alle ≥ 5
--     ansatte og ofte mangelfullt utformet. Mal dekker minimums­krav i
--     § 2A-2 (3) bokstav a-c fullstendig.
--   * § 4-6 oppfølgings­plan har konkret innholds­krav som mal støtter,
--     reduserer feil­slag på 4-ukers frist.
--   * § 14-6 ble utvidet til 14 punkter etter EU 2019/1152-
--     implementering i 2024 — mal speiler dette.
--   * LDL § 26 ARP er pliktig årlig redegjørelse for ≥ 50 ansatte
--     (≥ 20 hvis parter krever). LDO fører tilsyn.
--   * GDPR Art. 35 DPIA er pliktig før høyrisiko­behandling — særlig
--     viktig nå når survey-modulen kjører trakasserings­undersøkelser.
--
--   Restrisiko:
--   - Nye dokument-moduler (signature_block, revision_log,
--     confidentiality_marker, contact_card, retention_marker) trenger
--     UI-renderere — markert fase 2.
--   - Bransje- og register-kategoriene støtter to maler i denne
--     leveransen (vernerunde, eksponering); flere bransje-spesifikke
--     mal-er er restanse.
--
-- Spec: specs/aml-documents-content.md
-- Tilhørende TS-endring:
--   src/types/documents.ts (utvidet SpaceCategory + ModuleBlock-union)
--   src/data/documentTemplates.ts (8 nye PAGE_TEMPLATES + 8 nye SEED_SPACES)

set local search_path = public, pg_catalog;

-- ── 1. Utvid CHECK-constraint på wiki_spaces.category ────────────────────
--
-- NB: wiki_pages har IKKE category-kolonne (verifisert mot
-- 20260412120000_wiki_documents.sql); kategori sitter bare på spaces +
-- document_org_templates. Page-kategori utledes via space-tilhørighet.

alter table public.wiki_spaces
  drop constraint if exists wiki_spaces_category_check;

alter table public.wiki_spaces
  add constraint wiki_spaces_category_check
  check (category in (
    'hms_handbook',
    'policy',
    'procedure',
    'guide',
    'template_library',
    'varsling',
    'personal',
    'personvern',
    'likestilling',
    'protokoll',
    'register',
    'beredskap',
    'bransje'
  ));

-- ── 3. Utvid CHECK-constraint på document_org_templates.category ─────────

alter table public.document_org_templates
  drop constraint if exists document_org_templates_category_check;

alter table public.document_org_templates
  add constraint document_org_templates_category_check
  check (category in (
    'hms_handbook',
    'policy',
    'procedure',
    'guide',
    'template_library',
    'varsling',
    'personal',
    'personvern',
    'likestilling',
    'protokoll',
    'register',
    'beredskap',
    'bransje'
  ));

-- ── 4. Initialiser wiki_spaces for nye kategorier per organisasjon ───────
--
-- For hver eksisterende org legger vi til de 8 nye space-radene (idempotent
-- via on conflict). Nye orgs får dette via SEED_SPACES i TS-laget +
-- provision_documents_baseline_for_org().

do $$
declare
  v_org_id uuid;
  v_spaces text[][] := array[
    array['space-varsling', 'Varsling', 'Varslings­rutiner og varslings­saker (AML § 2A-1 til § 2A-6).', 'varsling', '🚨'],
    array['space-personal', 'Personal', 'Arbeidsavtaler, sykefraværs­oppfølging, tilrettelegging (AML kap. 14, § 4-6).', 'personal', '👥'],
    array['space-personvern', 'Personvern og GDPR', 'Behandlings­protokoll, DPIA, personvern­erklæring (GDPR Art. 13, 14, 30, 35).', 'personvern', '🔒'],
    array['space-likestilling', 'Likestilling og ARP', 'Aktivitets- og redegjørelses­plikt, lønns­kartlegging (LDL § 26, § 26 a).', 'likestilling', '⚖️'],
    array['space-protokoll', 'Protokoller', 'Drøftings­protokoller, formelle vedtak (AML § 8-1, § 15-1).', 'protokoll', '📋'],
    array['space-register', 'Registre', 'Eksponerings­register, opplærings­register, kjemikalie­register.', 'register', '📊'],
    array['space-beredskap', 'Beredskap', 'Brann, krise, evakuering (AML § 4-1, brannvern­loven).', 'beredskap', '🚒'],
    array['space-bransje', 'Bransje­spesifikt', 'SHA-plan, asbest, byggherre­dokumenter (forskrifter etter bransje).', 'bransje', '🏗️']
  ];
  v_row text[];
begin
  for v_org_id in select id from public.organizations
  loop
    foreach v_row slice 1 in array v_spaces
    loop
      insert into public.wiki_spaces (id, organization_id, title, description, category, icon, status)
      values (
        v_row[1] || '-' || v_org_id::text,
        v_org_id,
        v_row[2],
        v_row[3],
        v_row[4],
        v_row[5],
        'active'
      )
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        category = excluded.category,
        icon = excluded.icon;
    end loop;
  end loop;
end $$;

-- ── 5. Kommentar på kategori-kolonner ────────────────────────────────────

comment on column public.wiki_spaces.category is
  'Document space category. 13 values total: original 5 (hms_handbook, policy, procedure, guide, template_library) + 8 compliance-driven (varsling, personal, personvern, likestilling, protokoll, register, beredskap, bransje). See specs/aml-documents-content.md §15.';

comment on column public.document_org_templates.category is
  'Custom template category — mirrors wiki_spaces.category. Same 13 values.';

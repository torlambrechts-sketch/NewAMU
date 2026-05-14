-- AML kap. 12 — komplettér legal_basis på tpl-permisjonsoversikt.
--
-- Bakgrunn: 20260828120052_aml_chap12_14_ansettelse_permisjon.sql seedet
-- dokumentmalen `tpl-permisjonsoversikt` med en HTML-tabell som dekker
-- § 12-1..§ 12-13 + § 12-15, men legal_basis-arrayen utelot § 12-8
-- (ammefri) og § 12-13 (offentlige verv). Selv om tabellen viser kravene,
-- får Regelverk-dekning-dashbordet ingen treff for de to paragrafene siden
-- coverage-hooken matcher mot legal_basis[].
--
-- Selv­revisjon (Arbeidstilsynet-perspektiv): pålegg-grunn lukket =
-- § 12-8 ammefri (1 t. m/lønn, første år) og § 12-13 offentlige verv
-- vil nå telle som «partial» dekning når orgen har malen aktivert.
-- Restrisiko: faktisk uttaks­håndtering krever HR-system — dashbordet
-- markerer derfor «partial», ikke «covered».

update public.document_system_templates
set legal_basis = array[
  'AML § 12-1', 'AML § 12-2', 'AML § 12-3', 'AML § 12-4', 'AML § 12-5',
  'AML § 12-6', 'AML § 12-7', 'AML § 12-8', 'AML § 12-9', 'AML § 12-10',
  'AML § 12-11', 'AML § 12-12', 'AML § 12-13', 'AML § 12-15'
]::text[]
where id = 'tpl-permisjonsoversikt';

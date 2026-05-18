-- ISO packs — extend compliance_pack enum.
--
-- Adds three new pack slugs for the quality (ISO 9001), environmental (ISO
-- 14001) and information-security (ISO 27001) management system standards.
-- ISO 45001 already exists in the enum; this file only adds the three that
-- are new.
--
-- IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- This file must stay standalone — do not combine it with any other migration.
-- (Postgres <14 restriction; kept for portability and project convention.)

alter type public.compliance_pack add value if not exists 'iso-9001';
alter type public.compliance_pack add value if not exists 'iso-14001';
alter type public.compliance_pack add value if not exists 'iso-27001';

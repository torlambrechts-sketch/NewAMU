-- Meetings · structured minority-dissent text on agenda items.
--
-- Why
--   Forskrift om organisering, ledelse og medvirkning § 3-16 verbatim:
--   "Det skal skrives referat fra møtene i arbeidsmiljøutvalget. Ved
--   avstemninger skal både flertallets og mindretallets standpunkt
--   protokolleres."
--
--   The current data model captures vote_for / vote_against / vote_abstain
--   integer tallies and `decision_text` (majority position), but provides
--   no structured field for the minority's substantive argument. The
--   AMU årsmøte H10 template added a preparation-checklist reminder for
--   the secretary to record it — but free-text in `minutes_summary`
--   isn't queryable and an auditor cannot tell whether the obligation
--   was honored. This column closes that gap.
--
-- Self-audit (Arbeidstilsynet POV)
--   Closes a structural compliance gap for AMU minutes (§ 3-16). The
--   column is nullable and additive — only filled in when there is
--   actually a minority view to record.

set local search_path = public, pg_catalog;

alter table public.meeting_agenda_items
  add column if not exists minority_dissent_text text;

comment on column public.meeting_agenda_items.minority_dissent_text is
  'Mindretallets standpunkt ved avstemning (Forskrift om org. ledelse § 3-16). Fylles ut når vote_against eller vote_abstain er > 0 og mindretallet ønsker sin posisjon protokollført.';

-- Post-sign mutability contract:
--   The existing `meeting_agenda_items_before_change` trigger (from
--   archive/20260902120000) uses an explicit-block allowlist: it raises
--   only when identity/structure columns change (position, title,
--   description, law_ref, is_mandatory, is_manual, duration_minutes,
--   presenter_member_id, template_item_key). Soft fields (minutes_summary,
--   decision_*, vote_*, conflict_of_interest, binding_snapshot) are
--   implicitly allowed post-sign. `minority_dissent_text` follows the
--   same soft-field semantics — no trigger change required for it to be
--   editable after protocol_signed_at, which matches §3-16 intent: the
--   secretary may add or refine minority text during minutes review.

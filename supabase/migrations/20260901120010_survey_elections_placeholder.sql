-- Survey-as-election placeholder for verneombud + AMU-medlemsvalg.
--
-- Why
--   Replaces the demo-grade `modules/amu_election/` workflow (deleted in
--   the same PR) with a single system survey template in the
--   `survey_template_catalog`. The senior-dev + compliance-officer review
--   concluded:
--     - AML § 6-3 requires hemmelig valg of verneombud — the survey module
--       already supports `is_anonymous = true`, the platform's only
--       anonymous-collection primitive.
--     - AML § 7-3 requires equal employer/employee representation in
--       AMU — recorded as composition metadata on the elected meeting,
--       which the new meetings module handles via
--       `meeting_attendees.role`.
--   This row is a *placeholder*: it surfaces the legal obligation in the
--   compliance planner (`law_refs[]` populated), reserves the catalog
--   id `amu-valg-system`, and embeds eligibility/sealing requirements in
--   the body for the follow-up implementation to consume.
--
-- Restrisiko (intentional v1 gap)
--   - Eligibility gating: only employees in the relevant verneområde
--     should be able to vote. Surveys today have no per-survey role
--     constraint; need either a per-survey `eligible_group_id` column or
--     an `election_eligibility` jsonb. Tracked under
--     specs/meetings-amu-merger.md (deferred).
--   - One-vote-per-voter while preserving anonymity: needs a
--     `survey_ballots_cast(survey_id, voter_user_id)` lookup table
--     separate from `survey_responses` (double-envelope pattern).
--   - Result sealing: once an election closes, results must be
--     immutable. Needs a `sealed_at timestamptz` + trigger on
--     `survey_responses`.
--   - AMU konstitueringsmøte handoff: result certification creates a
--     meeting with the elected members pre-populated as
--     `meeting_attendees`.
--
-- The placeholder is `is_active = true` so admins can see it in the hub
-- and grasp where elections live; manual `is_anonymous = true` toggle is
-- a stopgap until the eligibility/sealing/handoff work ships.
--
-- Idempotent: composite ON CONFLICT on the primary key.

insert into public.survey_template_catalog
  (id, is_system, name, short_name, description, source, use_case,
   category, audience, estimated_minutes, recommend_anonymous,
   law_ref, body, pack, law_refs)
values
  (
    'amu-valg-system',
    true,
    'AMU- og verneombudsvalg',
    'AMU-valg',
    'Anonym avstemning til arbeidsmiljøutvalg og verneombud. Bruker undersøkelsesmodulens anonymitetsmekanisme. Stemmeberettigede begrenses manuelt i v1 — kommer som strukturert valgmodul.',
    'AML § 6-3, AML § 7-3, Forskrift om verneombud',
    'AMU- og verneombudsvalg — hemmelig valg per AML § 6-3.',
    'elections',
    'internal',
    10,
    true,
    'AML § 6-3',
    jsonb_build_object(
      'kind', 'election',
      'requires_eligibility_gating', true,
      'requires_one_vote_per_voter', true,
      'requires_result_sealing', true,
      'follow_up_meeting_template_slug', 'amu-konstitueringsmote',
      'eligibility', jsonb_build_object(
        'voter_role_hint', 'employee',
        'office_term_months', 24
      ),
      'notes', 'Krever full implementasjon: stemmeberettigede-liste, double-envelope og forsegling.'
    ),
    'arbeidsmiljo',
    array['AML § 6-3', 'AML § 7-3', 'Forskrift om verneombud']
  )
on conflict (id) do update
set name = excluded.name,
    short_name = excluded.short_name,
    description = excluded.description,
    source = excluded.source,
    use_case = excluded.use_case,
    category = excluded.category,
    audience = excluded.audience,
    estimated_minutes = excluded.estimated_minutes,
    recommend_anonymous = excluded.recommend_anonymous,
    law_ref = excluded.law_ref,
    body = excluded.body,
    pack = excluded.pack,
    law_refs = excluded.law_refs,
    is_system = excluded.is_system,
    is_active = true,
    updated_at = now();

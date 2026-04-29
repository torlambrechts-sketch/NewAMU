-- Survey purpose (user-facing goal) and AMU-oriented summary text for reporting.

alter table public.surveys
  add column if not exists survey_purpose text,
  add column if not exists survey_amu_summary text;

comment on column public.surveys.survey_purpose is 'Why the survey runs — drives question suggestions in builder (Norwegian UI)';
comment on column public.surveys.survey_amu_summary is 'Optional executive summary for AMU/reporting (Norwegian)';

notify pgrst, 'reload schema';

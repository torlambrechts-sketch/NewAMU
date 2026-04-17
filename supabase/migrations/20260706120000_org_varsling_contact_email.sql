-- Optional varsling contact email for org-level reporting (Arbeidstilsynet export, etc.)

alter table public.organizations
  add column if not exists varsling_contact_email text;

comment on column public.organizations.varsling_contact_email is
  'Public-facing or internal email for whistleblowing contact (optional).';

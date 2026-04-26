-- Sporingskolonne for hvilken side som leder møtet (AML §7-5)
ALTER TABLE public.amu_meetings
  ADD COLUMN IF NOT EXISTS chair_side text
    CHECK (chair_side IS NULL OR chair_side IN ('employer', 'employee'));

COMMENT ON COLUMN public.amu_meetings.chair_side IS
  'Hvilken side (arbeidsgiver/arbeidstaker) som leder møtet — AML §7-5.
   NULL = ikke satt. employer = arbeidsgiversiden. employee = arbeidstakersiden.';

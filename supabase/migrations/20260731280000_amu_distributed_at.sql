-- Sporingskolonne for distribusjon av signert referat (AML §7-2(6))
ALTER TABLE public.amu_meetings
  ADD COLUMN IF NOT EXISTS distributed_at timestamptz;

COMMENT ON COLUMN public.amu_meetings.distributed_at IS
  'Tidspunkt da signert referat ble distribuert til deltakere og ansatte.
   NULL = ikke distribuert. AML §7-2(6).';

# `_shared` test suite

Each `_shared/<module>.ts` has a companion `__tests__/<module>.test.ts`
covering its pure surface. Snapshot tests pin sha256 outputs so a regression
in the hashing convention shows up as a diff, not silent breakage.

CI runs `deno task test` from `supabase/functions/` (see
`.github/workflows/edge-functions.yml`). The task uses `--allow-net=localhost`
only — any test that needs Supabase / external HTTP must stub the client,
not hit the network. `--no-check` keeps `Deno.serve` handlers from being
type-checked transitively when only their helpers are imported.

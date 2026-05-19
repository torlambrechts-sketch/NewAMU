# Registers — parity port (stub)

Placeholder spec carved out of `endringslogg-rollout-plan.md §4.7`.
Registers is the one module whose Endringslogg rollout was *not*
attempted in the same pass as the other six because no parity spec
existed yet. This stub captures what we know so the next engineer
to pick it up doesn't repeat the discovery.

Status: 📋 needs parity spec authored before W5 registers can ship.

---

## What we know

- Tables exist: `register_types` (per-org, with `aml_paragraphs[]`
  + `regulation_ids[]`), `register_categories`, `register_org_settings`.
- Per-type record table(s) are not yet enumerated. Likely
  `register_entries` (TBD).
- The registers module appears in CLAUDE.md template-surfaces, with
  the dashboard scope `regelverk_coverage` registered for the
  oversiktsside.
- ROADMAP does not yet have a "registers parity port" row; this is
  the first call-out for one.

## What needs authoring

1. The classic C-1..C-9 inventory from `specs/PLAYBOOK.md §4`.
2. A per-register-type record schema (does each register type have
   its own table, or one polymorphic table with a `register_type_id`?).
3. Whether records are append-only (injury log) vs mutable (action
   plan). Decides whether `versjon_bumpet` is needed in this scope.
4. Privileged classification per-register-type — already roughed
   in `specs/endringslogg-privileged-data.md §registers`. Confirm
   with legal once the schema is firm.

## What we'll need at wave time

Once the spec lands, the wave-5 Endringslogg work is mechanical:

- `modules/registers/audit/registersAuditScope.ts` — accent TBD
  (no entry in CLAUDE.md accent palette today; pick once we know
  whether registers gets its own nav group).
- Summary template presets: `register_opprettet`, `register_endret`,
  `register_lukket` plus per-type subjects.
- Wire mutations into whatever hook ends up owning the surface
  (likely `useRegisters.ts`, not yet created).
- Dock `<EntityTimeline scopeId="registers">` in
  `RegisterTypePage.tsx` (or its successor).
- Default `privileged=true` for injury-log register types via the
  `isPrivileged.registerEntry(type)` helper that already exists.

Estimated effort post-parity-spec: 2 days.

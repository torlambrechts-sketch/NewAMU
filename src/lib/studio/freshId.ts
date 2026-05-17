// Re-export the canonical freshId helper so studio code can import from
// a single namespace (`src/lib/studio/*`) rather than reaching across to
// dashboards. Mirrors the workflow registry's freshId re-export per
// workflow-engine-review.md §3.

export { freshId } from '../dashboards/freshId'

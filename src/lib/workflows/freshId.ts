// Re-export the single id-minting helper. CLAUDE.md "Things easy to get wrong"
// calls out per-page cryptoUuid() polyfills as a smell; the workflow stack
// (registry + flow compiler + canvas) goes through this one entry point.

export { freshId } from '../dashboards/freshId'

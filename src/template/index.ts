/**
 * Central template definitions — Phase 2: UI Component System.
 *
 * All feature modules MUST import layout primitives from here rather than
 * reaching into `components/layout` directly. Future shell changes then
 * propagate from one file instead of every module.
 *
 *   PageShell        Full-page wrapper (breadcrumb, H1, hub tabs, cream canvas)
 *   ModuleListView   DB-driven list: KPI strip + toolbar + table
 *   ModuleDetailView Single-record detail card
 *   FormModal        Right-side slide-over form
 *   DataTable        Type-safe generic table
 */
export {
  PageShell,
  ModuleListView,
  ModuleDetailView,
  FormModal,
  DataTable,
} from './components'

export type {
  PageShellProps,
  ModuleListViewProps,
  ModuleDetailViewProps,
  FormModalProps,
  DataTableProps,
  DataTableColumn,
} from './components'

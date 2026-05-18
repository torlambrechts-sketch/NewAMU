// Compatible-kind heuristic for the widget editor.
//
// This file used to hand-maintain the kind-to-compatible-kinds mapping.
// As of Task 0.3 (Studio Builder Phase 0), the mapping lives in
// src/lib/studio/WidgetKindRegistry.ts and this file is a thin shim that
// reads from the registry. Pre-refactor consumers (`defaultCompatibleKinds`)
// keep working unchanged.
//
// Why we kept this file rather than deleting it:
// 1. The compiler-checked function name is what existing callers import.
//    Migrating every caller to `defaultCompatibleKindsFor` from the
//    registry would touch ~6 files and isn't necessary — re-exporting
//    keeps the diff small.
// 2. Caller can still override via DashboardEditWidgetPanel.compatibleKinds
//    prop; the shape is unchanged.

import type { ReportModuleKind } from '../../../types/reportBuilder'
import { defaultCompatibleKindsFor } from '../../../lib/studio/WidgetKindRegistry'

export function defaultCompatibleKinds(kind: ReportModuleKind): ReportModuleKind[] {
  return defaultCompatibleKindsFor(kind)
}

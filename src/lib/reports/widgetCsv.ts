// Per-widget CSV serialisation. Powers the "Eksporter CSV" item in the
// dashboard widget menu (3.4.1). Each kind maps to a sensible row layout:
//
//   kpi      → one row: "Verdi","Sammenligning"
//   table    → one row per dataset row, columns from `rowKeys` or first row
//   bar      → one row per series key: "Etikett","Verdi"
//   donut    → one row per segment: "Etikett","Verdi"
//   line     → one row per point: "X","Y"
//   heatmap  → 2-D matrix: header = columns, first cell of each row = row label
//
// Filename derives from the widget's title + kind so users get a hint
// of where the export came from when they open the spreadsheet.
//
// Empty / unresolved datasets serialise to an empty body (just the
// header row) so the user gets an obvious blank file rather than nothing.

import type { ReportModule } from '../../types/reportBuilder'
import { getAtPath, numberAtPath } from '../reportDatasets'

export type WidgetCsvPayload = {
  filename: string
  csv: string
}

export function widgetToCsv(
  module: ReportModule,
  datasets: Record<string, unknown>,
): WidgetCsvPayload {
  const ds = datasets[module.datasetKey]
  const filename = sanitizeFilename(`${module.title}.csv`)

  switch (module.kind) {
    case 'kpi': {
      const value = numberAtPath(ds, module.valuePath)
      const cmpDs = module.comparisonDatasetKey ? datasets[module.comparisonDatasetKey] : ds
      const cmp = module.comparisonValuePath ? numberAtPath(cmpDs, module.comparisonValuePath) : null
      const rows = cmp == null
        ? [['Verdi'], [String(value ?? '')]]
        : [
            ['Verdi', 'Sammenligning'],
            [String(value ?? ''), String(cmp ?? '')],
          ]
      return { filename, csv: rowsToCsv(rows) }
    }
    case 'table': {
      const rowsArr = Array.isArray(ds) ? (ds as Record<string, unknown>[]) : []
      const cols = module.rowKeys.length ? module.rowKeys : Object.keys(rowsArr[0] ?? {})
      const out: string[][] = [cols]
      for (const r of rowsArr) {
        out.push(cols.map((c) => stringifyCell(r[c])))
      }
      return { filename, csv: rowsToCsv(out) }
    }
    case 'bar': {
      const obj = ds && typeof ds === 'object' && !Array.isArray(ds) ? (ds as Record<string, unknown>) : {}
      const keys = module.seriesKeys.length ? module.seriesKeys : Object.keys(obj)
      const out: string[][] = [['Etikett', 'Verdi']]
      for (const k of keys) {
        const v = Number(obj[k])
        out.push([k, Number.isFinite(v) ? String(v) : ''])
      }
      return { filename, csv: rowsToCsv(out) }
    }
    case 'donut': {
      const raw = module.segmentsPath ? getAtPath(ds, module.segmentsPath) : ds
      const obj =
        raw && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : ds && typeof ds === 'object' && !Array.isArray(ds)
            ? (ds as Record<string, unknown>)
            : {}
      const out: string[][] = [['Etikett', 'Verdi']]
      for (const [label, v] of Object.entries(obj)) {
        if (typeof v === 'number' && Number.isFinite(v)) out.push([label, String(v)])
      }
      return { filename, csv: rowsToCsv(out) }
    }
    case 'line': {
      const raw = module.pointsPath ? getAtPath(ds, module.pointsPath) : ds
      const out: string[][] = [['X', 'Y']]
      if (Array.isArray(raw)) {
        for (const p of raw) {
          if (!p || typeof p !== 'object') continue
          const obj = p as Record<string, unknown>
          const x = obj.x ?? obj.label
          const y = obj.y ?? obj.value
          if ((typeof x === 'string' || typeof x === 'number') && typeof y === 'number') {
            out.push([String(x), String(y)])
          }
        }
      }
      return { filename, csv: rowsToCsv(out) }
    }
    case 'heatmap': {
      const rowsRaw = module.rowsPath
        ? getAtPath(ds, module.rowsPath)
        : (ds as Record<string, unknown> | null | undefined)?.rows
      const colsRaw = module.columnsPath
        ? getAtPath(ds, module.columnsPath)
        : (ds as Record<string, unknown> | null | undefined)?.columns
      const cellsRaw = module.cellsPath
        ? getAtPath(ds, module.cellsPath)
        : (ds as Record<string, unknown> | null | undefined)?.cells
      const rowLabels = Array.isArray(rowsRaw) ? (rowsRaw as unknown[]).map(String) : []
      const colLabels = Array.isArray(colsRaw) ? (colsRaw as unknown[]).map(String) : []
      const cells: number[][] = Array.isArray(cellsRaw)
        ? (cellsRaw as unknown[]).map((row) =>
            Array.isArray(row) ? (row as unknown[]).map((v) => Number(v) || 0) : [],
          )
        : []
      const out: string[][] = [['', ...colLabels]]
      rowLabels.forEach((rowLabel, ri) => {
        const cellsRow = cells[ri] ?? []
        out.push([rowLabel, ...colLabels.map((_, ci) => stringifyCell(cellsRow[ci] ?? ''))])
      })
      return { filename, csv: rowsToCsv(out) }
    }
    case 'scorecard':
    case 'bowtie': {
      // Bowtie konsumerer samme dataset-form som scorecard — eksport-CSV
      // er derfor identisk. Header beholder formuleringen for begge.
      const raw = module.groupsPath ? getAtPath(ds, module.groupsPath) : ds
      const groups: Array<Record<string, unknown>> = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : []
      const out: string[][] = [
        ['Kategori', 'Krav', 'Tittel', 'Plikt', 'Status', '§ / ID'],
      ]
      for (const g of groups) {
        const category = String(g.category ?? '')
        const rowsRaw = Array.isArray(g.rows) ? (g.rows as Array<Record<string, unknown>>) : []
        for (const r of rowsRaw) {
          out.push([
            category,
            String(r.label ?? ''),
            String(r.title ?? ''),
            String(r.obligation ?? ''),
            String(r.status ?? ''),
            String(r.id ?? ''),
          ])
        }
      }
      return { filename, csv: rowsToCsv(out) }
    }
    case 'compliance_paragraph_grid': {
      const raw = module.paragraphsPath
        ? getAtPath(ds, module.paragraphsPath)
        : (ds as { paragraphs?: unknown } | null | undefined)?.paragraphs
      const items: Array<Record<string, unknown>> = Array.isArray(raw)
        ? (raw as Array<Record<string, unknown>>)
        : []
      const out: string[][] = [
        ['Paragraf', 'Tittel', 'Kapittel', 'Status', 'Antall artefakter'],
      ]
      for (const p of items) {
        out.push([
          String(p.id ?? ''),
          String(p.label ?? ''),
          String(p.chapter ?? ''),
          String(p.status ?? ''),
          stringifyCell(p.artefactCount ?? ''),
        ])
      }
      return { filename, csv: rowsToCsv(out) }
    }
  }
}

/** Trigger a browser download for the given CSV payload. No-op when window is unavailable. */
export function downloadCsv(payload: WidgetCsvPayload): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  // Excel is happier when CSVs lead with a UTF-8 BOM, especially when
  // labels include æøå.
  const blob = new Blob(['﻿', payload.csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = payload.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\n')
}

function escapeCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function stringifyCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)
}

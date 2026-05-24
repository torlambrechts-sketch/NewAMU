// CSV import / export for register_records.
//
// Export: one row per record. Columns = every schema field (in the
// order declared on the type) + engine fields (status, review_due_at).
// UTF-8 BOM prefix keeps Excel happy with æøå. Filename includes the
// type name and date so users can find it back in their downloads.
//
// Import: parse CSV → an array of `{ values, status, reviewDueAt }`
// payloads. Validation runs per row:
//   - missing required fields (per type's metadata_schema) → error
//     attached to the row index; row is skipped on commit
//   - boolean cells accept "ja"/"nei"/"true"/"false"/"1"/"0"
//   - select cells accept the option's `value`; if the cell matches an
//     option's `label` instead we look it up so humans can edit the
//     CSV without needing to know slug ids
//   - select_multi accepts a pipe-separated ("a|b|c") or comma-inside-
//     quotes list
//   - date cells accept ISO (YYYY-MM-DD) or DD.MM.YYYY
//
// The dialog renders the error list before commit so the user can
// fix the source and re-upload, or proceed with the valid rows only.

import type {
  RegisterField,
  RegisterRecord,
  RegisterRecordStatus,
  RegisterType,
} from '../../types/registers'

const STATUS_LABELS: Record<RegisterRecordStatus, string> = {
  active: 'Aktiv',
  draft: 'Utkast',
  archived: 'Arkivert',
}

const STATUS_FROM_LABEL: Record<string, RegisterRecordStatus> = {
  aktiv: 'active',
  utkast: 'draft',
  arkivert: 'archived',
  active: 'active',
  draft: 'draft',
  archived: 'archived',
}

const BOOL_TRUE = new Set(['ja', 'true', '1', 'yes', 'y', 'sant'])
const BOOL_FALSE = new Set(['nei', 'false', '0', 'no', 'n', 'usant', ''])

// ── Export ───────────────────────────────────────────────────────────────

export type CsvExportPayload = {
  filename: string
  csv: string
}

export function exportRecordsToCsv(
  type: RegisterType,
  records: RegisterRecord[],
): CsvExportPayload {
  const fieldKeys = type.metadataSchema.fields.map((f) => f.key)
  const header = [
    ...type.metadataSchema.fields.map((f) => f.label || f.key),
    'Status',
    'Neste gjennomgang',
  ]

  const rows: string[][] = [header]
  for (const r of records) {
    const row: string[] = []
    for (const key of fieldKeys) {
      const field = type.metadataSchema.fields.find((f) => f.key === key)
      row.push(serialiseCell(r.values[key], field))
    }
    row.push(STATUS_LABELS[r.status])
    row.push(r.reviewDueAt ?? '')
    rows.push(row)
  }

  const today = new Date()
  const datePart = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  const filename = sanitizeFilename(`${type.name}_${datePart}.csv`)
  return { filename, csv: rowsToCsv(rows) }
}

function serialiseCell(v: unknown, field: RegisterField | undefined): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'ja' : 'nei'
  if (Array.isArray(v)) {
    if (field?.kind === 'select_multi' && field.options) {
      // Output labels for human-readability; importer accepts both.
      const labels = v
        .filter((x): x is string => typeof x === 'string')
        .map((id) => field.options?.find((o) => o.value === id)?.label ?? id)
      return labels.join('|')
    }
    return v.filter((x): x is string | number => typeof x === 'string' || typeof x === 'number').join('|')
  }
  if (field?.kind === 'select' && typeof v === 'string' && field.options) {
    return field.options.find((o) => o.value === v)?.label ?? v
  }
  return String(v)
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\n')
}

function escapeCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)
}

/** Trigger a browser download for the given CSV payload. No-op in SSR. */
export function downloadRegisterCsv(payload: CsvExportPayload): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
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

// ── Import ───────────────────────────────────────────────────────────────

export type ImportRowPayload = {
  values: Record<string, unknown>
  status: RegisterRecordStatus
  reviewDueAt: string | null
}

export type ImportRowError = {
  /** 1-based row number in the source CSV (header = 1, first data row = 2). */
  rowNumber: number
  field: string | null
  message: string
}

export type CsvImportResult = {
  rows: ImportRowPayload[]
  /** Errors that prevented a row from being parsed. */
  errors: ImportRowError[]
  /** Headers found in the CSV (echoed back so the UI can show them). */
  headers: string[]
}

/**
 * Parse a CSV string against a type's schema. Returns one row per data
 * line plus any per-row errors. Rows with errors are returned anyway
 * so the caller can decide to import "valid only" vs. abort.
 */
export function parseCsvForType(csvText: string, type: RegisterType): CsvImportResult {
  const records = parseCsv(csvText)
  if (records.length === 0) return { rows: [], errors: [], headers: [] }

  const headers = records[0].map((h) => h.trim())
  const fields = type.metadataSchema.fields

  // Map CSV column index → schema field (or "status" / "review_due_at")
  const colMap: Array<RegisterField | 'status' | 'review_due_at' | null> = headers.map(
    (header) => {
      const norm = header.toLowerCase().trim()
      if (!norm) return null
      const byLabel = fields.find(
        (f) => (f.label || '').toLowerCase().trim() === norm || f.key.toLowerCase() === norm,
      )
      if (byLabel) return byLabel
      if (norm === 'status') return 'status'
      if (norm === 'neste gjennomgang' || norm === 'review_due_at' || norm === 'review due at') {
        return 'review_due_at'
      }
      return null
    },
  )

  const rows: ImportRowPayload[] = []
  const errors: ImportRowError[] = []

  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i]
    if (cells.length === 0 || cells.every((c) => c.trim() === '')) continue
    const rowNumber = i + 1

    const values: Record<string, unknown> = {}
    let status: RegisterRecordStatus = 'active'
    let reviewDueAt: string | null = null

    for (let c = 0; c < cells.length; c += 1) {
      const col = colMap[c]
      if (!col) continue
      const raw = cells[c] ?? ''
      if (col === 'status') {
        const lower = raw.toLowerCase().trim()
        if (lower === '') continue
        const mapped = STATUS_FROM_LABEL[lower]
        if (!mapped) {
          errors.push({
            rowNumber,
            field: 'Status',
            message: `Ukjent status «${raw}» — gyldige verdier: Aktiv, Utkast, Arkivert`,
          })
        } else {
          status = mapped
        }
        continue
      }
      if (col === 'review_due_at') {
        if (raw.trim() === '') continue
        const iso = parseDateCell(raw)
        if (iso === null) {
          errors.push({
            rowNumber,
            field: 'Neste gjennomgang',
            message: `Ugyldig dato «${raw}» — bruk YYYY-MM-DD eller DD.MM.YYYY`,
          })
        } else {
          reviewDueAt = iso
        }
        continue
      }
      // Schema field
      const parsed = parseCellForField(raw, col)
      if (parsed.kind === 'error') {
        errors.push({
          rowNumber,
          field: col.label,
          message: parsed.message,
        })
      } else if (parsed.value !== undefined) {
        values[col.key] = parsed.value
      }
    }

    // Required-field validation
    for (const f of fields) {
      if (!f.required) continue
      const v = values[f.key]
      if (v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)) {
        errors.push({
          rowNumber,
          field: f.label,
          message: `Påkrevd felt «${f.label}» mangler`,
        })
      }
    }

    rows.push({ values, status, reviewDueAt })
  }

  return { rows, errors, headers }
}

type CellParse =
  | { kind: 'ok'; value: unknown }
  | { kind: 'error'; message: string }

function parseCellForField(raw: string, field: RegisterField): CellParse {
  const trimmed = raw.trim()
  if (trimmed === '') return { kind: 'ok', value: undefined }
  switch (field.kind) {
    case 'text':
      return { kind: 'ok', value: trimmed }
    case 'number': {
      const n = Number(trimmed.replace(',', '.'))
      if (!Number.isFinite(n)) return { kind: 'error', message: `Forventet tall, fikk «${raw}»` }
      return { kind: 'ok', value: n }
    }
    case 'date': {
      const iso = parseDateCell(trimmed)
      if (iso === null) return { kind: 'error', message: `Ugyldig dato «${raw}»` }
      return { kind: 'ok', value: iso }
    }
    case 'boolean': {
      const lower = trimmed.toLowerCase()
      if (BOOL_TRUE.has(lower)) return { kind: 'ok', value: true }
      if (BOOL_FALSE.has(lower)) return { kind: 'ok', value: false }
      return { kind: 'error', message: `Forventet ja/nei, fikk «${raw}»` }
    }
    case 'select': {
      const options = field.options ?? []
      const byValue = options.find((o) => o.value === trimmed)
      if (byValue) return { kind: 'ok', value: byValue.value }
      const byLabel = options.find((o) => o.label.toLowerCase() === trimmed.toLowerCase())
      if (byLabel) return { kind: 'ok', value: byLabel.value }
      if (options.length === 0) return { kind: 'ok', value: trimmed }
      return {
        kind: 'error',
        message: `Verdi «${raw}» finnes ikke i valg for ${field.label}`,
      }
    }
    case 'select_multi': {
      const options = field.options ?? []
      // Accept "a|b|c" or "a, b, c"
      const parts = trimmed
        .split(/[|;]|,(?![^"]*$)/)
        .map((s) => s.trim())
        .filter(Boolean)
      const out: string[] = []
      const bad: string[] = []
      for (const p of parts) {
        const byValue = options.find((o) => o.value === p)
        if (byValue) {
          out.push(byValue.value)
          continue
        }
        const byLabel = options.find((o) => o.label.toLowerCase() === p.toLowerCase())
        if (byLabel) {
          out.push(byLabel.value)
          continue
        }
        if (options.length === 0) {
          out.push(p)
        } else {
          bad.push(p)
        }
      }
      if (bad.length > 0) {
        return {
          kind: 'error',
          message: `Ukjente valg: ${bad.join(', ')}`,
        }
      }
      return { kind: 'ok', value: out }
    }
    case 'doc_ref':
    case 'location_ref':
      return { kind: 'ok', value: trimmed }
  }
}

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed)
    if (!Number.isNaN(d.getTime())) return trimmed
  }
  // DD.MM.YYYY
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(trimmed)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    const yyyy = m[3]
    const iso = `${yyyy}-${mm}-${dd}`
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return iso
  }
  return null
}

// ── CSV parser ───────────────────────────────────────────────────────────
// Tiny RFC-4180-ish parser. Handles "" escapes inside quoted cells and
// \r\n line endings.

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      cell += ch
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      current.push(cell)
      cell = ''
      i += 1
      continue
    }
    if (ch === '\n' || ch === '\r') {
      current.push(cell)
      cell = ''
      rows.push(current)
      current = []
      // Skip \n after \r
      if (ch === '\r' && text[i + 1] === '\n') i += 2
      else i += 1
      continue
    }
    cell += ch
    i += 1
  }
  if (cell !== '' || current.length > 0) {
    current.push(cell)
    rows.push(current)
  }
  // Trim BOM from first cell of first row
  if (rows[0] && rows[0][0]) rows[0][0] = rows[0][0].replace(/^﻿/, '')
  return rows
}

// ── Helper: build a sample CSV file the user can fill in ────────────────

export function buildSampleCsvForType(type: RegisterType): CsvExportPayload {
  const header = [
    ...type.metadataSchema.fields.map((f) => f.label || f.key),
    'Status',
    'Neste gjennomgang',
  ]
  // Provide a single example row of empty cells so the user can see
  // the expected column count.
  const exampleRow = header.map(() => '')
  return {
    filename: sanitizeFilename(`${type.name}_mal.csv`),
    csv: rowsToCsv([header, exampleRow]),
  }
}

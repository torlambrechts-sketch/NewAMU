// zipExport — bundle every widget's widgetToCsv output into a single
// .zip download. The list page on a report shows "Last ned CSV (.zip)"
// which is the v1 alternative for users who want the raw data without
// the audit-grade PDF.

import { zipSync, strToU8 } from 'fflate'
import { widgetToCsv } from './widgetCsv'
import type { ReportModule } from '../../types/reportBuilder'

const UTF8_BOM = '﻿'

export type ZipExportPayload = {
  filename: string
  blob: Blob
}

/**
 * Build (but do not download) a zip containing one CSV per widget in the
 * layout. Widgets whose dataset key has no data still appear with a single
 * header row, matching the per-widget CSV behaviour. Filename collisions
 * are disambiguated with a numeric suffix.
 */
export function buildWidgetZip(
  reportName: string,
  layout: ReportModule[],
  datasets: Record<string, unknown>,
): ZipExportPayload {
  const used = new Set<string>()
  const entries: Record<string, Uint8Array> = {}

  for (const m of layout) {
    const { filename, csv } = widgetToCsv(m, datasets)
    let entryName = filename
    let n = 2
    while (used.has(entryName)) {
      const dot = filename.lastIndexOf('.')
      const stem = dot > 0 ? filename.slice(0, dot) : filename
      const ext = dot > 0 ? filename.slice(dot) : ''
      entryName = `${stem}-${n++}${ext}`
    }
    used.add(entryName)
    entries[entryName] = strToU8(UTF8_BOM + csv)
  }

  const zipped = zipSync(entries, { level: 6 })
  const blob = new Blob([zipped as BlobPart], { type: 'application/zip' })
  const stem = sanitizeFilename(reportName) || 'rapport'
  return { filename: `${stem}.zip`, blob }
}

/** Trigger a browser download for the built zip. No-op outside the browser. */
export function downloadWidgetZip(payload: ZipExportPayload): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const url = URL.createObjectURL(payload.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = payload.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120)
}

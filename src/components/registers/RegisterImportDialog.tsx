// CSV import dialog for a single register type. Walks the user
// through file pickup → parse → review (errors per row) → commit.
//
// Commit calls `useRegisterRecords.createRecord` per valid row.
// We use the existing hook rather than a bulk RPC so the audit
// trail captures every insert (the trigger fires per UPDATE only,
// inserts don't produce revisions but the records themselves carry
// `created_at` for analyses).
//
// The user can:
//   - Download a blank template CSV with the type's column headers
//   - Drop in a populated CSV
//   - See per-row errors before committing
//   - Choose to skip rows with errors and import only the valid ones
//   - See progress while the inserts run

import { useCallback, useRef, useState } from 'react'
import { Download, FileText, Upload, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { WarningBox } from '../ui/AlertBox'
import {
  buildSampleCsvForType,
  downloadRegisterCsv,
  parseCsvForType,
  type CsvImportResult,
} from '../../lib/registers/registerCsv'
import type { RegisterType } from '../../types/registers'

type Props = {
  open: boolean
  type: RegisterType
  onClose: () => void
  onImport: (rows: { values: Record<string, unknown>; status: 'draft' | 'active' | 'archived'; reviewDueAt: string | null }[]) => Promise<{ ok: number; failed: number }>
}

type Phase =
  | { kind: 'pick' }
  | { kind: 'review'; parsed: CsvImportResult; filename: string }
  | { kind: 'importing'; total: number; done: number }
  | { kind: 'done'; ok: number; failed: number; total: number }

export function RegisterImportDialog({ open, type, onClose, onImport }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setPhase({ kind: 'pick' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  if (!open) return null

  const handleFile = (file: File) => {
    void file.text().then((text) => {
      const parsed = parseCsvForType(text, type)
      setPhase({ kind: 'review', parsed, filename: file.name })
    })
  }

  const handleImport = async (rowsToImport: CsvImportResult['rows']) => {
    setPhase({ kind: 'importing', total: rowsToImport.length, done: 0 })
    const { ok, failed } = await onImport(rowsToImport)
    setPhase({ kind: 'done', ok, failed, total: rowsToImport.length })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
          reset()
        }
      }}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-[#f7f6f2] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-import-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200/80 bg-[#f7f6f2] px-6 py-5">
          <div>
            <h2
              id="register-import-title"
              className="text-xl font-semibold tracking-tight text-neutral-900"
              style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
            >
              Importer CSV
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Last opp en CSV-fil for å legge til flere rader i {type.name}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose()
              reset()
            }}
            className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
          {phase.kind === 'pick' ? (
            <PickPhase
              type={type}
              fileInputRef={fileInputRef}
              onFile={handleFile}
            />
          ) : null}

          {phase.kind === 'review' ? (
            <ReviewPhase
              type={type}
              parsed={phase.parsed}
              filename={phase.filename}
              onBack={reset}
              onImport={handleImport}
            />
          ) : null}

          {phase.kind === 'importing' ? (
            <ImportingPhase total={phase.total} done={phase.done} />
          ) : null}

          {phase.kind === 'done' ? (
            <DonePhase
              ok={phase.ok}
              failed={phase.failed}
              total={phase.total}
              onClose={() => {
                onClose()
                reset()
              }}
              onAnother={reset}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function PickPhase({
  type,
  fileInputRef,
  onFile,
}: {
  type: RegisterType
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e7efe9] text-[#1a3d32]">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900">
              Trenger du en mal?
            </h3>
            <p className="mt-1 text-xs text-neutral-600">
              Last ned en tom CSV med riktige kolonneoverskrifter for {type.name}.
              Fyll den ut i Excel / Google Sheets og last opp her.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              className="mt-3"
              onClick={() => downloadRegisterCsv(buildSampleCsvForType(type))}
            >
              Last ned mal
            </Button>
          </div>
        </div>
      </section>

      <section
        className="rounded-md border-2 border-dashed border-neutral-300 bg-white p-8 text-center transition-colors hover:border-[#1a3d32]/70"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files?.[0]
          if (file) onFile(file)
        }}
      >
        <Upload className="mx-auto h-8 w-8 text-neutral-400" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-neutral-900">
          Dra og slipp CSV-fil her
        </p>
        <p className="mt-1 text-xs text-neutral-500">eller</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
          }}
        />
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={() => fileInputRef.current?.click()}
        >
          Velg fil
        </Button>
      </section>

      <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
        <p className="font-semibold">Krav til CSV-fil</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          <li>Første rad må være kolonneoverskrifter (etiketter fra registeret).</li>
          <li>Bruk komma som skilletegn. Tekst med komma må omsluttes med doble anførselstegn.</li>
          <li>Påkrevde felter må være fylt ut for at raden importeres.</li>
          <li>Datofelt: bruk YYYY-MM-DD eller DD.MM.YYYY.</li>
          <li>Ja/nei-felter: bruk ja/nei eller true/false.</li>
        </ul>
      </div>
    </div>
  )
}

function ReviewPhase({
  type,
  parsed,
  filename,
  onBack,
  onImport,
}: {
  type: RegisterType
  parsed: CsvImportResult
  filename: string
  onBack: () => void
  onImport: (rows: CsvImportResult['rows']) => Promise<void>
}) {
  const rowsWithErrors = new Set(parsed.errors.map((e) => e.rowNumber))
  const validRows = parsed.rows.filter((_, idx) => !rowsWithErrors.has(idx + 2))
  const allRows = parsed.rows
  const errorPerRow = new Map<number, string[]>()
  for (const e of parsed.errors) {
    const arr = errorPerRow.get(e.rowNumber) ?? []
    arr.push(`${e.field ?? 'Rad'}: ${e.message}`)
    errorPerRow.set(e.rowNumber, arr)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-neutral-200 bg-white p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-neutral-900">{filename}</span>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-neutral-500 hover:text-neutral-800"
          >
            Velg en annen fil
          </button>
        </div>
        <p className="mt-1 text-neutral-600">
          Fant {allRows.length} {allRows.length === 1 ? 'rad' : 'rader'} ·{' '}
          <span className="font-semibold text-[#1a3d32]">{validRows.length} klare for import</span>
          {parsed.errors.length > 0 ? (
            <>
              {' · '}
              <span className="font-semibold text-amber-700">
                {rowsWithErrors.size} rader med feil
              </span>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-neutral-500">
          Status-kolonnen er valgfri (settes til «Aktiv» om tom). Neste-gjennomgang-dato
          er valgfri og kan stå tom.
        </p>
      </div>

      {parsed.errors.length > 0 ? (
        <WarningBox>
          Noen rader inneholder feil og hoppes over hvis du importerer dem som de er.
          Last ned filen, rett opp og last opp på nytt for å ta dem med.
        </WarningBox>
      ) : null}

      {allRows.length === 0 ? (
        <p className="rounded border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-500">
          Fant ingen datarader — sjekk at filen har en header og minst én rad.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50/70">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Rad
                </th>
                {type.metadataSchema.fields.slice(0, 4).map((f) => (
                  <th
                    key={f.key}
                    className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600"
                  >
                    {f.label}
                  </th>
                ))}
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-neutral-600">
                  Feil
                </th>
              </tr>
            </thead>
            <tbody>
              {allRows.slice(0, 15).map((row, idx) => {
                const rowNumber = idx + 2
                const errs = errorPerRow.get(rowNumber)
                const hasErr = (errs?.length ?? 0) > 0
                return (
                  <tr
                    key={rowNumber}
                    className={[
                      'border-t border-neutral-100',
                      hasErr ? 'bg-red-50/40' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2 text-xs tabular-nums text-neutral-500">
                      {rowNumber}
                    </td>
                    {type.metadataSchema.fields.slice(0, 4).map((f) => {
                      const v = row.values[f.key]
                      return (
                        <td key={f.key} className="px-3 py-2 text-xs text-neutral-700">
                          {v == null || v === '' ? (
                            <span className="text-neutral-300">—</span>
                          ) : Array.isArray(v) ? (
                            v.map(String).slice(0, 2).join(', ')
                          ) : (
                            String(v)
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-xs text-neutral-700">
                      {labelStatus(row.status)}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-700">
                      {hasErr ? (errs ?? []).join(' · ') : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {allRows.length > 15 ? (
            <div className="border-t border-neutral-100 bg-neutral-50/60 px-3 py-2 text-center text-[11px] text-neutral-500">
              … og {allRows.length - 15} flere rader.
            </div>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          type="button"
        >
          Avbryt
        </Button>
        <Button
          variant="primary"
          icon={<Upload className="h-3.5 w-3.5" />}
          disabled={validRows.length === 0}
          onClick={() => void onImport(validRows)}
          type="button"
        >
          Importer {validRows.length} {validRows.length === 1 ? 'rad' : 'rader'}
        </Button>
      </div>
    </div>
  )
}

function ImportingPhase({ total, done }: { total: number; done: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-sm font-medium text-neutral-700">
        Importerer {done} av {total} …
      </p>
      <div className="h-2 w-64 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full bg-[#1a3d32] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function DonePhase({
  ok,
  failed,
  total,
  onClose,
  onAnother,
}: {
  ok: number
  failed: number
  total: number
  onClose: () => void
  onAnother: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-base font-semibold text-neutral-900">
        Import fullført
      </p>
      <p className="text-sm text-neutral-700">
        {ok} av {total} rader ble lagt til.
        {failed > 0 ? ` ${failed} feilet og ble hoppet over.` : ''}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="secondary" onClick={onAnother} type="button">
          Importer flere
        </Button>
        <Button variant="primary" onClick={onClose} type="button">
          Ferdig
        </Button>
      </div>
    </div>
  )
}

function labelStatus(s: 'draft' | 'active' | 'archived'): string {
  if (s === 'active') return 'Aktiv'
  if (s === 'draft') return 'Utkast'
  return 'Arkivert'
}

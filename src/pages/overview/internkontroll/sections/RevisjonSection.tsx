// Revisjon-logg — append-only audit trail combining
// internal_control_executions (signed kontroll-gjennomføringer) and
// compliance_plan_items updates (tiltak-livssyklus).

import { Download, History } from 'lucide-react'
import { Button } from '../../../../components/ui/Button'
import { Initials, SectionBanner } from './internkontrollShared'
import type { IkData } from '../useInternkontrollPageData'

export function RevisjonSection({ data }: { data: IkData }) {
  return (
    <div className="space-y-4">
      <SectionBanner
        icon={<History className="h-4 w-4" />}
        title="Revisjon-logg"
        trailing={
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-3 w-3" />}
            onClick={() => exportAudit(data)}
          >
            Eksporter
          </Button>
        }
      >
        Alle endringer i internkontroll-modulen. 10 års retensjon. Eksporterbar til
        Arbeidstilsynet og BSI.
      </SectionBanner>

      <div className="rounded-xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {data.audit.length === 0 ? (
          <p className="py-6 text-center text-[12px] italic text-neutral-500">
            Ingen registrerte hendelser ennå.
          </p>
        ) : (
          <ol className="space-y-2">
            {data.audit.map((e, i) => (
              <li
                key={`${e.when}-${i}`}
                className="flex items-start gap-3 rounded-md border border-neutral-200/80 bg-white p-3"
              >
                <Initials name={e.who} size={24} />
                <div className="flex-1 text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <span className="font-semibold text-neutral-900">{e.who}</span>{' '}
                      <span className="text-neutral-500">{e.action}</span>
                    </div>
                    <span className="tabular-nums text-[10px] text-neutral-400">{e.when}</span>
                  </div>
                  <p className="mt-0.5 text-neutral-700">{e.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function exportAudit(data: IkData) {
  const lines = [['Tidspunkt', 'Hvem', 'Handling', 'Detalj'].join(';')]
  for (const e of data.audit) {
    lines.push([escape(e.when), escape(e.who), escape(e.action), escape(e.detail)].join(';'))
  }
  // BOM so Excel reads UTF-8.
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `internkontroll-revisjon-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Escape + neutralise formula-injection vectors (=, +, -, @, tab, CR)
// when a CSV value would otherwise start a formula in Excel.
function escape(s: string): string {
  const trigger = /^[=+\-@\t\r]/.test(s) ? "'" : ''
  const body = trigger + s
  if (body.includes(';') || body.includes('"') || body.includes('\n') || trigger) {
    return '"' + body.replaceAll('"', '""') + '"'
  }
  return body
}

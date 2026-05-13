// EvidenceExportPanel — auditor-ready export builder.
//
// Lets an admin pick a date range + law-ref + framework filters and
// generate a signed manifest pack via workflow-evidence-pack edge fn.
// The pack is anchored in workflow_run_evidence (artefact_kind=
// 'evidence_pack') so the export itself joins the Merkle chain.

import { useState } from 'react'
import { Download, FileCheck, ShieldCheck } from 'lucide-react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useWorkflows } from '../../../hooks/useWorkflows'

const LAW_REF_PRESETS = [
  { label: 'AML § 5-2 (alvorlig skade)', value: 'AML § 5-2' },
  { label: 'GDPR Art. 33 (personvernbrudd)', value: 'GDPR Art. 33' },
  { label: 'IK-f § 5 nr. 7 (overvåking)', value: 'IK-f § 5 nr. 7' },
  { label: 'IK-f § 5 nr. 8 (gjennomgang)', value: 'IK-f § 5 nr. 8' },
  { label: 'AML § 7-2 (AMU)', value: 'AML § 7-2' },
]

const FRAMEWORK_PRESETS = ['aml-amu', 'iso-45001', 'gdpr', 'hovedavtalen']

type ExportResult = {
  manifest_sha256: string
  merkle_root: string
  counts: { runs: number; evidence: number }
  signed_url: string
  expires_in_seconds: number
}

export function EvidenceExportPanel() {
  const { supabase, organization } = useOrgSetupContext()
  const { canViewConfidential } = useWorkflows()
  const today = new Date().toISOString().slice(0, 10)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(ninetyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [lawRefs, setLawRefs] = useState<string[]>([])
  const [frameworks, setFrameworks] = useState<string[]>([])
  const [includeConfidential, setIncludeConfidential] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const generate = async () => {
    if (!supabase || !organization) return
    setGenerating(true)
    setError(null)
    setResult(null)
    try {
      const { data, error: e } = await supabase.functions.invoke('workflow-evidence-pack', {
        body: {
          organization_id: organization.id,
          date_from: new Date(dateFrom).toISOString(),
          date_to: new Date(dateTo + 'T23:59:59').toISOString(),
          law_refs: lawRefs,
          frameworks,
          include_confidential: includeConfidential,
        },
      })
      if (e) throw e
      setResult(data as ExportResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-emerald-700" />
        <h2 className="text-sm font-semibold text-neutral-900">Bevispakke (Evidence pack)</h2>
        <span className="text-xs text-neutral-500">Signert manifest for tilsyn og auditorer</span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-neutral-700">
              Fra dato
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-neutral-700">
              Til dato
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm"
              />
            </label>
          </div>
          <div>
            <span className="block text-xs font-medium text-neutral-700">Law refs</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {LAW_REF_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggle(lawRefs, setLawRefs, p.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    lawRefs.includes(p.value)
                      ? 'bg-emerald-600 text-white'
                      : 'border border-neutral-300 bg-white text-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs font-medium text-neutral-700">Rammeverk</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {FRAMEWORK_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggle(frameworks, setFrameworks, f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    frameworks.includes(f)
                      ? 'bg-emerald-600 text-white'
                      : 'border border-neutral-300 bg-white text-neutral-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {canViewConfidential && (
            <label className="flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={includeConfidential}
                onChange={(e) => setIncludeConfidential(e.target.checked)}
              />
              Inkluder konfidensielle kjøringer (varsling, sykefravær)
            </label>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {generating ? 'Genererer …' : 'Generer pakke'}
          </button>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Resultat</h3>
          {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
          {!result && !error && (
            <p className="text-sm text-neutral-500">
              Velg datointervall og law-ref-filter, klikk «Generer pakke». Pakken signeres med
              sha256 + Merkle-rot og lastes opp til workflow-evidence-packs.
            </p>
          )}
          {result && (
            <div className="space-y-2">
              <p className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                <FileCheck className="h-4 w-4" />
                Pakke opprettet ({result.counts.runs} kjøringer, {result.counts.evidence} bevis).
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-neutral-500">manifest_sha256</span>
                <code className="break-all text-[10px]">{result.manifest_sha256}</code>
                <span className="text-neutral-500">merkle_root</span>
                <code className="break-all text-[10px]">{result.merkle_root}</code>
                <span className="text-neutral-500">URL gyldig</span>
                <span>{Math.round(result.expires_in_seconds / 3600)} timer</span>
              </div>
              <a
                href={result.signed_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              >
                <Download className="h-4 w-4" /> Last ned signert manifest
              </a>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Pakken inneholder workflow_runs + workflow_run_evidence-rader for det valgte vinduet,
        med sha256-sjekksummer og Merkle-rot per regel. Selve pakken anker seg som en
        evidence_pack-rad slik at eksporten også blir en del av sporet.
      </p>
    </div>
  )
}

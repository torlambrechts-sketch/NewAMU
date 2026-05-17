// AI-generert sjekkliste-mal — eksperimentell.
//
// Scaffold UI for the "describe what you need → AI builds a draft
// template" flow. The backend Edge Function (`ai-generate-template`)
// has not been provisioned yet; this modal renders the interaction
// surface (textarea + generate button + result review + create) and
// surfaces a clear notice when the function is missing so admins
// understand it's a roadmap surface, not broken.
//
// When the Edge Function ships, the only change here is replacing the
// `simulate` branch with a real `supabase.functions.invoke(…)` call.

import { useState } from 'react'
import { Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardTextarea } from '../../components/ui/Textarea'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type GeneratedItem = {
  prompt: string
  type: 'yes_no_na' | 'text' | 'number' | 'photo' | 'signature'
  required?: boolean
  law_ref?: string | null
}

type Result = {
  name: string
  description: string
  items: GeneratedItem[]
}

export function AiTemplateGenModal({
  onClose,
  onAccept,
}: {
  onClose: () => void
  onAccept: (result: Result) => void | Promise<void>
}) {
  const { supabase } = useOrgSetupContext()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!supabase || !prompt.trim()) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      // Tries the Edge Function first. If it's missing or returns an
      // error, surface a clear message — don't silently fake output.
      const { data, error: fnErr } = await supabase.functions.invoke('ai-generate-template', {
        body: { prompt: prompt.trim(), source: 'compliance' },
      })
      if (fnErr) {
        throw new Error(
          'AI-generering er ikke konfigurert ennå. Plattform-administrator må aktivere Edge Function «ai-generate-template».',
        )
      }
      const r = data as Result
      if (!r?.name || !Array.isArray(r.items)) {
        throw new Error('Uventet svar fra AI-tjenesten.')
      }
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke generere malen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              <Sparkles className="size-3 text-purple-500" /> AI-generering · eksperimentell
            </p>
            <h2 className="text-base font-semibold text-neutral-900">Beskriv malen</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Lukk"
            className="h-7 w-7 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {result ? (
            <div className="space-y-3">
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <p className="text-sm font-semibold text-neutral-900">{result.name}</p>
                <p className="text-xs text-neutral-600">{result.description}</p>
              </div>
              <ol className="space-y-1.5 text-sm">
                {result.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white p-2">
                    <span className="text-neutral-400">{i + 1}.</span>
                    <span className="flex-1 text-neutral-800">{it.prompt}</span>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700">
                      {it.type}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <>
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Hva skal malen dekke?
              </label>
              <StandardTextarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={busy}
                rows={6}
                placeholder="Eksempel: «Månedlig sjekkliste for verneombud — gjennomgang av varslingskanaler, branninstruks, evakueringsveier, førstehjelps­utstyr. Ref AML § 4-1 og IK-f § 5.»"
                className="mt-2 focus:ring-2 focus:ring-[#1a3d32]/25"
              />
              {error ? (
                <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-neutral-100 px-5 py-3">
          {result ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setResult(null)}>
                Generer på nytt
              </Button>
              <Button variant="primary" onClick={() => void onAccept(result)}>
                Bruk som mal
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => void generate()}
              disabled={busy || !prompt.trim()}
              icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            >
              {busy ? 'Genererer …' : 'Generer utkast'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  )
}

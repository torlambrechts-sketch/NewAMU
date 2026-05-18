// CloneDeepLinkRedirect — universal handler for ?template=<id> on
// every studio scope's embedder.
//
// After SystemTemplateBrowser clones a system template and navigates to
// /studio?scope=<id>&mode=advanced&template=<newId>, this component
// surfaces a clear "Vi har klonet malen — fortsett til redigering" CTA
// that navigates to the canonical per-scope edit URL.
//
// Compliance has its own inline auto-open (see complianceEmbedder.tsx
// — it uses the same ?template param to mount TemplateEditorPanel
// directly). Other scopes use this redirect because their edit
// surfaces live on the module's own route + don't yet support inline
// open from the studio shell.

import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, ExternalLink } from 'lucide-react'
import { Button } from '../../ui/Button'

// Per-scope edit URLs. Hand-maintained — when a scope ships an inline
// editor in the studio shell, the entry here can be replaced with a
// no-op (or the scope's embedder can stop mounting CloneDeepLinkRedirect).
const SCOPE_EDIT_HREF: Record<string, (id: string) => string> = {
  documents: (id) => `/documents/${encodeURIComponent(id)}`,
  meetings: (id) => `/meetings/admin?template=${encodeURIComponent(id)}`,
  survey: (id) => `/survey/admin?template=${encodeURIComponent(id)}`,
  learning: (id) => `/learning/admin?course=${encodeURIComponent(id)}`,
  registers: (id) => `/registers/admin?type=${encodeURIComponent(id)}`,
  dashboards: (id) => `/overview/hms?layout=${encodeURIComponent(id)}`,
  workflows: (id) => `/workflow?rule=${encodeURIComponent(id)}`,
}

export type CloneDeepLinkRedirectProps = {
  scopeId: string
  /** Optional override label for the CTA. */
  ctaLabel?: string
}

export function CloneDeepLinkRedirect({ scopeId, ctaLabel }: CloneDeepLinkRedirectProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const templateId = searchParams.get('template')
  const editHref = templateId ? SCOPE_EDIT_HREF[scopeId]?.(templateId) : null

  // Strip ?template once consumed so reloads don't re-trigger.
  useEffect(() => {
    if (!templateId) return
    const next = new URLSearchParams(searchParams)
    next.delete('template')
    setSearchParams(next, { replace: true })
  }, [templateId, searchParams, setSearchParams])

  if (!templateId || !editHref) return null

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Klone fullført</p>
        <p className="mt-0.5 text-xs">
          Den klonede malen er klar for redigering. Klikk for å åpne den i {scopeId}-modulen.
        </p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => navigate(editHref)}
      >
        {ctaLabel ?? 'Åpne redigering'}
        <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
      </Button>
    </div>
  )
}

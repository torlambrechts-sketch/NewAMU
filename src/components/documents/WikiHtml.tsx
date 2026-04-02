import { useMemo } from 'react'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { applyTemplateVariables, resolveWikiLinks, type WikiDocRef } from '../../lib/wikiLinks'

type Props = {
  html: string
  templateVariables?: Record<string, string>
  allDocs: WikiDocRef[]
}

export function WikiHtml({ html, templateVariables, allDocs }: Props) {
  const inner = useMemo(() => {
    const withVars = applyTemplateVariables(html, templateVariables)
    return resolveWikiLinks(withVars, allDocs)
  }, [html, templateVariables, allDocs])

  return (
    <div
      className="prose prose-sm max-w-none text-neutral-800 [&_a.wiki-internal-link]:text-emerald-800 [&_a.wiki-internal-link]:underline [&_.wiki-unresolved]:bg-amber-100 [&_.wiki-unresolved]:text-amber-950"
      dangerouslySetInnerHTML={{ __html: sanitizeLearningHtml(inner) }}
    />
  )
}

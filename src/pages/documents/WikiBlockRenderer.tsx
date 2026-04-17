import { ExternalLink } from 'lucide-react'
import type { ContentBlock, WikiPageLang } from '../../types/documents'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { LiveOrgChart } from './modules/LiveOrgChart'
import { LiveRiskFeed } from './modules/LiveRiskFeed'
import { ActionButton } from './modules/ActionButton'
import { AcknowledgementFooter } from './modules/AcknowledgementFooter'

type Props = {
  blocks: ContentBlock[]
  pageId: string
  pageVersion: number
  /** Document primary language (BCP 47 short) */
  lang?: WikiPageLang
}

const alertStyles = {
  info: 'border-sky-200 bg-sky-50 text-sky-900 border-sky-800/25',
  warning: 'border-amber-200 bg-amber-50 text-amber-950 border-amber-900/20',
  danger: 'border-red-200 bg-red-50 text-red-950 border-red-900/25',
  tip: 'border-emerald-200 bg-emerald-50 text-emerald-950 border-emerald-900/20',
}

const alertIcons = { info: 'ℹ️', warning: '⚠️', danger: '🚨', tip: '💡' }

function isAlertVariant(v: unknown): v is keyof typeof alertStyles {
  return v === 'info' || v === 'warning' || v === 'danger' || v === 'tip'
}

export function WikiBlockRenderer({ blocks, pageId, pageVersion, lang = 'nb' }: Props) {
  return (
    <article lang={lang} className="space-y-4">
      {blocks.map((block, i) => {
        if (!block || typeof block !== 'object' || !('kind' in block)) {
          return (
            <p key={i} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Ugyldig innholdsblokk (mangler type).
            </p>
          )
        }
        switch (block.kind) {
          case 'heading': {
            const level = block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2
            const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
            const cls =
              level === 1
                ? 'text-2xl font-bold text-neutral-900 mt-6 mb-2'
                : level === 2
                  ? 'text-lg font-semibold text-neutral-800 mt-5 mb-1'
                  : 'text-base font-semibold text-neutral-700 mt-4 mb-1'
            return (
              <Tag key={i} className={cls}>
                {typeof block.text === 'string' ? block.text : ''}
              </Tag>
            )
          }

          case 'text':
            return (
              <article
                key={i}
                className="prose prose-sm max-w-none text-neutral-800 [&_a]:text-[#1a3d32] [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-neutral-500"
                dangerouslySetInnerHTML={{
                  __html: sanitizeLearningHtml(typeof block.body === 'string' ? block.body : ''),
                }}
              />
            )

          case 'alert': {
            const variant = isAlertVariant(block.variant) ? block.variant : 'info'
            const role = variant === 'danger' || variant === 'warning' ? 'alert' : 'status'
            const live = variant === 'danger' ? 'assertive' : 'polite'
            return (
              <div
                key={i}
                role={role}
                aria-live={live}
                className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[variant]}`}
              >
                <span aria-hidden>{alertIcons[variant]}</span>{' '}
                {typeof block.text === 'string' ? block.text : ''}
              </div>
            )
          }

          case 'divider':
            return <hr key={i} className="my-4 border-neutral-200" aria-hidden />

          case 'law_ref': {
            const refCode = typeof block.ref === 'string' ? block.ref : ''
            const desc = typeof block.description === 'string' ? block.description : ''
            return (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <span className="mt-0.5 shrink-0 rounded bg-[#1a3d32]/10 px-1.5 py-0.5 font-mono text-xs text-[#1a3d32]">
                  {refCode}
                </span>
                <span className="flex-1 text-sm text-neutral-700">{desc}</span>
                {block.url ? (
                  <a
                    href={block.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[#1a3d32] hover:underline"
                    aria-label={`Lovhenvisning: ${refCode} — åpnes i ny fane`}
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            )
          }

          case 'image': {
            const url = typeof block.url === 'string' ? block.url : ''
            const alt = typeof block.alt === 'string' && block.alt.trim() ? block.alt.trim() : ''
            const caption = typeof block.caption === 'string' ? block.caption.trim() : ''
            const width = block.width === 'wide' || block.width === 'medium' ? block.width : 'full'
            const maxW = width === 'medium' ? 'max-w-xl' : width === 'wide' ? 'max-w-3xl' : 'max-w-full'
            if (!url) {
              return (
                <p key={i} className="text-sm text-neutral-500">
                  Bildeblokk mangler URL.
                </p>
              )
            }
            return (
              <figure key={i} className={`my-4 ${maxW} mx-auto`}>
                <img src={url} alt={alt || caption || 'Illustrasjon'} className="h-auto w-full rounded-lg border border-neutral-200" />
                {caption ? <figcaption className="mt-2 text-center text-sm text-neutral-600">{caption}</figcaption> : null}
              </figure>
            )
          }

          case 'module': {
            const p = block.params ?? {}
            switch (block.moduleName) {
              case 'live_org_chart':
                return (
                  <LiveOrgChart
                    key={i}
                    showAMU={p.showAMU !== false}
                    showVerneombud={p.showVerneombud !== false}
                  />
                )
              case 'live_risk_feed':
                return (
                  <LiveRiskFeed
                    key={i}
                    maxItems={typeof p.maxItems === 'number' ? p.maxItems : 3}
                    showDepartment={p.showDepartment !== false}
                  />
                )
              case 'action_button':
                return (
                  <ActionButton
                    key={i}
                    label={typeof p.label === 'string' ? p.label : undefined}
                    route={typeof p.route === 'string' ? p.route : undefined}
                    variant={
                      p.variant === 'secondary' ? 'secondary'
                      : p.variant === 'danger' ? 'danger'
                      : 'primary'
                    }
                  />
                )
              case 'acknowledgement_footer':
                return (
                  <AcknowledgementFooter
                    key={i}
                    pageId={pageId}
                    pageVersion={pageVersion}
                  />
                )
              default:
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  >
                    Ukjent dynamisk modul:{' '}
                    <code className="rounded bg-white px-1 font-mono text-xs">
                      {typeof block.moduleName === 'string' ? block.moduleName : '(mangler navn)'}
                    </code>
                  </div>
                )
            }
          }

          default:
            return (
              <div
                key={i}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                Ukjent blokktype:{' '}
                <code className="rounded bg-white px-1 font-mono text-xs">
                  {String((block as { kind?: unknown }).kind)}
                </code>
              </div>
            )
        }
      })}
    </article>
  )
}

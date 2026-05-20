import { Fragment, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import type { ContentBlock, WikiPageLang } from '../../types/documents'
import { sanitizeLearningHtml } from '../../lib/sanitizeHtml'
import { headingAnchorId } from '../../lib/wikiPageLinks'
import { LiveOrgChart } from './modules/LiveOrgChart'
import { LiveRiskFeed } from './modules/LiveRiskFeed'
import { ActionButton } from './modules/ActionButton'
import { AcknowledgementFooter } from './modules/AcknowledgementFooter'
import { EmergencyStopProcedure } from './modules/EmergencyStopProcedure'
import { SignatureBlock } from './modules/SignatureBlock'
import { RevisionLog } from './modules/RevisionLog'
import { ConfidentialityMarker } from './modules/ConfidentialityMarker'
import { ContactCard } from './modules/ContactCard'
import { RetentionMarker } from './modules/RetentionMarker'
import { TrainingMatrix } from './modules/TrainingMatrix'

type Props = {
  blocks: ContentBlock[]
  pageId: string
  pageVersion: number
  /** Document primary language (BCP 47 short) */
  lang?: WikiPageLang
  /** Rendered after each block (e.g. comments). */
  blockFooter?: (blockIndex: number) => ReactNode
  /** Prose font size. Defaults to 'base'. */
  fontSize?: 'sm' | 'base' | 'lg'
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

const FONT_SIZE_PX: Record<'sm' | 'base' | 'lg', string> = {
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
}

export function WikiBlockRenderer({ blocks, pageId, pageVersion, lang = 'nb', blockFooter, fontSize = 'base' }: Props) {
  const fontSizePx = FONT_SIZE_PX[fontSize]
  const headingCounts = new Map<string, number>()
  return (
    <article lang={lang} className="space-y-4" style={{ fontSize: fontSizePx }}>
      {blocks.map((block, i) => {
        if (!block || typeof block !== 'object' || !('kind' in block)) {
          return (
            <Fragment key={i}>
              <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Ugyldig innholdsblokk (mangler type).
              </p>
              {blockFooter?.(i)}
            </Fragment>
          )
        }
        let node: ReactNode
        switch (block.kind) {
          case 'heading': {
            const level = block.level === 1 || block.level === 2 || block.level === 3 ? block.level : 2
            const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
            const cls =
              level === 1
                ? 'font-bold text-neutral-900 mt-6 mb-2'
                : level === 2
                  ? 'font-semibold text-neutral-800 mt-5 mb-1'
                  : 'font-semibold text-neutral-700 mt-4 mb-1'
            // em-relative so the reader text-size control scales headings too.
            const headingEm = level === 1 ? '1.6em' : level === 2 ? '1.2em' : '1.05em'
            const text = typeof block.text === 'string' ? block.text : ''
            const baseKey = text.toLowerCase().replace(/\s+/g, ' ').trim()
            const occ = headingCounts.get(baseKey) ?? 0
            headingCounts.set(baseKey, occ + 1)
            const hid = headingAnchorId(text, occ)
            node = (
              <Tag id={hid} className={cls} style={{ fontSize: headingEm }}>
                {text}
              </Tag>
            )
            break
          }

          case 'text':
            node = (
              <article
                className="prose max-w-none text-neutral-800 [&_a]:text-[#1a3d32] [&_a]:underline [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-neutral-500"
                style={{ fontSize: fontSizePx }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeLearningHtml(typeof block.body === 'string' ? block.body : ''),
                }}
              />
            )
            break

          case 'alert': {
            const variant = isAlertVariant(block.variant) ? block.variant : 'info'
            const role = variant === 'danger' || variant === 'warning' ? 'alert' : 'status'
            const live = variant === 'danger' ? 'assertive' : 'polite'
            node = (
              <div
                role={role}
                aria-live={live}
                className={`rounded-lg border px-4 py-3 text-sm ${alertStyles[variant]}`}
              >
                <span aria-hidden>{alertIcons[variant]}</span>{' '}
                {typeof block.text === 'string' ? block.text : ''}
              </div>
            )
            break
          }

          case 'divider':
            node = <hr className="my-4 border-neutral-200" aria-hidden />
            break

          case 'law_ref': {
            const refCode = typeof block.ref === 'string' ? block.ref : ''
            const desc = typeof block.description === 'string' ? block.description : ''
            node = (
              <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
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
            break
          }

          case 'image': {
            const url = typeof block.url === 'string' ? block.url : ''
            const alt = typeof block.alt === 'string' && block.alt.trim() ? block.alt.trim() : ''
            const caption = typeof block.caption === 'string' ? block.caption.trim() : ''
            const width = block.width === 'wide' || block.width === 'medium' ? block.width : 'full'
            const maxW = width === 'medium' ? 'max-w-xl' : width === 'wide' ? 'max-w-3xl' : 'max-w-full'
            if (!url) {
              node = (
                <p className="text-sm text-neutral-500">
                  Bildeblokk mangler URL.
                </p>
              )
              break
            }
            node = (
              <figure className={`my-4 ${maxW} mx-auto`}>
                <img src={url} alt={alt || caption || 'Illustrasjon'} className="h-auto w-full rounded-lg border border-neutral-200" />
                {caption ? <figcaption className="mt-2 text-center text-sm text-neutral-600">{caption}</figcaption> : null}
              </figure>
            )
            break
          }

          case 'table': {
            const headers = Array.isArray(block.headers) ? block.headers : []
            const rows = Array.isArray(block.rows) ? block.rows : []
            const caption = typeof block.caption === 'string' ? block.caption.trim() : ''
            const colCount = Math.max(1, headers.length)
            const paddedHeaders = [...headers]
            while (paddedHeaders.length < colCount) paddedHeaders.push('')
            const paddedRows = rows.map((row) => {
              const r = Array.isArray(row) ? [...row] : []
              while (r.length < colCount) r.push('')
              return r.slice(0, colCount)
            })
            node = (
              <figure className="my-4 overflow-x-auto">
                <table className="w-full min-w-max border-collapse text-sm">
                  {caption ? (
                    <caption className="mb-2 px-1 text-left text-xs text-neutral-500">{caption}</caption>
                  ) : null}
                  <thead>
                    <tr className="border-b-2 border-neutral-300 bg-neutral-50">
                      {paddedHeaders.map((h, hi) => (
                        <th key={hi} scope="col" className="px-3 py-2 text-left font-semibold text-neutral-900">
                          {h || `\u00a0`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paddedRows.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="px-3 py-2 text-neutral-500">
                          Ingen rader.
                        </td>
                      </tr>
                    ) : (
                      paddedRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-neutral-100 even:bg-neutral-50/80">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-neutral-800">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </figure>
            )
            break
          }

          case 'module': {
            const p = block.params ?? {}
            switch (block.moduleName) {
              case 'live_org_chart':
                node = (
                  <LiveOrgChart
                    showAMU={p.showAMU !== false}
                    showVerneombud={p.showVerneombud !== false}
                  />
                )
                break
              case 'live_risk_feed':
                node = (
                  <LiveRiskFeed
                    maxItems={typeof p.maxItems === 'number' ? p.maxItems : 3}
                    showDepartment={p.showDepartment !== false}
                  />
                )
                break
              case 'action_button':
                node = (
                  <ActionButton
                    label={typeof p.label === 'string' ? p.label : undefined}
                    route={typeof p.route === 'string' ? p.route : undefined}
                    variant={
                      p.variant === 'secondary' ? 'secondary'
                      : p.variant === 'danger' ? 'danger'
                      : 'primary'
                    }
                  />
                )
                break
              case 'acknowledgement_footer':
                node = (
                  <div id="wiki-ack-footer" className="scroll-mt-24">
                    <AcknowledgementFooter pageId={pageId} pageVersion={pageVersion} />
                  </div>
                )
                break
              case 'emergency_stop_procedure':
                node = <EmergencyStopProcedure />
                break
              case 'signature_block':
                node = (
                  <SignatureBlock
                    pageId={pageId}
                    pageVersion={pageVersion}
                    parties={Array.isArray(p.parties) ? (p.parties as string[]) : undefined}
                    requireDate={p.requireDate !== false}
                    notes={typeof p.notes === 'string' ? p.notes : undefined}
                  />
                )
                break
              case 'revision_log':
                node = (
                  <RevisionLog
                    pageId={pageId}
                    maxEntries={typeof p.maxEntries === 'number' ? p.maxEntries : 5}
                  />
                )
                break
              case 'confidentiality_marker':
                node = (
                  <ConfidentialityMarker
                    classification={
                      p.classification === 'aapen'
                        ? 'aapen'
                        : p.classification === 'strengt_fortrolig'
                          ? 'strengt_fortrolig'
                          : 'fortrolig'
                    }
                    accessList={Array.isArray(p.accessList) ? (p.accessList as string[]) : undefined}
                  />
                )
                break
              case 'contact_card':
                node = (
                  <ContactCard
                    role={
                      p.role === 'varslings_mottak'
                        ? 'varslings_mottak'
                        : p.role === 'bht'
                          ? 'bht'
                          : p.role === 'verneombud'
                            ? 'verneombud'
                            : p.role === 'tilsynet'
                              ? 'tilsynet'
                              : p.role === 'datatilsynet'
                                ? 'datatilsynet'
                                : 'custom'
                    }
                    name={typeof p.name === 'string' ? p.name : undefined}
                    phone={typeof p.phone === 'string' ? p.phone : undefined}
                    email={typeof p.email === 'string' ? p.email : undefined}
                    url={typeof p.url === 'string' ? p.url : undefined}
                  />
                )
                break
              case 'retention_marker':
                node = (
                  <RetentionMarker
                    category={typeof p.category === 'string' ? p.category : undefined}
                    minYears={typeof p.minYears === 'number' ? p.minYears : undefined}
                    legalRef={typeof p.legalRef === 'string' ? p.legalRef : undefined}
                  />
                )
                break
              case 'training_matrix':
                node = (
                  <TrainingMatrix
                    roleSlugs={Array.isArray(p.roleSlugs) ? (p.roleSlugs as string[]) : undefined}
                    courseIds={Array.isArray(p.courseIds) ? (p.courseIds as string[]) : undefined}
                    onlyGaps={p.onlyGaps === true}
                  />
                )
                break
              default:
                node = (
                  <div
                    className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                  >
                    Ukjent dynamisk modul:{' '}
                    <code className="rounded bg-white px-1 font-mono text-xs">
                      {typeof block.moduleName === 'string' ? block.moduleName : '(mangler navn)'}
                    </code>
                  </div>
                )
                break
            }
            break
          }

          default:
            node = (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              >
                Ukjent blokktype:{' '}
                <code className="rounded bg-white px-1 font-mono text-xs">
                  {String((block as { kind?: unknown }).kind)}
                </code>
              </div>
            )
        }
        return (
          <Fragment key={i}>
            {node}
            {blockFooter?.(i)}
          </Fragment>
        )
      })}
    </article>
  )
}

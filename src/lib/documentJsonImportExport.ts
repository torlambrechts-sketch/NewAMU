import type { ContentBlock, PageTemplate, SpaceCategory, WikiPage } from '../types/documents'

export const WIKI_PAGE_EXPORT_VERSION = 'klarert-wiki-page-export-v1' as const
export const DOCUMENT_TEMPLATE_EXPORT_VERSION = 'klarert-document-template-export-v1' as const

export type WikiPageExportPayload = {
  version: typeof WIKI_PAGE_EXPORT_VERSION
  exportedAt: string
  page: Pick<
    WikiPage,
    | 'title'
    | 'summary'
    | 'status'
    | 'template'
    | 'legalRefs'
    | 'lang'
    | 'requiresAcknowledgement'
    | 'acknowledgementAudience'
    | 'acknowledgementDepartmentId'
    | 'revisionIntervalMonths'
    | 'nextRevisionDueAt'
    | 'containsPii'
    | 'piiCategories'
    | 'piiLegalBasis'
    | 'piiRetentionNote'
    | 'retentionCategory'
    | 'retainMinimumYears'
    | 'retainMaximumYears'
  > & { blocks: ContentBlock[] }
}

export type DocumentTemplateExportPayload = {
  version: typeof DOCUMENT_TEMPLATE_EXPORT_VERSION
  exportedAt: string
  template: PageTemplate
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

export function parseWikiPageExport(json: unknown): WikiPageExportPayload | null {
  if (!isRecord(json)) return null
  if (json.version !== WIKI_PAGE_EXPORT_VERSION) return null
  if (!isRecord(json.page)) return null
  const p = json.page
  if (typeof p.title !== 'string' || !Array.isArray(p.blocks)) return null
  return json as unknown as WikiPageExportPayload
}

export function parseDocumentTemplateExport(json: unknown): DocumentTemplateExportPayload | null {
  if (!isRecord(json)) return null
  if (json.version !== DOCUMENT_TEMPLATE_EXPORT_VERSION) return null
  if (!isRecord(json.template)) return null
  const t = json.template
  if (typeof t.id !== 'string' || typeof t.label !== 'string') return null
  if (!isRecord(t.page) || typeof (t.page as { title?: unknown }).title !== 'string') return null
  return json as unknown as DocumentTemplateExportPayload
}

export function buildWikiPageExport(page: WikiPage): WikiPageExportPayload {
  return {
    version: WIKI_PAGE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    page: {
      title: page.title,
      summary: page.summary ?? '',
      status: page.status,
      template: page.template,
      legalRefs: page.legalRefs,
      lang: page.lang ?? 'nb',
      requiresAcknowledgement: page.requiresAcknowledgement,
      acknowledgementAudience: page.acknowledgementAudience ?? 'all_employees',
      acknowledgementDepartmentId: page.acknowledgementDepartmentId ?? null,
      revisionIntervalMonths: page.revisionIntervalMonths ?? 12,
      nextRevisionDueAt: page.nextRevisionDueAt ?? null,
      containsPii: page.containsPii ?? false,
      piiCategories: page.piiCategories ?? [],
      piiLegalBasis: page.piiLegalBasis ?? null,
      piiRetentionNote: page.piiRetentionNote ?? null,
      retentionCategory: page.retentionCategory ?? null,
      retainMinimumYears: page.retainMinimumYears ?? null,
      retainMaximumYears: page.retainMaximumYears ?? null,
      blocks: Array.isArray(page.blocks) ? page.blocks : [],
    },
  }
}

export function buildTemplateExport(tpl: PageTemplate): DocumentTemplateExportPayload {
  return {
    version: DOCUMENT_TEMPLATE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    template: tpl,
  }
}

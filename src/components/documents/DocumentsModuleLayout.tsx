import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import {
  DOCUMENTS_MODULE_DESC,
  DOCUMENTS_MODULE_TITLE,
  DOCUMENTS_NAV,
  documentsNavActiveId,
} from '../../data/documentsNav'
import { HubMenu1Bar } from '../layout/HubMenu1Bar'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { apiFetchAnnualReview } from '../../api/wikiAnnualReview'
import { DocumentsReadingPrefs } from './DocumentsReadingPrefs'
import { documentsModuleShellStyle } from '../../lib/documentsModuleShellStyle'
import { useDocumentsShellEmbedded } from '../../../modules/documents/DocumentsShellContext'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

type Props = {
  children: ReactNode
  /** Optional extra row below the horizontal menu (e.g. space title). */
  subHeader?: ReactNode
}

export function DocumentsModuleLayout({ children, subHeader }: Props) {
  const embeddedInModuleShell = useDocumentsShellEmbedded()
  const location = useLocation()
  const { can, supabase, organization, profile } = useOrgSetupContext()
  const activeId = documentsNavActiveId(location.pathname)
  const [annualReviewDot, setAnnualReviewDot] = useState(false)

  useEffect(() => {
    if (!can('documents.manage') || !supabase || !organization?.id) {
      queueMicrotask(() => setAnnualReviewDot(false))
      return
    }
    const y = new Date().getFullYear()
    const now = new Date()
    const afterFeb1 = now.getMonth() > 1 || (now.getMonth() === 1 && now.getDate() > 1)
    if (!afterFeb1) {
      queueMicrotask(() => setAnnualReviewDot(false))
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { review } = await apiFetchAnnualReview(supabase, organization.id, y)
        if (!cancelled) queueMicrotask(() => setAnnualReviewDot(review == null || review.status !== 'completed'))
      } catch {
        if (!cancelled) queueMicrotask(() => setAnnualReviewDot(false))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [can, supabase, organization?.id])

  if (embeddedInModuleShell) {
    return (
      <>
        {subHeader}
        {children}
      </>
    )
  }

  const menuItems = DOCUMENTS_NAV.filter((n) => {
    if (n.permission) return can(n.permission)
    return true
  }).map((n) => ({
    key: n.id,
    label: n.label,
    icon: n.icon,
    active: activeId === n.id,
    to: n.to,
    end: n.to === '/documents',
    badgeDot: n.id === 'annual_review' ? annualReviewDot : undefined,
  }))

  return (
    <div className={`${PAGE} docs-module-shell`} style={documentsModuleShellStyle(profile)}>
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Workspace
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">{DOCUMENTS_MODULE_TITLE}</span>
      </nav>

      <header className="border-b border-neutral-200/80 pb-6">
        <h1
          className="text-2xl font-semibold text-neutral-900 md:text-3xl"
          style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
        >
          {DOCUMENTS_MODULE_TITLE}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">{DOCUMENTS_MODULE_DESC}</p>
      </header>

      <div className="mt-6">
        <HubMenu1Bar ariaLabel="Bibliotek og wiki" items={menuItems} />
      </div>

      <DocumentsReadingPrefs />

      {subHeader}

      {children}
    </div>
  )
}

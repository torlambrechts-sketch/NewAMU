import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  DOCUMENTS_MODULE_DESC,
  DOCUMENTS_MODULE_TITLE,
  DOCUMENTS_NAV,
  documentsNavActiveId,
} from '../../data/documentsNav'
import { HubMenu1Bar } from '../layout/HubMenu1Bar'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

type Props = {
  children: ReactNode
  /** Optional extra row below the horizontal menu (e.g. space title). */
  subHeader?: ReactNode
}

export function DocumentsModuleLayout({ children, subHeader }: Props) {
  const location = useLocation()
  const { can } = useOrgSetupContext()
  const activeId = documentsNavActiveId(location.pathname)

  const menuItems = DOCUMENTS_NAV.filter((n) => {
    if (n.id === 'templates') return can('documents.manage')
    return true
  }).map((n) => ({
    key: n.id,
    label: n.label,
    icon: n.icon,
    active: activeId === n.id,
    to: n.to,
    end: n.to === '/documents',
  }))

  return (
    <div className={PAGE}>
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

      {subHeader}

      {children}
    </div>
  )
}

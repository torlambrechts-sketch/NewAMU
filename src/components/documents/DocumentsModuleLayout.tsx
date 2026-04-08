import { Link, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  DOCUMENTS_MODULE_DESC,
  DOCUMENTS_MODULE_TITLE,
  DOCUMENTS_NAV,
  documentsMenuLinkClass,
} from '../../data/documentsNav'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

type Props = {
  children: ReactNode
  /** Optional extra row below the horizontal menu (e.g. space title). */
  subHeader?: ReactNode
}

export function DocumentsModuleLayout({ children, subHeader }: Props) {
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

      <nav
        className="mt-6 flex flex-col gap-3 border-b border-neutral-200/80 pb-6 sm:flex-row sm:flex-wrap sm:items-center"
        aria-label="Bibliotek og wiki"
      >
        <div className="flex flex-wrap gap-2">
          {DOCUMENTS_NAV.map(({ to, label, id, icon: Icon }) => (
            <NavLink
              key={id}
              to={to}
              end={to === '/documents'}
              className={({ isActive }) => documentsMenuLinkClass(isActive)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {subHeader}

      {children}
    </div>
  )
}

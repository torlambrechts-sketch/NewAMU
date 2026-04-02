import { Outlet } from 'react-router-dom'
import { DocumentCenterProvider } from '../../contexts/DocumentCenterContext'

/** Shared shell for document center (matches e-learning cream band). */
export function DocumentLayout() {
  return (
    <DocumentCenterProvider>
      <div className="min-h-0 bg-[#FCF8F0]">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </div>
    </DocumentCenterProvider>
  )
}

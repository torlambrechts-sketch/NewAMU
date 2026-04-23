import { useCallback, useMemo } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { BookOpen, Calendar, FolderOpen } from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'
import { DOCUMENTS_HUB_SECTION_IDS } from './documentsHubSectionIds'

type Props = {
  canManage: boolean
}

function scrollToHubSection(id: string) {
  queueMicrotask(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

/**
 * Secondary navigation for the Dokumenter **Oversikt** hub: in-page sections on `/documents`
 * and årsgjennomgang when permitted.
 */
export function DocumentsHubSecondaryNav({ canManage }: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const mapperHash = `#${DOCUMENTS_HUB_SECTION_IDS.mapper}`
  const templatesHash = `#${DOCUMENTS_HUB_SECTION_IDS.templates}`

  const onDocumentsHome = location.pathname === '/documents'
  const hash = location.hash || ''

  const mapperActive = onDocumentsHome && (hash === '' || hash === mapperHash)
  const templatesActive = onDocumentsHome && hash === templatesHash

  const annualMatch = useMatch({ path: '/documents/aarsgjennomgang', end: false })

  const goHubSection = useCallback(
    (id: string) => {
      const h = `#${id}`
      void navigate(`/documents${h}`)
      scrollToHubSection(id)
    },
    [navigate],
  )

  const items: HubMenu1Item[] = useMemo(() => {
    const list: HubMenu1Item[] = [
      {
        key: 'mapper',
        label: 'Mapper',
        icon: FolderOpen,
        active: Boolean(mapperActive),
        onClick: () => goHubSection(DOCUMENTS_HUB_SECTION_IDS.mapper),
      },
      {
        key: 'templates',
        label: 'Malbibliotek',
        icon: BookOpen,
        active: Boolean(templatesActive),
        onClick: () => goHubSection(DOCUMENTS_HUB_SECTION_IDS.templates),
      },
    ]
    if (canManage) {
      list.push({
        key: 'annual',
        label: 'Årsgjennomgang',
        icon: Calendar,
        to: '/documents/aarsgjennomgang',
        active: Boolean(annualMatch),
      })
    }
    return list
  }, [annualMatch, canManage, goHubSection, mapperActive, templatesActive])

  return <HubMenu1Bar ariaLabel="Dokumenter — flere seksjoner" items={items} />
}

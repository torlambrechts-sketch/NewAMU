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

  const onDocumentsHome = location.pathname === '/documents'
  const hash = location.hash || ''

  const mapperActive = onDocumentsHome && (hash === '' || hash === mapperHash)
  const templatesMatch = useMatch({ path: '/documents/malbibliotek', end: false })

  const annualMatch = useMatch({ path: '/documents/aarsgjennomgang', end: false })

  const goMapper = useCallback(() => {
    void navigate(`/documents${mapperHash}`)
    scrollToHubSection(DOCUMENTS_HUB_SECTION_IDS.mapper)
  }, [navigate, mapperHash])

  const items: HubMenu1Item[] = useMemo(() => {
    const list: HubMenu1Item[] = [
      {
        key: 'mapper',
        label: 'Mapper',
        icon: FolderOpen,
        active: Boolean(mapperActive),
        onClick: goMapper,
      },
      {
        key: 'templates',
        label: 'Malbibliotek',
        icon: BookOpen,
        to: '/documents/malbibliotek',
        active: Boolean(templatesMatch),
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
  }, [annualMatch, canManage, goMapper, mapperActive, templatesMatch])

  return <HubMenu1Bar ariaLabel="Dokumenter — flere seksjoner" items={items} />
}

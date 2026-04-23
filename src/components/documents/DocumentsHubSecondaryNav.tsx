import { useCallback, useMemo } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router-dom'
import { BarChart3, BookOpen, Calendar, FolderOpen, Home, LayoutGrid, ShieldCheck } from 'lucide-react'
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
 * plus links to scorecard test, layout prototype, and (when permitted) årsgjennomgang.
 */
export function DocumentsHubSecondaryNav({ canManage }: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const mapperHash = `#${DOCUMENTS_HUB_SECTION_IDS.mapper}`
  const readinessHash = `#${DOCUMENTS_HUB_SECTION_IDS.readiness}`
  const templatesHash = `#${DOCUMENTS_HUB_SECTION_IDS.templates}`

  const onDocumentsHome = location.pathname === '/documents'
  const hash = location.hash || ''

  const mapperActive = onDocumentsHome && (hash === '' || hash === mapperHash)
  const readinessActive = onDocumentsHome && hash === readinessHash
  const templatesActive = onDocumentsHome && hash === templatesHash

  const scorecardMatch = useMatch({ path: '/documents/scorecard-browser', end: false })
  const layoutTestMatch = useMatch({ path: '/documents/document-center-font-test', end: false })
  const pandadocHomeMatch = useMatch({ path: '/documents/pandadoc-home-test', end: false })
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
        key: 'readiness',
        label: 'Tilsynsklarhet',
        icon: ShieldCheck,
        active: Boolean(readinessActive),
        onClick: () => goHubSection(DOCUMENTS_HUB_SECTION_IDS.readiness),
      },
      {
        key: 'templates',
        label: 'Malbibliotek',
        icon: BookOpen,
        active: Boolean(templatesActive),
        onClick: () => goHubSection(DOCUMENTS_HUB_SECTION_IDS.templates),
      },
      {
        key: 'scorecard',
        label: 'Scorecard (test)',
        icon: BarChart3,
        to: '/documents/scorecard-browser',
        active: Boolean(scorecardMatch),
      },
      {
        key: 'doc_center',
        label: 'Dokumentsenter (layout-test)',
        icon: LayoutGrid,
        to: '/documents/document-center-font-test',
        active: Boolean(layoutTestMatch),
      },
      {
        key: 'pandadoc_home',
        label: 'PandaDoc-hjem (test)',
        icon: Home,
        to: '/documents/pandadoc-home-test',
        active: Boolean(pandadocHomeMatch),
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
  }, [
    annualMatch,
    canManage,
    goHubSection,
    layoutTestMatch,
    pandadocHomeMatch,
    mapperActive,
    readinessActive,
    scorecardMatch,
    templatesActive,
  ])

  return <HubMenu1Bar ariaLabel="Dokumenter — flere seksjoner" items={items} />
}

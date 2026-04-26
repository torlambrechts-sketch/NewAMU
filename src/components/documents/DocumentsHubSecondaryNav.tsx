import { useMemo } from 'react'
import { useMatch } from 'react-router-dom'
import { BookOpen, ClipboardCheck, FolderOpen, Settings, ShieldCheck } from 'lucide-react'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'

type Props = {
  /** Full documents admin (maler, årsgjennomgang, innstillinger i hub-menyen) */
  canManage: boolean
  /** Red dot on «Årsgjennomgang» when review is missing or incomplete (same signal as legacy sidebar). */
  annualReviewBadgeDot?: boolean
}

/**
 * Primary navigation for the Dokumenter module (single `HubMenu1Bar` under `ModulePageShell`).
 * One menu line: Dokumenter, Malbibliotek, Samsvar, (Årsgjennomgang), Innstillinger.
 * Nested **folder** hierarchy (expand/collapse) lives in `ModuleDocumentsKandidatdetaljHub` sidebar, not here.
 */
export function DocumentsHubSecondaryNav({ canManage, annualReviewBadgeDot }: Props) {
  const documentsHomeMatch = useMatch({ path: '/documents', end: true })
  const editorTestMatch = useMatch({ path: '/documents/editor-test', end: true })
  const kandidatTestMatch = useMatch({ path: '/documents/kandidatdetalj-layout-test', end: true })
  const spaceMatch = useMatch({ path: '/documents/space/:spaceId', end: false })
  const pageMatch = useMatch({ path: '/documents/page/:pageId', end: false })

  const malMatch = useMatch({ path: '/documents/malbibliotek', end: true })
  const complianceMatch = useMatch({ path: '/documents/compliance', end: false })
  const annualMatch = useMatch({ path: '/documents/aarsgjennomgang', end: false })
  const settingsMatch = useMatch({ path: '/documents/templates', end: false })

  const documentsNavActive = Boolean(
    documentsHomeMatch || editorTestMatch || kandidatTestMatch || spaceMatch || pageMatch,
  )

  const items: HubMenu1Item[] = useMemo(() => {
    const documentsTabOn = Boolean(
      documentsNavActive && !malMatch && !complianceMatch && !annualMatch && !settingsMatch,
    )
    const list: HubMenu1Item[] = [
      {
        key: 'documents',
        label: 'Dokumenter',
        icon: FolderOpen,
        to: '/documents',
        end: true,
        navActiveOverride: documentsTabOn,
        active: false,
      },
      {
        key: 'malbibliotek',
        label: 'Malbibliotek',
        icon: BookOpen,
        to: '/documents/malbibliotek',
        end: true,
        active: false,
      },
      {
        key: 'samsvar',
        label: 'Samsvar',
        icon: ShieldCheck,
        to: '/documents/compliance',
        end: false,
        active: false,
      },
    ]
    if (canManage) {
      list.push({
        key: 'annual',
        label: 'Årsgjennomgang',
        icon: ClipboardCheck,
        to: '/documents/aarsgjennomgang',
        end: false,
        active: false,
        badgeDot: annualReviewBadgeDot === true,
      })
      list.push({
        key: 'innstillinger',
        label: 'Dokumentmaler',
        icon: Settings,
        to: '/documents/templates',
        end: false,
        active: false,
      })
    }
    return list
  }, [
    annualMatch,
    annualReviewBadgeDot,
    canManage,
    complianceMatch,
    malMatch,
    documentsNavActive,
    settingsMatch,
  ])

  return <HubMenu1Bar ariaLabel="Dokumenter" items={items} />
}

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, ChevronDown, ChevronRight, Eye, Folder, FolderPlus, Pencil, Plus, Search, Upload } from 'lucide-react'
import { useDocuments } from '../../hooks/useDocuments'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { WikiPage, WikiSpace } from '../../types/documents'
import { ModuleRecordsTableShell } from './ModuleRecordsTableShell'
import { MODULE_TABLE_TD, MODULE_TABLE_TD_ACTION, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from './moduleTableKit'
import { BEIGE_NAV, WikiFolderNavRow, WIKI_FOLDER_ICON_CLASS } from './ModuleWikiFolderNavRow'
import { ModuleSectionCard } from './ModuleSectionCard'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect'
import { WarningBox } from '../ui/AlertBox'
import { InfoBox } from '../ui/AlertBox'
import {
  useDocumentsHubActionsRegister,
  useDocumentsHubNewDocumentRegister,
  useDocumentsHubNewTemplateRegister,
} from '../../../modules/documents/DocumentsHubActionsContext'
import { DocumentsTemplateLibraryBody } from '../documents/DocumentsTemplateLibraryBody'
import { DocumentAccessRequestDialog } from '../documents/DocumentAccessRequestDialog'
import {
  canViewWikiSpace,
  folderAllowsArchivePageInSpace,
  folderAllowsCreateInSpace,
  folderAllowsWritePageInSpace,
  wikiSpaceHasRestrictedAccess,
} from '../../lib/wikiSpaceAccessGrants'
import { canBypassWikiFolderGrants, canEditWikiDocuments } from '../../lib/documentsAccess'
import {
  buildSpaceTree,
  getSpacePath,
  wikiSpaceCollectDescendantIds,
  wikiSpaceDepthFromRoot,
  wikiSpaceMaxDescendantEdgeDistance,
  type SpaceTreeNode,
} from '../../lib/wikiSpaceTree'

const SERIF = "'Libre Baskerville', Georgia, serif"

const CATEGORY_LABELS: Record<WikiSpace['category'], string> = {
  hms_handbook: 'HMS-håndbok',
  policy: 'Policy',
  procedure: 'Prosedyre',
  guide: 'Veiledning',
  template_library: 'Malbibliotek',
}

const CATEGORY_ICONS: Record<WikiSpace['category'], string> = {
  hms_handbook: '📋',
  policy: '📜',
  procedure: '🔄',
  guide: '📖',
  template_library: '🗂️',
}

const categoryOptions: SelectOption[] = (Object.keys(CATEGORY_LABELS) as WikiSpace['category'][]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

const MIME_PAGE_DRAG = 'application/x-klarert-wiki-page-id'

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export type ModuleDocumentsKandidatdetaljHubProps = {
  /** `home` — documents oversikt (default chrome). `demo` — layout reference label in breadcrumb. */
  variant?: 'home' | 'demo'
  /** Show title + breadcrumb block (off for tight embed under templates). */
  showIntro?: boolean
  /**
   * `pages` — høyre kolonne: dokumenttabell (standard).
   * `templates` — høyre kolonne: malbibliotek (egen rute `/documents/malbibliotek`).
   */
  centerContent?: 'pages' | 'templates'
}

/**
 * Default **Dokumenter** hub: Kandidatdetalj-style split (beige ~22% folder nav + white hovedkolonne),
 * drag wiki page onto folder to move; fil-slipp for opplasting ligger i høyre kolonne rett under «Søk i sider».
 *
 * Follow `docs/UI_PLACEMENT_RULES.md` and `DESIGN_SYSTEM.md` (module primitives, no raw controls).
 */
export function ModuleDocumentsKandidatdetaljHub({
  variant = 'home',
  showIntro = true,
  centerContent = 'pages',
}: ModuleDocumentsKandidatdetaljHubProps) {
  const docs = useDocuments()
  const navigate = useNavigate()
  const { can, user, profile, members } = useOrgSetupContext()
  const { createWikiAccessRequest } = docs
  const canEditDocs = canEditWikiDocuments(can, profile?.is_org_admin)
  const bypassFolderRbac = canBypassWikiFolderGrants(can, profile?.is_org_admin)

  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null)
  const [folderQuery, setFolderQuery] = useState('')
  const [pageQuery, setPageQuery] = useState('')
  const [uiError, setUiError] = useState<string | null>(null)
  const [dropHighlightSpaceId, setDropHighlightSpaceId] = useState<string | null>(null)
  const [movingPageId, setMovingPageId] = useState<string | null>(null)

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCategory, setNewCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [newParentSpaceId, setNewParentSpaceId] = useState<string>('')
  const [savingFolder, setSavingFolder] = useState(false)

  const [editSpace, setEditSpace] = useState<WikiSpace | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editCategory, setEditCategory] = useState<WikiSpace['category']>('hms_handbook')
  const [editParentSpaceId, setEditParentSpaceId] = useState<string>('')
  const [savingEditSpace, setSavingEditSpace] = useState(false)

  const [archiveSpaceTarget, setArchiveSpaceTarget] = useState<WikiSpace | null>(null)
  const [archivingSpace, setArchivingSpace] = useState(false)

  const [archivePageTarget, setArchivePageTarget] = useState<WikiPage | null>(null)
  const [archivingPage, setArchivingPage] = useState(false)
  const [newTemplateKey, setNewTemplateKey] = useState(0)

  const [accessRequestPage, setAccessRequestPage] = useState<WikiPage | null>(null)
  const [accessReqBusy, setAccessReqBusy] = useState(false)
  const [accessReqErr, setAccessReqErr] = useState<string | null>(null)
  const [accessReqDone, setAccessReqDone] = useState(false)

  const uploadInputRef = useRef<HTMLInputElement>(null)

  const grantBase = useMemo(
    () => ({
      grants: docs.wikiSpaceAccessGrants,
      userId: user?.id,
      profile,
      members,
    }),
    [docs.wikiSpaceAccessGrants, user?.id, profile, members],
  )

  const folderWriteOk = useCallback(
    (spaceId: string) => bypassFolderRbac || folderAllowsWritePageInSpace({ ...grantBase, spaceId }),
    [bypassFolderRbac, grantBase],
  )
  const folderCreateOk = useCallback(
    (spaceId: string) => bypassFolderRbac || folderAllowsCreateInSpace({ ...grantBase, spaceId }),
    [bypassFolderRbac, grantBase],
  )
  const folderArchiveOk = useCallback(
    (spaceId: string) => bypassFolderRbac || folderAllowsArchivePageInSpace({ ...grantBase, spaceId }),
    [bypassFolderRbac, grantBase],
  )

  useEffect(() => {
    if (!canEditDocs) return
    const clear = () => setDropHighlightSpaceId(null)
    window.addEventListener('dragend', clear)
    return () => window.removeEventListener('dragend', clear)
  }, [canEditDocs])

  const activeSpaces = useMemo(() => docs.spaces.filter((s) => s.status === 'active'), [docs.spaces])

  const activeSpacesPages = useMemo(
    () => activeSpaces.filter((s) => s.category !== 'template_library'),
    [activeSpaces],
  )
  const activeSpacesTemplates = useMemo(
    () => activeSpaces.filter((s) => s.category === 'template_library'),
    [activeSpaces],
  )

  /** Document folders (not malbibliotek) where the user may create pages — for «Bruk mal» / systemmal pencil. */
  const templateDocumentDestinationSpaces = useMemo(() => {
    return activeSpacesPages.filter((s) =>
      canViewWikiSpace({
        spaceId: s.id,
        grants: docs.wikiSpaceAccessGrants,
        bypassRestriction: bypassFolderRbac,
        userId: user?.id,
        profile,
        members,
      }) &&
      (bypassFolderRbac ||
        folderAllowsCreateInSpace({
          spaceId: s.id,
          grants: docs.wikiSpaceAccessGrants,
          userId: user?.id,
          profile,
          members,
        })),
    )
  }, [activeSpacesPages, docs.wikiSpaceAccessGrants, bypassFolderRbac, user?.id, profile, members])

  const spacesForNav = centerContent === 'templates' ? activeSpacesTemplates : activeSpacesPages

  const spacesForNavFiltered = useMemo(() => {
    if (centerContent === 'templates') return spacesForNav
    return spacesForNav.filter((s) =>
      canViewWikiSpace({
        spaceId: s.id,
        grants: docs.wikiSpaceAccessGrants,
        bypassRestriction: bypassFolderRbac,
        userId: user?.id,
        profile,
        members,
      }),
    )
  }, [centerContent, spacesForNav, docs.wikiSpaceAccessGrants, bypassFolderRbac, user?.id, profile, members])

  useEffect(() => {
    if (centerContent !== 'pages') return
    if (selectedSpaceId && !spacesForNavFiltered.some((s) => s.id === selectedSpaceId)) {
      setSelectedSpaceId(null)
    }
  }, [centerContent, selectedSpaceId, spacesForNavFiltered])

  const filteredSpaces = useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return spacesForNavFiltered
    return spacesForNavFiltered.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(q),
    )
  }, [spacesForNavFiltered, folderQuery])

  const spaceTreeForNav = useMemo(() => buildSpaceTree(filteredSpaces), [filteredSpaces])

  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!selectedSpaceId) return
    const path = getSpacePath(selectedSpaceId, spacesForNavFiltered)
    setExpandedFolderIds((prev) => {
      const next = { ...prev }
      for (let i = 0; i < path.length - 1; i++) next[path[i]!.id] = true
      return next
    })
  }, [selectedSpaceId, spacesForNavFiltered])

  const validParentIdsForCreate = useMemo(
    () =>
      new Set(
        spacesForNavFiltered
          .filter((s) => wikiSpaceDepthFromRoot(s.id, spacesForNavFiltered) < 3)
          .map((s) => s.id),
      ),
    [spacesForNavFiltered],
  )

  const parentSelectOptionsForNew = useMemo((): SelectOption[] => {
    const opts: SelectOption[] = [{ value: '', label: 'Rot (ingen overmappe)' }]
    for (const s of spacesForNavFiltered) {
      if (!validParentIdsForCreate.has(s.id)) continue
      const label = getSpacePath(s.id, spacesForNavFiltered)
        .map((x) => x.title)
        .join(' / ')
      opts.push({ value: s.id, label })
    }
    return opts
  }, [spacesForNavFiltered, validParentIdsForCreate])

  const editInvalidParentIds = useMemo(() => {
    if (!editSpace) return new Set<string>()
    const d = new Set<string>([editSpace.id])
    for (const id of wikiSpaceCollectDescendantIds(editSpace.id, spacesForNavFiltered)) d.add(id)
    return d
  }, [editSpace, spacesForNavFiltered])

  const parentSelectOptionsForEdit = useMemo((): SelectOption[] => {
    if (!editSpace) return []
    const opts: SelectOption[] = [{ value: '', label: 'Rot (ingen overmappe)' }]
    const maxDesc = wikiSpaceMaxDescendantEdgeDistance(editSpace.id, spacesForNavFiltered)
    for (const s of spacesForNavFiltered) {
      if (editInvalidParentIds.has(s.id)) continue
      const newDepthSelf = wikiSpaceDepthFromRoot(s.id, spacesForNavFiltered) + 1
      if (newDepthSelf > 3) continue
      if (newDepthSelf + maxDesc > 3) continue
      const label = getSpacePath(s.id, spacesForNavFiltered)
        .map((x) => x.title)
        .join(' / ')
      opts.push({ value: s.id, label })
    }
    return opts
  }, [editSpace, spacesForNavFiltered, editInvalidParentIds])

  const defaultParentIdForNewFolder = useMemo(() => {
    const sel = selectedSpaceId ?? ''
    if (!sel) return ''
    return wikiSpaceDepthFromRoot(sel, spacesForNavFiltered) < 3 ? sel : ''
  }, [selectedSpaceId, spacesForNavFiltered])

  const openNewFolderFromShell = useCallback(() => {
    setNewCategory(centerContent === 'templates' ? 'template_library' : 'hms_handbook')
    setNewParentSpaceId(defaultParentIdForNewFolder)
    setNewFolderOpen(true)
  }, [centerContent, defaultParentIdForNewFolder])
  useDocumentsHubActionsRegister(openNewFolderFromShell)

  const openNewTemplateFolderFromLibrary = useCallback(() => {
    setNewCategory('template_library')
    setNewParentSpaceId(defaultParentIdForNewFolder)
    setNewFolderOpen(true)
  }, [defaultParentIdForNewFolder])

  const toggleNewFolderPanel = useCallback(() => {
    setNewFolderOpen((open) => {
      const next = !open
      if (next) {
        setNewCategory(centerContent === 'templates' ? 'template_library' : 'hms_handbook')
        setNewParentSpaceId(defaultParentIdForNewFolder)
      }
      return next
    })
  }, [centerContent, defaultParentIdForNewFolder])

  const pagesForTable = useMemo(() => {
    const q = pageQuery.trim().toLowerCase()
    let list: WikiPage[]
    const relevantIds = new Set(spacesForNavFiltered.map((s) => s.id))
    if (selectedSpaceId == null) {
      list = docs.pages.filter((p) => relevantIds.has(p.spaceId))
    } else {
      list = docs.pages.filter((p) => p.spaceId === selectedSpaceId)
    }
    if (!q) return list
    return list.filter((p) => p.title.toLowerCase().includes(q) || (p.summary ?? '').toLowerCase().includes(q))
  }, [docs.pages, spacesForNavFiltered, selectedSpaceId, pageQuery])

  const sortedPages = useMemo(
    () => [...pagesForTable].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [pagesForTable],
  )

  const selectedSpace = selectedSpaceId ? spacesForNav.find((s) => s.id === selectedSpaceId) : null
  const mainTitle =
    centerContent === 'templates'
      ? selectedSpace
        ? `Maler — ${selectedSpace.title}`
        : 'Maler — alle malmapper'
      : selectedSpace
        ? `Sider — ${selectedSpace.title}`
        : 'Sider — alle mapper'
  const mainDescription =
    centerContent === 'templates'
      ? selectedSpace
        ? `${CATEGORY_LABELS[selectedSpace.category]} · ${docs.pages.filter((p) => p.spaceId === selectedSpace.id).length} sider`
        : `${sortedPages.length} sider i malmapper (kategori «Malbibliotek»)`
      : selectedSpace
        ? `${CATEGORY_LABELS[selectedSpace.category]} · ${docs.pages.filter((p) => p.spaceId === selectedSpace.id).length} sider`
        : `${sortedPages.length} sider på tvers av aktive mapper`

  const spaceById = useMemo(() => new Map(docs.spaces.map((s) => [s.id, s])), [docs.spaces])

  const pageCountBySpaceId = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of docs.pages) {
      m.set(p.spaceId, (m.get(p.spaceId) ?? 0) + 1)
    }
    return m
  }, [docs.pages])

  const targetSpaceIdForActions = selectedSpaceId ?? spacesForNavFiltered[0]?.id ?? null

  const uploadTargetSpace = useMemo(() => {
    if (centerContent !== 'pages' || !targetSpaceIdForActions) return null
    return spacesForNavFiltered.find((s) => s.id === targetSpaceIdForActions) ?? null
  }, [centerContent, targetSpaceIdForActions, spacesForNavFiltered])

  const newFolderCategoryOptions = useMemo(
    () =>
      centerContent === 'templates'
        ? categoryOptions.filter((c) => c.value === 'template_library')
        : categoryOptions.filter((c) => c.value !== 'template_library'),
    [centerContent],
  )

  const openEditSpace = useCallback((s: WikiSpace) => {
    setEditSpace(s)
    setEditTitle(s.title)
    setEditDesc(s.description)
    setEditCategory(s.category)
    setEditParentSpaceId(s.parentSpaceId ?? '')
  }, [])

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSavingFolder(true)
    setUiError(null)
    try {
      const parentId = newParentSpaceId.trim() || undefined
      if (parentId && !validParentIdsForCreate.has(parentId)) {
        throw new Error('Valgt overmappe tillater ikke nye undermapper (maks. 3 nivåer).')
      }
      const sp = await docs.createSpace(
        newTitle,
        newDesc,
        newCategory,
        CATEGORY_ICONS[newCategory],
        parentId ?? null,
      )
      setNewTitle('')
      setNewDesc('')
      setNewParentSpaceId('')
      setNewFolderOpen(false)
      setSelectedSpaceId(sp.id)
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke opprette mappe.')
    } finally {
      setSavingFolder(false)
    }
  }

  const handleSaveEditSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSpace || !editTitle.trim()) return
    setSavingEditSpace(true)
    setUiError(null)
    try {
      const nextParent = editParentSpaceId.trim() || null
      const prevParent = editSpace.parentSpaceId ?? null
      if (nextParent !== prevParent) {
        if (nextParent && editInvalidParentIds.has(nextParent)) {
          throw new Error('Ugyldig overmappe (kan ikke flytte en mappe inn i seg selv eller undermapper).')
        }
        const maxDesc = wikiSpaceMaxDescendantEdgeDistance(editSpace.id, spacesForNavFiltered)
        const newDepthSelf = nextParent ? wikiSpaceDepthFromRoot(nextParent, spacesForNavFiltered) + 1 : 1
        if (newDepthSelf > 3 || newDepthSelf + maxDesc > 3) {
          throw new Error('Flyttingen bryter maks. 3 nivåer av mapper.')
        }
      }
      await docs.updateSpace(editSpace.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        category: editCategory,
        parentSpaceId: nextParent,
      })
      setEditSpace(null)
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke lagre mappe.')
    } finally {
      setSavingEditSpace(false)
    }
  }

  const confirmArchiveSpace = async () => {
    if (!archiveSpaceTarget) return
    setArchivingSpace(true)
    setUiError(null)
    try {
      await docs.updateSpace(archiveSpaceTarget.id, { status: 'archived' })
      if (selectedSpaceId === archiveSpaceTarget.id) setSelectedSpaceId(null)
      setArchiveSpaceTarget(null)
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke arkivere mappe.')
    } finally {
      setArchivingSpace(false)
    }
  }

  const confirmArchivePage = async () => {
    if (!archivePageTarget) return
    setArchivingPage(true)
    setUiError(null)
    try {
      await docs.archivePage(archivePageTarget.id)
      setArchivePageTarget(null)
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke arkivere side.')
    } finally {
      setArchivingPage(false)
    }
  }

  const handleNewDocument = useCallback(async () => {
    setUiError(null)
    if (!targetSpaceIdForActions) {
      setUiError('Opprett eller velg en mappe først.')
      return
    }
    if (!folderCreateOk(targetSpaceIdForActions)) {
      setUiError('Du har ikke opprettingstilgang i den valgte mappen.')
      return
    }
    try {
      const page = await docs.createPage(targetSpaceIdForActions, 'Ny side', 'standard', [])
      navigate(`/documents/page/${page.id}/reference-edit`)
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke opprette side.')
    }
  }, [targetSpaceIdForActions, docs, navigate, folderCreateOk])

  useDocumentsHubNewDocumentRegister(
    () => {
      void handleNewDocument()
    },
    centerContent === 'pages',
  )

  useDocumentsHubNewTemplateRegister(
    useCallback(() => {
      setNewTemplateKey((k) => k + 1)
    }, []),
    centerContent === 'templates',
  )

  const triggerUpload = () => {
    setUiError(null)
    if (!targetSpaceIdForActions) {
      setUiError('Velg en mappe (eller opprett én) før du laster opp.')
      return
    }
    if (!folderCreateOk(targetSpaceIdForActions) && !folderWriteOk(targetSpaceIdForActions)) {
      setUiError('Du har ikke opplastingstilgang i den valgte mappen.')
      return
    }
    uploadInputRef.current?.click()
  }

  const uploadToSpace = async (spaceId: string, files: FileList | File[]) => {
    const list = Array.from(files)
    if (!list.length) return
    setUiError(null)
    try {
      for (const file of list) {
        await docs.uploadSpaceFile(spaceId, file)
      }
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Opplasting feilet.')
    }
  }

  const onUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const sid = targetSpaceIdForActions
    if (!sid) return
    const files = e.target.files
    if (!files?.length) return
    await uploadToSpace(sid, files)
    e.target.value = ''
  }

  const movePageToSpace = async (pageId: string, spaceId: string) => {
    setUiError(null)
    const page = docs.pages.find((p) => p.id === pageId)
    if (page && (!folderWriteOk(page.spaceId) || !folderWriteOk(spaceId))) {
      setUiError('Du har ikke skrivetilgang i kilde- eller målmappe for å flytte dokumentet.')
      return
    }
    setMovingPageId(pageId)
    try {
      await docs.updatePage(pageId, { spaceId })
    } catch (err) {
      setUiError(err instanceof Error ? err.message : 'Kunne ikke flytte dokument.')
    } finally {
      setMovingPageId(null)
      setDropHighlightSpaceId(null)
    }
  }

  const onPageDragStart = (e: DragEvent, pageId: string) => {
    e.dataTransfer.setData(MIME_PAGE_DRAG, pageId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onFolderDragOver = (e: DragEvent, spaceId: string) => {
    if (!canEditDocs || !e.dataTransfer.types.includes(MIME_PAGE_DRAG)) return
    if (
      !canViewWikiSpace({
        spaceId,
        grants: docs.wikiSpaceAccessGrants,
        bypassRestriction: bypassFolderRbac,
        userId: user?.id,
        profile,
        members,
      }) ||
      !folderWriteOk(spaceId)
    ) {
      return
    }
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropHighlightSpaceId(spaceId)
  }

  const onFolderDrop = async (e: DragEvent, spaceId: string) => {
    if (!canEditDocs) return
    if (
      !canViewWikiSpace({
        spaceId,
        grants: docs.wikiSpaceAccessGrants,
        bypassRestriction: bypassFolderRbac,
        userId: user?.id,
        profile,
        members,
      }) ||
      !folderWriteOk(spaceId)
    ) {
      return
    }
    e.preventDefault()
    const pageId = e.dataTransfer.getData(MIME_PAGE_DRAG)
    setDropHighlightSpaceId(null)
    if (!pageId) return
    const page = docs.pages.find((p) => p.id === pageId)
    if (!page || page.spaceId === spaceId) return
    await movePageToSpace(pageId, spaceId)
  }

  const onUploadZoneDrop = async (e: DragEvent) => {
    if (!canEditDocs || !targetSpaceIdForActions) return
    if (!folderCreateOk(targetSpaceIdForActions) && !folderWriteOk(targetSpaceIdForActions)) return
    e.preventDefault()
    setDropHighlightSpaceId(null)
    if (e.dataTransfer.files?.length) {
      await uploadToSpace(targetSpaceIdForActions, e.dataTransfer.files)
    }
  }

  const viewPath = (pageId: string) => `/documents/page/${pageId}`
  const editPath = (pageId: string) => `/documents/page/${pageId}/reference-edit`

  const hubTargetAllowsUpload =
    targetSpaceIdForActions != null &&
    (folderCreateOk(targetSpaceIdForActions) || folderWriteOk(targetSpaceIdForActions))
  const hubTargetAllowsNewDoc =
    targetSpaceIdForActions != null && folderCreateOk(targetSpaceIdForActions)

  const openEditOrRequest = (page: WikiPage) => {
    if (folderWriteOk(page.spaceId)) {
      navigate(editPath(page.id))
      return
    }
    setAccessReqErr(null)
    setAccessReqDone(false)
    setAccessRequestPage(page)
  }

  return (
    <div className="space-y-4">
      {showIntro ? (
        <div>
          <p className="text-xs text-neutral-500">
            <span>Dokumenter</span>
            <span className="mx-1.5 text-neutral-300">›</span>
            {variant === 'demo' ? (
              <>
                <span className="font-medium text-neutral-700">Layout-test</span>
                <span className="mx-1.5 text-neutral-300">›</span>
                <span>Kandidatdetalj-split</span>
              </>
            ) : (
              <span className="font-medium text-neutral-700">Dokumenter</span>
            )}
          </p>
          <div className="mt-1.5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-neutral-900 sm:text-xl" style={{ fontFamily: SERIF }}>
                {centerContent === 'templates' ? 'Malbibliotek' : 'Mapper og dokumenter'}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-neutral-600">
                {centerContent === 'templates'
                  ? 'Velg mappe til venstre for kontekst. Til høyre: tilgjengelige maler. Nye sider åpnes i standard dokumentredaktør.'
                  : variant === 'demo'
                    ? 'Referanse: beige seksjonsnav (~22 %) og tabell til høyre. Dra en rad til en mappe for å flytte dokumentet.'
                    : 'Bibliotek: velg mappe til venstre, jobb med sider til høyre. Dra dokumentrader til en mappe for å flytte. Standard modul-UI.'}
              </p>
            </div>
            {canEditDocs ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 lg:justify-end">
                {centerContent === 'templates' ? (
                  <>
                    <Button type="button" variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={openNewTemplateFolderFromLibrary}>
                      Ny malmappe
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => setNewTemplateKey((k) => k + 1)}
                    >
                      Ny mal
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="secondary" icon={<FolderPlus className="h-4 w-4" />} onClick={toggleNewFolderPanel}>
                      Ny mappe
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      icon={<Upload className="h-4 w-4" />}
                      onClick={triggerUpload}
                      disabled={!hubTargetAllowsUpload}
                    >
                      Last opp
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      icon={<Plus className="h-4 w-4" />}
                      onClick={() => void handleNewDocument()}
                      disabled={!hubTargetAllowsNewDoc}
                    >
                      Nytt dokument
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => void onUploadFiles(e)}
        aria-hidden
      />

      {docs.error ? <WarningBox>{docs.error}</WarningBox> : null}
      {uiError ? <WarningBox>{uiError}</WarningBox> : null}
      {!canEditDocs ? <InfoBox>Du har ikke redigeringstilgang — visning av mapper og sider.</InfoBox> : null}

      {canEditDocs && newFolderOpen ? (
        <ModuleSectionCard className="p-4 md:p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Ny mappe</h3>
          <form onSubmit={(e) => void handleCreateFolder(e)} className="mt-3 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-new-title">
                Tittel
              </label>
              <StandardInput id="hub-new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required placeholder="Tittel" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-new-desc">
                Beskrivelse
              </label>
              <StandardInput id="hub-new-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Kort beskrivelse" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-new-cat">
                Kategori
              </label>
              <SearchableSelect
                value={newCategory}
                options={newFolderCategoryOptions}
                onChange={(v) => setNewCategory(v as WikiSpace['category'])}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-new-parent">
                Overmappe (valgfritt)
              </label>
              <SearchableSelect value={newParentSpaceId} options={parentSelectOptionsForNew} onChange={(v) => setNewParentSpaceId(v)} />
              <p className="mt-1 text-[11px] text-neutral-400">Maks. tre nivåer (rot + to undernivåer).</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewFolderOpen(false)}>
                Avbryt
              </Button>
              <Button type="submit" variant="primary" disabled={savingFolder}>
                {savingFolder ? 'Oppretter…' : 'Opprett'}
              </Button>
            </div>
          </form>
        </ModuleSectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm lg:grid-cols-[minmax(200px,22%)_1fr]">
        <aside className="border-b border-neutral-200 lg:border-b-0 lg:border-r lg:border-neutral-200/80" style={{ backgroundColor: BEIGE_NAV }}>
          <div className="border-b border-neutral-200/60 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <StandardInput
                type="search"
                className="w-full py-2 pl-8 text-xs"
                placeholder="Søk i mapper…"
                value={folderQuery}
                onChange={(e) => setFolderQuery(e.target.value)}
                aria-label="Søk i mapper"
              />
            </div>
          </div>
          <nav className="max-h-[min(70vh,32rem)] overflow-y-auto p-2" aria-label="Dokumentmapper">
            <WikiFolderNavRow
              label={centerContent === 'templates' ? 'Alle malmapper' : 'Alle mapper'}
              sub={`${spacesForNavFiltered.length} aktive`}
              active={selectedSpaceId == null}
              onSelect={() => setSelectedSpaceId(null)}
            />
            <HubFolderTreeRows
              nodes={spaceTreeForNav}
              depth={0}
              expandedFolderIds={expandedFolderIds}
              onToggleExpand={(id) =>
                setExpandedFolderIds((prev) => ({ ...prev, [id]: !(prev[id] ?? false) }))
              }
              selectedSpaceId={selectedSpaceId}
              onSelectSpace={(id) => setSelectedSpaceId(id)}
              dropHighlightSpaceId={dropHighlightSpaceId}
              canEditDocs={canEditDocs}
              folderWriteOk={folderWriteOk}
              folderArchiveOk={folderArchiveOk}
              openEditSpace={openEditSpace}
              setArchiveSpaceTarget={setArchiveSpaceTarget}
              onFolderDragOver={onFolderDragOver}
              onFolderDrop={onFolderDrop}
              pageCountBySpaceId={pageCountBySpaceId}
            />
            {filteredSpaces.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-neutral-500">Ingen mapper matcher søket.</p>
            ) : null}
          </nav>
        </aside>

        <div className="min-w-0 bg-white p-4 md:p-6">
          {centerContent === 'templates' ? (
            <DocumentsTemplateLibraryBody
              destinationSpaces={activeSpacesTemplates}
              documentCatalogSpaces={templateDocumentDestinationSpaces}
              onNewTemplateFolder={canEditDocs ? openNewTemplateFolderFromLibrary : undefined}
              newTemplateKey={newTemplateKey}
            />
          ) : (
            <ModuleRecordsTableShell
              wrapInCard={false}
              title={mainTitle}
              titleTypography="sans"
              description={mainDescription}
              toolbar={
                <div className="flex w-full min-w-0 flex-col gap-3">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                    <StandardInput
                      type="search"
                      className="w-full py-2 pl-10"
                      placeholder="Søk i sider…"
                      value={pageQuery}
                      onChange={(e) => setPageQuery(e.target.value)}
                      aria-label="Søk i sider"
                    />
                  </div>
                  {canEditDocs && targetSpaceIdForActions && uploadTargetSpace && hubTargetAllowsUpload ? (
                    <ModuleSectionCard className="overflow-hidden p-2.5 shadow-sm">
                      <div
                        role="region"
                        aria-label="Slipp filer for opplasting"
                        onDragOver={(e) => {
                          if (!e.dataTransfer.types.includes('Files')) return
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'copy'
                        }}
                        onDrop={(e) => void onUploadZoneDrop(e)}
                        className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/90 px-2 py-3 text-center transition hover:border-[#1a3d32]/40"
                      >
                        <Upload className="mx-auto h-4 w-4 text-neutral-400" aria-hidden />
                        <p className="mt-1.5 text-[11px] font-medium leading-snug text-neutral-800">
                          Slipp filer her for opplasting i{' '}
                          <span className="text-[#1a3d32]">«{uploadTargetSpace.title}»</span>
                          {selectedSpaceId == null ? (
                            <span className="block pt-0.5 text-[10px] font-normal text-neutral-500">
                              Velg en mappe til venstre for å endre målmappe.
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-[10px] text-neutral-500">Eller «Last opp».</p>
                      </div>
                    </ModuleSectionCard>
                  ) : null}
                </div>
              }
              footer={<span className="text-sm text-neutral-500">{sortedPages.length} treff</span>}
            >
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {selectedSpaceId == null ? (
                      <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Mappe</th>
                    ) : null}
                    <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Tittel</th>
                    <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Status</th>
                    <th className={`${MODULE_TABLE_TH} text-sm normal-case font-semibold tracking-normal`}>Endret</th>
                    <th className={`${MODULE_TABLE_TH} text-right text-sm normal-case font-semibold tracking-normal`}>
                      Dokument
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.length === 0 ? (
                    <tr>
                      <td
                        colSpan={selectedSpaceId == null ? 5 : 4}
                        className="px-5 py-12 text-center text-sm text-neutral-500"
                      >
                        Ingen sider i denne visningen. Velg en mappe eller opprett et dokument.
                      </td>
                    </tr>
                  ) : null}
                  {sortedPages.map((page) => {
                    const space = spaceById.get(page.spaceId)
                    const statusLabel =
                      page.status === 'published' ? 'Publisert' : page.status === 'draft' ? 'Utkast' : 'Arkivert'
                    const variantBadge = page.status === 'published' ? 'success' : 'neutral'
                    const busy = movingPageId === page.id
                    const rowWrite = folderWriteOk(page.spaceId)
                    const rowArchive = folderArchiveOk(page.spaceId)
                    const restricted = wikiSpaceHasRestrictedAccess(page.spaceId, docs.wikiSpaceAccessGrants)
                    return (
                      <tr
                        key={page.id}
                        className={MODULE_TABLE_TR_BODY}
                        draggable={canEditDocs && rowWrite}
                        onDragStart={canEditDocs && rowWrite ? (e) => onPageDragStart(e, page.id) : undefined}
                      >
                        {selectedSpaceId == null ? (
                          <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>
                            <span className="inline-flex items-center gap-2">
                              <Folder className={WIKI_FOLDER_ICON_CLASS} aria-hidden />
                              {space?.title ?? '—'}
                            </span>
                          </td>
                        ) : null}
                        <td className={`${MODULE_TABLE_TD} text-sm text-neutral-900`}>
                          <button
                            type="button"
                            className="inline-flex min-w-0 items-center gap-2 text-left hover:underline"
                            onClick={() => navigate(viewPath(page.id))}
                            disabled={busy}
                          >
                            <Folder className={WIKI_FOLDER_ICON_CLASS} aria-hidden />
                            <span className="truncate font-medium">{page.title}</span>
                          </button>
                        </td>
                        <td className={`${MODULE_TABLE_TD}`}>
                          <Badge variant={variantBadge} className="scale-95">
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className={`${MODULE_TABLE_TD} text-sm text-neutral-600`}>{formatShortDate(page.updatedAt)}</td>
                        <td className={`${MODULE_TABLE_TD_ACTION}`}>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="icon"
                              title="Vis dokument"
                              aria-label={`Vis dokument ${page.title}`}
                              disabled={busy}
                              onClick={() => navigate(viewPath(page.id))}
                              icon={<Eye className="h-4 w-4" aria-hidden />}
                            />
                            {canEditDocs ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 text-neutral-500 hover:text-neutral-800"
                                  title={rowWrite ? 'Rediger' : restricted ? 'Be om redigeringstilgang' : 'Ingen skrivetilgang'}
                                  aria-label={rowWrite ? `Rediger ${page.title}` : `Be om tilgang — ${page.title}`}
                                  disabled={busy}
                                  onClick={() => openEditOrRequest(page)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {page.status !== 'archived' && rowArchive ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    title="Arkiver"
                                    aria-label={`Arkiver ${page.title}`}
                                    disabled={busy}
                                    onClick={() => setArchivePageTarget(page)}
                                    icon={<Archive className="h-4 w-4" aria-hidden />}
                                  />
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ModuleRecordsTableShell>
          )}
        </div>
      </div>

      {editSpace ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-edit-folder-title"
          onClick={() => setEditSpace(null)}
        >
          <ModuleSectionCard className="w-full max-w-md p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 id="hub-edit-folder-title" className="text-sm font-semibold text-neutral-900">
              Rediger mappe
            </h3>
            <form onSubmit={(e) => void handleSaveEditSpace(e)} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-edit-title">
                  Tittel
                </label>
                <StandardInput id="hub-edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-edit-desc">
                  Beskrivelse
                </label>
                <StandardInput id="hub-edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-edit-cat">
                  Kategori
                </label>
                <SearchableSelect value={editCategory} options={categoryOptions} onChange={(v) => setEditCategory(v as WikiSpace['category'])} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500" htmlFor="hub-edit-parent">
                  Overmappe
                </label>
                <SearchableSelect value={editParentSpaceId} options={parentSelectOptionsForEdit} onChange={(v) => setEditParentSpaceId(v)} />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" onClick={() => setEditSpace(null)}>
                  Avbryt
                </Button>
                <Button type="submit" variant="primary" disabled={savingEditSpace}>
                  {savingEditSpace ? 'Lagrer…' : 'Lagre'}
                </Button>
              </div>
            </form>
          </ModuleSectionCard>
        </div>
      ) : null}

      {archiveSpaceTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setArchiveSpaceTarget(null)}
        >
          <ModuleSectionCard className="w-full max-w-md p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-neutral-900">Arkiver mappe?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              «{archiveSpaceTarget.title}» settes til arkivert og vises ikke lenger under aktive mapper. Sider i mappen
              slettes ikke.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setArchiveSpaceTarget(null)}>
                Avbryt
              </Button>
              <Button type="button" variant="danger" disabled={archivingSpace} onClick={() => void confirmArchiveSpace()}>
                {archivingSpace ? 'Arkiverer…' : 'Arkiver'}
              </Button>
            </div>
          </ModuleSectionCard>
        </div>
      ) : null}

      {archivePageTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setArchivePageTarget(null)}
        >
          <ModuleSectionCard className="w-full max-w-md p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-neutral-900">Arkiver side?</h3>
            <p className="mt-2 text-sm text-neutral-600">
              «{archivePageTarget.title}» settes til arkivert og vises ikke lenger i aktive lister. Du kan gjenåpne fra
              administrasjon om nødvendig.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setArchivePageTarget(null)}>
                Avbryt
              </Button>
              <Button type="button" variant="secondary" disabled={archivingPage} onClick={() => void confirmArchivePage()}>
                {archivingPage ? 'Arkiverer…' : 'Arkiver'}
              </Button>
            </div>
          </ModuleSectionCard>
        </div>
      ) : null}

      <DocumentAccessRequestDialog
        open={Boolean(accessRequestPage && user?.id && profile)}
        title="Be om redigeringstilgang"
        documentLabel={accessRequestPage?.title ?? 'Dokument'}
        subLabel={
          accessRequestPage
            ? `Mappe: ${spaceById.get(accessRequestPage.spaceId)?.title ?? accessRequestPage.spaceId}`
            : undefined
        }
        busy={accessReqBusy}
        error={accessReqErr}
        done={accessReqDone}
        onClose={() => {
          if (accessReqBusy) return
          setAccessRequestPage(null)
          setAccessReqErr(null)
          setAccessReqDone(false)
        }}
        onSubmit={async ({ justification, accessScope, duration }) => {
          if (!accessRequestPage || !user?.id || !profile) return
          setAccessReqErr(null)
          setAccessReqBusy(true)
          try {
            await createWikiAccessRequest({
              resourceType: 'document',
              spaceId: accessRequestPage.spaceId,
              pageId: accessRequestPage.id,
              title: accessRequestPage.title,
              justification,
              accessScope,
              duration,
              requesterName: profile.display_name ?? '',
            })
            setAccessReqDone(true)
          } catch (err) {
            setAccessReqErr(err instanceof Error ? err.message : 'Kunne ikke sende søknad.')
          } finally {
            setAccessReqBusy(false)
          }
        }}
      />
    </div>
  )
}

function HubFolderTreeRows({
  nodes,
  depth,
  expandedFolderIds,
  onToggleExpand,
  selectedSpaceId,
  onSelectSpace,
  dropHighlightSpaceId,
  canEditDocs,
  folderWriteOk,
  folderArchiveOk,
  openEditSpace,
  setArchiveSpaceTarget,
  onFolderDragOver,
  onFolderDrop,
  pageCountBySpaceId,
}: {
  nodes: SpaceTreeNode[]
  depth: number
  expandedFolderIds: Record<string, boolean>
  onToggleExpand: (id: string) => void
  selectedSpaceId: string | null
  onSelectSpace: (id: string) => void
  dropHighlightSpaceId: string | null
  canEditDocs: boolean
  folderWriteOk: (spaceId: string) => boolean
  folderArchiveOk: (spaceId: string) => boolean
  openEditSpace: (s: WikiSpace) => void
  setArchiveSpaceTarget: (s: WikiSpace) => void
  onFolderDragOver: (e: DragEvent, spaceId: string) => void
  onFolderDrop: (e: DragEvent, spaceId: string) => Promise<void>
  pageCountBySpaceId: Map<string, number>
}) {
  return (
    <>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0
        const expanded = expandedFolderIds[node.id] ?? false
        const count = pageCountBySpaceId.get(node.id) ?? 0
        const dropOn = canEditDocs && folderWriteOk(node.id)
        const canEditThisFolder = canEditDocs && folderWriteOk(node.id)
        const canArchiveThisFolder = canEditDocs && folderArchiveOk(node.id)
        return (
          <div key={node.id}>
            <div className="flex items-stretch" style={{ marginLeft: depth * 14 }}>
              {hasChildren ? (
                <button
                  type="button"
                  className="mt-0.5 flex h-9 w-8 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-white/50 hover:text-neutral-800"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Skjul undermapper' : 'Vis undermapper'}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onToggleExpand(node.id)
                  }}
                >
                  {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-8 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <WikiFolderNavRow
                  label={node.title}
                  sub={`${CATEGORY_LABELS[node.category]} · ${count} sider`}
                  active={selectedSpaceId === node.id}
                  highlightDrop={dropOn && dropHighlightSpaceId === node.id}
                  onSelect={() => onSelectSpace(node.id)}
                  onDragOver={dropOn ? (e) => onFolderDragOver(e, node.id) : undefined}
                  onDrop={dropOn ? (e) => void onFolderDrop(e, node.id) : undefined}
                  actions={
                    canEditThisFolder || canArchiveThisFolder ? (
                      <>
                        {canEditThisFolder ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-neutral-500 hover:text-neutral-800"
                            title="Rediger mappe"
                            aria-label={`Rediger mappe ${node.title}`}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              openEditSpace(node)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        {canArchiveThisFolder ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-neutral-500 hover:text-neutral-900"
                            title="Arkiver mappe"
                            aria-label={`Arkiver mappe ${node.title}`}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setArchiveSpaceTarget(node)
                            }}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </>
                    ) : undefined
                  }
                />
              </div>
            </div>
            {hasChildren && expanded ? (
              <HubFolderTreeRows
                nodes={node.children}
                depth={depth + 1}
                expandedFolderIds={expandedFolderIds}
                onToggleExpand={onToggleExpand}
                selectedSpaceId={selectedSpaceId}
                onSelectSpace={onSelectSpace}
                dropHighlightSpaceId={dropHighlightSpaceId}
                canEditDocs={canEditDocs}
                folderWriteOk={folderWriteOk}
                folderArchiveOk={folderArchiveOk}
                openEditSpace={openEditSpace}
                setArchiveSpaceTarget={setArchiveSpaceTarget}
                onFolderDragOver={onFolderDragOver}
                onFolderDrop={onFolderDrop}
                pageCountBySpaceId={pageCountBySpaceId}
              />
            ) : null}
          </div>
        )
      })}
    </>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Award,
  BookOpen,
  LayoutDashboard,
  Loader2,
  Plus,
  Settings,
  Users,
} from 'lucide-react'
import { WORKPLACE_CREAM } from '../layout/WorkplaceChrome'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'
import { ModuleLegalBanner, ModulePageShell } from '../module'
import { Button } from '../ui/Button'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SlidePanel } from '../layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { LEARNING_MODULE_LEGAL_REFERENCES } from './learningLegalReferences'

/** Workplace content canvas (aligned with Action Board). */
export const SHELL_PAGE_BG = WORKPLACE_CREAM
/** Primary brand green from shell header */
export const SHELL_PRIMARY = '#1a3d32'
/** Gold accent from shell logo */
export const SHELL_ACCENT = '#c9a227'

/** @deprecated Use SHELL_PRIMARY for new code — kept for minimal churn in imports */
export const PIN_GREEN = SHELL_PRIMARY
export const CREAM = SHELL_PAGE_BG

/**
 * Wrapper for e-learning routes (content only). Primary + section navigation lives in AticsShell.
 */
function learningPageMeta(pathname: string): { section: string; description: string } {
  if (pathname === '/learning' || pathname === '/learning/') {
    return {
      section: 'Oversikt',
      description:
        'Tildel kurs, følg progresjon og dokumenter kompetanse i tråd med AML § 3-2 og IK-forskriften § 5 nr. 2.',
    }
  }
  if (pathname.startsWith('/learning/play/')) {
    return {
      section: 'Kursvisning',
      description: 'Fullfør moduler i ditt eget tempo. Fremdrift lagres automatisk.',
    }
  }
  if (pathname.startsWith('/learning/flow')) {
    return {
      section: 'Påmelding',
      description: 'Åpne kurset fra lenke eller QR-kode og start der du skal.',
    }
  }
  if (pathname.startsWith('/learning/courses/')) {
    return {
      section: 'Kursbygger',
      description: 'Struktur, moduler, publisering og versjonering for dette kurset.',
    }
  }
  if (pathname.startsWith('/learning/katalog')) {
    return {
      section: 'Katalog',
      description: 'Alle kurs i organisasjonen — søk, filtrer og åpne for å redigere eller ta kurset.',
    }
  }
  if (pathname.startsWith('/learning/deltakere')) {
    return {
      section: 'Deltakere',
      description: 'Tildelinger og fremdrift — bytt mellom liste og team-heatmap øverst i visningen.',
    }
  }
  if (pathname.startsWith('/learning/kompetanse')) {
    return {
      section: 'Kompetanse',
      description: 'Kursbevis, fornybare sertifikater og ekstern opplæring samlet på ett sted.',
    }
  }
  if (pathname.startsWith('/learning/innstillinger')) {
    return {
      section: 'Innstillinger',
      description: 'Preferanser, læringsstier, integrasjoner og personvern for e-læringsmodulen.',
    }
  }
  return {
    section: 'E-læring',
    description: 'Kurs, sertifiseringer og rapportering.',
  }
}

export function LearningLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { section, description } = learningPageMeta(pathname)
  const { can, isAdmin } = useOrgSetupContext()
  const canManage = isAdmin || can('learning.manage')
  const { createCourse, updateCourse } = useLearning()

  const [newCourseOpen, setNewCourseOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newRecert, setNewRecert] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // The course builder has its own breadcrumb / actions and the player runs full-screen,
  // so we hide the layout-level "Nytt kurs" CTA on those routes.
  const isBuilderRoute =
    pathname.startsWith('/learning/courses/') || pathname.startsWith('/learning/play/')

  const closeNewCoursePanel = useCallback(() => {
    if (creating) return
    setNewCourseOpen(false)
    setNewTitle('')
    setNewDesc('')
    setNewTags('')
    setNewRecert('')
  }, [creating])

  const submitNewCourse = useCallback(() => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const course = createCourse(newTitle, newDesc)
      const recertNumber = newRecert.trim() ? Number(newRecert.trim()) : NaN
      const tags = newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const patch: Parameters<typeof updateCourse>[1] = {}
      if (tags.length > 0) patch.tags = tags
      if (Number.isFinite(recertNumber) && recertNumber > 0) patch.recertificationMonths = recertNumber
      if (Object.keys(patch).length > 0) updateCourse(course.id, patch)
      navigate(`/learning/courses/${course.id}`)
      // Reset after navigate so the next open is empty.
      setNewCourseOpen(false)
      setNewTitle('')
      setNewDesc('')
      setNewTags('')
      setNewRecert('')
    } finally {
      setCreating(false)
    }
  }, [createCourse, navigate, newDesc, newRecert, newTags, newTitle, updateCourse])

  // Five canonical tabs (matches Survey/Documents). Old routes still resolve via
  // redirects in App.tsx, so deep links from emails / PDFs keep working.
  const learningHubItems: HubMenu1Item[] = useMemo(() => {
    const items: HubMenu1Item[] = [
      {
        key: 'dash',
        label: 'Oversikt',
        icon: LayoutDashboard,
        active: pathname === '/learning' || pathname === '/learning/',
        onClick: () => navigate('/learning'),
      },
      {
        key: 'katalog',
        label: 'Katalog',
        icon: BookOpen,
        active:
          pathname === '/learning/katalog' ||
          pathname.startsWith('/learning/katalog/') ||
          pathname.startsWith('/learning/courses'),
        onClick: () => navigate('/learning/katalog'),
      },
      {
        key: 'deltakere',
        label: 'Deltakere',
        icon: Users,
        active:
          pathname.startsWith('/learning/deltakere') ||
          pathname.startsWith('/learning/participants') ||
          pathname.startsWith('/learning/compliance'),
        onClick: () => navigate('/learning/deltakere'),
      },
      {
        key: 'kompetanse',
        label: 'Kompetanse',
        icon: Award,
        active:
          pathname.startsWith('/learning/kompetanse') ||
          pathname.startsWith('/learning/certifications') ||
          pathname.startsWith('/learning/external'),
        onClick: () => navigate('/learning/kompetanse'),
      },
    ]
    if (canManage) {
      items.push({
        key: 'innstillinger',
        label: 'Innstillinger',
        icon: Settings,
        active:
          pathname.startsWith('/learning/innstillinger') ||
          pathname.startsWith('/learning/settings') ||
          pathname.startsWith('/learning/paths') ||
          pathname.startsWith('/learning/insights'),
        onClick: () => navigate('/learning/innstillinger'),
      })
    }
    return items
  }, [canManage, navigate, pathname])

  const headerActions =
    canManage && !isBuilderRoute ? (
      <Button
        type="button"
        variant="primary"
        icon={<Plus className="h-4 w-4" />}
        onClick={() => setNewCourseOpen(true)}
      >
        Nytt kurs
      </Button>
    ) : undefined

  return (
    <>
      <ModulePageShell
        breadcrumb={[{ label: 'Arbeidsflate', to: '/' }, { label: 'E-læring' }, { label: section }]}
        title="E-læring"
        description={description}
        headerActions={headerActions}
        tabs={<HubMenu1Bar ariaLabel="E-læring — faner" items={learningHubItems} />}
      >
        <ModuleLegalBanner
          title="Regelverk for opplæring og kompetanse"
          intro={
            <>
              Lovpålagt opplæring forankres i arbeidsmiljøloven, internkontrollforskriften og
              personvernregelverket. Bruk regelreferansene under som sjekkliste når du oppretter
              kurs, tildeler eller dokumenterer fullføring.
            </>
          }
          references={LEARNING_MODULE_LEGAL_REFERENCES}
        />
        <Outlet />
      </ModulePageShell>

      <SlidePanel
        open={newCourseOpen}
        onClose={closeNewCoursePanel}
        titleId="learning-new-course-title"
        title="Nytt kurs"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeNewCoursePanel} disabled={creating}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              icon={creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              onClick={submitNewCourse}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? 'Oppretter…' : 'Opprett kladd'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-new-course-title">
              Tittel <span className="text-red-500">*</span>
            </label>
            <StandardInput
              id="learning-new-course-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="F.eks. Brannvern på arbeidsplassen"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-new-course-desc">
              Beskrivelse
            </label>
            <p className="mb-1 text-xs text-neutral-500">
              Hvem er målgruppen og hva oppnår de? Beskrivelsen vises i kurskatalogen.
            </p>
            <StandardTextarea
              id="learning-new-course-desc"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              placeholder="F.eks. Årlig opplæring i evakuering og bruk av brannslukkere."
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-new-course-tags">
              Tagger (kommaseparert)
            </label>
            <StandardInput
              id="learning-new-course-tags"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder="F.eks. HMS, brannvern, årlig"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="learning-new-course-recert">
              Resertifisering (måneder)
            </label>
            <p className="mb-1 text-xs text-neutral-500">
              La stå tom hvis kurset ikke krever fornyelse. Klarert sender automatisk varsel 60 dager før utløp.
            </p>
            <StandardInput
              id="learning-new-course-recert"
              type="number"
              min={0}
              value={newRecert}
              onChange={(e) => setNewRecert(e.target.value)}
              placeholder="F.eks. 12 eller 24"
            />
          </div>
        </div>
      </SlidePanel>
    </>
  )
}

// useArbeidsmiljostrategiData — felles data-komposisjon for alle
// Arbeidsmiljøstrategi-layouts. Tre visnings-varianter (Vekst, Puls,
// Styringssatser) speiler det samme datapunktet på forskjellige
// måter; for å unngå at hver layout duplikerer hooke-koden samles
// alt her.
//
// Returnerer en flat, sterkt typed objekt — layoutene velger hva
// de viser. Skriv-aksjoner (saveStrategy, createFocusArea, …) er
// inkludert så vi slipper å sende to hooks ned i hvert kort.

import { useMemo } from 'react'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'
import { useLearning } from '../../../hooks/useLearning'
import { useLearningCategories } from '../../../hooks/useLearningCategories'
import { useLearningDatasets } from '../../learning/dashboards/useLearningDatasets'
import { useChecklistModule } from '../../../../modules/compliance/useChecklistModule'
import { useChecklistDatasets } from '../../../../modules/compliance/dashboards/useChecklistDatasets'
import { useLicensedPacks } from '../../../context/packContextValue'
import { useSurvey } from '../../../../modules/survey/useSurvey'
import { useSurveyPacks } from '../../../../modules/survey/useSurveyPacks'
import { useSurveyOrgTemplates } from '../../../../modules/survey/useSurveyOrgTemplates'
import { useSurveyDatasets } from '../../../../modules/survey/dashboards/useSurveyDatasets'
import { useTaskItemsData } from '../../../../modules/tasks/useTaskItemsData'
import { useTasksDatasets } from '../../../../modules/tasks/dashboards/useTasksDatasets'
import { useDocuments } from '../../../hooks/useDocuments'
import { useDocumentsDatasets } from '../../documents/dashboards/useDocumentsDatasets'
import { useVernerunderDatasets } from '../../../../modules/vernerunder/dashboards/useVernerunderDatasets'
import {
  useWorkerWellbeingDatasets,
  type WellbeingAxisKey,
  type WellbeingIndexWeights,
} from '../dashboards/useWorkerWellbeingDatasets'
import { useWellbeingStrategy, type WellbeingFocusAreaRow } from './useWellbeingStrategy'
import { useWellbeingSnapshots, type WellbeingSnapshotRow } from './useWellbeingSnapshots'
import type { DashboardFilter } from '../../../lib/dashboards/dashboardFilters'

export type AxisOverviewRow = {
  axisKey: WellbeingAxisKey
  axis: string
  score: string
  signal: string
  nextMove: string
}

export type ActionQueueRow = {
  axis: string
  item: string
  severity: 'Kritisk' | 'Høy' | 'Medium' | string
  origin: string
}

export type ToolRow = {
  axis: WellbeingAxisKey
  title: string
  description: string
  path: string
}

export const WELLBEING_TOOLS: ToolRow[] = [
  { axis: 'trygghet', title: 'Vernerunder', description: 'Strukturerte runder med funn, alvorlighet og signatur.', path: '/vernerunder' },
  { axis: 'trygghet', title: 'Avvik & nestenulykke', description: 'CAPA-livssyklus for hendelser etter ISO 45001 § 10.2.', path: '/tasks/management?template=avvik' },
  { axis: 'trygghet', title: 'Risikoanalyser (ROS)', description: 'Identifiserer fare før den materialiserer seg.', path: '/ros' },
  { axis: 'trivsel', title: 'Psykososial undersøkelse', description: 'QPS Nordic, ARK eller NAQ-R+ — målet etter AML § 4-3.', path: '/survey' },
  { axis: 'trivsel', title: 'Sjekkliste § 4-3-oppfølging', description: 'Strukturert oppfølging av lave skår i hver delskala.', path: '/compliance/checklists' },
  { axis: 'medvirkning', title: 'AMU-møter (Q1–Q4)', description: 'Maler med agendapunkter knyttet til survey- og avviksdata.', path: '/meetings' },
  { axis: 'medvirkning', title: 'Verneombud-møter', description: 'Kvartalsvise operativ-møter etter AML § 6-2.', path: '/meetings' },
  { axis: 'medvirkning', title: 'Varslingskanal', description: 'Anonym kanal etter AML kap. 2A.', path: '/workplace-reporting/anonymous-aml' },
  { axis: 'mestring', title: 'HMS-grunnopplæring (40t)', description: 'Lederopplæring etter AML § 3-5.', path: '/learning' },
  { axis: 'mestring', title: 'Verneombud-opplæring (40t)', description: 'Pliktig kompetanse etter AML § 6-5.', path: '/learning' },
  { axis: 'mestring', title: 'AMU-grunnopplæring', description: 'Innføring i AMU-mandat og § 7-2-oppgaver.', path: '/learning' },
]

export type ArbeidsmiljostrategiData = ReturnType<typeof useArbeidsmiljostrategiData>

export function useArbeidsmiljostrategiData(filters: DashboardFilter[] = []) {
  const orgSetup = useOrgSetupContext()
  const { supabase, organization } = orgSetup
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()
  const survey = useSurvey({ supabase })
  const { packs: surveyPacks } = useSurveyPacks({ supabase })
  const surveyOrgTemplates = useSurveyOrgTemplates({ supabase })
  const tasksApi = useTaskItemsData()
  const learning = useLearning()
  const cats = useLearningCategories({ supabase })
  const docs = useDocuments()
  const wellbeingStrategy = useWellbeingStrategy()
  const snapshots = useWellbeingSnapshots()

  const categoryByCatalogId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const t of surveyOrgTemplates.templates) m.set(t.catalogId, t.categoryId)
    return m
  }, [surveyOrgTemplates.templates])

  const checklistDs = useChecklistDatasets({
    filters,
    executions: cl.executions,
    responsesByExecutionId: cl.responsesByExecutionId,
    templates: cl.templates,
    packs,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
  })
  const surveyDs = useSurveyDatasets({
    filters,
    surveys: survey.surveys,
    templateCatalog: survey.templateCatalog,
    packs: surveyPacks,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
    categoryByCatalogId,
  })
  const tasksDs = useTasksDatasets(
    tasksApi.items.map((t) => ({
      id: t.id,
      status: t.status,
      priority: t.priority,
      templateKind: t.templateKind,
      templateSlug: t.templateSlug,
      templateName: null,
      dueDate: t.dueDate,
      slaDueAt: t.slaDueAt,
      closedAt: t.closedAt,
      createdAt: t.createdAt,
    })),
    filters,
  )
  const learningDs = useLearningDatasets({
    filters,
    courses: learning.courses,
    progress: learning.progress,
    certificates: learning.certificates,
    categories: cats.categories,
    members: orgSetup.members,
    departments: orgSetup.departments,
  })
  const accessRequestsOpen = useMemo(
    () => docs.wikiAccessRequests.filter((r) => r.status === 'pending').length,
    [docs.wikiAccessRequests],
  )
  const documentsDs = useDocumentsDatasets({
    filters,
    pages: docs.pages,
    spaces: docs.spaces,
    orgCustomTemplates: docs.orgCustomTemplates,
    accessRequestsOpen,
  })
  const vernerunderDs = useVernerunderDatasets({ filters })

  const memberDatasets = useMemo<Record<string, unknown>>(
    () => ({ ...checklistDs, ...surveyDs, ...tasksDs, ...learningDs, ...documentsDs, ...vernerunderDs }),
    [checklistDs, surveyDs, tasksDs, learningDs, documentsDs, vernerunderDs],
  )

  const wellbeingDs = useWorkerWellbeingDatasets({
    memberDatasets,
    weights: wellbeingStrategy.weights,
    indexHistory: snapshots.series,
    snapshotHistory: snapshots.snapshots,
  })

  const indexSummary = useMemo(
    () => (wellbeingDs['wellbeing_index_summary'] as Record<string, unknown> | undefined) ?? {},
    [wellbeingDs],
  )
  const axisOverview = useMemo<AxisOverviewRow[]>(() => {
    const raw = (wellbeingDs['wellbeing_axis_overview'] ?? []) as Array<{ axis: string; score: string; signal: string; nextMove: string }>
    const keys: WellbeingAxisKey[] = ['trygghet', 'trivsel', 'medvirkning', 'mestring']
    return raw.map((r, i) => ({ ...r, axisKey: keys[i] ?? 'trygghet' }))
  }, [wellbeingDs])

  const actionQueue = (wellbeingDs['wellbeing_action_queue'] as ActionQueueRow[] | undefined) ?? []
  const trendPoints = (wellbeingDs['wellbeing_index_over_time'] as Array<{ x: string; y: number; periodKey?: string; hasData?: boolean }> | undefined) ?? []

  const rawScores = useMemo(
    () => ({
      index: typeof indexSummary.indexRaw === 'number' ? (indexSummary.indexRaw as number) : null,
      trygghet: typeof indexSummary.trygghetRaw === 'number' ? (indexSummary.trygghetRaw as number) : null,
      trivsel: typeof indexSummary.trivselRaw === 'number' ? (indexSummary.trivselRaw as number) : null,
      medvirkning: typeof indexSummary.medvirkningRaw === 'number' ? (indexSummary.medvirkningRaw as number) : null,
      mestring: typeof indexSummary.mestringRaw === 'number' ? (indexSummary.mestringRaw as number) : null,
    }),
    [indexSummary],
  )

  const loading =
    cl.loading ||
    survey.loading ||
    learning.learningLoading ||
    docs.loading ||
    wellbeingStrategy.loading ||
    snapshots.loading

  const error =
    cl.error ?? survey.error ?? learning.learningError ?? docs.error ?? wellbeingStrategy.error ?? snapshots.error

  return {
    // org meta
    organizationName: organization?.name?.trim() || 'Organisasjon',

    // strategy text + focus areas
    visionMd: wellbeingStrategy.strategy?.vision_md ?? null,
    missionMd: wellbeingStrategy.strategy?.mission_md ?? null,
    focusAreas: wellbeingStrategy.focusAreas as WellbeingFocusAreaRow[],
    canManageStrategy: wellbeingStrategy.canManage,
    saveStrategy: wellbeingStrategy.saveStrategy,
    createFocusArea: wellbeingStrategy.createFocusArea,
    updateFocusArea: wellbeingStrategy.updateFocusArea,
    archiveFocusArea: wellbeingStrategy.archiveFocusArea,

    // weights + raw scores (for snapshot capture)
    weights: wellbeingStrategy.weights as WellbeingIndexWeights,
    rawScores,
    memberDatasets,

    // summary KPIs and axis breakdown
    indexLabel: typeof indexSummary.indexLabel === 'string' ? (indexSummary.indexLabel as string) : '—',
    indexDelta: typeof indexSummary.indexDelta === 'string' ? (indexSummary.indexDelta as string) : '',
    axisScores: {
      trygghet: typeof indexSummary.trygghet === 'string' ? (indexSummary.trygghet as string) : '—',
      trivsel: typeof indexSummary.trivsel === 'string' ? (indexSummary.trivsel as string) : '—',
      medvirkning: typeof indexSummary.medvirkning === 'string' ? (indexSummary.medvirkning as string) : '—',
      mestring: typeof indexSummary.mestring === 'string' ? (indexSummary.mestring as string) : '—',
    },
    axisOverview,
    actionQueue,
    tools: WELLBEING_TOOLS,

    // snapshots / history
    trendPoints,
    snapshots: snapshots.snapshots as WellbeingSnapshotRow[],
    latestSnapshot: snapshots.latest,
    captureNow: snapshots.captureNow,
    maybeAutoCapture: snapshots.maybeAutoCapture,
    hasCurrentMonth: snapshots.hasCurrentMonth,
    currentPeriodKey: snapshots.currentPeriodKey,

    // raw datasets — for the engine-driven Klassisk view
    datasets: useMemo<Record<string, unknown>>(
      () => ({ ...memberDatasets, ...wellbeingDs }),
      [memberDatasets, wellbeingDs],
    ),

    // loading / error
    loading,
    error,
  }
}

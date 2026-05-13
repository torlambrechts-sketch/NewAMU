import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
  useParams,
} from 'react-router-dom'
import { OrgSetupProvider } from './context/OrgSetupProvider'
import { UiThemeProvider } from './context/UiThemeProvider'
import { I18nProvider } from './context/I18nProvider'
import { AticsShell } from './components/layout/AticsShell'
import { RegulationFilterProvider } from './context/RegulationFilterContext'
import { OrgGate } from './components/OrgGate'
import { PermissionGate } from './components/PermissionGate'
import { OnboardingWizard } from './pages/OnboardingWizard'
import { AuthPage } from './pages/AuthPage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReportsListPage } from './pages/reports/ReportsListPage'
import { ReportDetailPage } from './pages/reports/ReportDetailPage'
import { SharedReportPage } from './pages/public/SharedReportPage'
import { WorkflowModulePage } from './pages/WorkflowModulePage'
import { WorkflowPage } from './pages/WorkflowPage'
import { WorkflowEditorV2 } from './components/workflow/WorkflowEditorV2'
import { WorkplaceReportingPage } from './pages/WorkplaceReportingPage'
import { WorkplaceDashboardPage } from './pages/WorkplaceDashboardPage'
import { WorkplaceIncidentsPage } from './pages/WorkplaceIncidentsPage'
import { WorkplaceAnonymousAmlPage } from './pages/WorkplaceAnonymousAmlPage'
import { WorkplaceAnonymousAmlSettingsPage } from './pages/WorkplaceAnonymousAmlSettingsPage'
import { PublicAnonymousAmlPage } from './pages/PublicAnonymousAmlPage'
import { HrComplianceHub } from './pages/hr/HrComplianceHub'
import { HrDiscussionPage } from './pages/hr/HrDiscussionPage'
import { HrConsultationPage } from './pages/hr/HrConsultationPage'
import { HrORosPage } from './pages/hr/HrORosPage'
import { HrmEmployees } from './pages/HrmEmployees'
import { HrmSalary } from './pages/HrmSalary'
import { NotFound } from './pages/NotFound'
import { MeetingsHubPage } from './pages/meetings/MeetingsHubPage'
import { MeetingsDetailView } from './pages/meetings/MeetingsDetailView'
import { MeetingsAnalysePage } from './pages/meetings/MeetingsAnalysePage'
import { MeetingsExportPage } from './pages/meetings/MeetingsExportPage'
import { MembersModule } from './pages/MembersModule'
import { HseModule } from './pages/HseModule'
import { OrgHealthModule } from './pages/OrgHealthModule'
import { OrgHealthSettings } from './pages/OrgHealthSettings'
import { InternalControlModule } from './pages/InternalControlModule'
import { YearskontrollModule } from './pages/YearskontrollModule'
import { ComplianceDashboardPage } from './pages/ComplianceDashboardPage'
import { ComplianceKanbanPage } from './pages/ComplianceKanbanPage'
import { ComplianceAmlPage } from './pages/ComplianceAmlPage'
import { ComplianceArbeidsmiljolovenPage } from './pages/compliance/ComplianceArbeidsmiljolovenPage'
import { AdminTemplatesPage } from './pages/admin/AdminTemplatesPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import { ComplianceInternforskriftenPage } from './pages/ComplianceInternforskriftenPage'
import { OrganisationPage } from './pages/OrganisationPage'
import { AarshjulPage } from './pages/aarshjul/AarshjulPage'
import { ActionBoardPage } from './pages/actionboard/ActionBoardPage'
import { WorkplaceChrome } from './components/layout/WorkplaceChrome'
import { ModuleLegalFrameworkProvider } from './components/module'
import { WorkplacePublishedComposerProvider } from './context/WorkplacePublishedComposerProvider'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { WelcomeDashboardPage } from './pages/WelcomeDashboardPage'
import { TasksManagementPage, TasksAnalysePage } from '../modules/tasks'
import { TasksAllePage } from '../modules/tasks/TasksAllePage'
import { TasksManagementReviewPage } from '../modules/tasks/TasksManagementReviewPage'
import { ChecklistsAllePage } from '../modules/compliance/ChecklistsAllePage'
import { SurveyAllePage } from '../modules/survey/SurveyAllePage'
import { DocumentsAllePage } from './pages/documents/DocumentsAllePage'
import { LearningAllePage } from './pages/learning/LearningAllePage'
import { WorkspaceAuditLogPage } from './pages/WorkspaceAuditLogPage'
import { LearningLayout } from './components/learning/LearningLayout'
import { LearningDashboard } from './pages/learning/LearningDashboard'
import { LearningCoursesList } from './pages/learning/LearningCoursesList'
import { LearningCourseBuilder } from './pages/learning/LearningCourseBuilder'
import { RegistersHubPage } from './pages/registers/RegistersHubPage'
import { RegistersAnalysePage } from './pages/registers/RegistersAnalysePage'
import { RegisterTypePage } from './pages/registers/RegisterTypePage'
import { LearningPlayer } from './pages/learning/LearningPlayer'
import { LearningDeltakerePage } from './pages/learning/LearningDeltakerePage'
import { LearningKompetansePage } from './pages/learning/LearningKompetansePage'
import { LearningAnalysePage } from './pages/learning/LearningAnalysePage'
import { HmsOverviewPage } from './pages/overview/HmsOverviewPage'
import { ComplianceCompanyPage } from './pages/admin/ComplianceCompanyPage'
import { CompliancePersonalPage } from './pages/admin/CompliancePersonalPage'
import { RegelverkCoverageDashboardPage } from './pages/overview/regelverk/RegelverkCoverageDashboardPage'
import { ComplianceStudioPage } from './pages/overview/studio/ComplianceStudioPage'
import { LearningFlowEntry } from './pages/learning/LearningFlowEntry'
import { LearningCertificatePrintPage } from './pages/learning/LearningCertificatePrintPage'
import { DocumentsHome } from './pages/documents/DocumentsHome'
import { DocumentsAnalysePage } from './pages/documents/DocumentsAnalysePage'
import { DocumentsMalbibliotekPage } from './pages/documents/DocumentsMalbibliotekPage'
import { WikiSpaceView } from './pages/documents/WikiSpaceView'
import { WikiPageView } from './pages/documents/WikiPageView'
import { WikiPageEditRedirect } from './pages/documents/WikiPageEditRedirect'
import { ComplianceDashboard } from './pages/documents/ComplianceDashboard'
import { AnnualReviewPage } from './pages/documents/AnnualReviewPage'
import { InspectionArbeidstilsynetExportPage } from './pages/documents/InspectionArbeidstilsynetExportPage'

import { DocumentReviewsPage } from './pages/documents/DocumentReviewsPage'
import { DocumentModerationQueuePage } from './pages/documents/DocumentModerationQueuePage'
import { DocumentPrivacyPage } from './pages/documents/DocumentPrivacyPage'
import { DocumentEditorTestPage } from './pages/documents/DocumentEditorTestPage'
import { DocumentKandidatdetaljLayoutTestPage } from './pages/documents/DocumentKandidatdetaljLayoutTestPage'
import { WikiPageReferenceEditor } from './pages/documents/WikiPageReferenceEditor'
import { DocumentsOrgTemplateEditorPage } from './pages/documents/DocumentsOrgTemplateEditorPage'
import { DocumentsModuleShellLayout, DocumentsWikiOutlet } from '../modules/documents'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { DocumentsLayout } from './hooks/useDocuments'
import { PlatformAdminLoginPage } from './pages/platform/PlatformAdminLoginPage'
import { PlatformAdminLayout } from './pages/platform/PlatformAdminLayout'
import { PlatformAdminDashboardPage } from './pages/platform/PlatformAdminDashboardPage'
import { PlatformRoadmapPage } from './pages/platform/PlatformRoadmapPage'
import { LayoutLabPage } from './pages/platform/LayoutLabPage'
import { PlatformUiAdvancedPage } from './pages/platform/PlatformUiAdvancedPage'
import { PlatformBoxDesignerPage } from './pages/platform/PlatformBoxDesignerPage'
import { PlatformLayoutCompositionPage } from './pages/platform/PlatformLayoutCompositionPage'
import { PlatformPinpointLayoutsPage } from './pages/platform/PlatformPinpointLayoutsPage'
import { PlatformLayoutTemplatesPage } from './pages/platform/PlatformLayoutTemplatesPage'
import { PlatformModuleTemplatesPage } from './pages/platform/PlatformModuleTemplatesPage'
import { PlatformLayoutHubPage } from './pages/platform/PlatformLayoutHubPage'
import { PlatformLayoutElementsGalleryPage } from './pages/platform/PlatformLayoutElementsGalleryPage'
import { PublicWhistlePage } from './pages/PublicWhistlePage'
import { WhistleStatusPage } from './pages/WhistleStatusPage'
import { LandingPage } from './pages/LandingPage'
import { ModuleSlugPage } from './pages/ModuleSlugPage'
import { InspectionModulePage } from './pages/InspectionModulePage'
import { InspectionModuleAdminPage } from './pages/InspectionModuleAdminPage'
import { InspectionRoundDetailPage } from './pages/InspectionRoundDetailPage'
import { ChecklistsPage } from '../modules/compliance/ChecklistsPage'
import { ChecklistsAnalysePage } from '../modules/compliance/ChecklistsAnalysePage'
import { ChecklistExecutionPage } from '../modules/compliance/ChecklistExecutionPage'
import { PackProvider } from './context/PackContext'
import { VernerunderPageRoute } from './pages/VernerunderPage'
import { VernerundeDetailPage } from './pages/VernerundeDetailPage'
import { VernerunderAdminPage } from './pages/VernerunderAdminPage'
import { SjaDetailPage } from './pages/SjaDetailPage'
import { SjaModulePage } from './pages/SjaModulePage'
import { SjaModuleAdminPage } from './pages/SjaModuleAdminPage'
import { ModuleAdminPage } from './pages/ModuleAdminPage'
import { AvvikPage } from './pages/AvvikPage'
import { IkHubPage } from './pages/IkHubPage'
import { IkLovregisterPage } from './pages/IkLovregisterPage'
import { IkKompetansePage } from './pages/IkKompetansePage'
import { IkMedvirkningPage } from './pages/IkMedvirkningPage'
import { IkMalPage } from './pages/IkMalPage'
import { IkTiltaksplanPage } from './pages/IkTiltaksplanPage'
import { ActionPlanPage } from './pages/ActionPlanPage'
import { ActionPlanAdminPage } from './pages/ActionPlanAdminPage'
import { IkAnnualReviewPage } from './pages/IkAnnualReviewPage'
import { InternalControlAdminPage } from './pages/InternalControlAdminPage'
import { RisikoSikkerhetFrontpage } from './pages/RisikoSikkerhetFrontpage'
import { RosModulePage }         from './pages/RosModulePage'
import { RosModuleAdminPage }    from './pages/RosModuleAdminPage'
import { RosAnalysisDetailPage } from './pages/RosAnalysisDetailPage'
import { SurveyModulePage } from './pages/SurveyModulePage'
import { SurveyVendorsPage } from './pages/SurveyVendorsPage'
import { SurveyOrgTemplateEditorPage } from './pages/SurveyOrgTemplateEditorPage'
import { SurveyDetailPage } from './pages/SurveyDetailPage'
import { SurveyRespondPage } from './pages/SurveyRespondPage'
import { SurveyAnalysePage } from '../modules/survey/SurveyAnalysePage'

/**
 * Providers that depend on react-router (e.g. useOrgSetup → useLocation) must live *inside*
 * the router tree — not wrapping RouterProvider — or the app crashes with a blank screen.
 */

function WorkflowEditorRoute() {
  const { ruleId } = useParams<{ ruleId: string }>()
  if (!ruleId) return null
  return <WorkflowEditorV2 ruleId={ruleId} />
}

/**
 * Legacy module admin URL redirector. The seven per-module admin pages
 * were merged into the unified hub at `/admin/settings/<scope>/<section>`
 * (see consolidate-admin-settings refactor). This component translates
 * the legacy URL into the new path, mapping both the `:tab` path segment
 * and the `?tab=` query param to the new `:section` segment so external
 * bookmarks and Intercom deep links keep working.
 */
function LegacyAdminRedirect({ scope }: { scope: string }) {
  const { tab: pathTab } = useParams<{ tab?: string }>()
  const { search, hash } = useLocation()
  const params = new URLSearchParams(search)
  const queryTab = params.get('tab')
  const tab = pathTab ?? queryTab ?? undefined
  if (queryTab) params.delete('tab')
  const remaining = params.toString()
  const base = `/admin/settings/${scope}${tab ? `/${tab}` : ''}`
  const target = `${base}${remaining ? `?${remaining}` : ''}${hash}`
  return <Navigate to={target} replace />
}

/**
 * Learning's legacy `/learning/innstillinger?tab=…` URL preserves the
 * query string verbatim — the existing `LearningSettings` component
 * (registered as a single section under the `learning` scope) reads
 * `?tab=` itself, so we hand it through untouched.
 */
function LegacyLearningRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={`/admin/settings/learning${search}${hash}`} replace />
}

function AppRouterLayout() {
  return (
    <OrgSetupProvider>
      <UiThemeProvider>
        <I18nProvider>
          <Outlet />
        </I18nProvider>
      </UiThemeProvider>
    </OrgSetupProvider>
  )
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppRouterLayout />}>
            <Route path="/hrm" element={<Navigate to="/hrm/employees" replace />} />
            <Route path="/hrm/employees" element={<HrmEmployees />} />
            <Route path="/hrm/salary" element={<HrmSalary />} />
            <Route path="/404" element={<NotFound />} />

            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/varsle/status" element={<WhistleStatusPage />} />
            <Route path="/varsle/:slug" element={<PublicWhistlePage />} />
            <Route path="/anonym-aml/:slug" element={<PublicAnonymousAmlPage />} />
            <Route path="/survey-respond/:campaignId" element={<SurveyRespondPage />} />
            <Route path="/r/:token" element={<SharedReportPage />} />
            {/* Public marketing / landing page — root "/" for all visitors */}
            <Route index element={<LandingPage />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />

            <Route element={<OrgGate />}>
              <Route path="platform-admin" element={<PlatformAdminLayout />}>
                <Route index element={<PlatformAdminDashboardPage />} />
                <Route path="roadmap" element={<PlatformRoadmapPage />} />
                <Route path="layout-lab" element={<LayoutLabPage />} />
                <Route path="ui-advanced" element={<PlatformUiAdvancedPage />} />
                <Route path="box-designer" element={<PlatformBoxDesignerPage />} />
                <Route path="layout-builder" element={<PlatformLayoutCompositionPage />} />
                <Route path="layout-reference" element={<PlatformPinpointLayoutsPage />} />
                <Route path="layout-templates" element={<PlatformLayoutTemplatesPage />} />
                <Route path="module-templates" element={<PlatformModuleTemplatesPage />} />
                <Route path="layout" element={<PlatformLayoutHubPage />} />
                <Route path="layout-elements" element={<PlatformLayoutElementsGalleryPage />} />
                <Route path="layout-composer" element={<Navigate to="/platform-admin/layout#composer" replace />} />
                <Route path="layout-standard" element={<Navigate to="/platform-admin/layout#standard" replace />} />
                <Route path="layout-dashboard" element={<Navigate to="/platform-admin/layout#dashboard" replace />} />
                <Route path="layout-split" element={<Navigate to="/platform-admin/layout#split" replace />} />
                <Route path="*" element={<Navigate to="/platform-admin" replace />} />
              </Route>
              <Route path="onboarding" element={<OnboardingWizard />} />
              <Route element={<PermissionGate />}>
                <Route element={<DocumentsLayout />}>
                  <Route
                    element={
                      <RegulationFilterProvider>
                        <Outlet />
                      </RegulationFilterProvider>
                    }
                  >
                  <Route element={<AticsShell />}>
                    <Route
                      element={
                        <WorkplacePublishedComposerProvider>
                          <ModuleLegalFrameworkProvider>
                            <WorkplaceChrome />
                          </ModuleLegalFrameworkProvider>
                        </WorkplacePublishedComposerProvider>
                      }
                    >
                      <Route path="app" element={<WelcomeDashboardPage />} />
                      <Route path="dashboard/classic" element={<ProjectDashboard />} />
                      <Route path="tasks" element={<Navigate to="/tasks/management" replace />} />
                      <Route path="tasks/management" element={<TasksManagementPage />} />
                      <Route path="tasks/management/analyse" element={<TasksAnalysePage />} />
                      <Route path="tasks/management/alle" element={<TasksAllePage />} />
                      <Route path="tasks/management/admin" element={<LegacyAdminRedirect scope="tasks" />} />
                      <Route path="tasks/management/admin/:tab" element={<LegacyAdminRedirect scope="tasks" />} />
                      <Route path="tasks/management/review" element={<TasksManagementReviewPage />} />
                      <Route path="overview/hms" element={<PackProvider><HmsOverviewPage /></PackProvider>} />
                      <Route path="overview/compliance-selskap" element={<ComplianceCompanyPage />} />
                      <Route path="overview/compliance-min" element={<CompliancePersonalPage />} />
                      <Route path="overview/regelverk" element={<RegelverkCoverageDashboardPage />} />
                      <Route path="compliance-studio" element={<ComplianceStudioPage />} />
                      <Route path="workspace/revisjonslogg" element={<WorkspaceAuditLogPage />} />
                      <Route path="organisation" element={<OrganisationPage />} />
                      <Route path="organisation/admin" element={<AdminPage />} />
                      <Route path="reports" element={<ReportsListPage />} />
                      <Route path="reports/new" element={<Navigate to="/reports" replace />} />
                      <Route path="reports/:id" element={<ReportDetailPage />} />
                      <Route path="workplace-reporting" element={<WorkplaceReportingPage />} />
                      <Route path="workplace-reporting/dashboard" element={<WorkplaceDashboardPage />} />
                      <Route path="workplace-reporting/incidents" element={<WorkplaceIncidentsPage />} />
                      <Route path="workplace-reporting/anonymous-aml/settings" element={<WorkplaceAnonymousAmlSettingsPage />} />
                      <Route path="workplace-reporting/anonymous-aml" element={<WorkplaceAnonymousAmlPage />} />
                      <Route path="aarshjul" element={<AarshjulPage />} />
                      <Route path="action-board" element={<ActionBoardPage />} />
                      <Route
                        path="meetings"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise møter">
                            <MeetingsHubPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="meetings/analyse"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise analyse">
                            <MeetingsAnalysePage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route path="meetings/admin" element={<LegacyAdminRedirect scope="meetings" />} />
                      <Route
                        path="meetings/:meetingId/eksport"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise protokoll-pakke">
                            <MeetingsExportPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="meetings/:meetingId"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise møte">
                            <MeetingsDetailView />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route path="members" element={<MembersModule />} />
                      <Route path="org-health" element={<OrgHealthModule />} />
                      <Route path="org-health/settings" element={<OrgHealthSettings />} />
                      <Route path="compliance" element={<ComplianceDashboardPage />} />
                      <Route path="compliance/kanban" element={<ComplianceKanbanPage />} />
                      <Route path="compliance/aml" element={<ComplianceAmlPage />} />
                      <Route path="compliance/arbeidsmiljoloven" element={<ComplianceArbeidsmiljolovenPage />} />
                      <Route path="compliance/internforskriften" element={<ComplianceInternforskriftenPage />} />
                      <Route path="internal-control" element={<InternalControlModule />} />
                      <Route path="internkontroll" element={<IkHubPage />} />
                      <Route path="internkontroll/lovregister" element={<IkLovregisterPage />} />
                      <Route path="internkontroll/kompetanse" element={<IkKompetansePage />} />
                      <Route path="internkontroll/medvirkning" element={<IkMedvirkningPage />} />
                      <Route path="internkontroll/mal" element={<IkMalPage />} />
                      <Route path="internkontroll/tiltaksplan" element={<IkTiltaksplanPage />} />
                      <Route path="internkontroll/arsgjenomgang" element={<IkAnnualReviewPage />} />
                      <Route path="internkontroll/admin" element={<InternalControlAdminPage />} />
                      <Route path="modules/aarskontroll" element={<YearskontrollModule />} />
                      <Route path="hse" element={<HseModule />} />
                      {/* Legacy HSE inspection settings → redirected to the canonical admin at
                          /inspection-module/admin. Old deep-links continue to work. */}
                      <Route
                        path="hse/inspection-settings"
                        element={<Navigate to="/inspection-module/admin" replace />}
                      />
                      {/* Phase 3: inspection module */}
                      <Route path="inspection-module" element={<InspectionModulePage />} />
                      <Route path="inspection-module/admin" element={<InspectionModuleAdminPage />} />
                      {/* Avvik — now a task template in the new tasks module */}
                      <Route path="avvik" element={<Navigate to="/tasks/management?template=avvik" replace />} />
                      <Route path="avvik/legacy" element={<AvvikPage />} />
                      <Route path="inspection-module/:roundId" element={<InspectionRoundDetailPage />} />
                      {/* Compliance Checklist primitive — pack-aware (AML / ISO 45001) */}
                      <Route
                        path="compliance/checklists"
                        element={
                          <PackProvider>
                            <ChecklistsPage />
                          </PackProvider>
                        }
                      />
                      <Route path="compliance/checklists/admin" element={<LegacyAdminRedirect scope="compliance" />} />
                      <Route
                        path="compliance/checklists/analyse"
                        element={
                          <PackProvider>
                            <ChecklistsAnalysePage />
                          </PackProvider>
                        }
                      />
                      <Route
                        path="compliance/checklists/alle"
                        element={
                          <PackProvider>
                            <ChecklistsAllePage />
                          </PackProvider>
                        }
                      />
                      <Route
                        path="compliance/checklists/:executionId"
                        element={
                          <PackProvider>
                            <ChecklistExecutionPage />
                          </PackProvider>
                        }
                      />
                      <Route path="vernerunder/admin" element={<VernerunderAdminPage />} />
                      <Route path="vernerunder/:vernerundeId" element={<VernerundeDetailPage />} />
                      <Route path="vernerunder" element={<VernerunderPageRoute />} />
                      <Route path="sja" element={<SjaModulePage />} />
                      <Route path="sja/admin" element={<SjaModuleAdminPage />} />
                      <Route path="sja/:sjaId" element={<SjaDetailPage />} />
                      <Route path="tiltak" element={<ActionPlanPage />} />
                      <Route path="tiltak/admin" element={<ActionPlanAdminPage />} />
                      <Route path="action-plan" element={<ActionPlanPage />} />
                      <Route path="action-plan/admin" element={<ActionPlanAdminPage />} />
                      <Route path="risiko-sikkerhet" element={<RisikoSikkerhetFrontpage />} />
                      <Route path="ros"         element={<RosModulePage />} />
                      <Route path="ros/admin"   element={<RosModuleAdminPage />} />
                      <Route path="ros/:rosId"  element={<RosAnalysisDetailPage />} />
                      <Route path="survey" element={<SurveyModulePage />} />
                      <Route path="survey/admin" element={<LegacyAdminRedirect scope="survey" />} />
                      <Route path="survey/analyse" element={<SurveyAnalysePage />} />
                      <Route path="survey/alle" element={<SurveyAllePage />} />
                      <Route path="survey/leverandorer" element={<SurveyVendorsPage />} />
                      {/* Single route so :templateId is set for `new` (static route left no params → "Mangler mal-ID"). */}
                      <Route path="survey/templates/org/:templateId" element={<SurveyOrgTemplateEditorPage />} />
                      <Route path="survey/:surveyId" element={<SurveyDetailPage />} />
                      {/* Admin: module overview + RBAC */}
                      <Route path="admin/modules" element={<ModuleAdminPage />} />
                      <Route path="admin/templates" element={<AdminTemplatesPage />} />
                      {/* Unified settings hub. Legacy `/<module>/admin` URLs
                          continue to render their existing pages for one
                          release so bookmarks survive; sidebar entries now
                          point at `/admin/settings/<scope>`. */}
                      <Route path="admin/settings" element={<AdminSettingsPage />} />
                      <Route path="admin/settings/:scope" element={<AdminSettingsPage />} />
                      <Route
                        path="admin/settings/:scope/:section"
                        element={<AdminSettingsPage />}
                      />
                      {/* Phase 2: dynamic module route — loaded from `modules` table via registry */}
                      <Route path="modules/:module_slug" element={<ModuleSlugPage />} />
                      <Route path="admin" element={<Navigate to="/organisation/admin" replace />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="learning/play/:courseId" element={<LearningPlayer />} />
                      <Route path="learning/certificates/:certId/print" element={<LearningCertificatePrintPage />} />
                      <Route path="learning/flow" element={<LearningFlowEntry />} />
                      {/* Detail page renders its own ModulePageShell (course title + tabs + status). */}
                      <Route path="learning/courses/:courseId" element={<LearningCourseBuilder />} />
                      <Route path="registers" element={<RegistersHubPage />} />
                      <Route path="registers/analyse" element={<RegistersAnalysePage />} />
                      <Route path="registers/admin" element={<LegacyAdminRedirect scope="registers" />} />
                      <Route path="registers/:typeId" element={<RegisterTypePage />} />
                      <Route path="learning" element={<LearningLayout />}>
                        <Route index element={<LearningDashboard />} />
                        {/* Five canonical tabs */}
                        <Route path="katalog" element={<LearningCoursesList />} />
                        <Route path="deltakere" element={<LearningDeltakerePage />} />
                        <Route path="kompetanse" element={<LearningKompetansePage />} />
                        <Route path="analyse" element={<LearningAnalysePage />} />
                        <Route path="alle" element={<LearningAllePage />} />
                        <Route path="innstillinger" element={<LegacyLearningRedirect />} />
                        {/* Back-compat redirects — old URLs land on the new IA. */}
                        <Route path="courses" element={<Navigate to="/learning/katalog" replace />} />
                        <Route path="participants" element={<Navigate to="/learning/deltakere" replace />} />
                        <Route path="compliance" element={<Navigate to="/learning/deltakere?view=heatmap" replace />} />
                        <Route path="certifications" element={<Navigate to="/learning/kompetanse" replace />} />
                        <Route path="external" element={<Navigate to="/learning/kompetanse?tab=ekstern" replace />} />
                        <Route path="settings" element={<Navigate to="/admin/settings/learning" replace />} />
                        <Route path="paths" element={<Navigate to="/admin/settings/learning?tab=stier" replace />} />
                        <Route path="insights" element={<Navigate to="/learning" replace />} />
                      </Route>
                      <Route path="prosesser" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow" element={<WorkflowPage />} />
                      <Route path="workflow/:ruleId" element={<WorkflowEditorRoute />} />
                      <Route path="workflow/admin" element={<WorkflowModulePage />} />
                      <Route path="hr" element={<HrComplianceHub />} />
                      <Route path="hr/discussion" element={<HrDiscussionPage />} />
                      <Route path="hr/consultation" element={<HrConsultationPage />} />
                      <Route path="hr/o-ros" element={<HrORosPage />} />
                      <Route element={<DocumentsModuleShellLayout />}>
                        <Route path="documents/editor-test" element={<DocumentEditorTestPage />} />
                        <Route
                          path="documents/page/:pageId/reference-edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne redigering">
                              <WikiPageReferenceEditor />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/kandidatdetalj-layout-test" element={<DocumentKandidatdetaljLayoutTestPage />} />
                        <Route path="documents/malbibliotek" element={<DocumentsMalbibliotekPage />} />
                        <Route path="documents" element={<DocumentsHome />} />
                        <Route path="documents/analyse" element={<DocumentsAnalysePage />} />
                        <Route path="documents/alle" element={<DocumentsAllePage />} />
                        <Route path="documents/compliance" element={<ComplianceDashboard />} />
                        <Route
                          path="documents/compliance/inspection-export"
                          element={
                            <RouteErrorBoundary title="Kunne ikke vise tilsynsrapport">
                              <InspectionArbeidstilsynetExportPage />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/admin" element={<LegacyAdminRedirect scope="documents" />} />
                        <Route
                          path="documents/templates/org/:templateId/edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne malredigering">
                              <DocumentsOrgTemplateEditorPage />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/templates" element={<LegacyAdminRedirect scope="documents" />} />
                        <Route path="documents/reviews" element={<DocumentReviewsPage />} />
                        <Route path="documents/moderation" element={<DocumentModerationQueuePage />} />
                        <Route path="documents/privacy" element={<DocumentPrivacyPage />} />
                        <Route
                          path="documents/aarsgjennomgang"
                          element={
                            <RouteErrorBoundary title="Kunne ikke vise årsgjennomgang">
                              <AnnualReviewPage />
                            </RouteErrorBoundary>
                          }
                        />
                      </Route>
                      <Route element={<DocumentsWikiOutlet />}>
                        <Route path="documents/space/:spaceId" element={<WikiSpaceView />} />
                        <Route
                          path="documents/page/:pageId"
                          element={
                            <RouteErrorBoundary title="Kunne ikke vise dokumentet">
                              <WikiPageView />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/page/:pageId/edit" element={<WikiPageEditRedirect />} />
                      </Route>
                    </Route>
                  </Route>
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/404" replace />} />
    </Route>,
  ),
)

function App() {
  return <RouterProvider router={router} />
}

export default App

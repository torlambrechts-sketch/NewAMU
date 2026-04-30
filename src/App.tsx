import React, { Suspense, lazy } from 'react'
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
} from 'react-router-dom'
import { OrgSetupProvider } from './context/OrgSetupProvider'
import { UiThemeProvider } from './context/UiThemeProvider'
import { I18nProvider } from './context/I18nProvider'
import { AticsShell } from './components/layout/AticsShell'
import { OrgGate } from './components/OrgGate'
import { PermissionGate } from './components/PermissionGate'
import { OnboardingWizard } from './pages/OnboardingWizard'
import { AuthPage } from './pages/AuthPage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { ReportingEnginePage } from './pages/ReportingEnginePage'
import { WorkflowModulePage } from './pages/WorkflowModulePage'
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
import { CouncilModule } from './pages/CouncilModule'
import { AmuPage } from '../modules/amu/AmuPage'
import { AmuHubPage } from './pages/AmuHubPage'
import { AmuModuleAdminPage } from './pages/AmuModuleAdminPage'
import { MembersModule } from './pages/MembersModule'
import { HseModule } from './pages/HseModule'
import { OrgHealthModule } from './pages/OrgHealthModule'
import { OrgHealthSettings } from './pages/OrgHealthSettings'
import { InternalControlModule } from './pages/InternalControlModule'
import { YearskontrollModule } from './pages/YearskontrollModule'
import { ComplianceDashboardPage } from './pages/ComplianceDashboardPage'
import { OrganisationPage } from './pages/OrganisationPage'
import { AarshjulPage } from './pages/aarshjul/AarshjulPage'
import { ActionBoardPage } from './pages/actionboard/ActionBoardPage'
import { WorkplaceChrome } from './components/layout/WorkplaceChrome'
import { ModuleLegalFrameworkProvider } from './components/module'
import { WorkplacePublishedComposerProvider } from './context/WorkplacePublishedComposerProvider'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { WelcomeDashboardPage } from './pages/WelcomeDashboardPage'
import { TasksPage } from './pages/TasksPage'
import { WorkspaceAuditLogPage } from './pages/WorkspaceAuditLogPage'
const LearningLayout = lazy(() => import('./components/learning/LearningLayout').then((m) => ({ default: m.LearningLayout })))
const LearningDashboard = lazy(() => import('./pages/learning/LearningDashboard').then((m) => ({ default: m.LearningDashboard })))
const LearningCoursesList = lazy(() =>
  import('./pages/learning/LearningCoursesList').then((m) => ({ default: m.LearningCoursesList })),
)
const LearningCourseBuilder = lazy(() =>
  import('./pages/learning/LearningCourseBuilder').then((m) => ({ default: m.LearningCourseBuilder })),
)
const LearningPlayer = lazy(() => import('./pages/learning/LearningPlayer').then((m) => ({ default: m.LearningPlayer })))
const LearningCertifications = lazy(() =>
  import('./pages/learning/LearningCertifications').then((m) => ({ default: m.LearningCertifications })),
)
const LearningInsights = lazy(() => import('./pages/learning/LearningInsights').then((m) => ({ default: m.LearningInsights })))
const LearningParticipants = lazy(() =>
  import('./pages/learning/LearningParticipants').then((m) => ({ default: m.LearningParticipants })),
)
const LearningSettings = lazy(() => import('./pages/learning/LearningSettings').then((m) => ({ default: m.LearningSettings })))
const LearningFlowEntry = lazy(() =>
  import('./pages/learning/LearningFlowEntry').then((m) => ({ default: m.LearningFlowEntry })),
)
const LearningComplianceMatrix = lazy(() =>
  import('./pages/learning/LearningComplianceMatrix').then((m) => ({ default: m.LearningComplianceMatrix })),
)
const LearningPathsPage = lazy(() =>
  import('./pages/learning/LearningPathsPage').then((m) => ({ default: m.LearningPathsPage })),
)
const LearningExternalTraining = lazy(() =>
  import('./pages/learning/LearningExternalTraining').then((m) => ({ default: m.LearningExternalTraining })),
)
import { DocumentsHome } from './pages/documents/DocumentsHome'
import { DocumentsMalbibliotekPage } from './pages/documents/DocumentsMalbibliotekPage'
import { WikiSpaceView } from './pages/documents/WikiSpaceView'
import { WikiPageView } from './pages/documents/WikiPageView'
import { WikiPageEditRedirect } from './pages/documents/WikiPageEditRedirect'
import { WikiPageEditor } from './pages/documents/WikiPageEditor'
import { ComplianceDashboard } from './pages/documents/ComplianceDashboard'
import { AnnualReviewPage } from './pages/documents/AnnualReviewPage'
import { InspectionArbeidstilsynetExportPage } from './pages/documents/InspectionArbeidstilsynetExportPage'
import { DocumentTemplatesSettings } from './pages/documents/DocumentTemplatesSettings'
import { DocumentReviewsPage } from './pages/documents/DocumentReviewsPage'
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
import { PublicWhistlePage } from './pages/PublicWhistlePage'
import { WhistleStatusPage } from './pages/WhistleStatusPage'
import { LandingPage } from './pages/LandingPage'
import { ModuleSlugPage } from './pages/ModuleSlugPage'
import { InspectionModulePage } from './pages/InspectionModulePage'
import { InspectionModuleAdminPage } from './pages/InspectionModuleAdminPage'
import { InspectionRoundDetailPage } from './pages/InspectionRoundDetailPage'
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
import { AmuElectionHubPage } from './pages/AmuElectionHubPage'
import { AmuElectionDetailPage } from './pages/AmuElectionDetailPage'
import { AmuElectionAdminPage } from './pages/AmuElectionAdminPage'
import { InternalControlAdminPage } from './pages/InternalControlAdminPage'
import { RisikoSikkerhetFrontpage } from './pages/RisikoSikkerhetFrontpage'
import { RosModulePage }         from './pages/RosModulePage'
import { RosModuleAdminPage }    from './pages/RosModuleAdminPage'
import { RosAnalysisDetailPage } from './pages/RosAnalysisDetailPage'
import { SurveyModulePage } from './pages/SurveyModulePage'
import { SurveyModuleAdminPage } from './pages/SurveyModuleAdminPage'
import { SurveyOrgTemplateEditorPage } from './pages/SurveyOrgTemplateEditorPage'
import { SurveyDetailPage } from './pages/SurveyDetailPage'
import { SurveyRespondPage } from './pages/SurveyRespondPage'

/**
 * Providers that depend on react-router (e.g. useOrgSetup → useLocation) must live *inside*
 * the router tree — not wrapping RouterProvider — or the app crashes with a blank screen.
 */
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
                <Route path="layout-composer" element={<Navigate to="/platform-admin/layout#composer" replace />} />
                <Route path="layout-standard" element={<Navigate to="/platform-admin/layout#standard" replace />} />
                <Route path="layout-dashboard" element={<Navigate to="/platform-admin/layout#dashboard" replace />} />
                <Route path="layout-split" element={<Navigate to="/platform-admin/layout#split" replace />} />
                <Route path="*" element={<Navigate to="/platform-admin" replace />} />
              </Route>
              <Route path="onboarding" element={<OnboardingWizard />} />
              <Route element={<PermissionGate />}>
                <Route element={<DocumentsLayout />}>
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
                      <Route path="tasks" element={<TasksPage />} />
                      <Route path="workspace/revisjonslogg" element={<WorkspaceAuditLogPage />} />
                      <Route path="organisation" element={<OrganisationPage />} />
                      <Route path="organisation/admin" element={<AdminPage />} />
                      <Route path="reports" element={<ReportingEnginePage />} />
                      <Route path="workplace-reporting" element={<WorkplaceReportingPage />} />
                      <Route path="workplace-reporting/dashboard" element={<WorkplaceDashboardPage />} />
                      <Route path="workplace-reporting/incidents" element={<WorkplaceIncidentsPage />} />
                      <Route path="workplace-reporting/anonymous-aml/settings" element={<WorkplaceAnonymousAmlSettingsPage />} />
                      <Route path="workplace-reporting/anonymous-aml" element={<WorkplaceAnonymousAmlPage />} />
                      <Route path="aarshjul" element={<AarshjulPage />} />
                      <Route path="action-board" element={<ActionBoardPage />} />
                      <Route path="council" element={<CouncilModule />} />
                      <Route path="council/amu" element={<AmuHubPage />} />
                      <Route path="council/amu/admin" element={<AmuModuleAdminPage />} />
                      <Route path="council/amu/:meetingId" element={<AmuPage />} />
                      <Route path="members" element={<MembersModule />} />
                      <Route path="org-health" element={<OrgHealthModule />} />
                      <Route path="org-health/settings" element={<OrgHealthSettings />} />
                      <Route path="compliance" element={<ComplianceDashboardPage />} />
                      <Route path="internal-control" element={<InternalControlModule />} />
                      <Route path="internkontroll" element={<IkHubPage />} />
                      <Route path="internkontroll/lovregister" element={<IkLovregisterPage />} />
                      <Route path="internkontroll/kompetanse" element={<IkKompetansePage />} />
                      <Route path="internkontroll/medvirkning" element={<IkMedvirkningPage />} />
                      <Route path="internkontroll/mal" element={<IkMalPage />} />
                      <Route path="internkontroll/tiltaksplan" element={<IkTiltaksplanPage />} />
                      <Route path="internkontroll/arsgjenomgang" element={<IkAnnualReviewPage />} />
                      <Route path="internkontroll/amu-valg" element={<AmuElectionHubPage />} />
                      <Route path="internkontroll/amu-valg/admin" element={<AmuElectionAdminPage />} />
                      <Route path="internkontroll/amu-valg/:electionId" element={<AmuElectionDetailPage />} />
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
                      {/* Avvik / funn — dedicated deviation management */}
                      <Route path="avvik" element={<AvvikPage />} />
                      <Route path="inspection-module/:roundId" element={<InspectionRoundDetailPage />} />
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
                      <Route path="survey/admin" element={<SurveyModuleAdminPage />} />
                      {/* Single route so :templateId is set for `new` (static route left no params → "Mangler mal-ID"). */}
                      <Route path="survey/templates/org/:templateId" element={<SurveyOrgTemplateEditorPage />} />
                      <Route path="survey/:surveyId" element={<SurveyDetailPage />} />
                      {/* Admin: module overview + RBAC */}
                      <Route path="admin/modules" element={<ModuleAdminPage />} />
                      {/* Phase 2: dynamic module route — loaded from `modules` table via registry */}
                      <Route path="modules/:module_slug" element={<ModuleSlugPage />} />
                      <Route path="admin" element={<Navigate to="/organisation/admin" replace />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route
                        path="learning/play/:courseId"
                        element={
                          <Suspense
                            fallback={
                              <div className="flex min-h-[40vh] items-center justify-center text-neutral-400">
                                Laster…
                              </div>
                            }
                          >
                            <LearningPlayer />
                          </Suspense>
                        }
                      />
                      <Route
                        path="learning/flow"
                        element={
                          <Suspense
                            fallback={
                              <div className="flex min-h-[40vh] items-center justify-center text-neutral-400">
                                Laster…
                              </div>
                            }
                          >
                            <LearningFlowEntry />
                          </Suspense>
                        }
                      />
                      <Route
                        path="learning"
                        element={
                          <Suspense
                            fallback={
                              <div className="flex min-h-[40vh] items-center justify-center text-neutral-400">
                                Laster…
                              </div>
                            }
                          >
                            <LearningLayout />
                          </Suspense>
                        }
                      >
                        <Route index element={<LearningDashboard />} />
                        <Route path="courses" element={<LearningCoursesList />} />
                        <Route path="courses/:courseId" element={<LearningCourseBuilder />} />
                        <Route path="certifications" element={<LearningCertifications />} />
                        <Route path="insights" element={<LearningInsights />} />
                        <Route path="participants" element={<LearningParticipants />} />
                        <Route path="compliance" element={<LearningComplianceMatrix />} />
                        <Route path="paths" element={<LearningPathsPage />} />
                        <Route path="external" element={<LearningExternalTraining />} />
                        <Route path="settings" element={<LearningSettings />} />
                      </Route>
                      <Route path="prosesser" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow" element={<WorkflowModulePage />} />
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
                        <Route path="documents/compliance" element={<ComplianceDashboard />} />
                        <Route
                          path="documents/compliance/inspection-export"
                          element={
                            <RouteErrorBoundary title="Kunne ikke vise tilsynsrapport">
                              <InspectionArbeidstilsynetExportPage />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/admin" element={<Navigate to="/documents/templates" replace />} />
                        <Route
                          path="documents/templates/org/:templateId/edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne malredigering">
                              <DocumentsOrgTemplateEditorPage />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route path="documents/templates" element={<DocumentTemplatesSettings />} />
                        <Route path="documents/reviews" element={<DocumentReviewsPage />} />
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
                        <Route
                          path="documents/page/:pageId/wiki-edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne redigering">
                              <WikiPageEditor />
                            </RouteErrorBoundary>
                          }
                        />
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

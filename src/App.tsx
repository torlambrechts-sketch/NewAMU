import { lazy } from 'react'
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
import { MarketingShell } from './pages/marketing/shell/MarketingShell'

const FeaturePage = lazy(() => import('./pages/marketing/FeaturePage').then((m) => ({ default: m.FeaturePage })))
const CompliancePage = lazy(() => import('./pages/marketing/CompliancePage').then((m) => ({ default: m.CompliancePage })))
const IntegrationsPage = lazy(() => import('./pages/marketing/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })))
const AboutPage = lazy(() => import('./pages/marketing/AboutPage').then((m) => ({ default: m.AboutPage })))
const EndringerPage = lazy(() => import('./pages/marketing/EndringerPage').then((m) => ({ default: m.EndringerPage })))
const ContactPage = lazy(() => import('./pages/marketing/ContactPage').then((m) => ({ default: m.ContactPage })))
import { OrgSetupProvider } from './context/OrgSetupProvider'
import { UiThemeProvider } from './context/UiThemeProvider'
import { LocaleSync } from './components/LocaleSync'
import { AticsShell } from './components/layout/AticsShell'
import { RegulationFilterProvider } from './context/RegulationFilterContext'
import { OrgGate } from './components/OrgGate'
import { PermissionGate } from './components/PermissionGate'
import { OnboardingWizard } from './pages/OnboardingWizard'
import { AuthPage } from './pages/AuthPage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { ProfilePage } from './pages/ProfilePage'
import { SharedReportPage } from './pages/public/SharedReportPage'
import { WorkflowBuilderPage } from './pages/workflow/WorkflowBuilderPage'
import { AuditorWorkflowsPage } from './pages/auditor/AuditorWorkflowsPage'
import { GovIntegrationsPage } from './pages/admin/integrations/GovIntegrationsPage'
import { GovOutboxPage } from './pages/admin/GovOutboxPage'
import { AlertDedupGroupsPage } from './pages/admin/AlertDedupGroupsPage'
import { AltinnSetup } from './pages/admin/integrations/AltinnSetup'
import { ArbeidstilsynetSetup } from './pages/admin/integrations/ArbeidstilsynetSetup'
import { DatatilsynetSetup } from './pages/admin/integrations/DatatilsynetSetup'
import { NavSetup } from './pages/admin/integrations/NavSetup'
import { HelsetilsynetSetup } from './pages/admin/integrations/HelsetilsynetSetup'
import { CertRotationPage } from './pages/admin/integrations/CertRotationPage'
import { NotFound } from './pages/NotFound'
import { MeetingsHubPage } from './pages/meetings/MeetingsHubPage'
import { MeetingsDetailView } from './pages/meetings/MeetingsDetailView'
import { MeetingsAnalysePage } from './pages/meetings/MeetingsAnalysePage'
import { MeetingsExportPage } from './pages/meetings/MeetingsExportPage'
import MeetingLivePage from './pages/meetings/MeetingLivePage'
import MeetingExternalViewerPage from './pages/meetings/MeetingExternalViewerPage'
import { AMUAgendaBacklogPage } from './pages/meetings/AMUAgendaBacklogPage'
import { AlertsPage } from '../modules/alerts/pages/AlertsPage'
import { AlertsAdminPage } from '../modules/alerts/pages/AlertsAdminPage'
import { AlertsAnalysePage } from '../modules/alerts/pages/AlertsAnalysePage'
import { AlertsAllePage } from '../modules/alerts/pages/AlertsAllePage'
import { AlertsDetailView } from '../modules/alerts/pages/AlertsDetailView'
import { PublicAlertSubmitPage } from '../modules/alerts/pages/PublicAlertSubmitPage'
import { PublicAlertStatusPage } from '../modules/alerts/pages/PublicAlertStatusPage'

// Legacy /varsle/:slug and /anonym-aml/:slug redirect to /alerts/public/:slug.
// Kept permanently (printed materials in worker break rooms point here).
function LegacyVarsleRedirect() {
  const params = new URLSearchParams(window.location.search)
  const slug = window.location.pathname.split('/').pop() ?? ''
  return <Navigate to={`/alerts/public/${encodeURIComponent(slug)}${params.toString() ? `?${params.toString()}` : ''}`} replace />
}
import { AdminTemplatesPage } from './pages/admin/AdminTemplatesPage'
import { AdminPage as KlarertAdminPage } from './pages/admin/klarert/AdminPage'
import { TilsynsbrevPage } from './pages/admin/TilsynsbrevPage'
import { TilsynsbrevDetailPage } from './pages/admin/TilsynsbrevDetailPage'
import { OrganisationPage } from './pages/OrganisationPage'
import { WorkplaceChrome } from './components/layout/WorkplaceChrome'
import { ModuleLegalFrameworkProvider } from './components/module'
import { WorkplacePublishedComposerProvider } from './context/WorkplacePublishedComposerProvider'
import { WelcomeDashboardPage } from './pages/WelcomeDashboardPage'
import { TasksManagementPage, TasksAnalysePage } from '../modules/tasks'
import { TasksAllePage } from '../modules/tasks/TasksAllePage'
import { RiskAnalysePage, RiskRegisterPage } from '../modules/risk'
import { TasksManagementReviewPage } from '../modules/tasks/TasksManagementReviewPage'
import { ChecklistsAllePage } from '../modules/compliance/ChecklistsAllePage'
import { SurveyAllePage } from '../modules/survey/SurveyAllePage'
import { DocumentsAllePage } from './pages/documents/DocumentsAllePage'
import { LearningAllePage } from './pages/learning/LearningAllePage'
import { LearningLayout } from './components/learning/LearningLayout'
import { LearningDashboard } from './pages/learning/LearningDashboard'
import { LearningHubPage } from './pages/learning/LearningHubPage'
import { LearningCourseDetailPage } from './pages/learning/LearningCourseDetailPage'
import { LearningCoursesList } from './pages/learning/LearningCoursesList'
import { LearningCourseBuilder } from './pages/learning/LearningCourseBuilder'
import { LearningCourseBuilderV2 } from './pages/learning/LearningCourseBuilderV2'
import { RegistersHubPage } from './pages/registers/RegistersHubPage'
import { RegistersAnalysePage } from './pages/registers/RegistersAnalysePage'
import { RegisterTypePage } from './pages/registers/RegisterTypePage'
import { RegisterEntryPage } from './pages/registers/RegisterEntryPage'
import { LearningPlayer } from './pages/learning/LearningPlayer'
import { LearningPlayerV2 } from './pages/learning/LearningPlayerV2'
import { LearningDeltakerePage } from './pages/learning/LearningDeltakerePage'
import { LearningKompetansePage } from './pages/learning/LearningKompetansePage'
import { LearningAnalysePage } from './pages/learning/LearningAnalysePage'
import { HmsOverviewPage } from './pages/overview/HmsOverviewPage'
import { MyFavoritesPage } from './pages/favorites/MyFavoritesPage'
import { FavoritesProvider } from './components/favorites/FavoritesProvider'
import { IsoImsAnalysePage } from './pages/iso/IsoImsAnalysePage'
import { IsoSettingsPage } from './pages/iso/IsoSettingsPage'
import { IsoGapAnalysisHubPage } from './pages/iso/IsoGapAnalysisHubPage'
import { IsoGapAnalysisSessionPage } from './pages/iso/IsoGapAnalysisSessionPage'
import { IsoSoAPage } from './pages/iso/IsoSoAPage'
import { RegelverkCoveragePage } from './pages/overview/regelverk/RegelverkCoveragePage'
import { InternkontrollDashboardPage } from './pages/overview/internkontroll/InternkontrollDashboardPage'
import { InternkontrollGapPage } from './pages/overview/internkontroll/InternkontrollGapPage'
import { InternkontrollPlanPage } from './pages/overview/internkontroll/InternkontrollPlanPage'
import { InternkontrollAuditorPage } from './pages/auditor/InternkontrollAuditorPage'
import { ControlsAuditorPage } from './pages/auditor/ControlsAuditorPage'
import { BenchmarkPage } from './pages/dashboards/BenchmarkPage'
import { ComplianceStudioPage } from './pages/overview/studio/ComplianceStudioPage'
import { LearningFlowEntry } from './pages/learning/LearningFlowEntry'
import { LearningCertificatePrintPage } from './pages/learning/LearningCertificatePrintPage'
import { LearningMinHistorikkPage } from './pages/learning/LearningMinHistorikkPage'
import { DocumentsHome } from './pages/documents/DocumentsHome'
import { DocumentsAnalysePage } from './pages/documents/DocumentsAnalysePage'
import { DocumentsSokPage } from './pages/documents/DocumentsSokPage'
import { DocumentsMalbibliotekPage } from './pages/documents/DocumentsMalbibliotekPage'
import { WikiSpaceView } from './pages/documents/WikiSpaceView'
import { WikiPageView } from './pages/documents/WikiPageView'
import { ComplianceDashboard } from './pages/documents/ComplianceDashboard'
import { AnnualReviewPage } from './pages/documents/AnnualReviewPage'

import { DocumentReviewsPage } from './pages/documents/DocumentReviewsPage'
import { DocumentModerationQueuePage } from './pages/documents/DocumentModerationQueuePage'
import { DocumentPrivacyPage } from './pages/documents/DocumentPrivacyPage'
import { DocumentEditorTestPage } from './pages/documents/DocumentEditorTestPage'
import { DocumentKandidatdetaljLayoutTestPage } from './pages/documents/DocumentKandidatdetaljLayoutTestPage'
import { WikiPageReferenceEditor } from './pages/documents/WikiPageReferenceEditor'
import { DocumentEditPage } from './pages/documents/DocumentEditPage'
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
import { PlatformCoursePlayerHubPage } from './pages/platform/coursePlayer/PlatformCoursePlayerHubPage'
import { PlatformCoursePlayerFocusPage } from './pages/platform/coursePlayer/PlatformCoursePlayerFocusPage'
import { PlatformCoursePlayerCinemaPage } from './pages/platform/coursePlayer/PlatformCoursePlayerCinemaPage'
import { PlatformCoursePlayerCoachPage } from './pages/platform/coursePlayer/PlatformCoursePlayerCoachPage'
import { PlatformCoursePlayerKlasseromPage } from './pages/platform/coursePlayer/PlatformCoursePlayerKlasseromPage'
import { PlatformCoursePlayerHjemPage } from './pages/platform/coursePlayer/PlatformCoursePlayerHjemPage'
import { LandingPage } from './pages/LandingPage'
import { ChecklistsPage } from '../modules/compliance/ChecklistsPage'
import { ChecklistsAnalysePage } from '../modules/compliance/ChecklistsAnalysePage'
import { ChecklistsEtterlevelsePage } from '../modules/compliance/ChecklistsEtterlevelsePage'
import { ChecklistExecutionPage } from '../modules/compliance/ChecklistExecutionPage'
import {
  ControlsHubLanding,
  ControlsListPage,
  ControlDetailPage,
  ComplianceLayerAnalysePage,
  KontrollerInnstillingerPage,
} from '../modules/compliance-layer'
import { PackProvider } from './context/PackContext'
import { ModuleAdminPage } from './pages/ModuleAdminPage'
import { SurveyModulePage } from './pages/SurveyModulePage'
import { SurveyVendorsPage } from './pages/SurveyVendorsPage'
import { SurveyOrgTemplateEditorPage } from './pages/SurveyOrgTemplateEditorPage'
import { SurveyDetailPage } from './pages/SurveyDetailPage'
import { SurveyRespondPage } from './pages/SurveyRespondPage'
import { SurveyAnalysePage } from '../modules/survey/SurveyAnalysePage'
import { PartnerConsolePage } from './pages/partner/PartnerConsolePage'
import { PartnerBrandingPage } from './pages/partner/PartnerBrandingPage'

/**
 * Providers that depend on react-router (e.g. useOrgSetup → useLocation) must live *inside*
 * the router tree — not wrapping RouterProvider — or the app crashes with a blank screen.
 */

function WorkflowEditorRoute() {
  const { ruleId } = useParams<{ ruleId: string }>()
  if (!ruleId) return <Navigate to="/workflow" replace />
  return <Navigate to={`/workflow?tab=canvas&rule=${encodeURIComponent(ruleId)}`} replace />
}

/**
 * Legacy module admin URL redirector. The per-module admin pages and
 * the old scope-based settings hub have been replaced by the Klarert
 * Admin shell (`/admin/settings/<section>` where section ∈ org / users
 * / roles / packs / workflows / integrations / audit). This component
 * maps the old scope identifiers onto the new sections so external
 * bookmarks and Intercom deep links keep resolving.
 */
const LEGACY_SCOPE_TO_SECTION: Record<string, string> = {
  compliance: 'packs',
  survey: 'packs',
  tasks: 'packs',
  learning: 'packs',
  documents: 'packs',
  meetings: 'packs',
  registers: 'packs',
  'users-roles': 'users',
  integrations: 'integrations',
  organisation: 'org',
  settings: 'org',
  workflows: 'workflows',
}

function LegacyAdminRedirect({ scope }: { scope: string }) {
  const { tab: pathTab } = useParams<{ tab?: string }>()
  const { search, hash } = useLocation()
  const params = new URLSearchParams(search)
  const queryTab = params.get('tab')
  if (queryTab) params.delete('tab')
  void pathTab // ignored — old per-module tabs have no analogue in the new shell
  const remaining = params.toString()
  const section = LEGACY_SCOPE_TO_SECTION[scope] ?? 'org'
  const target = `/admin/settings/${section}${remaining ? `?${remaining}` : ''}${hash}`
  return <Navigate to={target} replace />
}

/**
 * Translates the legacy `/organisation/admin?tab=…` URLs into the new
 * sections. `users / roles / delegation / functional_roles /
 * role_compliance` all live in Brukere or Roller now; integrations and
 * gdpr-related tabs map to the relevant sections.
 */
const ORG_ADMIN_TAB_REDIRECTS: Record<string, string> = {
  users: '/admin/settings/users',
  roles: '/admin/settings/roles',
  delegation: '/admin/settings/roles',
  functional_roles: '/admin/settings/roles',
  role_compliance: '/admin/settings/roles',
  integrations: '/admin/settings/integrations',
  gdpr_breach: '/admin/settings/audit',
  gdpr_subject_requests: '/admin/settings/audit',
}

function LegacyOrgAdminRedirect() {
  const { search, hash } = useLocation()
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  const mapped = tab ? ORG_ADMIN_TAB_REDIRECTS[tab] : undefined
  const target = mapped ?? '/admin/settings/users'
  const [base, query] = target.split('?')
  const merged = new URLSearchParams(query ?? '')
  params.delete('tab')
  for (const [k, v] of params) merged.set(k, v)
  const merged_str = merged.toString()
  return <Navigate to={`${base}${merged_str ? `?${merged_str}` : ''}${hash}`} replace />
}

/**
 * Redirects the old `/admin/settings/org/<section>` URLs into the new
 * Klarert Admin sections.
 */
const LEGACY_ORG_SECTION_REDIRECTS: Record<string, string> = {
  'functional-roles': '/admin/settings/roles',
  'gdpr-breach': '/admin/settings/audit',
  'gdpr-subject-requests': '/admin/settings/audit',
  integrations: '/admin/settings/integrations',
}

function LegacyOrgScopeRedirect() {
  const { section } = useParams<{ section?: string }>()
  const { search, hash } = useLocation()
  const mapped = section ? LEGACY_ORG_SECTION_REDIRECTS[section] : undefined
  const target = mapped ?? '/admin/settings/users'
  const [base, query] = target.split('?')
  const merged = new URLSearchParams(query ?? '')
  const incoming = new URLSearchParams(search)
  for (const [k, v] of incoming) merged.set(k, v)
  const merged_str = merged.toString()
  return <Navigate to={`${base}${merged_str ? `?${merged_str}` : ''}${hash}`} replace />
}

/**
 * Learning's legacy `/learning/innstillinger?tab=…` URL nå mapper til
 * Mal-pakker-seksjonen i den nye Klarert Admin-shellen.
 */
function LegacyLearningRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={`/admin/settings/packs${search}${hash}`} replace />
}

function AppRouterLayout() {
  return (
    <OrgSetupProvider>
      <UiThemeProvider>
        <LocaleSync />
        <Outlet />
      </UiThemeProvider>
    </OrgSetupProvider>
  )
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppRouterLayout />}>
            <Route path="/404" element={<NotFound />} />

            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/platform-admin/login" element={<PlatformAdminLoginPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            {/* Varslinger — anonymous submission + status check */}
            <Route path="/alerts/public/status" element={<PublicAlertStatusPage />} />
            <Route path="/alerts/public/:slug" element={<PublicAlertSubmitPage />} />
            {/* Meetings — external invitee token-gated viewer (§8.33) */}
            <Route path="/meetings/external/:token" element={<MeetingExternalViewerPage />} />
            {/* Legacy /varsle aliases — permanent redirect per OQ-A2 */}
            <Route path="/varsle/status" element={<Navigate to="/alerts/public/status" replace />} />
            <Route path="/varsle/:slug" element={<LegacyVarsleRedirect />} />
            <Route path="/anonym-aml/:slug" element={<LegacyVarsleRedirect />} />
            <Route path="/auditor/workflows" element={<AuditorWorkflowsPage />} />
            <Route path="/survey-respond/:campaignId" element={<SurveyRespondPage />} />
            <Route path="/auditor/internkontroll/:token" element={<InternkontrollAuditorPage />} />
            <Route path="/auditor/controls/:token" element={<ControlsAuditorPage />} />
            <Route path="/r/:token" element={<SharedReportPage />} />
            {/* Public marketing — landing + per-module feature pages + etterlevelse + integrations + about + endringer + demo. */}
            <Route element={<MarketingShell />}>
              <Route index element={<LandingPage />} />
              <Route path="/features/:slug" element={<FeaturePage />} />
              <Route path="/etterlevelse" element={<CompliancePage />} />
              <Route path="/integrasjoner" element={<IntegrationsPage />} />
              <Route path="/om-oss" element={<AboutPage />} />
              <Route path="/endringer" element={<EndringerPage />} />
              <Route path="/demo" element={<ContactPage />} />
              <Route path="/kontakt" element={<ContactPage />} />
            </Route>
            {/* Legacy /compliance — redirect to /etterlevelse (kept for printed and external links). */}
            <Route path="/compliance" element={<Navigate to="/etterlevelse" replace />} />
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
                <Route path="course-player" element={<PlatformCoursePlayerHubPage />} />
                <Route path="course-player/focus" element={<PlatformCoursePlayerFocusPage />} />
                <Route path="course-player/cinema" element={<PlatformCoursePlayerCinemaPage />} />
                <Route path="course-player/coach" element={<PlatformCoursePlayerCoachPage />} />
                <Route path="course-player/klasserom" element={<PlatformCoursePlayerKlasseromPage />} />
                <Route path="course-player/hjem" element={<PlatformCoursePlayerHjemPage />} />
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
                            <FavoritesProvider>
                              <WorkplaceChrome />
                            </FavoritesProvider>
                          </ModuleLegalFrameworkProvider>
                        </WorkplacePublishedComposerProvider>
                      }
                    >
                      <Route path="app" element={<WelcomeDashboardPage />} />
                      <Route path="tasks" element={<Navigate to="/tasks/management" replace />} />
                      <Route path="tasks/management" element={<TasksManagementPage />} />
                      <Route path="tasks/management/analyse" element={<TasksAnalysePage />} />
                      <Route path="tasks/management/alle" element={<TasksAllePage />} />
                      <Route path="tasks/management/admin" element={<LegacyAdminRedirect scope="tasks" />} />
                      <Route path="tasks/management/admin/:tab" element={<LegacyAdminRedirect scope="tasks" />} />
                      <Route path="tasks/management/review" element={<TasksManagementReviewPage />} />
                      <Route path="overview/hms" element={<PackProvider><HmsOverviewPage /></PackProvider>} />
                      <Route path="favoritter" element={<MyFavoritesPage />} />
                      <Route path="iso/analyse" element={<IsoImsAnalysePage />} />
                      <Route path="iso/innstillinger" element={<IsoSettingsPage />} />
                      <Route path="iso/gap" element={<IsoGapAnalysisHubPage />} />
                      <Route path="iso/gap/:sessionId" element={<IsoGapAnalysisSessionPage />} />
                      <Route path="iso/soa" element={<IsoSoAPage />} />
                      {/* Partner-konsoll — HMS-konsulent multi-org surface (v0). */}
                      <Route path="partner" element={<PartnerConsolePage />} />
                      <Route path="partner/branding" element={<PartnerBrandingPage />} />
                      <Route path="partner/invoice/:id" element={<PartnerConsolePage />} />
                      <Route path="overview/regelverk" element={<RegelverkCoveragePage />} />
                      <Route path="overview/internkontroll" element={<InternkontrollDashboardPage />} />
                      <Route path="overview/internkontroll/gaps" element={<InternkontrollGapPage />} />
                      <Route path="overview/internkontroll/plan" element={<InternkontrollPlanPage />} />
                      <Route path="risk" element={<Navigate to="/risk/analyse" replace />} />
                      <Route path="risk/analyse" element={<RiskAnalysePage />} />
                      <Route path="risk/register" element={<RiskRegisterPage />} />
                      <Route path="benchmarking" element={<BenchmarkPage />} />
                      <Route path="compliance-studio" element={<ComplianceStudioPage />} />
                      <Route path="organisation" element={<OrganisationPage />} />
                      <Route path="organisation/admin" element={<LegacyOrgAdminRedirect />} />
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
                        path="meetings/agenda-backlog"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise agenda-restanser">
                            <AMUAgendaBacklogPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="meetings/:meetingId/eksport"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise protokoll-pakke">
                            <MeetingsExportPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route
                        path="meetings/:id/live"
                        element={
                          <RouteErrorBoundary title="Kunne ikke åpne møterom">
                            <MeetingLivePage />
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
                      <Route path="compliance" element={<Navigate to="/compliance/checklists" replace />} />
                      {/* Avvik — now a task template in the new tasks module */}
                      <Route path="avvik" element={<Navigate to="/tasks/management?template=avvik" replace />} />
                      {/* Varslinger module — AML kap. 2A + GDPR Art. 33 + HMS/sikkerhet/etisk */}
                      <Route
                        path="alerts"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise varslinger">
                            <AlertsPage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route path="alerts/admin" element={<AlertsAdminPage />} />
                      <Route
                        path="alerts/analyse"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise analyse">
                            <AlertsAnalysePage />
                          </RouteErrorBoundary>
                        }
                      />
                      <Route path="alerts/alle" element={<AlertsAllePage />} />
                      <Route
                        path="alerts/:caseId"
                        element={
                          <RouteErrorBoundary title="Kunne ikke vise sak">
                            <AlertsDetailView />
                          </RouteErrorBoundary>
                        }
                      />
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
                        path="compliance/checklists/etterlevelse"
                        element={
                          <PackProvider>
                            <ChecklistsEtterlevelsePage />
                          </PackProvider>
                        }
                      />
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
                      {/* Compliance Layer — Tier 2 internal controls
                          (Rules → Internal Controls → Execution).
                          Top-level NavGroup at /controls; integrates
                          with all module sign events via M5 auto-bind
                          triggers. */}
                      <Route path="controls" element={<ControlsHubLanding />} />
                      <Route path="controls/list" element={<ControlsListPage />} />
                      <Route
                        path="controls/analyse"
                        element={<ComplianceLayerAnalysePage />}
                      />
                      <Route
                        path="controls/admin"
                        element={<KontrollerInnstillingerPage />}
                      />
                      <Route
                        path="controls/:controlId"
                        element={<ControlDetailPage />}
                      />
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
                      {/* Tilsynsbrev — uploaded inspeksjonsbrev fra Arbeidstilsynet,
                          Datatilsynet etc. Parses asynkront via edge-funksjonen
                          tilsynsbrev-parser; detalj-siden lar admin opprette
                          oppgaver per pålegg. */}
                      <Route path="admin/tilsynsbrev" element={<TilsynsbrevPage />} />
                      <Route path="admin/tilsynsbrev/:id" element={<TilsynsbrevDetailPage />} />
                      {/* Klarert Admin — sentralt kontrollpanel som erstatter
                          den gamle registry-baserte settings-siden. Hoster
                          syv seksjoner: Organisasjon, Brukere, Roller,
                          Mal-pakker, Arbeidsflyt, Integrasjoner, Audit-logg.
                          Legacy `/<module>/admin`-URLer rediregrer fortsatt
                          hit slik at gamle bokmerker overlever. */}
                      <Route
                        path="admin/settings"
                        element={
                          <PackProvider>
                            <KlarertAdminPage />
                          </PackProvider>
                        }
                      />
                      <Route
                        path="admin/settings/:scope"
                        element={
                          <PackProvider>
                            <KlarertAdminPage />
                          </PackProvider>
                        }
                      />
                      <Route
                        path="admin/settings/:scope/:section"
                        element={
                          <PackProvider>
                            <KlarertAdminPage />
                          </PackProvider>
                        }
                      />
                      {/* Legacy `/admin/settings/org` URLs from den gamle
                          scope-tree-en — `org` scope eksisterer ikke
                          lenger som en egen rute, men `LegacyOrgScopeRedirect`
                          mapper mest brukte sub-veier inn i den nye shellen. */}
                      <Route path="admin/settings/org/:section" element={<LegacyOrgScopeRedirect />} />
                      {/* Organisasjon-tabbene under /organisation har sin
                          egen side; gamle `/admin/settings/organisation/*`
                          bokmerker peker dit. */}
                      <Route path="admin/settings/organisation" element={<Navigate to="/organisation" replace />} />
                      <Route path="admin/settings/organisation/analyse" element={<Navigate to="/organisation?tab=insights" replace />} />
                      <Route path="admin/settings/organisation/company" element={<Navigate to="/organisation?tab=settings" replace />} />
                      <Route path="admin/settings/organisation/units" element={<Navigate to="/organisation?tab=units" replace />} />
                      <Route path="admin/settings/organisation/employees" element={<Navigate to="/organisation?tab=employees" replace />} />
                      <Route path="admin/settings/organisation/mandates" element={<Navigate to="/organisation?tab=mandates" replace />} />
                      {/* Gamle workflow-byggerlenker sender til /workflow
                          som beholder den fulle canvas-redigereren. Den
                          enkle, listebaserte arbeidsflyt-redigereren bor
                          nå i Klarert Admin → Arbeidsflyt. */}
                      <Route path="admin/settings/workflows/analyse" element={<Navigate to="/workflow" replace />} />
                      <Route path="admin/settings/workflows/rules" element={<Navigate to="/workflow?tab=rules" replace />} />
                      <Route path="admin/settings/workflows/runs" element={<Navigate to="/workflow?tab=runs" replace />} />
                      <Route path="admin/settings/workflows/templates" element={<Navigate to="/workflow?tab=library" replace />} />
                      <Route path="admin/settings/workflows/auditors" element={<Navigate to="/admin/settings/users" replace />} />
                      <Route path="admin" element={<Navigate to="/organisation" replace />} />
                      <Route path="profile" element={<ProfilePage />} />
                      {/* New e-læring hub & detail surfaces render their own page chrome
                          (breadcrumb + header + framework rail). The legacy LearningLayout
                          still wraps the catalogue + deltakere + kompetanse tabs at the
                          `/learning/*` sub-URLs. */}
                      <Route path="learning" element={<LearningHubPage />} />
                      <Route path="learning/play/:courseId" element={<LearningPlayerV2 />} />
                      <Route path="learning/play-classic/:courseId" element={<LearningPlayer />} />
                      <Route path="learning/certificates/:certId/print" element={<LearningCertificatePrintPage />} />
                      <Route path="learning/flow" element={<LearningFlowEntry />} />
                      <Route path="learning/courses/:courseId" element={<LearningCourseBuilderV2 />} />
                      <Route path="learning/courses/:courseId/detail" element={<LearningCourseDetailPage />} />
                      <Route path="learning/courses/:courseId/classic" element={<LearningCourseBuilder />} />
                      <Route path="registers" element={<RegistersHubPage />} />
                      <Route path="registers/analyse" element={<RegistersAnalysePage />} />
                      <Route path="registers/admin" element={<LegacyAdminRedirect scope="registers" />} />
                      <Route path="registers/:typeId" element={<RegisterTypePage />} />
                      <Route path="registers/:typeId/:recordId" element={<RegisterEntryPage />} />
                      <Route element={<LearningLayout />}>
                        <Route path="learning/oversikt-klassisk" element={<LearningDashboard />} />
                        {/* Five canonical tabs */}
                        <Route path="learning/katalog" element={<LearningCoursesList />} />
                        <Route path="learning/deltakere" element={<LearningDeltakerePage />} />
                        <Route path="learning/kompetanse" element={<LearningKompetansePage />} />
                        <Route path="learning/min-historikk" element={<LearningMinHistorikkPage />} />
                        <Route path="learning/analyse" element={<LearningAnalysePage />} />
                        <Route path="learning/alle" element={<LearningAllePage />} />
                        <Route path="learning/innstillinger" element={<LegacyLearningRedirect />} />
                        {/* Back-compat redirects — old URLs land on the new IA. */}
                        <Route path="learning/courses" element={<Navigate to="/learning/katalog" replace />} />
                        <Route path="learning/participants" element={<Navigate to="/learning/deltakere" replace />} />
                        <Route path="learning/compliance" element={<Navigate to="/learning/deltakere?view=heatmap" replace />} />
                        <Route path="learning/certifications" element={<Navigate to="/learning/kompetanse" replace />} />
                        <Route path="learning/external" element={<Navigate to="/learning/kompetanse?tab=ekstern" replace />} />
                        <Route path="learning/settings" element={<Navigate to="/admin/settings/learning" replace />} />
                        <Route path="learning/paths" element={<Navigate to="/admin/settings/learning?tab=stier" replace />} />
                        <Route path="learning/insights" element={<Navigate to="/learning" replace />} />
                      </Route>
                      <Route path="prosesser" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow" element={<WorkflowBuilderPage />} />
                      <Route path="workflow/v3" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow/klassisk" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow/admin" element={<Navigate to="/workflow" replace />} />
                      <Route path="workflow/:ruleId" element={<WorkflowEditorRoute />} />
                      {/* Legacy combined route — kept as a deprecation hub that
                          lists the four per-provider wizards. Old bookmarks
                          still land somewhere useful. */}
                      <Route path="admin/integrasjoner-staten" element={<Navigate to="/admin/integrations" replace />} />
                      <Route path="admin/integrations" element={<GovIntegrationsPage />} />
                      <Route path="admin/integrations/altinn" element={<AltinnSetup />} />
                      <Route path="admin/integrations/arbeidstilsynet" element={<ArbeidstilsynetSetup />} />
                      <Route path="admin/integrations/datatilsynet" element={<DatatilsynetSetup />} />
                      <Route path="admin/integrations/nav" element={<NavSetup />} />
                      <Route path="admin/integrations/helsetilsynet" element={<HelsetilsynetSetup />} />
                      <Route path="admin/integrations/sertifikat-rotasjon" element={<CertRotationPage />} />
                      <Route path="admin/integrations/utboks" element={<GovOutboxPage />} />
                      <Route path="admin/varsling/dedup-grupper" element={<AlertDedupGroupsPage />} />
                      <Route element={<DocumentsModuleShellLayout />}>
                        <Route path="documents/editor-test" element={<DocumentEditorTestPage />} />
                        <Route path="documents/kandidatdetalj-layout-test" element={<DocumentKandidatdetaljLayoutTestPage />} />
                        <Route path="documents/malbibliotek" element={<DocumentsMalbibliotekPage />} />
                        <Route path="documents/analyse" element={<DocumentsAnalysePage />} />
                        <Route path="documents/sok" element={<DocumentsSokPage />} />
                        <Route path="documents/alle" element={<DocumentsAllePage />} />
                        <Route path="documents/compliance" element={<ComplianceDashboard />} />
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
                        {/* /documents owns its own ModulePageShell (new design).
                            Keep it in the lightweight outlet so the outer
                            DocumentsModuleShellLayout doesn't stack a second
                            header on top. */}
                        <Route path="documents" element={<DocumentsHome />} />
                        <Route path="documents/space/:spaceId" element={<WikiSpaceView />} />
                        <Route
                          path="documents/page/:pageId"
                          element={
                            <RouteErrorBoundary title="Kunne ikke vise dokumentet">
                              <WikiPageView />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route
                          path="documents/page/:pageId/reference-edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne redigering">
                              <WikiPageReferenceEditor />
                            </RouteErrorBoundary>
                          }
                        />
                        <Route
                          path="documents/page/:pageId/edit"
                          element={
                            <RouteErrorBoundary title="Kunne ikke åpne redigering">
                              <DocumentEditPage />
                            </RouteErrorBoundary>
                          }
                        />
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

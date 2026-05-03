import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AticsShell from './components/layout/AticsShell';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import WorkplaceDashboardPage from './pages/WorkplaceDashboardPage';
import WorkplaceReportingPage from './pages/WorkplaceReportingPage';
import WorkplaceIncidentsPage from './pages/WorkplaceIncidentsPage';
import WorkplaceAnonymousAmlPage from './pages/WorkplaceAnonymousAmlPage';
import PublicWhistlePage from './pages/PublicWhistlePage';
import PublicAnonymousAmlPage from './pages/PublicAnonymousAmlPage';
import WorkplaceAnonymousAmlSettingsPage from './pages/WorkplaceAnonymousAmlSettingsPage';
import WorkspaceAuditLogPage from './pages/WorkspaceAuditLogPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';
import ProjectDashboard from './pages/ProjectDashboard';
import ModuleSlugPage from './pages/ModuleSlugPage';
import ModuleAdminPage from './pages/ModuleAdminPage';
import YearskontrollModule from './pages/YearskontrollModule';
import InternalControlModule from './pages/InternalControlModule';
import InternalControlAdminPage from './pages/InternalControlAdminPage';
import ActionPlanPage from './pages/ActionPlanPage';
import ActionBoardPage from './pages/actionboard/ActionBoardPage';
import ActionPlanAdminPage from './pages/ActionPlanAdminPage';
import OrgModuleDesignerPage from './pages/OrgModuleDesignerPage';
import DocumentsHome from './pages/documents/DocumentsHome';
import DocumentsModuleAdminPage from './pages/DocumentsModuleAdminPage';
import WikiSpaceView from './pages/documents/WikiSpaceView';
import WikiPageView from './pages/documents/WikiPageView';
import WikiPageEditor from './pages/documents/WikiPageEditor';
import DocumentsMalbibliotekPage from './pages/documents/DocumentsMalbibliotekPage';
import DocumentsOrgTemplateEditorPage from './pages/documents/DocumentsOrgTemplateEditorPage';
import AnnualReviewPage from './pages/documents/AnnualReviewPage';
import DocumentReviewsPage from './pages/documents/DocumentReviewsPage';
import DocumentAccessRequestsPanel from './pages/documents/DocumentAccessRequestsPanel';
import InspectionArbeidstilsynetExportPage from './pages/documents/InspectionArbeidstilsynetExportPage';
import InspectionModulePage from './pages/InspectionModulePage';
import InspectionModuleAdminPage from './pages/InspectionModuleAdminPage';
import InspectionRoundDetailPage from './pages/InspectionRoundDetailPage';
import AarshjulPage from './pages/aarshjul/AarshjulPage';
import HseModule from './pages/HseModule';
import VernerunderPage from './pages/VernerunderPage';
import VernerunderAdminPage from './pages/VernerunderAdminPage';
import VernerundeDetailPage from './pages/VernerundeDetailPage';
import MembersModule from './pages/MembersModule';
import OrgHealthModule from './pages/OrgHealthModule';
import OrgHealthSettings from './pages/OrgHealthSettings';
import SurveyModulePage from './pages/SurveyModulePage';
import SurveyModuleAdminPage from './pages/SurveyModuleAdminPage';
import SurveyDetailPage from './pages/SurveyDetailPage';
import SurveyOrgTemplateEditorPage from './pages/SurveyOrgTemplateEditorPage';
import SurveyRespondPage from './pages/SurveyRespondPage';
import SjaModulePage from './pages/SjaModulePage';
import SjaModuleAdminPage from './pages/SjaModuleAdminPage';
import SjaDetailPage from './pages/SjaDetailPage';
import RosModulePage from './pages/RosModulePage';
import RosModuleAdminPage from './pages/RosModuleAdminPage';
import RosAnalysisDetailPage from './pages/RosAnalysisDetailPage';
import AmuHubPage from './pages/AmuHubPage';
import AmuModuleAdminPage from './pages/AmuModuleAdminPage';
import AmuElectionHubPage from './pages/AmuElectionHubPage';
import AmuElectionAdminPage from './pages/AmuElectionAdminPage';
import AmuElectionDetailPage from './pages/AmuElectionDetailPage';
import IkHubPage from './pages/IkHubPage';
import IkMalPage from './pages/IkMalPage';
import IkTiltaksplanPage from './pages/IkTiltaksplanPage';
import IkMedvirkningPage from './pages/IkMedvirkningPage';
import IkKompetansePage from './pages/IkKompetansePage';
import IkLovregisterPage from './pages/IkLovregisterPage';
import IkAnnualReviewPage from './pages/IkAnnualReviewPage';
import WorkflowModulePage from './pages/WorkflowModulePage';
import WorkflowPage from './pages/WorkflowPage';
import ReportingEnginePage from './pages/ReportingEnginePage';
import LayoutLabPage from './pages/platform/LayoutLabPage';
import PlatformAdminLayout from './pages/platform/PlatformAdminLayout';
import PlatformAdminDashboardPage from './pages/platform/PlatformAdminDashboardPage';
import PlatformAdminLoginPage from './pages/platform/PlatformAdminLoginPage';
import PlatformModuleTemplatesPage from './pages/platform/PlatformModuleTemplatesPage';
import PlatformLayoutTemplatesPage from './pages/platform/PlatformLayoutTemplatesPage';
import PlatformLayoutComposerPage from './pages/platform/PlatformLayoutComposerPage';
import PlatformLayoutCompositionPage from './pages/platform/PlatformLayoutCompositionPage';
import PlatformLayoutHubPage from './pages/platform/PlatformLayoutHubPage';
import PlatformBoxDesignerPage from './pages/platform/PlatformBoxDesignerPage';
import PlatformRoadmapPage from './pages/platform/PlatformRoadmapPage';
import PlatformUiAdvancedPage from './pages/platform/PlatformUiAdvancedPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">Laster...</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/invite/accept" element={<InviteAcceptPage />} />
          <Route path="/whistle/:orgId" element={<PublicWhistlePage />} />
          <Route path="/aml-report/:orgId" element={<PublicAnonymousAmlPage />} />
          
          <Route element={<AticsShell />}>
            <Route path="/dashboard" element={<WorkplaceDashboardPage />} />
            <Route path="/reporting" element={<WorkplaceReportingPage />} />
            <Route path="/incidents" element={<WorkplaceIncidentsPage />} />
            <Route path="/anonymous-aml" element={<WorkplaceAnonymousAmlPage />} />
            <Route path="/anonymous-aml/settings" element={<WorkplaceAnonymousAmlSettingsPage />} />
            <Route path="/audit-log" element={<WorkspaceAuditLogPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            
            {/* Module Routes */}
            <Route path="/m/:moduleSlug" element={<ModuleSlugPage />} />
            <Route path="/m/:moduleSlug/admin" element={<ModuleAdminPage />} />
            
            {/* Specific Modules */}
            <Route path="/aarshjul" element={<AarshjulPage />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/action-board" element={<ActionBoardPage />} />
            <Route path="/action-plan/admin" element={<ActionPlanAdminPage />} />
            
            {/* Documents Module */}
            <Route path="/documents" element={<DocumentsHome />} />
            <Route path="/documents/admin" element={<DocumentsModuleAdminPage />} />
            <Route path="/documents/s/:spaceId" element={<WikiSpaceView />} />
            <Route path="/documents/p/:pageId" element={<WikiPageView />} />
            <Route path="/documents/p/:pageId/edit" element={<WikiPageEditor />} />
            <Route path="/documents/templates" element={<DocumentsMalbibliotekPage />} />
            <Route path="/documents/templates/:templateId" element={<DocumentsOrgTemplateEditorPage />} />
            <Route path="/documents/annual-review" element={<AnnualReviewPage />} />
            <Route path="/documents/reviews" element={<DocumentReviewsPage />} />
            <Route path="/documents/access-requests" element={<DocumentAccessRequestsPanel />} />
            <Route path="/documents/export/arbeidstilsynet" element={<InspectionArbeidstilsynetExportPage />} />

            {/* Other Modules */}
            <Route path="/inspection" element={<InspectionModulePage />} />
            <Route path="/inspection/admin" element={<InspectionModuleAdminPage />} />
            <Route path="/inspection/round/:roundId" element={<InspectionRoundDetailPage />} />
            
            <Route path="/hse" element={<HseModule />} />
            <Route path="/vernerunder" element={<VernerunderPage />} />
            <Route path="/vernerunder/admin" element={<VernerunderAdminPage />} />
            <Route path="/vernerunder/:roundId" element={<VernerundeDetailPage />} />
            
            <Route path="/members" element={<MembersModule />} />
            <Route path="/health" element={<OrgHealthModule />} />
            <Route path="/health/settings" element={<OrgHealthSettings />} />
            
            <Route path="/surveys" element={<SurveyModulePage />} />
            <Route path="/surveys/admin" element={<SurveyModuleAdminPage />} />
            <Route path="/surveys/:surveyId" element={<SurveyDetailPage />} />
            <Route path="/surveys/templates/:templateId" element={<SurveyOrgTemplateEditorPage />} />
            
            <Route path="/sja" element={<SjaModulePage />} />
            <Route path="/sja/admin" element={<SjaModuleAdminPage />} />
            <Route path="/sja/:sjaId" element={<SjaDetailPage />} />
            
            <Route path="/ros" element={<RosModulePage />} />
            <Route path="/ros/admin" element={<RosModuleAdminPage />} />
            <Route path="/ros/:analysisId" element={<RosAnalysisDetailPage />} />
            
            <Route path="/amu" element={<AmuHubPage />} />
            <Route path="/amu/admin" element={<AmuModuleAdminPage />} />
            <Route path="/amu-election" element={<AmuElectionHubPage />} />
            <Route path="/amu-election/admin" element={<AmuElectionAdminPage />} />
            <Route path="/amu-election/:electionId" element={<AmuElectionDetailPage />} />

            <Route path="/internkontroll" element={<IkHubPage />} />
            <Route path="/internkontroll/mal" element={<IkMalPage />} />
            <Route path="/internkontroll/tiltaksplan" element={<IkTiltaksplanPage />} />
            <Route path="/internkontroll/medvirkning" element={<IkMedvirkningPage />} />
            <Route path="/internkontroll/kompetanse" element={<IkKompetansePage />} />
            <Route path="/internkontroll/lovregister" element={<IkLovregisterPage />} />
            <Route path="/internkontroll/annual-review" element={<IkAnnualReviewPage />} />
            
            <Route path="/workflows" element={<WorkflowModulePage />} />
            <Route path="/workflows/:workflowId" element={<WorkflowPage />} />
            <Route path="/reporting-engine" element={<ReportingEnginePage />} />
          </Route>

          {/* Platform Admin */}
          <Route path="/platform/login" element={<PlatformAdminLoginPage />} />
          <Route path="/platform" element={<PlatformAdminLayout />}>
            <Route index element={<PlatformAdminDashboardPage />} />
            <Route path="roadmap" element={<PlatformRoadmapPage />} />
            <Route path="modules" element={<PlatformModuleTemplatesPage />} />
            <Route path="layouts" element={<PlatformLayoutHubPage />} />
            <Route path="layouts/templates" element={<PlatformLayoutTemplatesPage />} />
            <Route path="layouts/composer" element={<PlatformLayoutComposerPage />} />
            <Route path="layouts/composition/:compositionId" element={<PlatformLayoutCompositionPage />} />
            <Route path="boxes" element={<PlatformBoxDesignerPage />} />
            <Route path="ui-advanced" element={<PlatformUiAdvancedPage />} />
            <Route path="lab" element={<LayoutLabPage />} />
          </Route>

          <Route path="/surveys/respond/:token" element={<SurveyRespondPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;

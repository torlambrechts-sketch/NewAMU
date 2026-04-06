import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { OrgSetupProvider } from './context/OrgSetupProvider'
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
import { HrmEmployees } from './pages/HrmEmployees'
import { HrmSalary } from './pages/HrmSalary'
import { NotFound } from './pages/NotFound'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { CouncilModule } from './pages/CouncilModule'
import { MembersModule } from './pages/MembersModule'
import { HseModule } from './pages/HseModule'
import { OrgHealthModule } from './pages/OrgHealthModule'
import { OrgHealthSettings } from './pages/OrgHealthSettings'
import { InternalControlModule } from './pages/InternalControlModule'
import { OrganisationPage } from './pages/OrganisationPage'
import { AarshjulPage } from './pages/aarshjul/AarshjulPage'
import { ActionBoardPage } from './pages/actionboard/ActionBoardPage'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { TasksPage } from './pages/TasksPage'
import { LearningLayout } from './components/learning/LearningLayout'
import { LearningDashboard } from './pages/learning/LearningDashboard'
import { LearningCoursesList } from './pages/learning/LearningCoursesList'
import { LearningCourseBuilder } from './pages/learning/LearningCourseBuilder'
import { LearningPlayer } from './pages/learning/LearningPlayer'
import { LearningCertifications } from './pages/learning/LearningCertifications'
import { LearningInsights } from './pages/learning/LearningInsights'
import { LearningParticipants } from './pages/learning/LearningParticipants'
import { LearningSettings } from './pages/learning/LearningSettings'
import { LearningFlowEntry } from './pages/learning/LearningFlowEntry'
import { LearningComplianceMatrix } from './pages/learning/LearningComplianceMatrix'
import { LearningPathsPage } from './pages/learning/LearningPathsPage'
import { LearningExternalTraining } from './pages/learning/LearningExternalTraining'
import { DocumentsHome } from './pages/documents/DocumentsHome'
import { WikiSpaceView } from './pages/documents/WikiSpaceView'
import { WikiPageView } from './pages/documents/WikiPageView'
import { WikiPageEditor } from './pages/documents/WikiPageEditor'
import { ComplianceDashboard } from './pages/documents/ComplianceDashboard'
import { DocumentTemplatesSettings } from './pages/documents/DocumentTemplatesSettings'
import { RouteErrorBoundary } from './components/RouteErrorBoundary'
import { DocumentsLayout } from './hooks/useDocuments'

function App() {
  return (
    <BrowserRouter>
      <OrgSetupProvider>
        <I18nProvider>
          <Routes>
            <Route path="/hrm" element={<Navigate to="/hrm/employees" replace />} />
            <Route path="/hrm/employees" element={<HrmEmployees />} />
            <Route path="/hrm/salary" element={<HrmSalary />} />
            <Route path="/404" element={<NotFound />} />

            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />

            <Route element={<OrgGate />}>
              <Route path="onboarding" element={<OnboardingWizard />} />
              <Route element={<PermissionGate />}>
                <Route element={<DocumentsLayout />}>
                <Route element={<AticsShell />}>
                  <Route index element={<ProjectDashboard />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="organisation" element={<OrganisationPage />} />
                  <Route path="reports" element={<ReportingEnginePage />} />
                  <Route path="aarshjul" element={<AarshjulPage />} />
                  <Route path="action-board" element={<ActionBoardPage />} />
                  <Route path="council" element={<CouncilModule />} />
                  <Route path="members" element={<MembersModule />} />
                  <Route path="org-health" element={<OrgHealthModule />} />
                  <Route path="org-health/settings" element={<OrgHealthSettings />} />
                  <Route path="internal-control" element={<InternalControlModule />} />
                  <Route path="hse" element={<HseModule />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="learning/play/:courseId" element={<LearningPlayer />} />
                  <Route path="learning/flow" element={<LearningFlowEntry />} />
                  <Route path="learning" element={<LearningLayout />}>
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
                  <Route
                    path="prosesser"
                    element={
                      <PlaceholderPage
                        title="Prosesser"
                        description="Aktive arbeidsflyter og dynamiske skjemaer som knytter compliance-arbeidet sammen."
                      />
                    }
                  />
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
                    path="documents/page/:pageId/edit"
                    element={
                      <RouteErrorBoundary title="Kunne ikke åpne redigering">
                        <WikiPageEditor />
                      </RouteErrorBoundary>
                    }
                  />
                  <Route path="documents/compliance" element={<ComplianceDashboard />} />
                  <Route path="documents/templates" element={<DocumentTemplatesSettings />} />
                </Route>
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </I18nProvider>
      </OrgSetupProvider>
    </BrowserRouter>
  )
}

export default App

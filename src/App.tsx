import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { OrgSetupProvider } from './context/OrgSetupProvider'
import { AticsShell } from './components/layout/AticsShell'
import { OrgGate } from './components/OrgGate'
import { PermissionGate } from './components/PermissionGate'
import { OnboardingWizard } from './pages/OnboardingWizard'
import { AuthPage } from './pages/AuthPage'
import { InviteAcceptPage } from './pages/InviteAcceptPage'
import { AdminPage } from './pages/AdminPage'
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

function App() {
  return (
    <BrowserRouter>
      <OrgSetupProvider>
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
            <Route element={<AticsShell />}>
              <Route index element={<ProjectDashboard />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="council" element={<CouncilModule />} />
              <Route path="members" element={<MembersModule />} />
              <Route path="org-health" element={<OrgHealthModule />} />
              <Route path="org-health/settings" element={<OrgHealthSettings />} />
              <Route path="internal-control" element={<InternalControlModule />} />
              <Route path="hse" element={<HseModule />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="learning" element={<LearningLayout />}>
                <Route index element={<LearningDashboard />} />
                <Route path="courses" element={<LearningCoursesList />} />
                <Route path="courses/:courseId" element={<LearningCourseBuilder />} />
                <Route path="play/:courseId" element={<LearningPlayer />} />
                <Route path="certifications" element={<LearningCertifications />} />
                <Route path="insights" element={<LearningInsights />} />
                <Route path="participants" element={<LearningParticipants />} />
                <Route path="settings" element={<LearningSettings />} />
              </Route>
              <Route
                path="clients"
                element={<PlaceholderPage title="Clients" description="Client directory and relationships." />}
              />
              <Route
                path="analytics"
                element={<PlaceholderPage title="Analytics" description="Charts and KPIs." />}
              />
              <Route
                path="marketing"
                element={<PlaceholderPage title="Marketing" description="Campaigns and content." />}
              />
              <Route
                path="reports"
                element={<PlaceholderPage title="Reports" description="Exports and scheduled reports." />}
              />
              <Route path="teams" element={<PlaceholderPage title="Teams" description="Team roster and roles." />} />
              <Route
                path="workspaces"
                element={<PlaceholderPage title="Workspaces" description="Workspace settings." />}
              />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </OrgSetupProvider>
    </BrowserRouter>
  )
}

export default App

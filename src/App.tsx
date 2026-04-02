import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AticsShell } from './components/layout/AticsShell'
import { HrmEmployees } from './pages/HrmEmployees'
import { HrmSalary } from './pages/HrmSalary'
import { NotFound } from './pages/NotFound'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { CouncilModule } from './pages/CouncilModule'
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
      <Routes>
        <Route path="/hrm" element={<Navigate to="/hrm/employees" replace />} />
        <Route path="/hrm/employees" element={<HrmEmployees />} />
        <Route path="/hrm/salary" element={<HrmSalary />} />
        <Route path="/404" element={<NotFound />} />

        <Route element={<AticsShell />}>
          <Route index element={<ProjectDashboard />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="council" element={<CouncilModule />} />
          <Route path="members" element={<Navigate to="/council?tab=election" replace />} />
          <Route path="org-health" element={<OrgHealthModule />} />
          <Route path="org-health/settings" element={<OrgHealthSettings />} />
          <Route path="internal-control" element={<InternalControlModule />} />
          <Route path="hse" element={<HseModule />} />
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

        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

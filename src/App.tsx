import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AticsShell } from './components/layout/AticsShell'
import { HrmEmployees } from './pages/HrmEmployees'
import { HrmSalary } from './pages/HrmSalary'
import { NotFound } from './pages/NotFound'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { CouncilModule } from './pages/CouncilModule'
import { ProjectDashboard } from './pages/ProjectDashboard'
import { TasksPage } from './pages/TasksPage'

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

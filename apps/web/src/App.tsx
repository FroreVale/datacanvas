import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { BuilderPage } from "@/pages/builder-page"
import { ChartsPage } from "@/pages/charts-page"
import { DashboardPage } from "@/pages/dashboard-page"
import { DatasetsPage } from "@/pages/datasets-page"
import { SettingsPage } from "@/pages/settings-page"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/builder/:chartId" element={<BuilderPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

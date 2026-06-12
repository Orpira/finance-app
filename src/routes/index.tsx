import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '../app/AppLayout'
import { PinGate } from '../components/PinGate'
import AgendaPage from '../pages/Agenda/AgendaPage'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import ExpensesPage from '../pages/Expenses/ExpensesPage'
import HomePage from '../pages/Home/HomePage'
import IncomePage from '../pages/Income/IncomePage'
import ReportsPage from '../pages/Reports/ReportsPage'
import SettingsPage from '../pages/Settings/SettingsPage'
import DebugPage from '../pages/Debug/DebugPage'

export function RouterProvider() {
  return (
    <BrowserRouter>
      <PinGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="income" element={<IncomePage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="debug" element={<DebugPage />} />
          </Route>
        </Routes>
      </PinGate>
    </BrowserRouter>
  )
}

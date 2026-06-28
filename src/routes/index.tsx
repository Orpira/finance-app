import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from '../app/AppLayout'
import { PinGate } from '../components/PinGate'
import { LicenseGuard } from '../components/security/LicenseGuard'
import { UsageModeGuard } from '../components/security/UsageModeGuard'
import AppointmentFormPage from '../pages/Agenda/AppointmentFormPage'
import AgendaPage from '../pages/Agenda/AgendaPage'
import BestDaysHistoryPage from '../pages/Summary/BestDaysHistoryPage'
import FullSummaryPage from '../pages/Summary/FullSummaryPage'
import ExpenseListPage from '../pages/Expenses/ExpenseListPage'
import ExpensesPage from '../pages/Expenses/ExpensesPage'
import HomePage from '../pages/Home/HomePage'
import IncomeListPage from '../pages/Income/IncomeListPage'
import IncomePage from '../pages/Income/IncomePage'
import IncomeDetailPage from '../pages/Income/IncomeDetailPage'
import MorePage from '../pages/More/MorePage'
import ReportPreviewPage from '../pages/Reports/ReportPreviewPage'
import ReportsPage from '../pages/Reports/ReportsPage'
import SettingsBackupPage from '../pages/Settings/SettingsBackupPage'
import SettingsBusinessPage from '../pages/Settings/SettingsBusinessPage'
import SettingsPage from '../pages/Settings/SettingsPage'
import SettingsSecurityPage from '../pages/Settings/SettingsSecurityPage'
import CommunicationChannelsPage from '../pages/Settings/CommunicationChannelsPage'
import DebugPage from '../pages/Debug/DebugPage'
import SeasonsPage from '../pages/Seasons/SeasonsPage'
import SeasonFormPage from '../pages/Seasons/SeasonFormPage'
import SeasonDetailPage from '../pages/Seasons/SeasonDetailPage'

export function RouterProvider() {
  return (
    <BrowserRouter>
      <LicenseGuard>
        <PinGate>
          <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="resumen-completo" element={<UsageModeGuard allowed={['professional']}><FullSummaryPage /></UsageModeGuard>} />
            <Route path="dashboard" element={<Navigate replace to="/resumen-completo" />} />
            <Route
              path="resumen-completo/historial-mejores-dias"
              element={<UsageModeGuard allowed={['professional']}><BestDaysHistoryPage /></UsageModeGuard>}
            />
            <Route path="dashboard/best-days-history" element={<Navigate replace to="/resumen-completo/historial-mejores-dias" />} />
            <Route path="income/nuevo" element={<IncomePage />} />
            <Route path="income/:incomeId" element={<IncomeDetailPage />} />
            <Route path="income/:incomeId/editar" element={<IncomePage />} />
            <Route path="income/list" element={<IncomeListPage />} />
            <Route path="income" element={<IncomeListPage />} />
            <Route path="expenses/list" element={<ExpenseListPage />} />
            <Route path="expenses/:expenseId/editar" element={<ExpensesPage />} />
            <Route path="expenses/nuevo" element={<ExpensesPage />} />
            <Route path="expenses" element={<ExpenseListPage />} />
            <Route path="agenda/nueva" element={<UsageModeGuard allowed={['professional']}><AppointmentFormPage /></UsageModeGuard>} />
            <Route
              path="agenda/:appointmentId/editar"
              element={<UsageModeGuard allowed={['professional']}><AppointmentFormPage /></UsageModeGuard>}
            />
            <Route path="agenda" element={<UsageModeGuard allowed={['professional']}><AgendaPage /></UsageModeGuard>} />
            <Route path="reports/preview" element={<ReportPreviewPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="temporadas/nueva" element={<UsageModeGuard allowed={['professional']}><SeasonFormPage /></UsageModeGuard>} />
            <Route path="temporadas/:id" element={<UsageModeGuard allowed={['professional']}><SeasonDetailPage /></UsageModeGuard>} />
            <Route path="temporadas" element={<UsageModeGuard allowed={['professional']}><SeasonsPage /></UsageModeGuard>} />
            <Route path="settings/backup" element={<SettingsBackupPage />} />
            <Route path="settings/business" element={<SettingsBusinessPage />} />
            <Route path="settings/security" element={<SettingsSecurityPage />} />
            <Route path="settings/communication-channels" element={<CommunicationChannelsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="debug" element={<DebugPage />} />
          </Route>
          </Routes>
        </PinGate>
      </LicenseGuard>
    </BrowserRouter>
  )
}

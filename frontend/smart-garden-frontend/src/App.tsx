import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { CropLibraryPage } from './pages/CropLibraryPage';
import { SoilLibraryPage } from './pages/SoilLibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { SupportPage } from './pages/SupportPage';
import { DebugPage } from './pages/DebugPage';
import { MyDevicesPage } from './pages/MyDevicesPage';
import { AdminDevicesPage } from './pages/AdminDevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { MonitoringPage } from './pages/MonitoringPage';
import { IrrigationHistoryPage } from './pages/IrrigationHistoryPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { PlantDiagnosisPage } from './pages/PlantDiagnosisPage';
import { GardenConfigPage } from './pages/GardenConfigPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { MainLayout } from './layouts/MainLayout';
import { AutomationLayout } from './layouts/AutomationLayout';
import { useAuth } from './hooks/useAuth';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
            }
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />
            }
          />
          <Route
            path="/reset-password"
            element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />
            }
          />
          <Route element={<MainLayout />}>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <SystemLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/support"
              element={
                <ProtectedRoute>
                  <SupportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UserManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/devices"
              element={
                <AdminRoute>
                  <AdminDevicesPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/crop-libraries"
              element={
                <AdminRoute>
                  <CropLibraryPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/soil-libraries"
              element={
                <AdminRoute>
                  <SoilLibraryPage />
                </AdminRoute>
              }
            />
            <Route
              path="/devices"
              element={
                <ProtectedRoute>
                  <MyDevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devices/:id"
              element={
                <ProtectedRoute>
                  <DeviceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitoring"
              element={
                <ProtectedRoute>
                  <MonitoringPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garden-config"
              element={
                <ProtectedRoute>
                  <GardenConfigPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/irrigation-history"
              element={
                <ProtectedRoute>
                  <IrrigationHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/automation"
              element={
                <ProtectedRoute>
                  <AutomationLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/automation/predictions" replace />} />
              <Route path="schedules" element={<Navigate to="/garden-config" replace />} />
              <Route path="config" element={<Navigate to="/garden-config" replace />} />
              <Route path="predictions" element={<PredictionsPage />} />
            </Route>
            <Route
              path="/plant-diagnosis"
              element={
                <ProtectedRoute>
                  <PlantDiagnosisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/irrigation-config"
              element={<Navigate to="/garden-config" replace />}
            />
            <Route
              path="/schedules"
              element={<Navigate to="/garden-config" replace />}
            />
            <Route
              path="/predictions"
              element={<Navigate to="/automation/predictions" replace />}
            />
            <Route
              path="/debug"
              element={
                <ProtectedRoute>
                  <DebugPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

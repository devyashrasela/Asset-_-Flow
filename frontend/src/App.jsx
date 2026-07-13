import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Layouts
import { AuthLayout } from './components/layout/AuthLayout'
import { DashboardLayout } from './components/layout/DashboardLayout'

// Guards
import { GuestGuard } from './components/guards/GuestGuard'
import { AuthGuard } from './components/guards/AuthGuard'
import { WorkspaceGuard } from './components/guards/WorkspaceGuard'

// Auth Pages
import { Login } from './pages/auth/Login'
import { Signup } from './pages/auth/Signup'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { ResetPassword } from './pages/auth/ResetPassword'
import { Workspaces } from './pages/auth/Workspaces'

import { OrganizationSetup } from './pages/OrganizationSetup'

// App Pages
import { Dashboard } from './pages/Dashboard'
import { AssetDirectory } from './pages/AssetDirectory'
import { AssetDetail } from './pages/AssetDetail'
import { Allocations } from './pages/Allocations'
import { Reports } from './pages/Reports'
import { Bookings } from './pages/Bookings'
import { Maintenance } from './pages/Maintenance'
import { AuditCycles } from './pages/AuditCycles'
import { AuditDetail } from './pages/AuditDetail'
import { AuditReport } from './pages/AuditReport'
import { ActivityLog } from './pages/ActivityLog'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth routes — guest only */}
          <Route
            element={
              <GuestGuard>
                <AuthLayout />
              </GuestGuard>
            }
          >
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Workspace selector — auth required */}
          <Route
            path="/workspaces"
            element={
              <AuthGuard>
                <Workspaces />
              </AuthGuard>
            }
          />

          {/* Dashboard shell — auth + workspace required */}
          <Route
            element={
              <WorkspaceGuard>
                <DashboardLayout />
              </WorkspaceGuard>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Placeholder routes for sidebar nav */}
            <Route path="/assets" element={<AssetDirectory />} />
            <Route path="/assets/:tag" element={<AssetDetail />} />
            <Route path="/allocations" element={<Allocations />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/bookings/my" element={<Bookings />} />
            <Route path="/bookings/approvals" element={<Bookings />} />
            <Route path="/bookings/:assetTag" element={<Bookings />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/audit" element={<AuditCycles />} />
            <Route path="/audit/:cycleId" element={<AuditDetail />} />
            <Route path="/audit/:cycleId/report" element={<AuditReport />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/organization-setup" element={<OrganizationSetup />} />
            <Route path="/settings" element={<PlaceholderPage title="Settings" />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

/** Temporary placeholder for unbuilt pages */
function PlaceholderPage({ title }) {
  return (
    <div className="p-6">
      <h1 className="text-page-title text-neutral-900">{title}</h1>
      <p className="text-sm text-neutral-500 mt-1">This page is under construction.</p>
    </div>
  )
}

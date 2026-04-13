import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ScanPage from './pages/ScanPage'
import ReportPage from './pages/ReportPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-dedsec-bg flex items-center justify-center">
      <p className="text-dedsec-green animate-pulse-green text-2xl">☠️</p>
    </div>
  )

  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-dedsec-bg flex items-center justify-center">
      <p className="text-dedsec-green animate-pulse-green text-2xl">☠️</p>
    </div>
  )

  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      }/>
      <Route path="/scan" element={
        <ProtectedRoute><ScanPage /></ProtectedRoute>
      }/>
      <Route path="/report/:scanId" element={
        <ProtectedRoute><ReportPage /></ProtectedRoute>
      }/>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
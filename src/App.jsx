import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { ROLES } from './utils/constants'
import LoginPage from './pages/LoginPage.jsx'
import Layout from './components/layout/Layout.jsx'
import DeveloperDashboard from './pages/DeveloperDashboard.jsx'
import TesterDashboard from './pages/TesterDashboard.jsx'
import TestRoundsPage from './pages/TestRoundsPage.jsx'
import RoundDetailPage from './pages/RoundDetailPage.jsx'
import CreateRoundPage from './pages/CreateRoundPage.jsx'
import ExecutionPage from './pages/ExecutionPage.jsx'
import BugsPage from './pages/BugsPage.jsx'
import BugDetailPage from './pages/BugDetailPage.jsx'
import PassesPage from './pages/PassesPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SetupMissingEnv from './pages/SetupMissingEnv.jsx'

function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-ink-dim">
        <div className="animate-pulse">Loading…</div>
      </div>
    )
  }
  if (!user || !profile) return <Navigate to="/login" replace />
  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }
  return children
}

function RoleHome() {
  const { profile } = useAuth()
  return profile?.role === ROLES.TESTER
    ? <Navigate to="/my-tests" replace />
    : <Navigate to="/dashboard" replace />
}

export default function App() {
  const { firebaseReady } = useAuth()
  if (!firebaseReady) return <SetupMissingEnv />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleHome />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute roles={[ROLES.DEVELOPER]}>
              <DeveloperDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tests"
          element={
            <ProtectedRoute roles={[ROLES.TESTER]}>
              <TesterDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/rounds" element={<TestRoundsPage />} />
        <Route path="/rounds/new" element={
          <ProtectedRoute roles={[ROLES.DEVELOPER]}>
            <CreateRoundPage />
          </ProtectedRoute>
        } />
        <Route path="/rounds/:roundId" element={<RoundDetailPage />} />
        <Route path="/rounds/:roundId/execute" element={<ExecutionPage />} />
        <Route path="/bugs" element={<BugsPage />} />
        <Route path="/bugs/fixed" element={<BugsPage defaultFilter="fixed" pageTitle="Fixed" pageDescription="Bugs the developer has fixed and queued for retest." />} />
        <Route path="/bugs/backlog" element={<BugsPage defaultFilter="rejected" pageTitle="Backlog" pageDescription="Bugs deferred — no fix or retest planned. Reopen if priorities change." />} />
        <Route path="/bugs/:bugId" element={<BugDetailPage />} />
        <Route
          path="/passes"
          element={
            <ProtectedRoute roles={[ROLES.DEVELOPER]}>
              <PassesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute roles={[ROLES.DEVELOPER]}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={[ROLES.DEVELOPER]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

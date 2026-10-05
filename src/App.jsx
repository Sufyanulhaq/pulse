import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { SiteLayout } from './components/SiteLayout.jsx'
import { AppLayout } from './components/AppLayout.jsx'
import { CommandPalette } from './components/CommandPalette.jsx'
import { Spinner } from './components/ui.jsx'
import { useAuth } from './state/AuthContext.jsx'
import HomePage from './pages/site/HomePage.jsx'
import TimerPage from './pages/app/TimerPage.jsx'

// The home page and timer load first; everything else loads when visited.
const FeaturesPage = lazy(() => import('./pages/site/FeaturesPage.jsx'))
const PricingPage = lazy(() => import('./pages/site/PricingPage.jsx'))
const DevelopersPage = lazy(() => import('./pages/site/DevelopersPage.jsx'))
const IntegrationsPage = lazy(() => import('./pages/site/IntegrationsPage.jsx'))
const ChangelogPage = lazy(() => import('./pages/site/ChangelogPage.jsx'))
const AboutPage = lazy(() => import('./pages/site/AboutPage.jsx'))
const ContactPage = lazy(() => import('./pages/site/ContactPage.jsx'))
const PrivacyPage = lazy(() => import('./pages/site/LegalPages.jsx').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/site/LegalPages.jsx').then((m) => ({ default: m.TermsPage })))
const LoginPage = lazy(() => import('./pages/AuthPages.jsx').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('./pages/AuthPages.jsx').then((m) => ({ default: m.SignupPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'))
const InsightsPage = lazy(() => import('./pages/app/InsightsPage.jsx'))
const HistoryPage = lazy(() => import('./pages/app/HistoryPage.jsx'))
const AssistantPage = lazy(() => import('./pages/app/AssistantPage.jsx'))
const TeamsList = lazy(() => import('./pages/app/TeamsPage.jsx').then((m) => ({ default: m.TeamsList })))
const TeamDetail = lazy(() => import('./pages/app/TeamsPage.jsx').then((m) => ({ default: m.TeamDetail })))
const DeveloperPage = lazy(() => import('./pages/app/DeveloperPage.jsx'))
const SettingsPage = lazy(() => import('./pages/app/SettingsPage.jsx'))
const AdminPage = lazy(() => import('./pages/app/AdminPage.jsx'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function RequireAccount({ children }) {
  const { user, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Spinner />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

function PageFallback() {
  return (
    <div className="page-loading">
      <Spinner />
    </div>
  )
}

export default function App() {
  return (
    <div className="app-root">
      <a className="skip-link" href="/" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus() }}>
        Skip to content
      </a>
      <ScrollToTop />
      <CommandPalette />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="features" element={<FeaturesPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="developers" element={<DevelopersPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="changelog" element={<ChangelogPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="app" element={<AppLayout />}>
            <Route index element={<TimerPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="assistant" element={<AssistantPage />} />
            <Route path="teams" element={<RequireAccount><TeamsList /></RequireAccount>} />
            <Route path="teams/:id" element={<RequireAccount><TeamDetail /></RequireAccount>} />
            <Route path="developer" element={<RequireAccount><DeveloperPage /></RequireAccount>} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<RequireAccount><AdminPage /></RequireAccount>} />
          </Route>
        </Routes>
      </Suspense>
    </div>
  )
}

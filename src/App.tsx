import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

// Layout
import { AppShell } from '@/components/layout/AppShell'

// Auth pages
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'

// Onboarding
import { Onboarding } from '@/pages/onboarding/Onboarding'

// App pages — health module (existing)
import { Dashboard } from '@/pages/Dashboard'
import { Connect } from '@/pages/Connect'

// App pages — new modules
import { Pipeline } from '@/pages/sales/Pipeline'
import { Contacts } from '@/pages/sales/Contacts'
import { Marketing } from '@/pages/marketing/Marketing'
import { Service } from '@/pages/service/Service'
import { KnowledgeBase } from '@/pages/knowledge/KnowledgeBase'
import { ChannelCapture } from '@/pages/captures/ChannelCapture'
import { Settings } from '@/pages/Settings'

function RootRedirect() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/app" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return (
    <BrowserRouter>
      <Routes>
        {/* Root — redirect based on auth state */}
        <Route path="/" element={<RootRedirect />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Onboarding (authenticated) */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main app with sidebar layout */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/health" replace />} />
          <Route path="health" element={<Dashboard />} />
          <Route path="health/connect" element={<Connect />} />
          <Route path="sales" element={<Pipeline />} />
          <Route path="sales/contacts" element={<Contacts />} />
          <Route path="marketing" element={<Marketing />} />
          <Route path="marketing/segments" element={<Marketing />} />
          <Route path="marketing/sequences" element={<Marketing />} />
          <Route path="service" element={<Service />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="knowledge/:articleId" element={<KnowledgeBase />} />
          <Route path="captures" element={<ChannelCapture />} />
          <Route path="captures/:captureId" element={<ChannelCapture />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Legacy route compat */}
        <Route path="/connect" element={<Navigate to="/app/health/connect" replace />} />
        <Route path="/dashboard" element={<Navigate to="/app/health" replace />} />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

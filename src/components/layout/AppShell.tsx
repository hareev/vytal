import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const user = useAuthStore(s => s.user)
  const org = useAuthStore(s => s.org)
  const logout = useAuthStore(s => s.logout)

  if (!user || !org) return <Navigate to="/login" replace />

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-page)' }}>
      <Sidebar org={org} user={user} onLogout={logout} />
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>
    </div>
  )
}

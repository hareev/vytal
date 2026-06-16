import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

export function AuthCallback() {
  const navigate = useNavigate()
  const loadFromStorage = useAuthStore(s => s.loadFromStorage)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    const isNew = new URLSearchParams(window.location.search).get('new') === '1'
    localStorage.setItem('vytal_token', token)
    window.history.replaceState({}, '', '/auth/callback')
    loadFromStorage().then(() => navigate(isNew ? '/onboarding' : '/app', { replace: true }))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Signing you in…</p>
    </div>
  )
}

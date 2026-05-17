import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

export function Login() {
  const navigate = useNavigate()
  const login = useAuthStore(s => s.login)
  const error = useAuthStore(s => s.error)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setIsLoading(true)
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError ?? error ?? null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-page)' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="28" height="28" rx="8" fill="var(--accent)"/>
              <circle cx="14" cy="14" r="7" stroke="white" strokeWidth="1.5"/>
              <path d="M14 10v4l2.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em' }}>Vytal</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
            Sign in to Vytal
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Welcome back — enter your credentials to continue
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            {displayError && (
              <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--danger-bg)', border: '0.5px solid var(--danger-border)', fontSize: '13px', color: 'var(--danger-text)' }}>
                {displayError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                background: 'var(--accent)', border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 500, color: '#fff',
                opacity: isLoading ? 0.7 : 1,
                transition: 'opacity 0.15s',
                marginTop: '2px',
              }}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '1.25rem' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500 }}>Register</Link>
        </p>
      </div>
    </div>
  )
}

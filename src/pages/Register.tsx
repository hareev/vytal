import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/hooks/useAuthStore'

export function Register() {
  const navigate = useNavigate()
  const register = useAuthStore(s => s.register)
  const error = useAuthStore(s => s.error)

  const [orgName, setOrgName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.')
      return
    }
    setIsLoading(true)
    try {
      await register(orgName, email, name, password)
      navigate('/onboarding')
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const displayError = localError ?? error ?? null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-page)' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

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
            Create your Vytal workspace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Get started for free — no credit card required
          </p>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '1.5rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Organisation name *
              </label>
              <input
                type="text"
                required
                placeholder="Acme Inc."
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Your name *
              </label>
              <input
                type="text"
                required
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Work email *
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Password *
              </label>
              <input
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none' }}
              />
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--text-tertiary)' }}>Minimum 8 characters</p>
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
              {isLoading ? 'Creating workspace…' : 'Create workspace'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '1.25rem' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

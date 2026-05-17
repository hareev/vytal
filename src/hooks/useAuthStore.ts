import { create } from 'zustand'
import type { User, Org } from '@/types/auth'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Demo seed (used when mock mode is on) ────────────────────────────────────

const DEMO_USER: User = {
  id: 'demo',
  orgId: 'org-demo',
  email: 'demo@vytal.io',
  name: 'Demo User',
  role: 'owner',
  createdAt: new Date(),
}

const DEMO_ORG: Org = {
  id: 'org-demo',
  name: 'Acme Corp',
  slug: 'acme',
  plan: 'pro',
  modules: { sales: true, marketing: true, service: true, health: true },
  createdAt: new Date(),
}

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface AuthStore {
  user: User | null
  org: Org | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (orgName: string, email: string, name: string, password: string) => Promise<void>
  logout: () => void
  loadFromStorage: () => Promise<void>
  setOrg: (org: Org) => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthStore>((set) => ({
  user: USE_MOCK ? DEMO_USER : null,
  org: USE_MOCK ? DEMO_ORG : null,
  token: USE_MOCK ? 'mock-token' : null,
  isAuthenticated: USE_MOCK,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { token, user, org } = await client.auth.login(email, password)
      localStorage.setItem('vytal_token', token)
      set({ token, user, org, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  register: async (orgName, email, name, password) => {
    set({ isLoading: true, error: null })
    try {
      const { token, user, org } = await client.auth.register(orgName, email, name, password)
      localStorage.setItem('vytal_token', token)
      set({ token, user, org, isAuthenticated: true, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      set({ isLoading: false, error: message })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('vytal_token')
    set({
      user: null,
      org: null,
      token: null,
      isAuthenticated: false,
      error: null,
    })
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem('vytal_token')
    if (!token) return

    set({ isLoading: true, error: null })
    try {
      const { user, org } = await client.auth.me()
      set({ token, user, org, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('vytal_token')
      set({ token: null, isAuthenticated: false, isLoading: false })
    }
  },

  setOrg: (org) => set({ org }),
}))

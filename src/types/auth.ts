export type UserRole = 'owner' | 'admin' | 'member'
export type OrgPlan = 'free' | 'starter' | 'pro'

export interface User {
  id: string
  orgId: string
  email: string
  name: string
  role: UserRole
  avatarUrl?: string
  createdAt: Date
}

export interface Org {
  id: string
  name: string
  slug: string
  plan: OrgPlan
  logoUrl?: string
  modules: {
    sales: boolean
    marketing: boolean
    service: boolean
    health: boolean
  }
  createdAt: Date
}

export interface AuthState {
  user: User | null
  org: Org | null
  token: string | null
  isAuthenticated: boolean
}

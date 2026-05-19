import type { Contact, Deal, Pipeline, Stage } from '@/types/crm'
import type { Campaign, Segment, Sequence, SequenceStep } from '@/types/marketing'
import type { Ticket, TicketMessage } from '@/types/service'
import type { User, Org } from '@/types/auth'
import type { KbCategory, KbArticle, ArticleStatus } from '@/types/kb'

// ─── Request / Response shapes ────────────────────────────────────────────────

export interface ListParams {
  page?: number
  limit?: number
  search?: string
  [key: string]: string | number | boolean | undefined
}

export interface AuthLoginResponse {
  token: string
  user: User
  org: Org
}

export interface AuthRegisterResponse {
  token: string
  user: User
  org: Org
}

export interface MeResponse {
  user: User
  org: Org
}

// ─── ApiClient ────────────────────────────────────────────────────────────────

export class ApiClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null

  constructor(baseUrl: string, getToken: () => string | null) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.getToken = getToken
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`[${res.status}] ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ─── Contacts ──────────────────────────────────────────────────────────────

  contacts = {
    list: (params?: ListParams): Promise<Contact[]> =>
      this.request<Contact[]>('GET', this.buildQuery('/contacts', params)),

    get: (id: string): Promise<Contact> =>
      this.request<Contact>('GET', `/contacts/${id}`),

    create: (data: Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Contact> =>
      this.request<Contact>('POST', '/contacts', data),

    update: (id: string, data: Partial<Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Contact> =>
      this.request<Contact>('PATCH', `/contacts/${id}`, data),

    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/contacts/${id}`),
  }

  // ─── Deals ─────────────────────────────────────────────────────────────────

  deals = {
    list: (params?: ListParams): Promise<Deal[]> =>
      this.request<Deal[]>('GET', this.buildQuery('/deals', params)),

    get: (id: string): Promise<Deal> =>
      this.request<Deal>('GET', `/deals/${id}`),

    create: (data: Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Deal> =>
      this.request<Deal>('POST', '/deals', data),

    update: (id: string, data: Partial<Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Deal> =>
      this.request<Deal>('PATCH', `/deals/${id}`, data),
  }

  // ─── Pipelines ─────────────────────────────────────────────────────────────

  pipelines = {
    list: (): Promise<Pipeline[]> =>
      this.request<Pipeline[]>('GET', '/pipelines'),

    create: (data: Omit<Pipeline, 'id' | 'orgId' | 'createdAt'>): Promise<Pipeline> =>
      this.request<Pipeline>('POST', '/pipelines', data),

    addStage: (pipelineId: string, data: Omit<Stage, 'id'>): Promise<Stage> =>
      this.request<Stage>('POST', `/pipelines/${pipelineId}/stages`, data),
  }

  // ─── Campaigns ─────────────────────────────────────────────────────────────

  campaigns = {
    list: (): Promise<Campaign[]> =>
      this.request<Campaign[]>('GET', '/campaigns'),

    get: (id: string): Promise<Campaign> =>
      this.request<Campaign>('GET', `/campaigns/${id}`),

    create: (data: Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Campaign> =>
      this.request<Campaign>('POST', '/campaigns', data),

    update: (id: string, data: Partial<Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Campaign> =>
      this.request<Campaign>('PATCH', `/campaigns/${id}`, data),

    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/campaigns/${id}`),
  }

  // ─── Segments ──────────────────────────────────────────────────────────────

  segments = {
    list: (): Promise<Segment[]> =>
      this.request<Segment[]>('GET', '/segments'),

    create: (data: Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Segment> =>
      this.request<Segment>('POST', '/segments', data),

    update: (id: string, data: Partial<Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Segment> =>
      this.request<Segment>('PATCH', `/segments/${id}`, data),

    delete: (id: string): Promise<void> =>
      this.request<void>('DELETE', `/segments/${id}`),
  }

  // ─── Tickets ───────────────────────────────────────────────────────────────

  tickets = {
    list: (params?: ListParams): Promise<Ticket[]> =>
      this.request<Ticket[]>('GET', this.buildQuery('/tickets', params)),

    get: (id: string): Promise<Ticket> =>
      this.request<Ticket>('GET', `/tickets/${id}`),

    create: (data: Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>): Promise<Ticket> =>
      this.request<Ticket>('POST', '/tickets', data),

    update: (id: string, data: Partial<Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>): Promise<Ticket> =>
      this.request<Ticket>('PATCH', `/tickets/${id}`, data),

    addMessage: (id: string, body: string, isInternal: boolean): Promise<TicketMessage> =>
      this.request<TicketMessage>('POST', `/tickets/${id}/messages`, { body, isInternal }),
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  auth = {
    login: (email: string, password: string): Promise<AuthLoginResponse> =>
      this.request<AuthLoginResponse>('POST', '/auth/login', { email, password }),

    register: (orgName: string, email: string, name: string, password: string): Promise<AuthRegisterResponse> =>
      this.request<AuthRegisterResponse>('POST', '/auth/register', { orgName, email, name, password }),

    me: (): Promise<MeResponse> =>
      this.request<MeResponse>('GET', '/auth/me'),
  }

  // ─── Orgs ──────────────────────────────────────────────────────────────────

  orgs = {
    get: (): Promise<Org> =>
      this.request<Org>('GET', '/orgs/me'),

    update: (data: Partial<Omit<Org, 'id' | 'createdAt'>>): Promise<Org> =>
      this.request<Org>('PATCH', '/orgs/me', data),

    members: (): Promise<User[]> =>
      this.request<User[]>('GET', '/orgs/me/members'),
  }

  // ─── Knowledge Base ────────────────────────────────────────────────────────

  kb = {
    categories: {
      list: (): Promise<KbCategory[]> =>
        this.request<KbCategory[]>('GET', '/kb/categories'),

      create: (data: Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>): Promise<KbCategory> =>
        this.request<KbCategory>('POST', '/kb/categories', data),

      update: (id: string, data: Partial<Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>>): Promise<KbCategory> =>
        this.request<KbCategory>('PATCH', `/kb/categories/${id}`, data),

      delete: (id: string): Promise<void> =>
        this.request<void>('DELETE', `/kb/categories/${id}`),
    },

    articles: {
      list: (params?: ListParams & { categoryId?: string; status?: ArticleStatus }): Promise<KbArticle[]> => {
        const { categoryId, status, ...rest } = params ?? {}
        const merged: ListParams = { ...rest }
        if (categoryId !== undefined) merged['category_id'] = categoryId
        if (status !== undefined) merged['status'] = status
        return this.request<KbArticle[]>('GET', this.buildQuery('/kb/articles', merged))
      },

      get: (id: string): Promise<KbArticle> =>
        this.request<KbArticle>('GET', `/kb/articles/${id}`),

      create: (data: Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>): Promise<KbArticle> =>
        this.request<KbArticle>('POST', '/kb/articles', data),

      update: (id: string, data: Partial<Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>>): Promise<KbArticle> =>
        this.request<KbArticle>('PATCH', `/kb/articles/${id}`, data),

      delete: (id: string): Promise<void> =>
        this.request<void>('DELETE', `/kb/articles/${id}`),

      publish: (id: string): Promise<KbArticle> =>
        this.request<KbArticle>('POST', `/kb/articles/${id}/publish`),
    },
  }

  // ─── Sequences (bonus — referenced by marketing store) ─────────────────────

  sequences = {
    list: (): Promise<Sequence[]> =>
      this.request<Sequence[]>('GET', '/sequences'),

    create: (data: Omit<Sequence, 'id' | 'orgId' | 'createdAt'>): Promise<Sequence> =>
      this.request<Sequence>('POST', '/sequences', data),

    addStep: (sequenceId: string, data: Omit<SequenceStep, 'id' | 'sequenceId'>): Promise<SequenceStep> =>
      this.request<SequenceStep>('POST', `/sequences/${sequenceId}/steps`, data),
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildQuery(path: string, params?: ListParams): string {
    if (!params) return path
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v))
    }
    const str = qs.toString()
    return str ? `${path}?${str}` : path
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

const VITE_API_URL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  'http://localhost:3001'

export const api = new ApiClient(
  VITE_API_URL,
  () => localStorage.getItem('vytal_token'),
)

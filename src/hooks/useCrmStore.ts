import { create } from 'zustand'
import type { Contact, Deal, Pipeline, Activity } from '@/types/crm'
import type { ListParams } from '@/lib/api/client'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface CrmStore {
  contacts: Contact[]
  deals: Deal[]
  pipelines: Pipeline[]
  activities: Activity[]
  isLoading: boolean
  error: string | null

  // Contacts
  loadContacts: (params?: ListParams) => Promise<void>
  createContact: (data: Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => Promise<Contact>
  updateContact: (id: string, data: Partial<Omit<Contact, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteContact: (id: string) => Promise<void>

  // Deals
  loadDeals: (params?: ListParams) => Promise<void>
  createDeal: (data: Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => Promise<Deal>
  updateDeal: (id: string, data: Partial<Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  moveDeal: (dealId: string, newStageId: string) => Promise<void>

  // Pipelines
  loadPipelines: () => Promise<void>

  // Activities
  createActivity: (data: Omit<Activity, 'id' | 'createdAt'>) => Promise<Activity>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCrmStore = create<CrmStore>((set, get) => ({
  contacts: [],
  deals: [],
  pipelines: [],
  activities: [],
  isLoading: false,
  error: null,

  // ─── Contacts ──────────────────────────────────────────────────────────

  loadContacts: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const contacts = await client.contacts.list(params)
      set({ contacts, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load contacts' })
    }
  },

  createContact: async (data) => {
    const contact = await client.contacts.create(data)
    set((state) => ({ contacts: [...state.contacts, contact] }))
    return contact
  },

  updateContact: async (id, data) => {
    const updated = await client.contacts.update(id, data)
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === id ? updated : c)),
    }))
  },

  deleteContact: async (id) => {
    await client.contacts.delete(id)
    set((state) => ({ contacts: state.contacts.filter((c) => c.id !== id) }))
  },

  // ─── Deals ─────────────────────────────────────────────────────────────

  loadDeals: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const deals = await client.deals.list(params)
      set({ deals, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load deals' })
    }
  },

  createDeal: async (data) => {
    const deal = await client.deals.create(data)
    set((state) => ({ deals: [...state.deals, deal] }))
    return deal
  },

  updateDeal: async (id, data) => {
    const updated = await client.deals.update(id, data)
    set((state) => ({
      deals: state.deals
        .map((d) => (d.id === id ? updated : d))
        .sort((a, b) => (a.stageId < b.stageId ? -1 : a.stageId > b.stageId ? 1 : 0)),
    }))
  },

  moveDeal: async (dealId, newStageId) => {
    const { deals } = get()
    const deal = deals.find((d) => d.id === dealId)
    if (!deal) return
    await get().updateDeal(dealId, { stageId: newStageId })
  },

  // ─── Pipelines ─────────────────────────────────────────────────────────

  loadPipelines: async () => {
    set({ isLoading: true, error: null })
    try {
      const pipelines = await client.pipelines.list()
      set({ pipelines, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load pipelines' })
    }
  },

  // ─── Activities ────────────────────────────────────────────────────────

  createActivity: async (data) => {
    // Activities are written locally until a backend endpoint is available
    const activity: Activity = { ...data, id: Math.random().toString(36).slice(2), createdAt: new Date() }
    set((state) => ({ activities: [...state.activities, activity] }))
    return activity
  },
}))

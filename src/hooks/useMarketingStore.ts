import { create } from 'zustand'
import type { Campaign, Segment, Sequence } from '@/types/marketing'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface MarketingStore {
  campaigns: Campaign[]
  segments: Segment[]
  sequences: Sequence[]
  isLoading: boolean
  error: string | null

  // Campaigns
  loadCampaigns: () => Promise<void>
  createCampaign: (data: Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => Promise<Campaign>
  updateCampaign: (id: string, data: Partial<Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>

  // Segments
  loadSegments: () => Promise<void>
  createSegment: (data: Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => Promise<Segment>
  updateSegment: (id: string, data: Partial<Omit<Segment, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => Promise<void>

  // Sequences
  loadSequences: () => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMarketingStore = create<MarketingStore>((set) => ({
  campaigns: [],
  segments: [],
  sequences: [],
  isLoading: false,
  error: null,

  // ─── Campaigns ─────────────────────────────────────────────────────────

  loadCampaigns: async () => {
    set({ isLoading: true, error: null })
    try {
      const campaigns = await client.campaigns.list()
      set({ campaigns, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load campaigns' })
    }
  },

  createCampaign: async (data) => {
    const campaign = await client.campaigns.create(data)
    set((state) => ({ campaigns: [...state.campaigns, campaign] }))
    return campaign
  },

  updateCampaign: async (id, data) => {
    const updated = await client.campaigns.update(id, data)
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)),
    }))
  },

  deleteCampaign: async (id) => {
    await client.campaigns.delete(id)
    set((state) => ({ campaigns: state.campaigns.filter((c) => c.id !== id) }))
  },

  // ─── Segments ──────────────────────────────────────────────────────────

  loadSegments: async () => {
    set({ isLoading: true, error: null })
    try {
      const segments = await client.segments.list()
      set({ segments, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load segments' })
    }
  },

  createSegment: async (data) => {
    const segment = await client.segments.create(data)
    set((state) => ({ segments: [...state.segments, segment] }))
    return segment
  },

  updateSegment: async (id, data) => {
    const updated = await client.segments.update(id, data)
    set((state) => ({
      segments: state.segments.map((s) => (s.id === id ? updated : s)),
    }))
  },

  // ─── Sequences ─────────────────────────────────────────────────────────

  loadSequences: async () => {
    set({ isLoading: true, error: null })
    try {
      const sequences = await client.sequences.list()
      set({ sequences, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load sequences' })
    }
  },
}))

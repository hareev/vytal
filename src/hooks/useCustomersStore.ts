import { create } from 'zustand'
import type { AccountSummary, AccountProfile, AccountIntelligence } from '@/types/customers'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'
import { generateAccountIntelligence } from '@/lib/ai/accountIntelligence'

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

interface CustomersStore {
  searchResults: AccountSummary[]
  recentAccounts: AccountSummary[]
  activeAccount: AccountProfile | null
  isSearching: boolean
  isLoadingAccount: boolean
  isAnalyzing: boolean
  error: string | null

  searchCompanies: (query: string) => Promise<void>
  loadAccount: (companySlug: string) => Promise<void>
  generateIntelligence: () => Promise<void>
  clearSearch: () => void
  setActiveAccount: (account: AccountProfile | null) => void
}

export const useCustomersStore = create<CustomersStore>((set, get) => ({
  searchResults: [],
  recentAccounts: [],
  activeAccount: null,
  isSearching: false,
  isLoadingAccount: false,
  isAnalyzing: false,
  error: null,

  searchCompanies: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] })
      return
    }
    set({ isSearching: true, error: null })
    try {
      const results = await client.customers.search(query)
      set({ searchResults: results, isSearching: false })
    } catch (err) {
      set({ isSearching: false, error: err instanceof Error ? err.message : 'Search failed' })
    }
  },

  loadAccount: async (companySlug: string) => {
    set({ isLoadingAccount: true, error: null, activeAccount: null })
    try {
      const account = await client.customers.getAccount(companySlug)
      set({ activeAccount: account, isLoadingAccount: false })

      // Track in recents (deduplicated, capped at 5)
      const summary: AccountSummary = {
        companySlug: account.companySlug,
        companyName: account.companyName,
        contactCount: account.contacts.length,
        dealCount: account.deals.length,
        openDealValue: account.deals.filter((d) => d.status === 'open').reduce((sum, d) => sum + d.value, 0),
        primaryStatus: account.contacts[0]?.status ?? 'lead',
      }
      set((state) => ({
        recentAccounts: [
          summary,
          ...state.recentAccounts.filter((r) => r.companySlug !== companySlug),
        ].slice(0, 5),
      }))
    } catch (err) {
      set({ isLoadingAccount: false, error: err instanceof Error ? err.message : 'Failed to load account' })
    }
  },

  generateIntelligence: async () => {
    const { activeAccount } = get()
    if (!activeAccount) return
    set({ isAnalyzing: true, error: null })
    try {
      const intelligence: AccountIntelligence = await generateAccountIntelligence(activeAccount)
      set((state) => ({
        isAnalyzing: false,
        activeAccount: state.activeAccount
          ? { ...state.activeAccount, intelligence }
          : null,
      }))
    } catch (err) {
      set({ isAnalyzing: false, error: err instanceof Error ? err.message : 'Intelligence generation failed' })
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  setActiveAccount: (account) => set({ activeAccount: account }),
}))

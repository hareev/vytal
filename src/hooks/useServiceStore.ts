import { create } from 'zustand'
import type { Ticket, TicketMessage } from '@/types/service'
import type { ListParams } from '@/lib/api/client'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface ServiceStore {
  tickets: Ticket[]
  isLoading: boolean
  error: string | null

  loadTickets: (params?: ListParams) => Promise<void>
  createTicket: (data: Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) => Promise<Ticket>
  updateTicket: (id: string, data: Partial<Omit<Ticket, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>) => Promise<void>
  addMessage: (ticketId: string, body: string, isInternal: boolean) => Promise<TicketMessage>
  closeTicket: (id: string) => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useServiceStore = create<ServiceStore>((set, get) => ({
  tickets: [],
  isLoading: false,
  error: null,

  loadTickets: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const tickets = await client.tickets.list(params)
      set({ tickets, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load tickets' })
    }
  },

  createTicket: async (data) => {
    const ticket = await client.tickets.create(data)
    set((state) => ({ tickets: [...state.tickets, ticket] }))
    return ticket
  },

  updateTicket: async (id, data) => {
    const updated = await client.tickets.update(id, data)
    set((state) => ({
      tickets: state.tickets.map((t) => (t.id === id ? updated : t)),
    }))
  },

  addMessage: async (ticketId, body, isInternal) => {
    const msg = await client.tickets.addMessage(ticketId, body, isInternal)
    set((state) => ({
      tickets: state.tickets.map((t) => {
        if (t.id !== ticketId) return t
        return { ...t, messages: [...(t.messages ?? []), msg], updatedAt: new Date() }
      }),
    }))
    return msg
  },

  closeTicket: async (id) => {
    await get().updateTicket(id, { status: 'closed', resolvedAt: new Date() })
  },
}))

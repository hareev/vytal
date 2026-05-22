import { create } from 'zustand'
import type { ChannelCapture, ChannelType, CaptureStatus, CaptureMetadata } from '@/types/captures'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface CaptureStore {
  captures: ChannelCapture[]
  activeCapture: ChannelCapture | null
  isLoading: boolean
  isProcessing: boolean
  error: string | null

  loadCaptures: (params?: { status?: CaptureStatus; channelType?: ChannelType }) => Promise<void>
  loadCapture: (id: string) => Promise<void>
  createCapture: (data: { channelType: ChannelType; rawContent: string; metadata?: CaptureMetadata }) => Promise<ChannelCapture>
  processCapture: (id: string) => Promise<void>
  acceptCapture: (id: string) => Promise<void>
  dismissCapture: (id: string) => Promise<void>
  setActiveCapture: (capture: ChannelCapture | null) => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useCaptureStore = create<CaptureStore>((set) => ({
  captures: [],
  activeCapture: null,
  isLoading: false,
  isProcessing: false,
  error: null,

  loadCaptures: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const captures = await client.captures.list(params)
      set({ captures, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load captures' })
    }
  },

  loadCapture: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const capture = await client.captures.get(id)
      set({ activeCapture: capture, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load capture' })
    }
  },

  createCapture: async (data) => {
    const capture = await client.captures.create(data)
    set((state) => ({ captures: [capture, ...state.captures], activeCapture: capture }))
    return capture
  },

  processCapture: async (id) => {
    set({ isProcessing: true })
    try {
      const updated = await client.captures.process(id)
      set((state) => ({
        isProcessing: false,
        captures: state.captures.map((c) => (c.id === id ? updated : c)),
        activeCapture: state.activeCapture?.id === id ? updated : state.activeCapture,
      }))
    } catch (err) {
      set({ isProcessing: false, error: err instanceof Error ? err.message : 'Failed to process capture' })
    }
  },

  acceptCapture: async (id) => {
    const updated = await client.captures.accept(id)
    set((state) => ({
      captures: state.captures.map((c) => (c.id === id ? updated : c)),
      activeCapture: state.activeCapture?.id === id ? updated : state.activeCapture,
    }))
  },

  dismissCapture: async (id) => {
    const updated = await client.captures.dismiss(id)
    set((state) => ({
      captures: state.captures.map((c) => (c.id === id ? updated : c)),
      activeCapture: state.activeCapture?.id === id ? updated : state.activeCapture,
    }))
  },

  setActiveCapture: (capture) => {
    set({ activeCapture: capture })
  },
}))

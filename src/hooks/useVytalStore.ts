import { create } from 'zustand'
import type { OrgConnection, ScoredHealthPayload, AIDiagnosis } from '@/types/health'
import type { BaseAdapter } from '@/lib/adapters'

interface VytalState {
  // Connection
  connection: OrgConnection | null
  adapter: BaseAdapter | null
  isConnecting: boolean
  connectionError: string | null

  // Health data
  healthData: ScoredHealthPayload | null
  diagnosis: AIDiagnosis | null
  isScanning: boolean
  scanError: string | null
  lastScanAt: Date | null

  // Actions
  setConnection: (conn: OrgConnection, adapter: BaseAdapter) => void
  setHealthData: (data: ScoredHealthPayload) => void
  setDiagnosis: (diag: AIDiagnosis) => void
  setScanning: (v: boolean, error?: string) => void
  setConnecting: (v: boolean, error?: string) => void
  disconnect: () => void
}

export const useVytalStore = create<VytalState>((set) => ({
  connection: null,
  adapter: null,
  isConnecting: false,
  connectionError: null,

  healthData: null,
  diagnosis: null,
  isScanning: false,
  scanError: null,
  lastScanAt: null,

  setConnection: (conn, adapter) =>
    set({ connection: conn, adapter, connectionError: null, isConnecting: false }),

  setHealthData: (data) =>
    set({ healthData: data, isScanning: false, scanError: null, lastScanAt: new Date() }),

  setDiagnosis: (diag) =>
    set({ diagnosis: diag }),

  setScanning: (v, error) =>
    set({ isScanning: v, scanError: error ?? null }),

  setConnecting: (v, error) =>
    set({ isConnecting: v, connectionError: error ?? null }),

  disconnect: () =>
    set({
      connection: null,
      adapter: null,
      healthData: null,
      diagnosis: null,
      connectionError: null,
      scanError: null,
      lastScanAt: null,
    }),
}))

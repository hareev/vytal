import { useVytalStore } from './useVytalStore'
import { createAdapter } from '@/lib/adapters'
import { scoreHealthPayload } from '@/lib/scoring/engine'
import { generateDiagnosis } from '@/lib/ai/triage'
import type { OrgConnection, RawHealthPayload } from '@/types/health'

const API_BASE =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  'http://localhost:3001/api'

export function useScan() {
  const store = useVytalStore()

  async function connect(
    platform: OrgConnection['platform'],
    credentials: Record<string, string>
  ) {
    store.setConnecting(true)
    try {
      if (platform === 'dynamics365') {
        // Azure AD and Dataverse block browser CORS — proxy through backend
        const token = localStorage.getItem('vytal_token')
        const res = await fetch(`${API_BASE}/health/d365/scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(credentials),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
          throw new Error(body.error ?? `Scan failed (${res.status})`)
        }

        const { connection, payload } = await res.json() as {
          connection: Omit<OrgConnection, 'connectedAt'> & { connectedAt: string }
          payload: RawHealthPayload
        }

        const conn: OrgConnection = {
          ...connection,
          connectedAt: new Date(connection.connectedAt),
        }

        // No client-side adapter — health data already fetched server-side
        store.setConnection(conn, null)

        const scored = scoreHealthPayload({ ...payload, connection: conn })
        store.setHealthData(scored)

        generateDiagnosis(scored)
          .then(diag => store.setDiagnosis(diag))
          .catch(err => console.warn('AI diagnosis failed:', err))

        return
      }

      // Other platforms: client-side adapters
      const adapter = createAdapter(platform)
      const conn = await adapter.connect(credentials)
      store.setConnection(conn, adapter)
    } catch (e) {
      store.setConnecting(false, (e as Error).message)
      throw e
    }
  }

  async function scan() {
    const { adapter, healthData } = store

    // D365 via backend proxy: health data already stored during connect()
    if (!adapter && healthData) return healthData

    if (!adapter) throw new Error('Not connected')

    store.setScanning(true)
    try {
      const raw = await adapter.fetchHealthPayload()
      const scored = scoreHealthPayload(raw)
      store.setHealthData(scored)

      generateDiagnosis(scored)
        .then(diag => store.setDiagnosis(diag))
        .catch(err => console.warn('AI diagnosis failed:', err))

      return scored
    } catch (e) {
      store.setScanning(false, (e as Error).message)
      throw e
    }
  }

  return {
    connect,
    scan,
    disconnect: store.disconnect,
    isConnecting: store.isConnecting,
    isScanning: store.isScanning,
    connectionError: store.connectionError,
    scanError: store.scanError,
  }
}

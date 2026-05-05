import { useVytalStore } from './useVytalStore'
import { createAdapter } from '@/lib/adapters'
import { scoreHealthPayload } from '@/lib/scoring/engine'
import { generateDiagnosis } from '@/lib/ai/triage'
import type { OrgConnection } from '@/types/health'

/**
 * useScan — top-level hook that drives a full health scan.
 *
 * Usage:
 *   const { connect, scan } = useScan()
 *   await connect('dynamics365', credentials)
 *   await scan()
 */
export function useScan() {
  const store = useVytalStore()

  async function connect(
    platform: OrgConnection['platform'],
    credentials: Record<string, string>
  ) {
    store.setConnecting(true)
    try {
      const adapter = createAdapter(platform)
      const conn = await adapter.connect(credentials)
      store.setConnection(conn, adapter)
    } catch (e) {
      store.setConnecting(false, (e as Error).message)
      throw e
    }
  }

  async function scan() {
    const { adapter } = store
    if (!adapter) throw new Error('Not connected')

    store.setScanning(true)
    try {
      // 1. Fetch raw telemetry from the CRM
      const raw = await adapter.fetchHealthPayload()

      // 2. Score through the platform-agnostic engine
      const scored = scoreHealthPayload(raw)
      store.setHealthData(scored)

      // 3. Get AI diagnosis (non-blocking — update when ready)
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

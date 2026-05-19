import { D365Adapter } from './d365'
import { SalesforceAdapter } from './salesforce'
import { HubSpotAdapter } from './hubspot'
import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection } from '@/types/health'

export { D365Adapter, SalesforceAdapter, HubSpotAdapter }
export type { BaseAdapter, AdapterManifest }

// Registry of all available adapter manifests (for rendering connect UI)
export const ADAPTER_MANIFESTS: Record<OrgConnection['platform'], AdapterManifest> = {
  dynamics365: D365Adapter.manifest,
  salesforce: SalesforceAdapter.manifest,
  siebel: {
    platform: 'siebel',
    name: 'Oracle Siebel',
    credentialFields: [
      { key: 'baseUrl', label: 'Siebel Base URL', type: 'url', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  hubspot: HubSpotAdapter.manifest,
  custom: {
    platform: 'custom',
    name: 'Custom CRM',
    credentialFields: [
      { key: 'baseUrl', label: 'API Base URL', type: 'url', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
}

// Factory: instantiate the right adapter for a given platform
export function createAdapter(platform: OrgConnection['platform']): BaseAdapter {
  switch (platform) {
    case 'dynamics365': return new D365Adapter()
    case 'salesforce': return new SalesforceAdapter()
    case 'hubspot': return new HubSpotAdapter()
    default:
      throw new Error(`Adapter for platform '${platform}' not yet implemented. Contribute one at github.com/hareev/vytal!`)
  }
}

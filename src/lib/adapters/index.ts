import { D365Adapter } from './d365'
import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection } from '@/types/health'

export { D365Adapter }
export type { BaseAdapter, AdapterManifest }

// Registry of all available adapter manifests (for rendering connect UI)
export const ADAPTER_MANIFESTS: Record<OrgConnection['platform'], AdapterManifest> = {
  dynamics365: D365Adapter.manifest,
  salesforce: {
    platform: 'salesforce',
    name: 'Salesforce',
    credentialFields: [
      { key: 'instanceUrl', label: 'Instance URL', type: 'url', placeholder: 'https://yourorg.salesforce.com', required: true },
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true, helpText: 'From a Connected App OAuth flow' },
    ],
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
  },
  siebel: {
    platform: 'siebel',
    name: 'Oracle Siebel',
    credentialFields: [
      { key: 'baseUrl', label: 'Siebel Base URL', type: 'url', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  hubspot: {
    platform: 'hubspot',
    name: 'HubSpot',
    credentialFields: [
      { key: 'accessToken', label: 'Private App Token', type: 'password', required: true },
    ],
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
  },
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
    default:
      throw new Error(`Adapter for platform '${platform}' not yet implemented. Contribute one at github.com/hareev/vytal!`)
  }
}

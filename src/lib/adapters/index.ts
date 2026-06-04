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
  hubspot: HubSpotAdapter.manifest,
  zoho: {
    platform: 'zoho',
    name: 'Zoho CRM',
    credentialFields: [
      { key: 'instanceUrl', label: 'API Base URL', type: 'url', placeholder: 'https://www.zohoapis.com', required: true },
      { key: 'accessToken', label: 'OAuth Access Token', type: 'password', required: true, helpText: 'Generated via Zoho OAuth 2.0 — requires ZohoCRM.modules.* scope' },
    ],
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6/',
  },
  sugarcrm: {
    platform: 'sugarcrm',
    name: 'SugarCRM',
    credentialFields: [
      { key: 'instanceUrl', label: 'Instance URL', type: 'url', placeholder: 'https://yourorg.sugarondemand.com', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
    docsUrl: 'https://support.sugarcrm.com/Documentation/Sugar_Developer/Sugar_Developer_Guide/Integration/Web_Services/REST_API/',
  },
  pega: {
    platform: 'pega',
    name: 'Pega CRM',
    credentialFields: [
      { key: 'instanceUrl', label: 'Pega Instance URL', type: 'url', placeholder: 'https://yourorg.pega.com', required: true },
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'OAuth Client Secret', type: 'password', required: true, helpText: 'From a Pega OAuth 2.0 registration' },
    ],
    docsUrl: 'https://docs.pega.com/bundle/platform/page/platform/integration/pega-api-overview.html',
  },
  freshsales: {
    platform: 'freshsales',
    name: 'Freshsales',
    credentialFields: [
      { key: 'domain', label: 'Freshsales Domain', type: 'text', placeholder: 'yourcompany.myfreshworks.com', required: true },
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, helpText: 'Found in Profile Settings → API Settings' },
    ],
    docsUrl: 'https://developer.freshworks.com/crm/api/',
  },
  pipedrive: {
    platform: 'pipedrive',
    name: 'Pipedrive',
    credentialFields: [
      { key: 'apiToken', label: 'API Token', type: 'password', required: true, helpText: 'Found in Settings → Personal Preferences → API' },
    ],
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
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
    case 'salesforce': return new SalesforceAdapter()
    case 'hubspot': return new HubSpotAdapter()
    default:
      throw new Error(`Adapter for platform '${platform}' not yet implemented. Contribute one at github.com/hareev/vytal!`)
  }
}

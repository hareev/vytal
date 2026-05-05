import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection, RawHealthPayload } from '@/types/health'

/**
 * D365Adapter — Dynamics 365 / Dataverse connector
 *
 * Uses:
 *   - Dataverse Web API (OData v4) for schema and record queries
 *   - Power Platform Admin API for flow and adoption telemetry
 *
 * Auth: OAuth 2.0 via MSAL (client credentials or user delegated)
 * Required credentials: tenantId, clientId, clientSecret, orgUrl
 */
export class D365Adapter implements BaseAdapter {
  readonly name = 'Dynamics 365 / Dataverse'
  readonly platform = 'dynamics365' as const

  private orgUrl = ''
  private accessToken = ''
  private orgId = ''

  // ─── Manifest (used to render the connect form) ──────────────────────────

  static manifest: AdapterManifest = {
    platform: 'dynamics365',
    name: 'Dynamics 365 / Dataverse',
    credentialFields: [
      {
        key: 'orgUrl',
        label: 'Org URL',
        type: 'url',
        placeholder: 'https://yourorg.crm.dynamics.com',
        required: true,
        helpText: 'Your Dataverse environment URL',
      },
      {
        key: 'tenantId',
        label: 'Azure Tenant ID',
        type: 'text',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        required: true,
      },
      {
        key: 'clientId',
        label: 'App Registration Client ID',
        type: 'text',
        required: true,
        helpText: 'Azure AD app with Dataverse user_impersonation scope',
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
    ],
    docsUrl: 'https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview',
  }

  // ─── Connect ─────────────────────────────────────────────────────────────

  async connect(credentials: Record<string, string>): Promise<OrgConnection> {
    const { orgUrl, tenantId, clientId, clientSecret } = credentials

    // Acquire OAuth token from Azure AD
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: `${orgUrl}/.default`,
        }),
      }
    )

    if (!tokenRes.ok) {
      throw new Error(`Auth failed: ${tokenRes.statusText}`)
    }

    const token = await tokenRes.json()
    this.accessToken = token.access_token
    this.orgUrl = orgUrl.replace(/\/$/, '')

    // Fetch org metadata to confirm connection
    const meta = await this.apiGet<{ value: Array<{ UniqueName: string; OrganizationId: string }> }>(
      '/api/data/v9.2/organizations?$select=UniqueName,OrganizationId'
    )

    const org = meta.value[0]
    this.orgId = org.OrganizationId

    return {
      id: org.OrganizationId,
      platform: 'dynamics365',
      orgName: org.UniqueName,
      orgUrl: this.orgUrl,
      connectedAt: new Date(),
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.apiGet('/api/data/v9.2/$metadata')
      return true
    } catch {
      return false
    }
  }

  // ─── Fetch health payload ─────────────────────────────────────────────────

  async fetchHealthPayload(): Promise<RawHealthPayload> {
    const [
      entityMeta,
      flowData,
      userStats,
      duplicateRules,
    ] = await Promise.all([
      this.fetchEntityMetadata(),
      this.fetchFlowData(),
      this.fetchUserStats(),
      this.fetchDuplicateRules(),
    ])

    return {
      connection: {
        id: this.orgId,
        platform: 'dynamics365',
        orgName: '',
        orgUrl: this.orgUrl,
        connectedAt: new Date(),
      },
      schema: entityMeta,
      automation: flowData,
      dataQuality: duplicateRules,
      security: userStats.security,
      adoption: userStats.adoption,
    }
  }

  // ─── Schema metadata ──────────────────────────────────────────────────────

  private async fetchEntityMetadata(): Promise<RawHealthPayload['schema']> {
    // EntityDefinitions gives us all entities + customisation status
    const entities = await this.apiGet<{
      value: Array<{
        IsCustomEntity: boolean
        LogicalName: string
        IsActivity: boolean
        IsValidForAdvancedFind: boolean
      }>
    }>('/api/data/v9.2/EntityDefinitions?$select=IsCustomEntity,LogicalName,IsActivity,IsValidForAdvancedFind')

    const total = entities.value.length
    const custom = entities.value.filter(e => e.IsCustomEntity).length

    // Heuristic: entities with no IsValidForAdvancedFind are often abandoned
    const unused = entities.value.filter(e => e.IsCustomEntity && !e.IsValidForAdvancedFind).length

    return {
      totalEntities: total,
      customEntities: custom,
      unusedEntities: unused,
      totalFields: 0,         // populated in full version via AttributeDefinitions
      unusedFields: 0,
      deprecatedObjects: 0,
      namingViolations: 0,
    }
  }

  // ─── Flow / automation data ───────────────────────────────────────────────

  private async fetchFlowData(): Promise<RawHealthPayload['automation']> {
    // Workflows table covers both classic workflows and Power Automate cloud flows
    const flows = await this.apiGet<{
      value: Array<{
        statecode: number
        category: number
        name: string
        clientdata?: string
      }>
    }>('/api/data/v9.2/workflows?$select=statecode,category,name&$filter=category eq 5 or category eq 6')

    const total = flows.value.length
    const active = flows.value.filter(f => f.statecode === 1).length
    const inactive = total - active

    return {
      totalFlows: total,
      activeFlows: active,
      inactiveFlows: inactive,
      circularDependencies: 0,         // deep analysis — phase 2
      maxNestingDepth: 0,
      flowsWithoutErrorHandling: 0,
      deprecatedApiCalls: 0,
    }
  }

  // ─── User and security stats ──────────────────────────────────────────────

  private async fetchUserStats(): Promise<{
    security: RawHealthPayload['security']
    adoption: RawHealthPayload['adoption']
  }> {
    const users = await this.apiGet<{
      value: Array<{
        isdisabled: boolean
        accessmode: number
        islicensed: boolean
      }>
    }>('/api/data/v9.2/systemusers?$select=isdisabled,accessmode,islicensed&$filter=accessmode ne 4')

    const total = users.value.length
    const licensed = users.value.filter(u => u.islicensed && !u.isdisabled).length

    return {
      security: {
        totalUsers: total,
        adminUsers: 0,              // requires role query — phase 2
        dormantAdmins: 0,
        usersWithoutMFA: 0,         // requires Azure AD — phase 2
        rolesWithExcessivePrivilege: 0,
        auditLogEnabled: false,     // check via organization settings
      },
      adoption: {
        monthlyActiveUsers: licensed,
        totalLicensedUsers: licensed,
        featureUtilisationPct: 0,
        automationsPerActiveUser: 0,
        recentCustomisations30d: 0,
      },
    }
  }

  // ─── Duplicate rules ──────────────────────────────────────────────────────

  private async fetchDuplicateRules(): Promise<RawHealthPayload['dataQuality']> {
    const rules = await this.apiGet<{ value: Array<{ statecode: number }> }>(
      '/api/data/v9.2/duplicaterules?$select=statecode'
    )
    const activeRules = rules.value.filter(r => r.statecode === 1).length

    return {
      totalRecordsSampled: 0,
      duplicateCount: 0,
      incompleteRequiredFields: 0,
      staleRecords30d: 0,
      staleRecords90d: 0,
      // activeRules is surfaced as an issue in the scoring engine
      _activeDuplicateRules: activeRules,
    } as RawHealthPayload['dataQuality'] & { _activeDuplicateRules: number }
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.orgUrl = ''
    this.orgId = ''
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  private async apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.orgUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    })

    if (!res.ok) {
      throw new Error(`Dataverse API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  }
}

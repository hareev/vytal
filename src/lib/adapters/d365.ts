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
  private tenantId = ''
  private clientId = ''
  private clientSecret = ''

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
    this.tenantId = tenantId
    this.clientId = clientId
    this.clientSecret = clientSecret

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
      auditLogEnabled,
    ] = await Promise.all([
      this.fetchEntityMetadata(),
      this.fetchFlowData(),
      this.fetchUserStats(),
      this.fetchDuplicateRules(),
      this.fetchAuditLogStatus(),
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
      security: { ...userStats.security, auditLogEnabled },
      adoption: userStats.adoption,
    }
  }

  // ─── Schema metadata ──────────────────────────────────────────────────────

  private async fetchEntityMetadata(): Promise<RawHealthPayload['schema']> {
    const entities = await this.apiGet<{
      value: Array<{
        IsCustomEntity: boolean
        LogicalName: string
        IsActivity: boolean
        IsValidForAdvancedFind: boolean
      }>
    }>('/api/data/v9.2/EntityDefinitions?$select=IsCustomEntity,LogicalName,IsActivity,IsValidForAdvancedFind')

    const total = entities.value.length
    const customEntityList = entities.value.filter(e => e.IsCustomEntity)
    const custom = customEntityList.length
    const unused = customEntityList.filter(e => !e.IsValidForAdvancedFind).length

    const { totalFields, unusedFields } = await this.fetchFieldCounts(
      customEntityList.map(e => e.LogicalName).slice(0, 20)
    )

    return {
      totalEntities: total,
      customEntities: custom,
      unusedEntities: unused,
      totalFields,
      unusedFields,
      deprecatedObjects: 0,
      namingViolations: 0,
    }
  }

  private async fetchFieldCounts(entityNames: string[]): Promise<{ totalFields: number; unusedFields: number }> {
    if (entityNames.length === 0) return { totalFields: 0, unusedFields: 0 }

    type CountResponse = { '@odata.count': number; value: unknown[] }

    const results = await Promise.all(
      entityNames.map(async (name) => {
        try {
          const [totalRes, unusedRes] = await Promise.all([
            this.apiGet<CountResponse>(
              `/api/data/v9.2/EntityDefinitions(LogicalName='${name}')/Attributes?$select=LogicalName&$count=true&$top=0`
            ),
            this.apiGet<CountResponse>(
              `/api/data/v9.2/EntityDefinitions(LogicalName='${name}')/Attributes?$select=LogicalName&$filter=IsValidForAdvancedFind eq false&$count=true&$top=0`
            ),
          ])
          return {
            total: totalRes['@odata.count'] ?? 0,
            unused: unusedRes['@odata.count'] ?? 0,
          }
        } catch {
          return { total: 0, unused: 0 }
        }
      })
    )

    return {
      totalFields: results.reduce((sum, r) => sum + r.total, 0),
      unusedFields: results.reduce((sum, r) => sum + r.unused, 0),
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
    const [users, adminStats, mfaCount] = await Promise.all([
      this.apiGet<{
        value: Array<{
          isdisabled: boolean
          accessmode: number
          islicensed: boolean
        }>
      }>('/api/data/v9.2/systemusers?$select=isdisabled,accessmode,islicensed&$filter=accessmode ne 4'),
      this.fetchAdminStats(),
      this.fetchMFACount().catch(() => 0),
    ])

    const total = users.value.length
    const licensed = users.value.filter(u => u.islicensed && !u.isdisabled).length

    return {
      security: {
        totalUsers: total,
        adminUsers: adminStats.adminCount,
        dormantAdmins: adminStats.dormantAdmins,
        usersWithoutMFA: mfaCount,
        rolesWithExcessivePrivilege: 0,
        auditLogEnabled: false,
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

  private async fetchAdminStats(): Promise<{ adminCount: number; dormantAdmins: number }> {
    try {
      const roleRes = await this.apiGet<{ value: Array<{ roleid: string }> }>(
        `/api/data/v9.2/roles?$select=roleid&$filter=name eq 'System Administrator'&$top=1`
      )
      if (roleRes.value.length === 0) return { adminCount: 0, dormantAdmins: 0 }
      const roleId = roleRes.value[0].roleid

      const adminUsers = await this.apiGet<{
        value: Array<{ systemuserid: string; lastloggedin: string | null }>
      }>(
        `/api/data/v9.2/systemusers?$select=systemuserid,lastloggedin&$filter=systemuserroles_association/any(r: r/roleid eq ${roleId}) and accessmode ne 4`
      )

      const now = Date.now()
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const dormantAdmins = adminUsers.value.filter(u => {
        const lastLogin = u.lastloggedin ? new Date(u.lastloggedin).getTime() : 0
        return now - lastLogin > ninetyDaysMs
      }).length

      return { adminCount: adminUsers.value.length, dormantAdmins }
    } catch {
      return { adminCount: 0, dormantAdmins: 0 }
    }
  }

  private async fetchAuditLogStatus(): Promise<boolean> {
    try {
      const res = await this.apiGet<{ value: Array<{ isauditenabled: boolean }> }>(
        '/api/data/v9.2/organizations?$select=isauditenabled'
      )
      return res.value[0]?.isauditenabled ?? false
    } catch {
      return false
    }
  }

  private async getGraphToken(): Promise<string> {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )
    if (!tokenRes.ok) throw new Error('Graph token acquisition failed')
    const token = await tokenRes.json() as { access_token: string }
    return token.access_token
  }

  private async fetchMFACount(): Promise<number> {
    const graphToken = await this.getGraphToken()
    const res = await fetch(
      'https://graph.microsoft.com/v1.0/reports/credentialUserRegistrationDetails',
      {
        headers: {
          Authorization: `Bearer ${graphToken}`,
          Accept: 'application/json',
        },
      }
    )
    if (!res.ok) throw new Error(`Graph MFA report error ${res.status}`)
    const data = await res.json() as { value: Array<{ isMfaRegistered: boolean }> }
    return data.value.filter(u => !u.isMfaRegistered).length
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
    this.tenantId = ''
    this.clientId = ''
    this.clientSecret = ''
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

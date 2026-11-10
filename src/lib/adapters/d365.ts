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

    const { totalFields, unusedFields } = await this.fetchFieldCounts(
      customEntityList.map(e => e.LogicalName).slice(0, 20)
    )

    return {
      totalEntities: total,
      customEntities: custom,
      // IsValidForAdvancedFind says whether a table shows in Advanced Find, not
      // whether it is used, so "unused" is not measured until record counts or
      // form/flow references are checked.
      unusedEntities: null,
      totalFields,
      unusedFields,
      deprecatedObjects: null,
      namingViolations: null,
    }
  }

  private async fetchFieldCounts(entityNames: string[]): Promise<{ totalFields: number | null; unusedFields: number | null }> {
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
          return null
        }
      })
    )

    // If any table could not be read, the totals are incomplete: report them as not measured.
    if (results.some(r => r === null)) return { totalFields: null, unusedFields: null }
    const counted = results as Array<{ total: number; unused: number }>

    return {
      totalFields: counted.reduce((sum, r) => sum + r.total, 0),
      unusedFields: counted.reduce((sum, r) => sum + r.unused, 0),
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
      circularDependencies: null,      // deep analysis — phase 2
      maxNestingDepth: null,
      flowsWithoutErrorHandling: null,
      deprecatedApiCalls: null,
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
      this.fetchMFACount().catch(() => null),
    ])

    const total = users.value.length
    const licensed = users.value.filter(u => u.islicensed && !u.isdisabled).length

    return {
      security: {
        totalUsers: total,
        adminUsers: adminStats.adminCount,
        dormantAdmins: adminStats.dormantAdmins,
        usersWithoutMFA: mfaCount,
        rolesWithExcessivePrivilege: null,
        auditLogEnabled: null, // filled from fetchAuditLogStatus()
      },
      adoption: {
        // Monthly active users needs sign-in or audit data; licensed is not active.
        monthlyActiveUsers: null,
        totalLicensedUsers: licensed,
        featureUtilisationPct: null,
        automationsPerActiveUser: null,
        recentCustomisations30d: null,
      },
    }
  }

  private async fetchAdminStats(): Promise<{ adminCount: number | null; dormantAdmins: number | null }> {
    // Dormancy needs each admin's last sign-in. Dataverse's systemuser table
    // does not expose one; it has to come from Microsoft Graph signInActivity
    // (Entra ID P1/P2), so dormant admins are not measured here.
    try {
      const roleRes = await this.apiGet<{ value: Array<{ roleid: string }> }>(
        `/api/data/v9.2/roles?$select=roleid&$filter=name eq 'System Administrator'&$top=1`
      )
      if (roleRes.value.length === 0) return { adminCount: null, dormantAdmins: null }
      const roleId = roleRes.value[0].roleid

      const adminUsers = await this.apiGet<{ value: Array<{ systemuserid: string }> }>(
        `/api/data/v9.2/systemusers?$select=systemuserid&$filter=systemuserroles_association/any(r: r/roleid eq ${roleId}) and accessmode ne 4`
      )

      return { adminCount: adminUsers.value.length, dormantAdmins: null }
    } catch {
      return { adminCount: null, dormantAdmins: null }
    }
  }

  private async fetchAuditLogStatus(): Promise<boolean | null> {
    try {
      const res = await this.apiGet<{ value: Array<{ isauditenabled: boolean }> }>(
        '/api/data/v9.2/organizations?$select=isauditenabled'
      )
      const enabled = res.value[0]?.isauditenabled
      return typeof enabled === 'boolean' ? enabled : null
    } catch {
      return null
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

    // Record sampling is not implemented yet, so every data quality metric is
    // not measured (rather than a perfect 0).
    return {
      totalRecordsSampled: null,
      duplicateCount: null,
      incompleteRequiredFields: null,
      staleRecords30d: null,
      staleRecords90d: null,
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

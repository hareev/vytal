import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection, RawHealthPayload } from '@/types/health'

export class SalesforceAdapter implements BaseAdapter {
  readonly name = 'Salesforce'
  readonly platform = 'salesforce' as const

  private instanceUrl = ''
  private accessToken = ''
  private orgId = ''

  static manifest: AdapterManifest = {
    platform: 'salesforce',
    name: 'Salesforce',
    credentialFields: [
      {
        key: 'instanceUrl',
        label: 'Instance URL',
        type: 'url',
        placeholder: 'https://yourorg.salesforce.com',
        required: true,
        helpText: 'Your Salesforce org instance URL',
      },
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        required: true,
        helpText: 'From a Connected App OAuth flow',
      },
    ],
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
  }

  async connect(credentials: Record<string, string>): Promise<OrgConnection> {
    const { instanceUrl, accessToken } = credentials
    this.instanceUrl = instanceUrl.replace(/\/$/, '')
    this.accessToken = accessToken

    const identity = await this.apiGet<{ organization_id: string; display_name?: string; username?: string }>(
      '/services/oauth2/userinfo'
    )

    this.orgId = identity.organization_id

    return {
      id: identity.organization_id,
      platform: 'salesforce',
      orgName: identity.display_name ?? identity.username ?? identity.organization_id,
      orgUrl: this.instanceUrl,
      connectedAt: new Date(),
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.apiGet<unknown>('/services/data/v59.0/')
      return true
    } catch {
      return false
    }
  }

  async fetchHealthPayload(): Promise<RawHealthPayload> {
    const [schema, automation, dataQuality, security] = await Promise.all([
      this.fetchSchema(),
      this.fetchAutomation(),
      this.fetchDataQuality(),
      this.fetchSecurityAndAdoption(),
    ])

    return {
      connection: {
        id: this.orgId,
        platform: 'salesforce',
        orgName: '',
        orgUrl: this.instanceUrl,
        connectedAt: new Date(),
      },
      schema,
      automation,
      dataQuality,
      security: security.security,
      adoption: security.adoption,
    }
  }

  private async fetchSchema(): Promise<RawHealthPayload['schema']> {
    try {
      const result = await this.apiGet<{
        records: Array<{
          DeveloperName: string
          QualifiedApiName: string
        }>
        totalSize: number
      }>(
        '/services/data/v59.0/tooling/query?q=SELECT+DeveloperName,QualifiedApiName+FROM+CustomObject'
      )

      // This query returns custom objects only, so it can't give the total
      // object count (standard + custom). The custom ratio is not measured
      // until standard objects are counted too (e.g. via EntityDefinition).
      const custom = result.totalSize

      const fieldResult = await this.apiGet<{ totalSize: number }>(
        '/services/data/v59.0/tooling/query?q=SELECT+COUNT()+FROM+CustomField'
      ).catch(() => null)

      return {
        totalEntities: null,
        customEntities: custom,
        unusedEntities: null,
        totalFields: fieldResult ? fieldResult.totalSize : null,
        unusedFields: null,
        deprecatedObjects: null,
        // The previous PascalCase-only rule flagged Salesforce's own
        // underscore convention; not measured until a real naming policy is set.
        namingViolations: null,
      }
    } catch {
      return {
        totalEntities: null,
        customEntities: null,
        unusedEntities: null,
        totalFields: null,
        unusedFields: null,
        deprecatedObjects: null,
        namingViolations: null,
      }
    }
  }

  private async fetchAutomation(): Promise<RawHealthPayload['automation']> {
    try {
      const result = await this.apiGet<{
        records: Array<{
          Status: string
          ApiVersion: number
        }>
        totalSize: number
      }>(
        '/services/data/v59.0/tooling/query?q=SELECT+Status,ApiVersion+FROM+Flow'
      )

      // Tooling API Flow rows are flow versions, not flows, so these counts
      // are approximate until versions are grouped by FlowDefinition.
      const total = result.totalSize
      const active = result.records.filter(f => f.Status === 'Active').length
      const inactive = total - active

      return {
        totalFlows: total,
        activeFlows: active,
        inactiveFlows: inactive,
        circularDependencies: null,
        maxNestingDepth: null,
        flowsWithoutErrorHandling: null,
        // An old ApiVersion on a flow version is not a deprecated API call.
        deprecatedApiCalls: null,
      }
    } catch {
      return {
        totalFlows: null,
        activeFlows: null,
        inactiveFlows: null,
        circularDependencies: null,
        maxNestingDepth: null,
        flowsWithoutErrorHandling: null,
        deprecatedApiCalls: null,
      }
    }
  }

  private async fetchDataQuality(): Promise<RawHealthPayload['dataQuality']> {
    // Duplicate rules are configuration, not records: counting them says
    // nothing about duplicate records. Data quality is not measured until
    // records are sampled.
    return {
      totalRecordsSampled: null,
      duplicateCount: null,
      incompleteRequiredFields: null,
      staleRecords30d: null,
      staleRecords90d: null,
    }
  }

  private async fetchSecurityAndAdoption(): Promise<{
    security: RawHealthPayload['security']
    adoption: RawHealthPayload['adoption']
  }> {
    try {
      const usersResult = await this.apiGet<{
        records: Array<{
          IsActive: boolean
          Profile: { Name: string } | null
          LastLoginDate: string | null
        }>
        totalSize: number
      }>(
        '/services/data/v59.0/query?q=SELECT+IsActive,Profile.Name,LastLoginDate+FROM+User'
      )

      const total = usersResult.totalSize
      const now = Date.now()
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      const adminUsers = usersResult.records.filter(
        u => u.Profile?.Name === 'System Administrator'
      ).length

      const dormantAdmins = usersResult.records.filter(u => {
        const isAdmin = u.Profile?.Name === 'System Administrator'
        const lastLogin = u.LastLoginDate ? new Date(u.LastLoginDate).getTime() : 0
        return isAdmin && now - lastLogin > ninetyDaysMs
      }).length

      const activeUsers = usersResult.records.filter(u => {
        if (!u.IsActive) return false
        const lastLogin = u.LastLoginDate ? new Date(u.LastLoginDate).getTime() : 0
        return now - lastLogin <= thirtyDaysMs
      }).length

      const licensed = usersResult.records.filter(u => u.IsActive).length

      return {
        security: {
          totalUsers: total,
          adminUsers,
          dormantAdmins,
          usersWithoutMFA: null,
          // The count of all profiles and permission sets is not a count of
          // over-privileged ones.
          rolesWithExcessivePrivilege: null,
          // Setup Audit Trail is always on in Salesforce; field history and
          // event monitoring aren't checked yet.
          auditLogEnabled: null,
        },
        adoption: {
          monthlyActiveUsers: activeUsers,
          totalLicensedUsers: licensed,
          // Active ÷ licensed is already scored above; it is not feature use.
          featureUtilisationPct: null,
          automationsPerActiveUser: null,
          recentCustomisations30d: null,
        },
      }
    } catch {
      return {
        security: {
          totalUsers: null,
          adminUsers: null,
          dormantAdmins: null,
          usersWithoutMFA: null,
          rolesWithExcessivePrivilege: null,
          auditLogEnabled: null,
        },
        adoption: {
          monthlyActiveUsers: null,
          totalLicensedUsers: null,
          featureUtilisationPct: null,
          automationsPerActiveUser: null,
          recentCustomisations30d: null,
        },
      }
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = ''
    this.instanceUrl = ''
    this.orgId = ''
  }

  private async apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${this.instanceUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`Salesforce API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  }
}

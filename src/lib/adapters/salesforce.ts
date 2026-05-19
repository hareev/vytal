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

      const total = result.totalSize
      const custom = result.records.length
      const namingViolations = result.records.filter(
        r => r.DeveloperName && !/^[A-Z][a-zA-Z0-9]*$/.test(r.DeveloperName)
      ).length

      const fieldResult = await this.apiGet<{ totalSize: number }>(
        '/services/data/v59.0/tooling/query?q=SELECT+COUNT()+FROM+CustomField'
      ).catch(() => ({ totalSize: 0 }))

      return {
        totalEntities: total,
        customEntities: custom,
        unusedEntities: 0,
        totalFields: fieldResult.totalSize,
        unusedFields: 0,
        deprecatedObjects: 0,
        namingViolations,
      }
    } catch {
      return {
        totalEntities: 0,
        customEntities: 0,
        unusedEntities: 0,
        totalFields: 0,
        unusedFields: 0,
        deprecatedObjects: 0,
        namingViolations: 0,
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

      const total = result.totalSize
      const active = result.records.filter(f => f.Status === 'Active').length
      const inactive = total - active
      const deprecatedApiCalls = result.records.filter(f => f.ApiVersion < 50).length

      return {
        totalFlows: total,
        activeFlows: active,
        inactiveFlows: inactive,
        circularDependencies: 0,
        maxNestingDepth: 0,
        flowsWithoutErrorHandling: 0,
        deprecatedApiCalls,
      }
    } catch {
      return {
        totalFlows: 0,
        activeFlows: 0,
        inactiveFlows: 0,
        circularDependencies: 0,
        maxNestingDepth: 0,
        flowsWithoutErrorHandling: 0,
        deprecatedApiCalls: 0,
      }
    }
  }

  private async fetchDataQuality(): Promise<RawHealthPayload['dataQuality']> {
    try {
      const result = await this.apiGet<{
        records: Array<{ IsActive: boolean }>
        totalSize: number
      }>(
        '/services/data/v59.0/query?q=SELECT+IsActive+FROM+DuplicateRule'
      )

      const activeRules = result.records.filter(r => r.IsActive).length
      const duplicateCount = activeRules > 0 ? 0 : result.totalSize

      return {
        totalRecordsSampled: result.totalSize,
        duplicateCount,
        incompleteRequiredFields: 0,
        staleRecords30d: 0,
        staleRecords90d: 0,
      }
    } catch {
      return {
        totalRecordsSampled: 0,
        duplicateCount: 0,
        incompleteRequiredFields: 0,
        staleRecords30d: 0,
        staleRecords90d: 0,
      }
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

      const profileResult = await this.apiGet<{ totalSize: number }>(
        '/services/data/v59.0/query?q=SELECT+COUNT()+FROM+Profile'
      ).catch(() => ({ totalSize: 0 }))

      const permSetResult = await this.apiGet<{ totalSize: number }>(
        '/services/data/v59.0/query?q=SELECT+COUNT()+FROM+PermissionSet'
      ).catch(() => ({ totalSize: 0 }))

      return {
        security: {
          totalUsers: total,
          adminUsers,
          dormantAdmins,
          usersWithoutMFA: 0,
          rolesWithExcessivePrivilege: profileResult.totalSize + permSetResult.totalSize,
          auditLogEnabled: false,
        },
        adoption: {
          monthlyActiveUsers: activeUsers,
          totalLicensedUsers: licensed,
          featureUtilisationPct: licensed > 0 ? Math.round((activeUsers / licensed) * 100) : 0,
          automationsPerActiveUser: 0,
          recentCustomisations30d: 0,
        },
      }
    } catch {
      return {
        security: {
          totalUsers: 0,
          adminUsers: 0,
          dormantAdmins: 0,
          usersWithoutMFA: 0,
          rolesWithExcessivePrivilege: 0,
          auditLogEnabled: false,
        },
        adoption: {
          monthlyActiveUsers: 0,
          totalLicensedUsers: 0,
          featureUtilisationPct: 0,
          automationsPerActiveUser: 0,
          recentCustomisations30d: 0,
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

import type { BaseAdapter, AdapterManifest } from './base'
import type { OrgConnection, RawHealthPayload } from '@/types/health'

const HUBSPOT_BASE = 'https://api.hubapi.com'

export class HubSpotAdapter implements BaseAdapter {
  readonly name = 'HubSpot'
  readonly platform = 'hubspot' as const

  private accessToken = ''
  private portalId = ''

  static manifest: AdapterManifest = {
    platform: 'hubspot',
    name: 'HubSpot',
    credentialFields: [
      {
        key: 'accessToken',
        label: 'Private App Token',
        type: 'password',
        required: true,
        helpText: 'Private App access token from HubSpot developer settings',
      },
    ],
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
  }

  async connect(credentials: Record<string, string>): Promise<OrgConnection> {
    this.accessToken = credentials['accessToken'] ?? ''

    const info = await this.apiGet<{
      portalId: number
      hub_domain?: string
      hub_id?: number
      app_id?: number
    }>('/oauth/v1/access-tokens/' + encodeURIComponent(this.accessToken))

    this.portalId = String(info.portalId)

    return {
      id: this.portalId,
      platform: 'hubspot',
      orgName: info.hub_domain ?? `HubSpot Portal ${this.portalId}`,
      orgUrl: `https://app.hubspot.com/contacts/${this.portalId}`,
      connectedAt: new Date(),
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.apiGet<unknown>('/oauth/v1/access-tokens/' + encodeURIComponent(this.accessToken))
      return true
    } catch {
      return false
    }
  }

  async fetchHealthPayload(): Promise<RawHealthPayload> {
    const [schema, automation, dataQuality, securityAdoption] = await Promise.all([
      this.fetchSchema(),
      this.fetchAutomation(),
      this.fetchDataQuality(),
      this.fetchSecurityAndAdoption(),
    ])

    return {
      connection: {
        id: this.portalId,
        platform: 'hubspot',
        orgName: '',
        orgUrl: `https://app.hubspot.com/contacts/${this.portalId}`,
        connectedAt: new Date(),
      },
      schema,
      automation,
      dataQuality,
      security: securityAdoption.security,
      adoption: securityAdoption.adoption,
    }
  }

  private async fetchSchema(): Promise<RawHealthPayload['schema']> {
    const objectTypes = ['contacts', 'companies', 'deals'] as const
    type PropertyRecord = { name: string; label: string; updatedAt?: string }
    type PropertiesResponse = { results: PropertyRecord[] }

    let totalFields = 0
    let unusedFields = 0
    let namingViolations = 0

    await Promise.all(
      objectTypes.map(async objectType => {
        try {
          const result = await this.apiGet<PropertiesResponse>(
            `/crm/v3/properties/${objectType}`
          )
          totalFields += result.results.length
          unusedFields += result.results.filter(
            p => !p.updatedAt || new Date(p.updatedAt).getTime() < Date.now() - 180 * 24 * 60 * 60 * 1000
          ).length
          namingViolations += result.results.filter(
            p => p.name && !/^[a-z][a-z0-9_]*$/.test(p.name)
          ).length
        } catch {
          // individual object type failure is non-fatal
        }
      })
    )

    const schemaResult = await this.apiGet<{ results: Array<{ name: string }> }>(
      '/crm/v3/schemas'
    ).catch(() => ({ results: [] as Array<{ name: string }> }))

    const customEntities = schemaResult.results.length

    return {
      totalEntities: objectTypes.length + customEntities,
      customEntities,
      unusedEntities: null,
      totalFields,
      unusedFields,
      deprecatedObjects: null,
      namingViolations,
    }
  }

  private async fetchAutomation(): Promise<RawHealthPayload['automation']> {
    try {
      const result = await this.apiGet<{
        results: Array<{ id: string; enabled: boolean }>
        total?: number
      }>('/automation/v4/flows')

      const total = result.total ?? result.results.length
      const active = result.results.filter(f => f.enabled).length
      const inactive = result.results.length - active

      return {
        totalFlows: total,
        activeFlows: active,
        inactiveFlows: inactive,
        circularDependencies: null,
        maxNestingDepth: null,
        flowsWithoutErrorHandling: null,
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
    // The previous check read a single contact (limit=1), so "incomplete
    // fields" could only ever be 0% or 100%, and duplicates were never looked
    // at. Data quality is not measured until a real sample is read.
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
      const result = await this.apiGet<{
        results: Array<{
          id: number
          email: string
          roleIds?: number[]
          superAdmin?: boolean
          lastLogin?: string
          active?: boolean
        }>
        total?: number
      }>('/settings/v3/users')

      const total = result.total ?? result.results.length
      const now = Date.now()
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      const admins = result.results.filter(u => u.superAdmin === true)
      const adminCount = admins.length

      const dormantAdmins = admins.filter(u => {
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).getTime() : 0
        return now - lastLogin > ninetyDaysMs
      }).length

      const activeUsers = result.results.filter(u => {
        if (u.active === false) return false
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).getTime() : 0
        return now - lastLogin <= thirtyDaysMs
      }).length

      return {
        security: {
          totalUsers: total,
          adminUsers: adminCount,
          dormantAdmins,
          usersWithoutMFA: null,
          rolesWithExcessivePrivilege: null,
          auditLogEnabled: null,
        },
        adoption: {
          monthlyActiveUsers: activeUsers,
          totalLicensedUsers: total,
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
    this.portalId = ''
  }

  private async apiGet<T>(path: string): Promise<T> {
    const url = path.startsWith('http') ? path : `${HUBSPOT_BASE}${path}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    })

    if (!res.ok) {
      throw new Error(`HubSpot API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  }
}

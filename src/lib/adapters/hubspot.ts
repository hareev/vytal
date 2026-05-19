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
      unusedEntities: 0,
      totalFields,
      unusedFields,
      deprecatedObjects: 0,
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
        circularDependencies: 0,
        maxNestingDepth: 0,
        flowsWithoutErrorHandling: 0,
        deprecatedApiCalls: 0,
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
        total: number
        results: Array<Record<string, unknown>>
      }>('/crm/v3/objects/contacts?limit=1&properties=email,firstname,lastname')

      const total = result.total ?? 0
      const incomplete = result.results.filter(c => {
        const props = c['properties'] as Record<string, string | null> | undefined
        return !props?.['email'] || !props?.['firstname']
      }).length

      return {
        totalRecordsSampled: total,
        duplicateCount: 0,
        incompleteRequiredFields: total > 0 ? Math.round((incomplete / result.results.length) * 100) : 0,
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
          usersWithoutMFA: 0,
          rolesWithExcessivePrivilege: 0,
          auditLogEnabled: false,
        },
        adoption: {
          monthlyActiveUsers: activeUsers,
          totalLicensedUsers: total,
          featureUtilisationPct: total > 0 ? Math.round((activeUsers / total) * 100) : 0,
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

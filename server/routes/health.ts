import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';

const router = new Hono();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDataverseGetter(baseUrl: string, token: string) {
  return async function apiGet<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });
    if (!res.ok) throw new Error(`Dataverse API error ${res.status}: ${path}`);
    return res.json() as Promise<T>;
  };
}

async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  scope: string,
): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope,
      }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(body['error_description'] ?? `Azure AD auth failed (${res.status})`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ─── POST /api/health/d365/scan ──────────────────────────────────────────────

const d365ScanSchema = z.object({
  orgUrl: z.string().url('Org URL must be a valid URL'),
  tenantId: z.string().min(1, 'Tenant ID is required'),
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
});

router.post('/d365/scan', authMiddleware, zValidator('json', d365ScanSchema), async (c) => {
  const { orgUrl, tenantId, clientId, clientSecret } = c.req.valid('json');
  const baseUrl = orgUrl.replace(/\/$/, '');

  // 1. Acquire Dataverse token
  let accessToken: string;
  try {
    accessToken = await getAzureToken(tenantId, clientId, clientSecret, `${baseUrl}/.default`);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 401);
  }

  const apiGet = makeDataverseGetter(baseUrl, accessToken);

  // 2. Fetch org identity + audit flag in one call
  let orgName = '';
  let orgId = '';
  let auditLogEnabled = false;
  try {
    const whoAmI = await apiGet<{ OrganizationId: string }>('/api/data/v9.2/WhoAmI()');
    orgId = whoAmI.OrganizationId;
    // 'uniquename' does not exist in all Dataverse versions — use 'name' + 'isauditenabled'
    const orgRecord = await apiGet<{ name: string; isauditenabled: boolean }>(
      `/api/data/v9.2/organizations(${orgId})?$select=name,isauditenabled`,
    );
    orgName = orgRecord.name || '';
    auditLogEnabled = orgRecord.isauditenabled ?? false;
  } catch (e) {
    return c.json({ error: `Could not reach Dataverse: ${(e as Error).message}` }, 502);
  }

  // 3. Fetch all health dimensions in parallel
  const [entities, flows, users, _duplicateRules, adminStats] = await Promise.all([
    apiGet<{ value: Array<{ IsCustomEntity: boolean; LogicalName: string; IsValidForAdvancedFind: boolean }> }>(
      '/api/data/v9.2/EntityDefinitions?$select=IsCustomEntity,LogicalName,IsActivity,IsValidForAdvancedFind',
    ).catch(() => ({ value: [] })),

    apiGet<{ value: Array<{ statecode: number; category: number }> }>(
      '/api/data/v9.2/workflows?$select=statecode,category,name&$filter=category eq 5 or category eq 6',
    ).catch(() => ({ value: [] })),

    apiGet<{ value: Array<{ isdisabled: boolean; accessmode: number; islicensed: boolean }> }>(
      '/api/data/v9.2/systemusers?$select=isdisabled,accessmode,islicensed&$filter=accessmode ne 4',
    ).catch(() => ({ value: [] })),

    apiGet<{ value: Array<{ statecode: number }> }>(
      '/api/data/v9.2/duplicaterules?$select=statecode',
    ).catch(() => ({ value: [] })),

    // Admin role members
    apiGet<{ value: Array<{ roleid: string }> }>(
      `/api/data/v9.2/roles?$select=roleid&$filter=name eq 'System Administrator'&$top=1`,
    ).then(async (roleRes) => {
      if (roleRes.value.length === 0) return { adminCount: 0, dormantAdmins: 0 };
      const roleId = roleRes.value[0].roleid;
      const admins = await apiGet<{ value: Array<{ systemuserid: string; lastloggedin: string | null }> }>(
        `/api/data/v9.2/systemusers?$select=systemuserid,lastloggedin&$filter=systemuserroles_association/any(r: r/roleid eq ${roleId}) and accessmode ne 4`,
      );
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const dormant = admins.value.filter(u => {
        const last = u.lastloggedin ? new Date(u.lastloggedin).getTime() : 0;
        return Date.now() - last > ninetyDaysMs;
      }).length;
      return { adminCount: admins.value.length, dormantAdmins: dormant };
    }).catch(() => ({ adminCount: 0, dormantAdmins: 0 })),
  ]);

  const customEntities = entities.value.filter(e => e.IsCustomEntity);
  const licensed = users.value.filter(u => u.islicensed && !u.isdisabled).length;

  const connection = {
    id: orgId,
    platform: 'dynamics365' as const,
    orgName,
    orgUrl: baseUrl,
    connectedAt: new Date().toISOString(),
  };

  const payload = {
    connection,
    schema: {
      totalEntities: entities.value.length,
      customEntities: customEntities.length,
      unusedEntities: customEntities.filter(e => !e.IsValidForAdvancedFind).length,
      totalFields: 0,
      unusedFields: 0,
      deprecatedObjects: 0,
      namingViolations: 0,
    },
    automation: {
      totalFlows: flows.value.length,
      activeFlows: flows.value.filter(f => f.statecode === 1).length,
      inactiveFlows: flows.value.filter(f => f.statecode !== 1).length,
      circularDependencies: 0,
      maxNestingDepth: 0,
      flowsWithoutErrorHandling: 0,
      deprecatedApiCalls: 0,
    },
    dataQuality: {
      totalRecordsSampled: 0,
      duplicateCount: 0,
      incompleteRequiredFields: 0,
      staleRecords30d: 0,
      staleRecords90d: 0,
    },
    security: {
      totalUsers: users.value.length,
      adminUsers: adminStats.adminCount,
      dormantAdmins: adminStats.dormantAdmins,
      usersWithoutMFA: 0,
      rolesWithExcessivePrivilege: 0,
      auditLogEnabled,
    },
    adoption: {
      monthlyActiveUsers: licensed,
      totalLicensedUsers: licensed,
      featureUtilisationPct: 0,
      automationsPerActiveUser: 0,
      recentCustomisations30d: 0,
    },
  };

  return c.json({ connection, payload });
});

export default router;

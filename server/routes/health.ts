import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { generateHealthDiagnosis, healthDiagnosisRequestSchema } from '../lib/healthDiagnosis.js';

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
  let auditLogEnabled: boolean | null = null;
  try {
    const whoAmI = await apiGet<{ OrganizationId: string }>('/api/data/v9.2/WhoAmI()');
    orgId = whoAmI.OrganizationId;
    // 'uniquename' does not exist in all Dataverse versions — use 'name' + 'isauditenabled'
    const orgRecord = await apiGet<{ name: string; isauditenabled: boolean }>(
      `/api/data/v9.2/organizations(${orgId})?$select=name,isauditenabled`,
    );
    orgName = orgRecord.name || '';
    auditLogEnabled = typeof orgRecord.isauditenabled === 'boolean' ? orgRecord.isauditenabled : null;
  } catch (e) {
    return c.json({ error: `Could not reach Dataverse: ${(e as Error).message}` }, 502);
  }

  // 3. Fetch all health dimensions in parallel.
  // A failed query yields null, not an empty list, so the metrics it feeds are
  // reported as "not measured" instead of scoring as a healthy zero.
  const [entities, flows, users, adminStats] = await Promise.all([
    apiGet<{ value: Array<{ IsCustomEntity: boolean; LogicalName: string }> }>(
      '/api/data/v9.2/EntityDefinitions?$select=IsCustomEntity,LogicalName',
    ).catch(() => null),

    // Cloud flows (5) and desktop flows (6). Classic workflows, business rules,
    // actions and business process flows (0–4) are not counted yet.
    apiGet<{ value: Array<{ statecode: number; category: number }> }>(
      '/api/data/v9.2/workflows?$select=statecode,category,name&$filter=category eq 5 or category eq 6',
    ).catch(() => null),

    apiGet<{ value: Array<{ isdisabled: boolean; accessmode: number; islicensed: boolean }> }>(
      '/api/data/v9.2/systemusers?$select=isdisabled,accessmode,islicensed&$filter=accessmode ne 4',
    ).catch(() => null),

    // System Administrator role members. Dormancy needs each admin's last
    // sign-in, which Dataverse does not expose on systemuser; it has to come
    // from Microsoft Graph signInActivity (Entra ID P1/P2), so it is not
    // measured here.
    apiGet<{ value: Array<{ roleid: string }> }>(
      `/api/data/v9.2/roles?$select=roleid&$filter=name eq 'System Administrator'&$top=1`,
    ).then(async (roleRes) => {
      if (roleRes.value.length === 0) return { adminCount: null };
      const roleId = roleRes.value[0].roleid;
      const admins = await apiGet<{ value: Array<{ systemuserid: string }> }>(
        `/api/data/v9.2/systemusers?$select=systemuserid&$filter=systemuserroles_association/any(r: r/roleid eq ${roleId}) and accessmode ne 4`,
      );
      return { adminCount: admins.value.length as number | null };
    }).catch(() => ({ adminCount: null })),
  ]);

  const customEntities = entities ? entities.value.filter(e => e.IsCustomEntity) : null;
  const licensed = users ? users.value.filter(u => u.islicensed && !u.isdisabled).length : null;

  const connection = {
    id: orgId,
    platform: 'dynamics365' as const,
    orgName,
    orgUrl: baseUrl,
    connectedAt: new Date().toISOString(),
  };

  // null = not measured. Only fill a metric this route actually queried.
  const payload = {
    connection,
    schema: {
      totalEntities: entities ? entities.value.length : null,
      customEntities: customEntities ? customEntities.length : null,
      unusedEntities: null,
      totalFields: null,
      unusedFields: null,
      deprecatedObjects: null,
      namingViolations: null,
    },
    automation: {
      totalFlows: flows ? flows.value.length : null,
      activeFlows: flows ? flows.value.filter(f => f.statecode === 1).length : null,
      inactiveFlows: flows ? flows.value.filter(f => f.statecode !== 1).length : null,
      circularDependencies: null,
      maxNestingDepth: null,
      flowsWithoutErrorHandling: null,
      deprecatedApiCalls: null,
    },
    dataQuality: {
      totalRecordsSampled: null,
      duplicateCount: null,
      incompleteRequiredFields: null,
      staleRecords30d: null,
      staleRecords90d: null,
    },
    security: {
      totalUsers: users ? users.value.length : null,
      adminUsers: adminStats.adminCount,
      dormantAdmins: null,
      usersWithoutMFA: null,
      rolesWithExcessivePrivilege: null,
      auditLogEnabled,
    },
    adoption: {
      monthlyActiveUsers: null,
      totalLicensedUsers: licensed,
      featureUtilisationPct: null,
      automationsPerActiveUser: null,
      recentCustomisations30d: null,
    },
  };

  return c.json({ connection, payload });
});

// ─── POST /api/health/diagnosis ──────────────────────────────────────────────
// AI triage of a scored health report. Runs server-side so the Anthropic key
// stays out of the browser bundle.

router.post('/diagnosis', authMiddleware, zValidator('json', healthDiagnosisRequestSchema), async (c) => {
  try {
    const diagnosis = await generateHealthDiagnosis(c.req.valid('json'));
    return c.json(diagnosis);
  } catch (e) {
    const message = (e as Error).message;
    const status = message.includes('not configured') ? 503 : 502;
    return c.json({ error: message }, status);
  }
});

export default router;

/**
 * Diagnostic script for Dataverse connectivity.
 * Run: node --env-file=.env --import tsx/esm scripts/test-d365.ts
 *
 * Reads from .env — uses the same var names already present:
 *   APP_URL         e.g. https://yourorg.crm.dynamics.com
 *   TENANT_ID
 *   CLIENT_ID
 *   CLIENT_SECRET
 */

const ORG_URL        = process.env.APP_URL        ?? ''
const TENANT_ID      = process.env.TENANT_ID      ?? ''
const CLIENT_ID      = process.env.CLIENT_ID      ?? ''
const CLIENT_SECRET  = process.env.CLIENT_SECRET  ?? ''

const MISSING = ['APP_URL','TENANT_ID','CLIENT_ID','CLIENT_SECRET']
  .filter(k => !process.env[k])

if (MISSING.length) {
  console.error(`\nMissing env vars in .env: ${MISSING.join(', ')}\n`)
  process.exit(1)
}

const BASE_URL = ORG_URL.replace(/\/$/, '')

// ─── helpers ────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: `${BASE_URL}/.default`,
      }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, string>
    throw new Error(body['error_description'] ?? `Azure AD auth failed (${res.status})`)
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  console.log(`  Token acquired — expires in ${data.expires_in}s`)
  return data.access_token
}

async function dvGet(token: string, path: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const url = `${BASE_URL}${path}`
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
        Prefer: 'odata.include-annotations="*"',
      },
    })
    const body = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, body }
  } catch (e) {
    return { ok: false, status: 0, body: { error: (e as Error).message } }
  }
}

function check(label: string, result: { ok: boolean; status: number; body: unknown }) {
  const icon = result.ok ? '✓' : '✗'
  const status = result.status === 0 ? 'NETWORK ERROR' : result.status
  console.log(`\n${icon} [${status}] ${label}`)
  if (!result.ok || process.env.VERBOSE) {
    console.log('  ', JSON.stringify(result.body, null, 2).split('\n').slice(0, 12).join('\n  '))
  } else {
    // Print a brief summary of the returned data
    const body = result.body as Record<string, unknown>
    if (body && typeof body === 'object') {
      if ('value' in body && Array.isArray(body.value)) {
        const sample = (body.value as unknown[]).slice(0, 2)
        console.log(`   → ${(body.value as unknown[]).length} record(s). Sample: ${JSON.stringify(sample[0])}`)
      } else {
        const keys = Object.keys(body).filter(k => !k.startsWith('@'))
        const preview: Record<string, unknown> = {}
        keys.slice(0, 6).forEach(k => { preview[k] = body[k] })
        console.log('   →', JSON.stringify(preview))
      }
    }
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

console.log('\n=== Vytal D365 Connectivity Test ===')
console.log(`Org URL   : ${BASE_URL}`)
console.log(`Tenant ID : ${TENANT_ID}`)
console.log(`Client ID : ${CLIENT_ID}`)

let token: string
try {
  console.log('\n[1] Acquiring Azure AD token...')
  token = await getToken()
} catch (e) {
  console.error('\n✗ Auth failed:', (e as Error).message)
  process.exit(1)
}

console.log('\n[2] Testing Dataverse endpoints...')

// WhoAmI — baseline connectivity check
const whoAmI = await dvGet(token, '/api/data/v9.2/WhoAmI()')
check('WhoAmI()', whoAmI)
const orgId = whoAmI.ok ? (whoAmI.body as Record<string,string>).OrganizationId : null

// Organization queries
const orgTests = [
  [orgId ? `/api/data/v9.2/organizations(${orgId})?$select=name,isauditenabled` : null, 'organizations(<id>) — name + audit flag'],
  ['/api/data/v9.2/organizations?$top=1&$select=name,isauditenabled',           'organizations collection ($top=1)'],
  ['/api/data/v9.2/organizations',                                               'organizations (no $select — field discovery)'],
] as Array<[string | null, string]>

for (const [path, label] of orgTests) {
  if (!path) { console.log(`\n- [SKIP] ${label} (no orgId from WhoAmI)`); continue }
  const r = await dvGet(token, path)
  check(label, r)
}

// Other entities used by the health scan
const healthTests: Array<[string, string]> = [
  ['/api/data/v9.2/EntityDefinitions?$select=IsCustomEntity,LogicalName,IsValidForAdvancedFind', 'EntityDefinitions (no $top — metadata endpoint)'],
  ['/api/data/v9.2/workflows?$select=statecode,category&$filter=category eq 5 or category eq 6&$top=5', 'workflows (cloud flows)'],
  ['/api/data/v9.2/systemusers?$select=isdisabled,accessmode,islicensed&$filter=accessmode ne 4&$top=5', 'systemusers'],
  ['/api/data/v9.2/roles?$select=roleid,name&$filter=name eq \'System Administrator\'&$top=1', 'roles (System Administrator)'],
  ['/api/data/v9.2/duplicaterules?$select=statecode&$top=3', 'duplicaterules'],
]

console.log('\n[3] Testing health-scan endpoints...')
for (const [path, label] of healthTests) {
  const r = await dvGet(token, path)
  check(label, r)
}

console.log('\n=== Done ===\n')
console.log('Tip: set VERBOSE=1 to print full response bodies for passing tests.')

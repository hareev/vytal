#!/usr/bin/env node
// ─── Vytal command line ──────────────────────────────────────────────────────
//
//   npm run scan -- salesforce --target-org <alias> [--out <dir>] [--json]
//
// Uses the login the Salesforce CLI already holds (`sf org login web`), so no
// Connected App is needed. The access token is read from `sf org display`,
// kept in memory for the scan and never printed or written to disk.
// The scan only sends GET requests; it changes nothing in the org.

import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { SalesforceClient } from '../core/salesforce/client'
import { scanSalesforceOrg, type SalesforceScanResult } from '../core/salesforce/scan'
import { scoreHealthPayload } from '../src/lib/scoring/engine'
import type { ScoredHealthPayload } from '../src/types/health'

const VERSION = '0.1.0'
const run = promisify(execFile)

interface Args {
  command?: string
  platform?: string
  targetOrg?: string
  out: string
  json: boolean
  help: boolean
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { out: '.', json: false, help: false }
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--json') args.json = true
    else if (a === '--target-org' || a === '-o') args.targetOrg = argv[++i]
    else if (a.startsWith('--target-org=')) args.targetOrg = a.slice('--target-org='.length)
    else if (a === '--out') args.out = argv[++i] ?? '.'
    else if (a.startsWith('--out=')) args.out = a.slice('--out='.length)
    else positional.push(a)
  }
  // Accept both `scan salesforce` and plain `salesforce`.
  if (positional[0] === 'scan') positional.shift()
  args.command = 'scan'
  args.platform = positional[0]
  return args
}

const HELP = `Vytal ${VERSION}: CRM health scan

Usage:
  npm run scan -- salesforce --target-org <alias> [--out <dir>] [--json]

Options:
  -o, --target-org  Salesforce CLI alias or username to scan (required).
                    Log in first with: sf org login web --alias <alias>
  --out             Folder for the evidence file (default: current folder).
  --json            Print the full result as JSON instead of a summary.

The scan is read-only. The evidence file holds counts, setup names, stage
names and record IDs, never record contents or the access token.`

interface SfOrgDisplay {
  status: number
  message?: string
  result?: { accessToken?: string; instanceUrl?: string; username?: string; apiVersion?: string }
}

async function salesforceLogin(targetOrg: string): Promise<{ instanceUrl: string; accessToken: string }> {
  let stdout: string
  try {
    ;({ stdout } = await run('sf', ['org', 'display', '--target-org', targetOrg, '--json'], { maxBuffer: 1024 * 1024 }))
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: string }
    if (e.code === 'ENOENT') {
      throw new Error('The Salesforce CLI (sf) is not installed or not on PATH. Install it from https://developer.salesforce.com/tools/salesforcecli')
    }
    // sf exits non-zero with a JSON error body on stdout.
    stdout = e.stdout ?? ''
    if (!stdout) throw new Error(`sf org display failed for "${targetOrg}".`)
  }
  let parsed: SfOrgDisplay
  try {
    parsed = JSON.parse(stdout) as SfOrgDisplay
  } catch {
    throw new Error('Could not read the output of sf org display.')
  }
  const accessToken = parsed.result?.accessToken
  const instanceUrl = parsed.result?.instanceUrl
  if (parsed.status !== 0 || !accessToken || !instanceUrl) {
    throw new Error(`No usable Salesforce CLI login for "${targetOrg}"${parsed.message ? `: ${parsed.message.replace(/\.$/, '')}` : ''}. Run: sf org login web --alias ${targetOrg}`)
  }
  return { accessToken, instanceUrl }
}

export interface EvidenceFile {
  tool: 'vytal'
  version: string
  platform: 'salesforce'
  org: { id: string; name: string; instanceUrl: string }
  scannedAt: string
  scored: ScoredHealthPayload
  evidence: SalesforceScanResult['evidence']
  notMeasured: SalesforceScanResult['notMeasured']
  extras: SalesforceScanResult['extras']
}

export function buildEvidenceFile(result: SalesforceScanResult, scored: ScoredHealthPayload): EvidenceFile {
  return {
    tool: 'vytal',
    version: VERSION,
    platform: 'salesforce',
    org: { id: result.raw.connection.id, name: result.raw.connection.orgName, instanceUrl: result.raw.connection.orgUrl },
    scannedAt: scored.scannedAt.toISOString(),
    scored,
    evidence: result.evidence,
    notMeasured: result.notMeasured,
    extras: result.extras,
  }
}

export function formatSummary(file: EvidenceFile): string {
  const s = file.scored
  const lines: string[] = []
  const score = (n: number | null) => (n === null ? 'not measured' : String(n))
  lines.push(`Vytal health scan: ${file.org.name} (${file.org.instanceUrl})`)
  lines.push(`Overall score: ${score(s.overallScore)}   Checks measured: ${s.checksMeasured} of ${s.checksTotal}`)
  lines.push('')
  for (const d of Object.values(s.dimensions)) {
    lines.push(`  ${d.label.padEnd(18)} ${score(d.score).padStart(12)}   ${d.checksMeasured}/${d.checksTotal} checks`)
    for (const issue of d.issues) lines.push(`    [${issue.severity}] ${issue.title}`)
  }
  const ex = file.extras
  if (ex.securityHealthCheck) {
    lines.push('')
    lines.push(`Salesforce Security Health Check: ${ex.securityHealthCheck.score ?? 'no score'} (${ex.securityHealthCheck.highRiskSettings.length} high-risk settings)`)
  }
  if (ex.limitsNearMax && ex.limitsNearMax.length) {
    lines.push(`Org limits at 80% or more: ${ex.limitsNearMax.map(l => `${l.name} ${l.pctUsed}%`).join(', ')}`)
  }
  const unmeasured = file.notMeasured.filter(n => n.reason !== 'Not in the first Salesforce slice yet.')
  if (unmeasured.length) {
    lines.push('')
    lines.push('Could not measure:')
    for (const n of unmeasured) lines.push(`  ${n.metric}: ${n.reason}`)
  }
  return lines.join('\n')
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.help || !args.platform) {
    console.log(HELP)
    return args.help ? 0 : 1
  }
  if (args.platform !== 'salesforce') {
    console.error(`Only "salesforce" can be scanned from the command line so far (got "${args.platform}").`)
    return 1
  }
  if (!args.targetOrg) {
    console.error('Missing --target-org. Example: npm run scan -- salesforce --target-org my-org')
    return 1
  }

  const login = await salesforceLogin(args.targetOrg)
  const client = new SalesforceClient(login)
  if (!args.json) console.error(`Scanning ${login.instanceUrl} (read-only)...`)
  const result = await scanSalesforceOrg(client)
  const scored = scoreHealthPayload(result.raw)
  const file = buildEvidenceFile(result, scored)

  const outDir = resolve(args.out)
  await mkdir(outDir, { recursive: true })
  const stamp = file.scannedAt.replace(/[:.]/g, '-')
  const outPath = join(outDir, `vytal-salesforce-${file.org.id}-${stamp}.json`)
  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8')

  if (args.json) console.log(JSON.stringify(file, null, 2))
  else {
    console.log(formatSummary(file))
    console.log('')
    console.log(`Evidence written to ${outPath}`)
  }
  return 0
}

// Run only when executed directly, so tests can import the helpers.
const invokedDirectly = process.argv[1] && /cli[\\/]vytal\.ts$/.test(process.argv[1])
if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    code => { process.exitCode = code },
    err => {
      console.error(err instanceof Error ? err.message : String(err))
      process.exitCode = 1
    },
  )
}

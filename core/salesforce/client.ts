// ─── Salesforce read-only REST client ─────────────────────────────────────────
//
// A deliberately small client for scans. It only ever sends GET requests, so a
// scan cannot change anything in the org it reads. Callers pass in an access
// token they already hold (the CLI takes it from the Salesforce CLI's login);
// the client never stores or logs it.

export const SALESFORCE_API_VERSION = '62.0'

export type FetchLike = (url: string, init: { method: 'GET'; headers: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
}>

export class SalesforceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
  ) {
    super(message)
    this.name = 'SalesforceApiError'
  }
}

interface QueryPage<T> {
  totalSize: number
  done: boolean
  records: T[]
  nextRecordsUrl?: string
}

export interface QueryOptions {
  /** Use the Tooling API instead of the data API. */
  tooling?: boolean
  /** Stop paging after this many records. The result says if it was cut. */
  maxRecords?: number
}

export interface QueryResult<T> {
  records: T[]
  totalSize: number
  /** True when paging stopped at maxRecords before the end of the result. */
  truncated: boolean
}

export interface SalesforceClientOptions {
  instanceUrl: string
  accessToken: string
  apiVersion?: string
  fetch?: FetchLike
}

export class SalesforceClient {
  readonly instanceUrl: string
  readonly apiVersion: string
  private readonly accessToken: string
  private readonly fetchFn: FetchLike

  constructor(opts: SalesforceClientOptions) {
    this.instanceUrl = opts.instanceUrl.replace(/\/$/, '')
    this.accessToken = opts.accessToken
    this.apiVersion = opts.apiVersion ?? SALESFORCE_API_VERSION
    this.fetchFn = opts.fetch ?? (globalThis.fetch as unknown as FetchLike)
  }

  /** GET a path under the instance, e.g. `/services/data/v62.0/limits`. */
  async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.instanceUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      let message = `Salesforce API error ${res.status} on ${pathOnly(path)}`
      let errorCode: string | undefined
      try {
        const parsed = JSON.parse(body) as Array<{ message?: string; errorCode?: string }> | { message?: string; errorCode?: string }
        const first = Array.isArray(parsed) ? parsed[0] : parsed
        if (first?.message) message = `${message}: ${first.message}`
        errorCode = first?.errorCode
      } catch {
        // body was not JSON; keep the status-only message
      }
      throw new SalesforceApiError(message, res.status, errorCode)
    }
    return res.json() as Promise<T>
  }

  /** Path prefix for data or Tooling API calls at the configured version. */
  apiPath(tooling = false): string {
    return `/services/data/v${this.apiVersion}${tooling ? '/tooling' : ''}`
  }

  /** Run a SOQL query and follow nextRecordsUrl until done or maxRecords. */
  async query<T>(soql: string, opts: QueryOptions = {}): Promise<QueryResult<T>> {
    const max = opts.maxRecords ?? Number.POSITIVE_INFINITY
    let page = await this.get<QueryPage<T>>(`${this.apiPath(opts.tooling)}/query?q=${encodeURIComponent(soql)}`)
    const records: T[] = [...page.records]
    while (!page.done && page.nextRecordsUrl && records.length < max) {
      page = await this.get<QueryPage<T>>(page.nextRecordsUrl)
      records.push(...page.records)
    }
    const truncated = records.length > max || (!page.done && records.length >= max)
    return { records: records.slice(0, Number.isFinite(max) ? max : undefined), totalSize: page.totalSize, truncated }
  }

  /** Run a `SELECT COUNT() ...` query and return the count. */
  async count(soql: string, opts: Pick<QueryOptions, 'tooling'> = {}): Promise<number> {
    const page = await this.get<QueryPage<unknown>>(`${this.apiPath(opts.tooling)}/query?q=${encodeURIComponent(soql)}`)
    return page.totalSize
  }
}

function pathOnly(path: string): string {
  // Keep error messages short and free of query strings.
  return path.split('?')[0]
}

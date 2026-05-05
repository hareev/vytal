import type { RawHealthPayload, OrgConnection } from '@/types/health'

/**
 * BaseAdapter — implement this interface to add a new CRM platform to Vytal.
 *
 * Steps:
 * 1. Create src/lib/adapters/yourplatform.ts
 * 2. Implement this interface
 * 3. Register in src/lib/adapters/index.ts
 * 4. Add connection UI in src/components/connectors/
 */
export interface BaseAdapter {
  /** Human-readable platform name shown in the UI */
  readonly name: string

  /** Platform identifier — matches CRMPlatform union type */
  readonly platform: OrgConnection['platform']

  /**
   * Establish a connection to the CRM org.
   * Credentials are passed as a key/value map so the interface stays generic.
   * Store any tokens/session state internally — do not persist to localStorage.
   */
  connect(credentials: Record<string, string>): Promise<OrgConnection>

  /**
   * Validate that an existing connection is still live.
   * Called before each scan to avoid stale token errors.
   */
  validateConnection(): Promise<boolean>

  /**
   * Fetch raw health telemetry from the connected org.
   * This is the only method the scoring engine calls after connect().
   * Map your platform's API responses to RawHealthPayload.
   */
  fetchHealthPayload(): Promise<RawHealthPayload>

  /**
   * Optional: disconnect and clean up any stored session state.
   */
  disconnect?(): Promise<void>
}

// ─── Shared credential field descriptor (used to render connect forms) ────────

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
  required: boolean
  helpText?: string
}

export interface AdapterManifest {
  platform: OrgConnection['platform']
  name: string
  logoUrl?: string
  credentialFields: CredentialField[]
  docsUrl?: string
}
